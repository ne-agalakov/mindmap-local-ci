import assert from "node:assert/strict";
import test from "node:test";
import { projectOperationCallCounters } from "../app/lib/operation-call-counters.ts";
import { updateOperationObservation } from "../app/lib/operation-observability.ts";

const operationId = "operation-counters-fixture";

function observation(overrides = {}) {
  return updateOperationObservation(undefined, {
    operationId,
    stageKey: "relations",
    stageLabel: "Проверка связей",
    workKind: "ai",
    runtimeState: "waiting_ai",
    stallAfterMs: 30_000,
    modelLabel: "fixture-model",
    activity: "fixture activity",
    ...overrides,
  }, "2026-08-01T10:00:00.000Z");
}

function decision(eventType, id, input = {}, output = {}, overrides = {}) {
  return {
    id,
    eventType,
    createdAt: "2026-08-01T10:00:00.000Z",
    engine: "offline",
    input,
    output,
    userAction: "fixture",
    ...overrides,
  };
}

test("offline/storage operation with no call journal has an explicit persisted zero", () => {
  const result = projectOperationCallCounters([], observation({
    workKind: "local",
    modelLabel: "без AI",
  }));
  assert.deepEqual(result, {
    operationId,
    networkCalls: 0,
    modelCalls: 0,
    confirmedNetworkCalls: 0,
    confirmedModelCalls: 0,
    unresolvedPlannedCalls: 0,
    source: "explicit_zero",
  });
});

test("completed model call produces exact persisted network and model counters", () => {
  const planned = decision("pipeline_ai_call_planned", "call-1", { operationId });
  const completed = decision(
    "pipeline_ai_call_completed",
    "complete-1",
    { operationId, callId: "call-1" },
    { completed: true },
    { engine: "ollama", model: "fixture-model" },
  );
  const result = projectOperationCallCounters([planned, completed], observation());
  assert.equal(result.networkCalls, 1);
  assert.equal(result.modelCalls, 1);
  assert.equal(result.source, "persisted_decision_journal");
});

test("returned HTTP failure counts as network but not confirmed model execution", () => {
  const planned = decision("pipeline_ai_call_planned", "call-2", { operationId });
  const completed = decision(
    "pipeline_ai_call_completed",
    "complete-2",
    { operationId, callId: "call-2" },
    { completed: false, status: 503 },
  );
  const result = projectOperationCallCounters([planned, completed], observation());
  assert.equal(result.networkCalls, 1);
  assert.equal(result.modelCalls, 0);
});

test("network-only configuration read is persisted without increasing model calls", () => {
  const planned = decision("operation_network_call_planned", "network-1", { operationId });
  const completed = decision(
    "operation_network_call_completed",
    "network-complete-1",
    { operationId, callId: "network-1" },
    { completed: true, status: 200 },
  );
  const result = projectOperationCallCounters([planned, completed], observation());
  assert.equal(result.networkCalls, 1);
  assert.equal(result.modelCalls, 0);
});

test("unmatched persisted planned call remains unknown after reload", () => {
  const result = projectOperationCallCounters([
    decision("pipeline_ai_call_planned", "uncertain-call", { operationId }),
  ], observation());
  assert.equal(result.networkCalls, "unknown");
  assert.equal(result.modelCalls, "unknown");
  assert.equal(result.unresolvedPlannedCalls, 1);
});

test("journal projection is isolated by operation/run identity", () => {
  const result = projectOperationCallCounters([
    decision("pipeline_ai_call_planned", "other-call", { runId: "other-run" }),
    decision("pipeline_ai_call_completed", "other-complete", { runId: "other-run", callId: "other-call" }, { completed: true }, { engine: "ollama" }),
  ], observation());
  assert.equal(result.networkCalls, "unknown");
  assert.equal(result.modelCalls, "unknown");
  assert.equal(result.source, "unknown");
});
