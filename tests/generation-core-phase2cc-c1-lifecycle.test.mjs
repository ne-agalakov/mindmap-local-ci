import assert from "node:assert/strict";
import test from "node:test";
import * as c1 from "./generation-core-phase2cc-c1-fixture.mjs";
const {
  ALLOWED_ATTEMPT_TRANSITIONS, CONTROL_REGISTRY_NAME, GENERATION_DATABASE_PREFIX,
  SANITIZED_GENERATION_MANIFEST, SANITIZED_GENERATION_SEAL, SANITIZED_GENERATION_VERIFICATION,
  SANITIZED_IMPORT_RESULT, SANITIZED_REGISTRY_SNAPSHOT, SANITIZED_RESOLVER_VERIFICATION,
  SANITIZED_VERIFIED_BACKUP, SANITIZED_VERIFIED_SOURCE, applyGenerationAttemptEvent,
  assertGenerationIdentity, assertGenerationManifest, canTransitionAttempt,
  createSanitizedGenerationAttemptEvidence, executeGenerationAttemptCommand,
  hashGenerationAttemptEvents, hashGenerationAttemptState, inspectGenerationAttempt,
  at, meta, mustReject, mustSucceed, planPromotion, planRollback, replayGenerationAttemptEvents,
  runToSealed, sha256, startAttempt,
} = c1;

test("C1 manifest is immutable, exact-bound, synthetic-only, and namespace-safe", () => {
  assert.doesNotThrow(() => assertGenerationManifest(SANITIZED_GENERATION_MANIFEST));
  assert.doesNotThrow(() => assertGenerationIdentity(SANITIZED_GENERATION_MANIFEST.generation));
  assert.equal(
    SANITIZED_GENERATION_MANIFEST.generation.databaseName,
    `${GENERATION_DATABASE_PREFIX}${SANITIZED_GENERATION_MANIFEST.generation.generationId}`,
  );

  const personal = structuredClone(SANITIZED_GENERATION_MANIFEST);
  personal.workspace = "personal";
  personal.source.workspace = "personal";
  personal.generation.workspace = "personal";
  assert.throws(() => assertGenerationManifest(personal), /personal_workspace_rejected/);

  const temporary = structuredClone(SANITIZED_GENERATION_MANIFEST.generation);
  temporary.databaseName = "mindmap-state-core-v1-phase2cb-dry-run-unsafe";
  assert.throws(() => assertGenerationIdentity(temporary), /generation_database_name_mismatch|temporary_namespace_rejected/);

  const wrongAuthorization = structuredClone(SANITIZED_GENERATION_MANIFEST);
  wrongAuthorization.authorization.artifact = { ...wrongAuthorization.authorization.artifact, archiveSha256: "f".repeat(64) };
  assert.throws(() => assertGenerationManifest(wrongAuthorization), /authorization_artifact_mismatch/);

  const personalCounts = structuredClone(SANITIZED_GENERATION_MANIFEST);
  personalCounts.source.counts.personalThoughts = 1;
  assert.throws(() => assertGenerationManifest(personalCounts), /personal_data_present/);
});

