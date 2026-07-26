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

export function updateOperationObservation(
  current: OperationObservation | undefined,
  update: OperationObservationUpdate,
  now = new Date().toISOString(),
): OperationObservation {
  const sameOperation = current?.operationId === update.operationId;
  const sameStage = sameOperation && current?.stageKey === update.stageKey;
  const progressed = update.progressed !== false;
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
    stallAfterMs: update.stallAfterMs,
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

  const heartbeatAge = Math.max(0, nowMs - Date.parse(observation.lastHeartbeatAt));
  const progressAge = Math.max(0, nowMs - Date.parse(observation.lastProgressAt));
  const heartbeatLimit = Math.min(15_000, observation.stallAfterMs);
  if (heartbeatAge > heartbeatLimit || progressAge > observation.stallAfterMs) {
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
  const endMs = terminal
    ? Date.parse(observation.stageFinishedAt ?? observation.lastProgressAt)
    : nowMs;
  return Math.max(0, Math.floor((endMs - Date.parse(observation.stageStartedAt)) / 1000));
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
