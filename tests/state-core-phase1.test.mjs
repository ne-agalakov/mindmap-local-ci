import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  ALLOWED_STATUS_TRANSITIONS,
  authorizeAttempt,
  beginAuthorizedAttempt,
  blockContinuation,
  canTransition,
  classifyPlacementReference,
  completeStage,
  confirmStageSaved,
  createRun,
  inspectRun,
  recordProgress,
  replayRunEvents,
  requestAttempt,
  startCleanRun,
} from "../state-core/index.ts";

const at = (second) => `2026-07-25T14:00:${String(second).padStart(2, "0")}.000Z`;
const meta = (commandId, aggregate, second) => ({
  commandId,
  occurredAt: at(second),
  expectedRevision: aggregate?.revision ?? 0,
});

const qwenIdentity = Object.freeze({
  runId: "run-qwen-original",
  workspace: "synthetic",
  datasetId: "approved-96-v1",
  orderVariant: "original",
  semanticModel: "qwen3:8b",
  embeddingModel: "embeddinggemma",
  pipelineVersion: "state-core-v1",
  buildId: "phase1-build-a",
  storageSchema: "mindmap-state-core-v1",
});

const qwenRuntime = Object.freeze({
  configuredSemanticModel: "qwen3:8b",
  configuredEmbeddingModel: "embeddinggemma",
  buildId: "phase1-build-a",
  storageSchema: "mindmap-state-core-v1",
  supportedPipelineVersions: ["state-core-v1"],
  compatibleSourceBuildIds: [],
});

function mustSucceed(result) {
  assert.equal(result.ok, true, result.ok ? undefined : result.rejection.message);
  return result;
}

function mustReject(result, code) {
  assert.equal(result.ok, false);
  assert.equal(result.rejection.code, code);
  return result;
}

test("exact accepted Alpha.19 fixture derives immediate Qwen-to-DeepSeek block without a click", async () => {
  const fixture = JSON.parse(await readFile(
    new URL("../fixtures/legacy/browser-database-inspection.json", import.meta.url),
    "utf8",
  ));
  const historical = Object.freeze({
    identity: Object.freeze({
      runId: fixture.activeRun.runId,
      workspace: "synthetic",
      datasetId: fixture.activeRun.dataset,
      orderVariant: fixture.activeRun.orderVariant,
      semanticModel: fixture.activeRun.runModel,
      embeddingModel: "embeddinggemma",
      pipelineVersion: fixture.activeRun.pipelineVersions.at(-1),
      buildId: "legacy-alpha19",
      storageSchema: "legacy-sqljs-v060",
    }),
    status: "paused",
    stage: fixture.activeRun.currentStage,
    revision: fixture.database.tables.aiDecisions,
    attempts: Object.freeze([]),
    completedStages: Object.freeze([
      "preflight",
      "extraction",
      "embeddings",
      "clustering",
      "hierarchy",
      "projects_and_placement",
      "candidates",
    ]),
  });
  const deepseekRuntime = Object.freeze({
    configuredSemanticModel: fixture.activeRun.configuredModel,
    configuredEmbeddingModel: "embeddinggemma",
    buildId: "phase1-build-a",
    storageSchema: "legacy-sqljs-v060",
    supportedPipelineVersions: [fixture.activeRun.pipelineVersions.at(-1)],
    compatibleSourceBuildIds: ["legacy-alpha19"],
  });

  const before = structuredClone(historical);
  const first = inspectRun(historical, deepseekRuntime);
  const second = inspectRun(historical, deepseekRuntime);

  assert.deepEqual(historical, before, "inspection must not mutate the accepted fixture projection");
  assert.deepEqual(second, first, "reload/inspection projection must be deterministic");
  assert.equal(first.persistedStatus, "paused");
  assert.equal(first.effectiveStatus, "blocked");
  assert.equal(first.block?.reason, "run_model_mismatch");
  assert.equal(first.requiresContinuationClick, false);
  assert.equal(first.aiCallAllowed, false);
  assert.equal(first.availableActions.includes("begin_attempt"), false);
  assert.equal(first.availableActions.includes("start_clean_run"), true);
});

