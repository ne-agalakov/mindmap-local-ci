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

test("registry revision, previous pointer, generation, import, verification, and seal mismatches stop before promotion", () => {
  let aggregate = startAttempt("mismatch").aggregate;
  aggregate = mustSucceed(executeGenerationAttemptCommand(aggregate, {
    type: "consume_authorization",
    attemptId: aggregate.attemptId,
    authorizationId: SANITIZED_GENERATION_MANIFEST.authorization.authorizationId,
    meta: meta("mismatch-consume", aggregate, 2),
  }, sha256)).aggregate;

  mustReject(executeGenerationAttemptCommand(aggregate, {
    type: "verify_backup",
    attemptId: aggregate.attemptId,
    backup: { ...SANITIZED_VERIFIED_BACKUP, sha256: "f".repeat(64) },
    meta: meta("mismatch-backup", aggregate, 3),
  }, sha256), "backup_identity_mismatch");

  const { aggregate: sealed } = runToSealed("mismatch-sealed");
  const wrongRevision = { ...SANITIZED_REGISTRY_SNAPSHOT, revision: 8 };
  mustReject(executeGenerationAttemptCommand(sealed, {
    type: "mark_promotion_ready",
    attemptId: sealed.attemptId,
    registrySnapshot: wrongRevision,
    meta: meta("mismatch-revision", sealed, 40),
  }, sha256), "registry_revision_mismatch");

  const wrongPointer = {
    ...SANITIZED_REGISTRY_SNAPSHOT,
    activePointers: [{ ...SANITIZED_REGISTRY_SNAPSHOT.activePointers[0], generationId: "gen-competing-001", databaseName: `${GENERATION_DATABASE_PREFIX}gen-competing-001` }],
  };
  mustReject(executeGenerationAttemptCommand(sealed, {
    type: "mark_promotion_ready",
    attemptId: sealed.attemptId,
    registrySnapshot: wrongPointer,
    meta: meta("mismatch-pointer", sealed, 41),
  }, sha256), "active_pointer_mismatch");
});

test("pre-promotion interruption becomes terminal blocked recovery with no automatic resume or retry", () => {
  let aggregate = startAttempt("interrupt-pre").aggregate;
  aggregate = mustSucceed(executeGenerationAttemptCommand(aggregate, {
    type: "consume_authorization",
    attemptId: aggregate.attemptId,
    authorizationId: SANITIZED_GENERATION_MANIFEST.authorization.authorizationId,
    meta: meta("interrupt-pre-consume", aggregate, 2),
  }, sha256)).aggregate;

  const interrupted = mustSucceed(executeGenerationAttemptCommand(aggregate, {
    type: "interrupt",
    attemptId: aggregate.attemptId,
    checkpoint: "after_authorization_consume",
    reason: "terminal_closed",
    meta: meta("interrupt-pre-stop", aggregate, 3),
  }, sha256)).aggregate;

  assert.equal(interrupted.status, "blocked_recovery");
  const inspection = inspectGenerationAttempt(interrupted);
  assert.equal(inspection.terminal, true);
  assert.equal(inspection.retryAllowed, false);
  assert.equal(inspection.automaticResumeAllowed, false);
  assert.equal(inspection.recoveryAction, "offline_diagnosis");
  assert.deepEqual(inspection.availableCommands, []);

  mustReject(executeGenerationAttemptCommand(interrupted, {
    type: "verify_backup",
    attemptId: interrupted.attemptId,
    backup: SANITIZED_VERIFIED_BACKUP,
    meta: meta("interrupt-pre-illegal-resume", interrupted, 4),
  }, sha256), "attempt_terminal");
});

