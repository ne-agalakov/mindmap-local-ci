import assert from "node:assert/strict";
import test from "node:test";
import {
  buildOperationDiagnostics,
  heartbeatOperation,
  observationFromCheckpoint,
  operationLiveness,
  stageDurationSeconds,
  updateOperationObservation,
} from "../app/lib/operation-observability.ts";

const baseUpdate = {
  operationId: "run-1",
  stageKey: "candidates",
  stageLabel: "численные кандидаты",
  workKind: "local",
  runtimeState: "working",
  stallAfterMs: 20_000,
  modelLabel: "без AI",
  activity: "Сравниваю пары.",
  completed: 0,
  total: 4560,
};

test("stage timer survives progress updates and resets only on a real stage transition", () => {
  const started = updateOperationObservation(undefined, baseUpdate, "2026-07-23T10:00:00.000Z");
  const progressed = updateOperationObservation(started, {
    ...baseUpdate,
    completed: 192,
  }, "2026-07-23T10:00:05.000Z");
  assert.equal(progressed.stageStartedAt, started.stageStartedAt);
  assert.equal(progressed.lastProgressAt, "2026-07-23T10:00:05.000Z");

  const nextStage = updateOperationObservation(progressed, {
    ...baseUpdate,
    stageKey: "relations",
    stageLabel: "проверка связей",
    workKind: "ai",
    runtimeState: "waiting_ai",
    modelLabel: "deepseek-r1:8b",
  }, "2026-07-23T10:00:07.000Z");
  assert.equal(nextStage.stageStartedAt, "2026-07-23T10:00:07.000Z");
});

test("status-only updates do not falsify work progress", () => {
  const started = updateOperationObservation(undefined, baseUpdate, "2026-07-23T10:00:00.000Z");
  const saving = updateOperationObservation(started, {
    ...baseUpdate,
    runtimeState: "saving",
    activity: "Сохраняю checkpoint.",
  }, "2026-07-23T10:00:05.000Z");

  assert.equal(saving.lastProgressAt, started.lastProgressAt);
  assert.equal(saving.lastHeartbeatAt, "2026-07-23T10:00:05.000Z");
});

test("heartbeat proves UI life without falsifying work progress", () => {
  const started = updateOperationObservation(undefined, baseUpdate, "2026-07-23T10:00:00.000Z");
  const heartbeat = heartbeatOperation(started, "run-1", "2026-07-23T10:00:04.000Z");
  assert.equal(heartbeat.lastHeartbeatAt, "2026-07-23T10:00:04.000Z");
  assert.equal(heartbeat.lastProgressAt, "2026-07-23T10:00:00.000Z");
});

test("stale heartbeat or stale progress becomes possibly stalled only after the configured threshold", () => {
  const started = updateOperationObservation(undefined, baseUpdate, "2026-07-23T10:00:00.000Z");
  assert.equal(operationLiveness(started, Date.parse("2026-07-23T10:00:16.000Z")), "working");
  assert.equal(operationLiveness(started, Date.parse("2026-07-23T10:00:21.000Z")), "possibly_stalled");

  const paused = { ...started, runtimeState: "paused" };
  assert.equal(operationLiveness(paused, Date.parse("2026-07-23T10:10:00.000Z")), "paused");
});

test("stall threshold never drops below fifteen seconds", () => {
  const started = updateOperationObservation(undefined, {
    ...baseUpdate,
    stallAfterMs: 1_000,
  }, "2026-07-23T10:00:00.000Z");
  assert.equal(started.stallAfterMs, 15_000);
  assert.equal(operationLiveness(started, Date.parse("2026-07-23T10:00:14.000Z")), "working");
});

test("invalid active timestamps fail closed as possibly stalled", () => {
  const started = updateOperationObservation(undefined, baseUpdate, "2026-07-23T10:00:00.000Z");
  assert.equal(operationLiveness({ ...started, lastHeartbeatAt: "invalid" }), "possibly_stalled");
});

test("a restored checkpoint is explicitly paused and cannot look active", () => {
  const restored = observationFromCheckpoint({
    operationId: "run-1",
    stageKey: "hierarchy",
    stageLabel: "строгая иерархия",
    checkpointAt: "2026-07-23T10:00:00.000Z",
    workKind: "ai",
    modelLabel: "deepseek-r1:8b",
    activity: "Ждёт подтверждения.",
    completed: 10,
    total: 10,
  });
  assert.equal(restored.runtimeState, "paused");
  assert.equal(operationLiveness(restored, Date.parse("2026-07-23T11:00:00.000Z")), "paused");
  assert.equal(stageDurationSeconds(restored, Date.parse("2026-07-23T11:00:00.000Z")), undefined);
});

