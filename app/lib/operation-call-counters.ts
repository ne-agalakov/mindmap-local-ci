import type {
  OperationDiagnosticsCounter,
  OperationObservation,
} from "./operation-observability";

export type OperationCallDecision = {
  id: string;
  eventType: string;
  engine: string;
  input?: unknown;
  output?: unknown;
};

export type PersistedOperationCallCounters = {
  operationId: string;
  networkCalls: OperationDiagnosticsCounter;
  modelCalls: OperationDiagnosticsCounter;
  confirmedNetworkCalls: number;
  confirmedModelCalls: number;
  unresolvedPlannedCalls: number;
  source: "persisted_decision_journal" | "explicit_zero" | "unknown";
};

export function projectOperationCallCounters(
  decisions: OperationCallDecision[],
  observation: OperationObservation,
): PersistedOperationCallCounters {
  const operationId = observation.operationId;
  const planned = decisions.filter((decision) =>
    isPlannedCall(decision.eventType) && decisionScope(decision) === operationId
  );
  const plannedIds = new Set(planned.map((decision) => decision.id));
  const completed = decisions.filter((decision) => {
    if (!isCompletedCall(decision.eventType)) return false;
    const callId = decisionCallId(decision);
    return decisionScope(decision) === operationId
      || Boolean(callId && plannedIds.has(callId));
  });
  const completedCallIds = new Set(
    completed.flatMap((decision) => {
      const callId = decisionCallId(decision);
      return callId ? [callId] : [];
    }),
  );
  const unresolvedPlannedCalls = planned.filter(
    (decision) => !completedCallIds.has(decision.id),
  ).length;
  const confirmedNetworkCalls = uniqueCompletedCalls(completed).size;
  const confirmedModelCalls = uniqueCompletedCalls(
    completed.filter((decision) =>
      decision.eventType === "pipeline_ai_call_completed"
      && modelExecutionConfirmed(decision)
    ),
  ).size;

  if (unresolvedPlannedCalls > 0) {
    return {
      operationId,
      networkCalls: "unknown",
      modelCalls: "unknown",
      confirmedNetworkCalls,
      confirmedModelCalls,
      unresolvedPlannedCalls,
      source: "persisted_decision_journal",
    };
  }

  if (planned.length || completed.length) {
    return {
      operationId,
      networkCalls: confirmedNetworkCalls,
      modelCalls: confirmedModelCalls,
      confirmedNetworkCalls,
      confirmedModelCalls,
      unresolvedPlannedCalls: 0,
      source: "persisted_decision_journal",
    };
  }

  if (observation.workKind !== "ai" && observation.modelLabel === "без AI") {
    return {
      operationId,
      networkCalls: 0,
      modelCalls: 0,
      confirmedNetworkCalls: 0,
      confirmedModelCalls: 0,
      unresolvedPlannedCalls: 0,
      source: "explicit_zero",
    };
  }

  return {
    operationId,
    networkCalls: "unknown",
    modelCalls: "unknown",
    confirmedNetworkCalls: 0,
    confirmedModelCalls: 0,
    unresolvedPlannedCalls: 0,
    source: "unknown",
  };
}

function isPlannedCall(eventType: string) {
  return eventType === "pipeline_ai_call_planned"
    || eventType === "operation_network_call_planned";
}

function isCompletedCall(eventType: string) {
  return eventType === "pipeline_ai_call_completed"
    || eventType === "operation_network_call_completed";
}

function decisionScope(decision: OperationCallDecision) {
  const input = decision.input as {
    operationId?: unknown;
    runId?: unknown;
  } | undefined;
  if (typeof input?.operationId === "string") return input.operationId;
  return typeof input?.runId === "string" ? input.runId : undefined;
}

function decisionCallId(decision: OperationCallDecision) {
  const input = decision.input as { callId?: unknown } | undefined;
  return typeof input?.callId === "string" ? input.callId : undefined;
}

function modelExecutionConfirmed(decision: OperationCallDecision) {
  const output = decision.output as { completed?: unknown } | undefined;
  return decision.engine === "ollama" && output?.completed === true;
}

function uniqueCompletedCalls(decisions: OperationCallDecision[]) {
  const ids = new Set<string>();
  decisions.forEach((decision, index) => {
    ids.add(decisionCallId(decision) ?? `${decision.id}:${index}`);
  });
  return ids;
}
