import assert from "node:assert/strict";
import test from "node:test";
import { restoreCheckpointExecutionContext } from "../app/lib/batch-run-state.ts";

function decision(eventType, runId, input = {}, overrides = {}) {
  return {
    id: `${runId}-${eventType}`,
    thoughtId: "synthetic-thought",
    eventType,
    input: { runId, ...input },
    output: {},
    confidence: 1,
    model: undefined,
    engine: "offline",
    userAction: "synthetic_fixture",
    createdAt: "2026-07-31T15:00:00.000Z",
    ...overrides,
  };
}

test("restored completion storage never inherits a historical model label", () => {
  const runId = "qwen-complete";
  const decisions = [
    decision("pipeline_preflight", runId, {}, { model: "qwen3:8b", engine: "ollama" }),
    decision("batch_completed", runId, { stage: "complete", zeroModelCalls: true }),
  ];

  assert.deepEqual(restoreCheckpointExecutionContext(decisions, runId, "complete"), {
    workKind: "storage",
    modelLabel: "без AI",
  });
});