test("a paused stage freezes its duration at the pause transition", () => {
  const started = updateOperationObservation(undefined, baseUpdate, "2026-07-23T10:00:00.000Z");
  const paused = updateOperationObservation(started, {
    ...baseUpdate,
    runtimeState: "paused",
    activity: "Ожидает подтверждения.",
  }, "2026-07-23T10:00:12.000Z");

  assert.equal(paused.stageFinishedAt, "2026-07-23T10:00:12.000Z");
  assert.equal(stageDurationSeconds(paused, Date.parse("2026-07-23T10:01:00.000Z")), 12);
  assert.equal(stageDurationSeconds(paused, Date.parse("2026-07-23T11:00:00.000Z")), 12);
});

test("a terminal observation without a factual finish timestamp has unknown duration", () => {
  const started = updateOperationObservation(undefined, baseUpdate, "2026-07-23T10:00:00.000Z");
  const legacyTerminal = {
    ...started,
    runtimeState: "paused",
    stageFinishedAt: undefined,
  };
  assert.equal(stageDurationSeconds(legacyTerminal, Date.parse("2026-07-23T11:00:00.000Z")), undefined);
});

test("an explicitly resumed stage starts a new known timer", () => {
  const restored = observationFromCheckpoint({
    operationId: "run-legacy",
    stageKey: "hierarchy",
    stageLabel: "Строгая иерархия",
    checkpointAt: "2026-07-23T10:00:00.000Z",
    workKind: "local",
    modelLabel: "без AI",
    activity: "Восстановлена пауза.",
  });
  const resumed = updateOperationObservation(restored, {
    ...baseUpdate,
    operationId: "run-legacy",
    stageKey: "hierarchy",
    runtimeState: "working",
  }, "2026-07-23T11:00:00.000Z");

  assert.equal(resumed.stageStartedAt, "2026-07-23T11:00:00.000Z");
  assert.equal(resumed.stageDurationKnown, true);
  assert.equal(stageDurationSeconds(resumed, Date.parse("2026-07-23T11:00:05.000Z")), 5);
});


test("sanitized diagnostics exclude free-text activity and never invent call counters", () => {
  const observation = updateOperationObservation(undefined, {
    ...baseUpdate,
    stageLabel: "Личный текст не должен попасть в диагностику",
    activity: "Секретная мысль пользователя",
  }, "2026-07-23T10:00:00.000Z");
  const diagnostics = buildOperationDiagnostics(observation, {
    exportedAt: "2026-07-23T10:00:05.000Z",
    nowMs: Date.parse("2026-07-23T10:00:05.000Z"),
  });
  const serialized = JSON.stringify(diagnostics);

  assert.equal(diagnostics.format, "mindmap-operation-diagnostics");
  assert.equal(diagnostics.schemaVersion, 1);
  assert.equal(diagnostics.safety.networkCalls, "unknown");
  assert.equal(diagnostics.safety.modelCalls, "unknown");
  assert.equal(diagnostics.safety.automaticRetryAllowed, false);
  assert.equal(diagnostics.safety.automaticResumeAllowed, false);
  assert.equal(diagnostics.safety.automaticRestartAllowed, false);
  assert.equal(diagnostics.safety.personalDataIncluded, false);
  assert.equal(serialized.includes("Секретная мысль пользователя"), false);
  assert.equal(serialized.includes("Личный текст не должен попасть"), false);
});

test("sanitized diagnostics preserve explicit zero-call evidence", () => {
  const observation = updateOperationObservation(undefined, baseUpdate, "2026-07-23T10:00:00.000Z");
  const diagnostics = buildOperationDiagnostics(observation, {
    exportedAt: "2026-07-23T10:00:05.000Z",
    nowMs: Date.parse("2026-07-23T10:00:05.000Z"),
    networkCalls: 0,
    modelCalls: 0,
  });

  assert.equal(diagnostics.safety.networkCalls, 0);
  assert.equal(diagnostics.safety.modelCalls, 0);
  assert.equal(diagnostics.liveness, "working");
  assert.equal(diagnostics.stageDurationSeconds, 5);
  assert.equal(diagnostics.heartbeatAgeMs, 5_000);
  assert.equal(diagnostics.progressAgeMs, 5_000);
});
