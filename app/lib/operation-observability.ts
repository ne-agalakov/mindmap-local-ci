export type OperationWorkKind = "ai" | "local" | "storage";

export type OperationRuntimeState =
  | "working"
  | "waiting_ai"
  | "saving"
  | "paused"
  | "stopped"
  | "completed";

export type OperationObservation = {
  operationId: string;
  stageKey: string;
  stageLabel: string;
  workKind: OperationWorkKind;
  runtimeState: OperationRuntimeState;
  startedAt: string;
  stageStartedAt: string;
  stageFinishedAt?: string;
  stageDurationKnown?: boolean;
  lastProgressAt: string;
  lastHeartbeatAt: string;
  stallAfterMs: number;
  modelLabel: string;
  activity: string;
  completed?: number;
  total?: number;
};

export type OperationObservationUpdate = Pick<
  OperationObservation,
  "operationId" | "stageKey" | "stageLabel" | "workKind" | "runtimeState" | "stallAfterMs" | "modelLabel" | "activity"
> & {
  completed?: number;
  total?: number;
  progressed?: boolean;
};

export type OperationLiveness =
  | "working"
  | "waiting_ai"
  | "saving"
  | "paused"
  | "stopped"
  | "completed"
  | "possibly_stalled";


export type OperationDiagnosticsCounter = number | "unknown";

export type OperationDiagnostics = {
  format: "mindmap-operation-diagnostics";
  schemaVersion: 1;
  exportedAt: string;
  liveness: OperationLiveness;
  stageDurationSeconds?: number;
  heartbeatAgeMs?: number;
  progressAgeMs?: number;
  observation: Pick<
    OperationObservation,
    | "stageKey"
    | "workKind"
    | "runtimeState"
    | "startedAt"
    | "stageStartedAt"
    | "stageFinishedAt"
    | "stageDurationKnown"
    | "lastProgressAt"
    | "lastHeartbeatAt"
    | "stallAfterMs"
    | "modelLabel"
    | "completed"
    | "total"
  >;
  safety: {
    networkCalls: OperationDiagnosticsCounter;
    modelCalls: OperationDiagnosticsCounter;
    automaticRetryAllowed: false;
    automaticResumeAllowed: false;
    automaticRestartAllowed: false;
    personalDataIncluded: false;
  };
};

export function updateOperationObservation(
  current: OperationObservation | undefined,
  update: OperationObservationUpdate,
  now = new Date().toISOString(),
): OperationObservation {
  const sameOperation = current?.operationId === update.operationId;
  const sameStage = sameOperation && current?.stageKey === update.stageKey;
  const completedAdvanced = sameStage
    && typeof update.completed === "number"
    && (typeof current?.completed !== "number" || update.completed > current.completed);
  const progressed = update.progressed ?? (!current || !sameStage || completedAdvanced);
  const terminal = ["paused", "stopped", "completed"].includes(update.runtimeState);
  const currentTerminal = current
    ? ["paused", "stopped", "completed"].includes(current.runtimeState)
    : false;
  const resumedStage = sameStage && currentTerminal && !terminal;
  return {
    operationId: update.operationId,
    stageKey: update.stageKey,
    stageLabel: update.stageLabel,
    workKind: update.workKind,
    runtimeState: update.runtimeState,
    startedAt: sameOperation ? current.startedAt : now,
    stageStartedAt: sameStage && !resumedStage ? current.stageStartedAt : now,
    stageFinishedAt: terminal
      ? sameStage && current.stageFinishedAt
        ? current.stageFinishedAt
        : now
      : undefined,
    stageDurationKnown: sameStage && !resumedStage ? current.stageDurationKnown !== false : true,
    lastProgressAt: progressed
      ? now
      : sameStage
        ? current.lastProgressAt
        : now,
    lastHeartbeatAt: now,
    stallAfterMs: Math.max(15_000, update.stallAfterMs),
    modelLabel: update.modelLabel,
    activity: update.activity,
    completed: update.completed,
    total: update.total,
  };
}

export function heartbeatOperation(
  current: OperationObservation | undefined,
  operationId: string,
  now = new Date().toISOString(),
) {
  if (!current || current.operationId !== operationId) return current;
  return { ...current, lastHeartbeatAt: now };
}