test("post-promotion failure requires explicit pointer rollback and never mutates generation payload", () => {
  const { aggregate: sealed, nextSecond } = runToSealed("rollback");
  let aggregate = mustSucceed(executeGenerationAttemptCommand(sealed, {
    type: "mark_promotion_ready",
    attemptId: sealed.attemptId,
    registrySnapshot: SANITIZED_REGISTRY_SNAPSHOT,
    meta: meta("rollback-ready", sealed, nextSecond),
  }, sha256)).aggregate;

  const activationReceipt = {
    ...aggregate.promotionPlan.receiptDraft,
    committedRegistryRevision: aggregate.promotionPlan.expectedRegistryRevision + 1,
    committedAt: at(nextSecond + 1),
    outcome: "committed",
  };
  aggregate = mustSucceed(executeGenerationAttemptCommand(aggregate, {
    type: "record_promotion_committed",
    attemptId: aggregate.attemptId,
    receipt: activationReceipt,
    meta: meta("rollback-activated", aggregate, nextSecond + 1),
  }, sha256)).aggregate;

  mustReject(executeGenerationAttemptCommand(aggregate, {
    type: "stop_attempt",
    attemptId: aggregate.attemptId,
    stopCode: "resolver_verification_failed",
    message: "cannot stop silently",
    meta: meta("rollback-silent-stop", aggregate, nextSecond + 2),
  }, sha256), "post_promotion_stop_requires_rollback");

  aggregate = mustSucceed(executeGenerationAttemptCommand(aggregate, {
    type: "require_rollback",
    attemptId: aggregate.attemptId,
    reasonCode: "resolver_hash_mismatch",
    message: "resolver did not verify the active generation",
    meta: meta("rollback-required", aggregate, nextSecond + 3),
  }, sha256)).aggregate;
  assert.equal(aggregate.status, "rollback_required");

  const currentRegistry = {
    registryName: CONTROL_REGISTRY_NAME,
    schemaVersion: SANITIZED_REGISTRY_SNAPSHOT.schemaVersion,
    revision: activationReceipt.committedRegistryRevision,
    activePointers: [activationReceipt.nextPointer],
  };
  const rollbackPlan = planRollback(aggregate, currentRegistry);
  assert.equal(rollbackPlan.payloadMutationRequired, false);
  assert.deepEqual(rollbackPlan.restoredPointer, SANITIZED_REGISTRY_SNAPSHOT.activePointers[0]);

  const rollbackReceipt = {
    ...rollbackPlan.receiptDraft,
    committedRegistryRevision: rollbackPlan.expectedRegistryRevision + 1,
    committedAt: at(nextSecond + 4),
    outcome: "rolled_back",
  };
  aggregate = mustSucceed(executeGenerationAttemptCommand(aggregate, {
    type: "record_rollback_committed",
    attemptId: aggregate.attemptId,
    receipt: rollbackReceipt,
    registrySnapshot: currentRegistry,
    meta: meta("rollback-commit", aggregate, nextSecond + 4),
  }, sha256)).aggregate;

  assert.equal(aggregate.status, "rolled_back");
  assert.equal(inspectGenerationAttempt(aggregate).retryAllowed, false);
  assert.equal(aggregate.manifest.expectedTargetSnapshotHash, SANITIZED_GENERATION_MANIFEST.expectedTargetSnapshotHash);
});

test("transition table is closed and event replay rejects gaps or impossible transitions", () => {
  assert.equal(canTransitionAttempt("planned", "authorization_consumed"), true);
  assert.equal(canTransitionAttempt("planned", "promotion_committed"), false);
  assert.deepEqual(ALLOWED_ATTEMPT_TRANSITIONS.completed, []);
  assert.deepEqual(ALLOWED_ATTEMPT_TRANSITIONS.blocked_recovery, []);

  const planned = startAttempt("replay");
  const invalidSequence = { ...planned.events[0], sequence: 2 };
  assert.throws(() => applyGenerationAttemptEvent(undefined, invalidSequence), /non_contiguous_attempt_event_sequence/);

  const impossible = {
    ...planned.events[0],
    type: "attempt_completed",
    sequence: 2,
  };
  assert.throws(() => applyGenerationAttemptEvent(planned.aggregate, impossible), /invalid_attempt_event_transition/);
});