test("C1 full deterministic lifecycle is replayable and requires atomic pointer receipts", () => {
  const { aggregate: sealed, events, nextSecond } = runToSealed("full");
  assert.equal(sealed.status, "sealed");
  const frozenBefore = structuredClone(sealed);

  const plan = planPromotion(sealed, SANITIZED_REGISTRY_SNAPSHOT);
  assert.equal(plan.dataCopyRequired, false);
  assert.equal(plan.networkAllowed, false);
  assert.equal(plan.modelAllowed, false);
  assert.equal(plan.previousPointer?.generationId, "gen-sanitized-prev");
  assert.equal(plan.nextPointer.generationId, SANITIZED_GENERATION_MANIFEST.generation.generationId);
  assert.equal(plan.nextPointer.registryRevision, SANITIZED_REGISTRY_SNAPSHOT.revision + 1);
  assert.deepEqual(sealed, frozenBefore, "planning must not mutate the sealed aggregate");

  let result = mustSucceed(executeGenerationAttemptCommand(sealed, {
    type: "mark_promotion_ready",
    attemptId: sealed.attemptId,
    registrySnapshot: SANITIZED_REGISTRY_SNAPSHOT,
    meta: meta("full-promotion-ready", sealed, nextSecond),
  }, sha256));
  events.push(...result.events);
  let aggregate = result.aggregate;
  assert.equal(aggregate.status, "promotion_ready");

  const receipt = {
    ...aggregate.promotionPlan.receiptDraft,
    committedRegistryRevision: aggregate.promotionPlan.expectedRegistryRevision + 1,
    committedAt: at(nextSecond + 1),
    outcome: "committed",
  };
  result = mustSucceed(executeGenerationAttemptCommand(aggregate, {
    type: "record_promotion_committed",
    attemptId: aggregate.attemptId,
    receipt,
    meta: meta("full-promotion-commit", aggregate, nextSecond + 1),
  }, sha256));
  events.push(...result.events);
  aggregate = result.aggregate;
  assert.equal(aggregate.status, "promotion_committed");

  result = mustSucceed(executeGenerationAttemptCommand(aggregate, {
    type: "record_resolver_verified",
    attemptId: aggregate.attemptId,
    verification: SANITIZED_RESOLVER_VERIFICATION,
    meta: meta("full-resolver", aggregate, nextSecond + 2),
  }, sha256));
  events.push(...result.events);
  aggregate = result.aggregate;
  assert.equal(aggregate.status, "resolver_verified");

  result = mustSucceed(executeGenerationAttemptCommand(aggregate, {
    type: "complete_attempt",
    attemptId: aggregate.attemptId,
    meta: meta("full-complete", aggregate, nextSecond + 3),
  }, sha256));
  events.push(...result.events);
  aggregate = result.aggregate;

  assert.equal(aggregate.status, "completed");
  assert.deepEqual(replayGenerationAttemptEvents(events), aggregate);
  assert.equal(hashGenerationAttemptState(aggregate, sha256), hashGenerationAttemptState(replayGenerationAttemptEvents(events), sha256));
  assert.equal(hashGenerationAttemptEvents(events, sha256), hashGenerationAttemptEvents(structuredClone(events), sha256));
  assert.deepEqual(inspectGenerationAttempt(aggregate), {
    attemptId: aggregate.attemptId,
    status: "completed",
    revision: aggregate.revision,
    terminal: true,
    retryAllowed: false,
    automaticResumeAllowed: false,
    sourceOpenAllowed: false,
    productionWriteAllowed: false,
    networkAllowed: false,
    modelAllowed: false,
    recoveryAction: "none",
    availableCommands: [],
  });
});

test("one-shot authorization, command idempotency, and stale revision guards are deterministic", () => {
  let aggregate = startAttempt("guards").aggregate;
  const command = {
    type: "consume_authorization",
    attemptId: aggregate.attemptId,
    authorizationId: SANITIZED_GENERATION_MANIFEST.authorization.authorizationId,
    meta: meta("guards-consume", aggregate, 2),
  };
  const first = mustSucceed(executeGenerationAttemptCommand(aggregate, command, sha256));
  aggregate = first.aggregate;
  assert.equal(aggregate.status, "authorization_consumed");

  const duplicate = mustSucceed(executeGenerationAttemptCommand(aggregate, {
    ...command,
    meta: { ...command.meta, occurredAt: at(30) },
  }, sha256));
  assert.equal(duplicate.idempotent, true);
  assert.deepEqual(duplicate.events, []);
  assert.equal(duplicate.aggregate, aggregate);

  mustReject(executeGenerationAttemptCommand(aggregate, {
    ...command,
    authorizationId: "authorization-other",
    meta: { ...command.meta, occurredAt: at(31) },
  }, sha256), "idempotency_conflict");

  mustReject(executeGenerationAttemptCommand(aggregate, {
    type: "verify_backup",
    attemptId: aggregate.attemptId,
    backup: SANITIZED_VERIFIED_BACKUP,
    meta: {
      commandId: "guards-stale",
      occurredAt: at(32),
      expectedRevision: aggregate.revision - 1,
    },
  }, sha256), "stale_revision");

  mustReject(executeGenerationAttemptCommand(aggregate, {
    type: "consume_authorization",
    attemptId: aggregate.attemptId,
    authorizationId: SANITIZED_GENERATION_MANIFEST.authorization.authorizationId,
    meta: meta("guards-consume-again", aggregate, 33),
  }, sha256), "authorization_already_consumed");
});