export function operationLiveness(
  observation: OperationObservation,
  nowMs = Date.now(),
): OperationLiveness {
  if (observation.runtimeState === "paused") return "paused";
  if (observation.runtimeState === "stopped") return "stopped";
  if (observation.runtimeState === "completed") return "completed";

  const heartbeatAt = Date.parse(observation.lastHeartbeatAt);
  const progressAt = Date.parse(observation.lastProgressAt);
  if (!Number.isFinite(heartbeatAt) || !Number.isFinite(progressAt)) {
    return "possibly_stalled";
  }
  const heartbeatAge = Math.max(0, nowMs - heartbeatAt);
  const progressAge = Math.max(0, nowMs - progressAt);
  if (heartbeatAge > observation.stallAfterMs || progressAge > observation.stallAfterMs) {
    return "possibly_stalled";
  }
  return observation.runtimeState;
}

export function elapsedSeconds(iso: string, nowMs = Date.now()) {
  return Math.max(0, Math.floor((nowMs - Date.parse(iso)) / 1000));
}

export function stageDurationSeconds(
  observation: OperationObservation,
  nowMs = Date.now(),
) {
  if (observation.stageDurationKnown === false) return undefined;
  const terminal = ["paused", "stopped", "completed"].includes(observation.runtimeState);
  const startMs = Date.parse(observation.stageStartedAt);
  let endMs = nowMs;
  if (terminal) {
    if (!observation.stageFinishedAt) return undefined;
    endMs = Date.parse(observation.stageFinishedAt);
  }
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return undefined;
  return Math.max(0, Math.floor((endMs - startMs) / 1000));
}

export function observationFromCheckpoint(input: {
  operationId: string;
  stageKey: string;
  stageLabel: string;
  checkpointAt: string;
  workKind: OperationWorkKind;
  modelLabel: string;
  activity: string;
  completed?: number;
  total?: number;
}): OperationObservation {
  return {
    operationId: input.operationId,
    stageKey: input.stageKey,
    stageLabel: input.stageLabel,
    workKind: input.workKind,
    runtimeState: "paused",
    startedAt: input.checkpointAt,
    stageStartedAt: input.checkpointAt,
    stageFinishedAt: input.checkpointAt,
    stageDurationKnown: false,
    lastProgressAt: input.checkpointAt,
    lastHeartbeatAt: input.checkpointAt,
    stallAfterMs: 30_000,
    modelLabel: input.modelLabel,
    activity: input.activity,
    completed: input.completed,
    total: input.total,
  };
}

export function buildOperationDiagnostics(
  observation: OperationObservation,
  input: {
    exportedAt?: string;
    nowMs?: number;
    networkCalls?: number;
    modelCalls?: number;
  } = {},
): OperationDiagnostics {
  const exportedAt = input.exportedAt ?? new Date().toISOString();
  const nowMs = input.nowMs ?? Date.parse(exportedAt);
  return {
    format: "mindmap-operation-diagnostics",
    schemaVersion: 1,
    exportedAt,
    liveness: operationLiveness(observation, nowMs),
    stageDurationSeconds: stageDurationSeconds(observation, nowMs),
    heartbeatAgeMs: ageMs(observation.lastHeartbeatAt, nowMs),
    progressAgeMs: ageMs(observation.lastProgressAt, nowMs),
    observation: {
      stageKey: observation.stageKey,
      workKind: observation.workKind,
      runtimeState: observation.runtimeState,
      startedAt: observation.startedAt,
      stageStartedAt: observation.stageStartedAt,
      stageFinishedAt: observation.stageFinishedAt,
      stageDurationKnown: observation.stageDurationKnown,
      lastProgressAt: observation.lastProgressAt,
      lastHeartbeatAt: observation.lastHeartbeatAt,
      stallAfterMs: observation.stallAfterMs,
      modelLabel: observation.modelLabel,
      completed: observation.completed,
      total: observation.total,
    },
    safety: {
      networkCalls: knownCounter(input.networkCalls),
      modelCalls: knownCounter(input.modelCalls),
      automaticRetryAllowed: false,
      automaticResumeAllowed: false,
      automaticRestartAllowed: false,
      personalDataIncluded: false,
    },
  };
}

function ageMs(iso: string, nowMs: number) {
  const value = Date.parse(iso);
  return Number.isFinite(value) && Number.isFinite(nowMs)
    ? Math.max(0, nowMs - value)
    : undefined;
}

function knownCounter(value: number | undefined): OperationDiagnosticsCounter {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? Math.floor(value)
    : "unknown";
}

