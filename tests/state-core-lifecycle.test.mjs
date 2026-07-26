import assert from "node:assert/strict";
import test from "node:test";
import {
  abandonRun,
  authorizeAttempt,
  beginAuthorizedAttempt,
  createRun,
  failStage,
  inspectRun,
  pauseStage,
  requestAttempt,
} from "../state-core/index.ts";

const identity = Object.freeze({
  runId: "lifecycle-run",
  workspace: "synthetic",
  datasetId: "approved-96-v1",
  orderVariant: "original",
  semanticModel: "qwen3:8b",
  embeddingModel: "embeddinggemma",
  pipelineVersion: "state-core-v1",
  buildId: "phase1-build-a",
  storageSchema: "mindmap-state-core-v1",
});

const runtime = Object.freeze({
  configuredSemanticModel: "qwen3:8b",
  configuredEmbeddingModel: "embeddinggemma",
  buildId: "phase1-build-a",
  storageSchema: "mindmap-state-core-v1",
  supportedPipelineVersions: ["state-core-v1"],
  compatibleSourceBuildIds: [],
});

const meta = (commandId, aggregate, second) => ({
  commandId,
  occurredAt: `2026-07-25T15:00:${String(second).padStart(2, "0")}.000Z`,
  expectedRevision: aggregate?.revision ?? 0,
});

function ok(result) {
  assert.equal(result.ok, true, result.ok ? undefined : result.rejection.message);
  return result;
}

function rejected(result, code) {
  assert.equal(result.ok, false);
  assert.equal(result.rejection.code, code);
}

test("pause, failure, and abandonment commands match advertised state actions", () => {
  let result = ok(createRun(identity, "clustering", meta("create", undefined, 1)));
  let aggregate = result.aggregate;

  result = ok(requestAttempt(aggregate, {
    attemptId: "attempt-pause",
    stage: "clustering",
    model: "qwen3:8b",
    inputHash: "sha256:pause-input",
    idempotencyKey: "pause-key",
  }, runtime, meta("request-pause", aggregate, 2)));
  aggregate = result.aggregate;

  result = ok(authorizeAttempt(aggregate, {
    attemptId: "attempt-pause",
    authorizationId: "pause-approval",
  }, runtime, meta("authorize-pause", aggregate, 3)));
  aggregate = result.aggregate;

  result = ok(beginAuthorizedAttempt(aggregate, {
    attemptId: "attempt-pause",
  }, runtime, meta("begin-pause", aggregate, 4)));
  aggregate = result.aggregate;
  assert.equal(inspectRun(aggregate, runtime).availableActions.includes("pause_stage"), true);

  result = ok(pauseStage(aggregate, {
    attemptId: "attempt-pause",
    reason: "user_requested",
  }, runtime, meta("pause", aggregate, 5)));
  aggregate = result.aggregate;
  assert.equal(aggregate.status, "paused");
  assert.equal(aggregate.activeAttemptId, undefined);
  assert.equal(aggregate.attempts.at(-1).status, "cancelled");

  result = ok(requestAttempt(aggregate, {
    attemptId: "attempt-fail",
    stage: "clustering",
    model: "qwen3:8b",
    inputHash: "sha256:fail-input",
    idempotencyKey: "fail-key",
  }, runtime, meta("request-fail", aggregate, 6)));
  aggregate = result.aggregate;
  assert.equal(inspectRun(aggregate, runtime).availableActions.includes("fail_stage"), true);

  result = ok(failStage(aggregate, {
    failureCode: "preflight_contract_failed",
  }, runtime, meta("fail", aggregate, 7)));
  aggregate = result.aggregate;
  assert.equal(aggregate.status, "failed");
  assert.equal(aggregate.failureCode, "preflight_contract_failed");
  assert.equal(aggregate.attempts.at(-1).status, "failed");
  assert.equal(aggregate.activeAttemptId, undefined);

  result = ok(abandonRun(aggregate, "superseded_by_clean_run", meta("abandon", aggregate, 8)));
  aggregate = result.aggregate;
  assert.equal(aggregate.status, "abandoned");
  assert.deepEqual(inspectRun(aggregate, runtime).availableActions, ["inspect"]);
  rejected(abandonRun(aggregate, "again", meta("abandon-again", aggregate, 9)), "invalid_transition");
});

test("pause and failure reject invalid lifecycle state", () => {
  const aggregate = ok(createRun(identity, "clustering", meta("create-invalid", undefined, 10))).aggregate;
  rejected(pauseStage(aggregate, {
    attemptId: "missing",
    reason: "invalid",
  }, runtime, meta("pause-invalid", aggregate, 11)), "invalid_transition");
  rejected(failStage(aggregate, {
    failureCode: "invalid",
  }, runtime, meta("fail-invalid", aggregate, 12)), "invalid_transition");
});