test("authorized attempt lifecycle is explicit, replayable, and AI is allowed only while the authorized attempt runs", () => {
  const allEvents = [];
  let result = mustSucceed(createRun(qwenIdentity, "extraction", meta("create", undefined, 1)));
  allEvents.push(...result.events);
  let aggregate = result.aggregate;
  assert.equal(inspectRun(aggregate, qwenRuntime).aiCallAllowed, false);

  result = mustSucceed(requestAttempt(aggregate, {
    attemptId: "attempt-1",
    stage: "extraction",
    model: "qwen3:8b",
    inputHash: "sha256:input-1",
    idempotencyKey: "run-qwen-original:extraction:1",
  }, qwenRuntime, meta("request", aggregate, 2)));
  allEvents.push(...result.events);
  aggregate = result.aggregate;
  assert.equal(aggregate.status, "awaiting_authorization");
  assert.equal(inspectRun(aggregate, qwenRuntime).aiCallAllowed, false);

  const duplicateRequest = mustSucceed(requestAttempt(aggregate, {
    attemptId: "attempt-1",
    stage: "extraction",
    model: "qwen3:8b",
    inputHash: "sha256:input-1",
    idempotencyKey: "run-qwen-original:extraction:1",
  }, qwenRuntime, meta("request-duplicate", aggregate, 3)));
  assert.equal(duplicateRequest.idempotent, true);
  assert.deepEqual(duplicateRequest.events, []);
  assert.equal(duplicateRequest.aggregate, aggregate);

  result = mustSucceed(authorizeAttempt(aggregate, {
    attemptId: "attempt-1",
    authorizationId: "user-approval-1",
  }, qwenRuntime, meta("authorize", aggregate, 4)));
  allEvents.push(...result.events);
  aggregate = result.aggregate;
  assert.equal(inspectRun(aggregate, qwenRuntime).aiCallAllowed, false);

  const duplicateAuthorization = mustSucceed(authorizeAttempt(aggregate, {
    attemptId: "attempt-1",
    authorizationId: "user-approval-1",
  }, qwenRuntime, meta("authorize-duplicate", aggregate, 5)));
  assert.equal(duplicateAuthorization.idempotent, true);
  assert.deepEqual(duplicateAuthorization.events, []);

  result = mustSucceed(beginAuthorizedAttempt(aggregate, {
    attemptId: "attempt-1",
  }, qwenRuntime, meta("begin", aggregate, 6)));
  allEvents.push(...result.events);
  aggregate = result.aggregate;
  assert.equal(aggregate.status, "running");
  assert.equal(inspectRun(aggregate, qwenRuntime).aiCallAllowed, true);

  result = mustSucceed(recordProgress(aggregate, {
    attemptId: "attempt-1",
    completed: 12,
    total: 96,
    heartbeatAt: at(7),
    message: "12/96",
  }, qwenRuntime, meta("progress", aggregate, 7)));
  allEvents.push(...result.events);
  aggregate = result.aggregate;
  assert.deepEqual(aggregate.progress, {
    completed: 12,
    total: 96,
    heartbeatAt: at(7),
    message: "12/96",
  });

  result = mustSucceed(completeStage(aggregate, {
    attemptId: "attempt-1",
    artifactHash: "sha256:artifact-1",
  }, qwenRuntime, meta("complete", aggregate, 8)));
  allEvents.push(...result.events);
  aggregate = result.aggregate;
  assert.equal(aggregate.status, "saving");
  assert.equal(inspectRun(aggregate, qwenRuntime).aiCallAllowed, false);

  result = mustSucceed(confirmStageSaved(aggregate, {
    nextStage: "embeddings",
    final: false,
  }, qwenRuntime, meta("saved", aggregate, 9)));
  allEvents.push(...result.events);
  aggregate = result.aggregate;
  assert.equal(aggregate.status, "paused");
  assert.equal(aggregate.stage, "embeddings");
  assert.deepEqual(aggregate.completedStages, ["extraction"]);
  assert.equal(aggregate.activeAttemptId, undefined);
  assert.deepEqual(replayRunEvents(allEvents), aggregate);
});

test("authorization, revision, model, and idempotency guards reject unsafe commands", () => {
  let result = mustSucceed(createRun(qwenIdentity, "extraction", meta("create-guards", undefined, 10)));
  let aggregate = result.aggregate;

  mustReject(beginAuthorizedAttempt(aggregate, { attemptId: "missing" }, qwenRuntime, meta("begin-missing", aggregate, 11)), "invalid_transition");
  mustReject(requestAttempt(aggregate, {
    attemptId: "attempt-wrong-model",
    stage: "extraction",
    model: "deepseek-r1:8b",
    inputHash: "sha256:input",
    idempotencyKey: "wrong-model",
  }, qwenRuntime, meta("wrong-model", aggregate, 12)), "model_mismatch");

  result = mustSucceed(requestAttempt(aggregate, {
    attemptId: "attempt-guarded",
    stage: "extraction",
    model: "qwen3:8b",
    inputHash: "sha256:input-a",
    idempotencyKey: "same-key",
  }, qwenRuntime, meta("request-guarded", aggregate, 13)));
  aggregate = result.aggregate;

  mustReject(requestAttempt(aggregate, {
    attemptId: "attempt-other",
    stage: "extraction",
    model: "qwen3:8b",
    inputHash: "sha256:input-b",
    idempotencyKey: "same-key",
  }, qwenRuntime, meta("idempotency-conflict", aggregate, 14)), "idempotency_conflict");

  mustReject(authorizeAttempt(aggregate, {
    attemptId: "attempt-guarded",
    authorizationId: "approval",
  }, qwenRuntime, {
    commandId: "stale",
    occurredAt: at(15),
    expectedRevision: aggregate.revision - 1,
  }), "stale_revision");

  mustReject(beginAuthorizedAttempt(aggregate, {
    attemptId: "attempt-guarded",
  }, qwenRuntime, meta("begin-before-auth", aggregate, 16)), "attempt_not_startable");
});

test("blocked run cannot resume and a clean run preserves dataset/order while changing run identity", () => {
  let result = mustSucceed(createRun(qwenIdentity, "relations", meta("create-block", undefined, 20)));
  let aggregate = result.aggregate;
  result = mustSucceed(blockContinuation(aggregate, {
    reason: "explicitly_blocked",
    expected: "qwen3:8b",
    actual: "deepseek-r1:8b",
  }, meta("block", aggregate, 21)));
  aggregate = result.aggregate;
  assert.equal(aggregate.status, "blocked");
  assert.equal(canTransition("blocked", "running"), false);
  assert.deepEqual(ALLOWED_STATUS_TRANSITIONS.blocked, ["abandoned"]);

  const deepseekIdentity = {
    ...qwenIdentity,
    runId: "run-deepseek-original",
    semanticModel: "deepseek-r1:8b",
    buildId: "phase1-build-b",
  };
  const clean = mustSucceed(startCleanRun(aggregate, deepseekIdentity, "preflight", meta("clean-run", aggregate, 22)));
  assert.equal(clean.aggregate.identity.runId, "run-deepseek-original");
  assert.equal(clean.aggregate.identity.datasetId, aggregate.identity.datasetId);
  assert.equal(clean.aggregate.identity.orderVariant, aggregate.identity.orderVariant);
  assert.equal(clean.aggregate.status, "created");
  assert.equal(aggregate.status, "blocked", "historical aggregate must remain unchanged");

  mustReject(startCleanRun(aggregate, {
    ...deepseekIdentity,
    runId: "different-order-run",
    orderVariant: "reverse",
  }, "preflight", meta("clean-wrong-order", aggregate, 23)), "identity_conflict");
});

test("unresolved markers remain distinct from damaged references", () => {
  const targets = new Map([
    ["area-1", { id: "area-1", kind: "area" }],
    ["direction-1", { id: "direction-1", kind: "direction" }],
    ["project-1", { id: "project-1", kind: "project" }],
  ]);
  assert.deepEqual(classifyPlacementReference(null, targets), { kind: "unresolved", marker: null });
  assert.deepEqual(classifyPlacementReference("__unmatched__", targets), { kind: "unresolved", marker: "__unmatched__" });
  assert.deepEqual(classifyPlacementReference("missing", targets), {
    kind: "damaged_reference",
    targetId: "missing",
    reason: "missing_target",
  });
  assert.deepEqual(classifyPlacementReference("area-1", targets), {
    kind: "damaged_reference",
    targetId: "area-1",
    reason: "invalid_target_type",
    actualKind: "area",
  });
  assert.deepEqual(classifyPlacementReference("direction-1", targets), {
    kind: "resolved",
    targetId: "direction-1",
    targetKind: "direction",
  });
});

test("pure state-core has no React, storage, browser, filesystem, network, or model-service dependency", async () => {
  const files = [
    new URL("../domain/run.ts", import.meta.url),
    new URL("../domain/references.ts", import.meta.url),
    new URL("../state-core/run-state-core.ts", import.meta.url),
  ];
  const source = (await Promise.all(files.map((file) => readFile(file, "utf8")))).join("\n").toLowerCase();
  for (const forbidden of [
    "from \"react",
    "indexeddb",
    "sql.js",
    "node:fs",
    "node:http",
    "node:https",
    "fetch(",
    "ollama",
    "127.0.0.1:11434",
    "/api/generate",
    "math.random",
    "date.now",
    "new date(",
  ]) {
    assert.equal(source.includes(forbidden), false, `forbidden pure-core dependency: ${forbidden}`);
  }
});
