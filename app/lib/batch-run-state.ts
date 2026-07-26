import type { PersistedAiDecision } from "./local-db";

export type RestoredBatchStage =
  | "preflight"
  | "extract"
  | "embeddings"
  | "cluster"
  | "hierarchy"
  | "candidates"
  | "relations"
  | "complete";

export type RestoredBatchProgress = {
  status: "idle" | "paused" | "failed" | "completed";
  completed: number;
  total: number;
  stage?: RestoredBatchStage;
  runId?: string;
  orderVariant?: "round_robin" | "original" | "reverse" | "seeded";
  error?: string;
  interruptedByReload?: boolean;
  stageCompleted?: number;
  stageTotal?: number;
  checkpointAt?: string;
  awaitingConfirmation?: boolean;
  continuationBlock?: {
    code: "model_mismatch" | "model_config_unavailable";
    runModel?: string;
    configuredModel?: string;
  };
};

export type RestoredCheckpointExecutionContext = {
  workKind: "local" | "ai" | "storage";
  modelLabel: string;
};

export type OfflineCandidateCheckpointAssessment = {
  ready: boolean;
  reason?:
    | "missing_run"
    | "missing_offline_hierarchy_pause"
    | "missing_hierarchy"
    | "incomplete_embeddings";
  embeddingCount: number;
  unresolvedThoughtCount: number;
  existingCandidateCount?: number;
};

const PIPELINE_EVENTS: PersistedAiDecision["eventType"][] = [
  "pipeline_preflight",
  "pipeline_extract",
  "pipeline_embeddings",
  "pipeline_cluster_plan",
  "pipeline_cluster_assignment",
  "pipeline_cluster",
  "pipeline_hierarchy_plan",
  "pipeline_hierarchy_assignment",
  "pipeline_hierarchy_repair",
  "pipeline_hierarchy",
  "pipeline_candidates",
  "pipeline_relations",
  "pipeline_validated",
];

export function restoreBatchProgress(
  decisions: PersistedAiDecision[],
  total: number,
): RestoredBatchProgress {
  const lastStartIndex = decisions.findLastIndex(
    (decision) => decision.eventType === "batch_started",
  );
  const lastStart = lastStartIndex >= 0 ? decisions[lastStartIndex] : undefined;
  const runId = lastStart ? decisionRunId(lastStart) : undefined;
  if (!runId) return { status: "idle", completed: 0, total };

  const runDecisions = decisions.filter((decision) => decisionRunId(decision) === runId);
  const startInput = lastStart?.input as { orderVariant?: unknown } | undefined;
  const savedOrderVariant = startInput?.orderVariant;
  const orderVariant = isOrderVariant(savedOrderVariant)
    ? savedOrderVariant
    : undefined;
  const completed = countExtractedThoughts(runDecisions, total);
  const embedded = countEmbeddedThoughts(runDecisions, total);
  const nextPipelineStage = nextStage(runDecisions, completed, embedded, total);
  const terminal = [...decisions.slice(lastStartIndex + 1)]
    .reverse()
    .find((decision) => decisionRunId(decision) === runId
      && ["batch_completed", "batch_paused", "batch_failed"].includes(decision.eventType));
  const continuationBlockDecision = [...decisions.slice(lastStartIndex + 1)]
    .reverse()
    .find((decision) => decisionRunId(decision) === runId
      && decision.eventType === "batch_continuation_blocked");
  const continuationBlockInput = continuationBlockDecision?.input as {
    code?: unknown;
    savedRunModel?: unknown;
    configuredModel?: unknown;
  } | undefined;
  const continuationBlock = continuationBlockInput?.code === "model_mismatch"
    ? {
        code: "model_mismatch" as const,
        runModel: typeof continuationBlockInput.savedRunModel === "string" ? continuationBlockInput.savedRunModel : undefined,
        configuredModel: typeof continuationBlockInput.configuredModel === "string" ? continuationBlockInput.configuredModel : undefined,
      }
    : continuationBlockInput?.code === "model_config_unavailable"
      ? { code: "model_config_unavailable" as const }
      : undefined;
  const continuationBlockOutput = continuationBlockDecision?.output as { message?: unknown } | undefined;

  if (terminal?.eventType === "batch_completed") {
    return { status: "completed", completed: total, total, stage: "complete", runId, orderVariant, stageCompleted: total, stageTotal: total };
  }

  if (terminal?.eventType === "batch_failed") {
    const stage = decisionStage(terminal) ?? nextPipelineStage;
    const stageProgress = restoreStageProgress(runDecisions, stage, completed, total);
    const output = terminal.output as { error?: unknown } | undefined;
    return {
      status: "failed",
      completed,
      total,
      stage,
      runId,
      orderVariant,
      error: typeof output?.error === "string" ? output.error : "Семантический этап не завершён.",
      checkpointAt: terminal.createdAt,
      awaitingConfirmation: true,
      ...stageProgress,
    };
  }

  const stage = terminal?.eventType === "batch_paused"
    ? decisionStage(terminal) ?? nextPipelineStage
    : nextPipelineStage;
  const stageProgress = restoreStageProgress(runDecisions, stage, completed, total);
  const terminalOutput = terminal?.output as { message?: unknown; error?: unknown } | undefined;
  return {
    status: "paused",
    completed,
    total,
    stage,
    runId,
    orderVariant,
    interruptedByReload: terminal?.eventType !== "batch_paused",
    checkpointAt: terminal?.createdAt ?? runDecisions.at(-1)?.createdAt ?? lastStart.createdAt,
    awaitingConfirmation: true,
    continuationBlock,
    error: typeof continuationBlockOutput?.message === "string"
      ? continuationBlockOutput.message
      : typeof terminalOutput?.message === "string"
        ? terminalOutput.message
        : typeof terminalOutput?.error === "string" && terminalOutput.error !== "pipeline_paused"
          ? terminalOutput.error
          : undefined,
    ...stageProgress,
  };
}

export function shouldAutoResumeBatch(progress: RestoredBatchProgress) {
  void progress;
  return false;
}

export function restoreCheckpointExecutionContext(
  decisions: PersistedAiDecision[],
  runId: string | undefined,
  stage: RestoredBatchStage | undefined,
): RestoredCheckpointExecutionContext {
  if (!runId || !stage) return { workKind: "storage", modelLabel: "без AI" };
  const runDecisions = decisions.filter((decision) => decisionRunId(decision) === runId);
  const terminal = [...runDecisions]
    .reverse()
    .find((decision) => ["batch_completed", "batch_paused", "batch_failed"].includes(decision.eventType));
  const terminalStage = terminal ? decisionStage(terminal) : undefined;
  const terminalInput = terminal?.input as { zeroModelCalls?: unknown } | undefined;

  if (terminalStage === stage && terminalInput?.zeroModelCalls === true) {
    return { workKind: "local", modelLabel: "без AI" };
  }
  if (stage === "candidates") return { workKind: "local", modelLabel: "без AI" };
  if (stage === "embeddings") return { workKind: "ai", modelLabel: "embeddinggemma" };
  if (stage === "complete") return { workKind: "storage", modelLabel: latestRunModel(runDecisions) ?? "без AI" };

  return {
    workKind: "ai",
    modelLabel: latestRunModel(runDecisions) ?? "локальная модель (не сохранена)",
  };
}

export function assessOfflineCandidateCheckpoint(
  decisions: PersistedAiDecision[],
  runId: string | undefined,
  expectedThoughts: number,
): OfflineCandidateCheckpointAssessment {
  if (!runId) {
    return {
      ready: false,
      reason: "missing_run",
      embeddingCount: 0,
      unresolvedThoughtCount: 0,
    };
  }

  const runDecisions = decisions.filter((decision) => decisionRunId(decision) === runId);
  const terminal = [...runDecisions]
    .reverse()
    .find((decision) => ["batch_completed", "batch_paused", "batch_failed"].includes(decision.eventType));
  const hierarchy = [...runDecisions]
    .reverse()
    .find((decision) => decision.eventType === "pipeline_hierarchy");
  const hierarchyOutput = hierarchy?.output as { unresolvedThoughtIds?: unknown } | undefined;
  const unresolvedThoughtCount = Array.isArray(hierarchyOutput?.unresolvedThoughtIds)
    ? hierarchyOutput.unresolvedThoughtIds.filter((value) => typeof value === "string").length
    : 0;
  const embeddedIds = new Set<string>();
  runDecisions
    .filter((decision) => decision.eventType === "pipeline_embeddings")
    .forEach((decision) => {
      const output = decision.output as { embeddings?: Record<string, unknown> } | undefined;
      Object.keys(output?.embeddings ?? {}).forEach((id) => embeddedIds.add(id));
    });
  const candidates = [...runDecisions]
    .reverse()
    .find((decision) => decision.eventType === "pipeline_candidates");
  const candidateOutput = candidates?.output as { candidates?: unknown } | undefined;
  const existingCandidateCount = Array.isArray(candidateOutput?.candidates)
    ? candidateOutput.candidates.length
    : undefined;

  if (terminal?.userAction !== "offline_hierarchy_recovered_for_review") {
    return {
      ready: false,
      reason: "missing_offline_hierarchy_pause",
      embeddingCount: embeddedIds.size,
      unresolvedThoughtCount,
      existingCandidateCount,
    };
  }
  if (!hierarchy) {
    return {
      ready: false,
      reason: "missing_hierarchy",
      embeddingCount: embeddedIds.size,
      unresolvedThoughtCount,
      existingCandidateCount,
    };
  }
  if (embeddedIds.size !== expectedThoughts) {
    return {
      ready: false,
      reason: "incomplete_embeddings",
      embeddingCount: embeddedIds.size,
      unresolvedThoughtCount,
      existingCandidateCount,
    };
  }
  return {
    ready: true,
    embeddingCount: embeddedIds.size,
    unresolvedThoughtCount,
    existingCandidateCount,
  };
}

function countExtractedThoughts(decisions: PersistedAiDecision[], total: number) {
  const thoughtIds = new Set<string>();
  decisions
    .filter((decision) => decision.eventType === "pipeline_extract")
    .forEach((decision) => {
      const output = decision.output as { items?: Array<{ thoughtId?: unknown }> } | undefined;
      output?.items?.forEach((item) => {
        if (typeof item.thoughtId === "string") thoughtIds.add(item.thoughtId);
      });
    });
  return Math.min(total, thoughtIds.size);
}

function nextStage(decisions: PersistedAiDecision[], extracted: number, embedded: number, total: number): RestoredBatchStage {
  const completedEvents = new Set(
    decisions
      .filter((decision) => PIPELINE_EVENTS.includes(decision.eventType))
      .map((decision) => decision.eventType),
  );
  if (completedEvents.has("pipeline_validated")) return "complete";
  if (completedEvents.has("pipeline_relations")) return "relations";
  if (completedEvents.has("pipeline_candidates")) return "relations";
  if (completedEvents.has("pipeline_hierarchy")) return "candidates";
  if (completedEvents.has("pipeline_hierarchy_plan") || completedEvents.has("pipeline_hierarchy_assignment") || completedEvents.has("pipeline_hierarchy_repair")) return "hierarchy";
  if (completedEvents.has("pipeline_cluster")) return "hierarchy";
  if (completedEvents.has("pipeline_cluster_plan") || completedEvents.has("pipeline_cluster_assignment")) return "cluster";
  if (embedded === total) return "cluster";
  if (completedEvents.has("pipeline_embeddings")) return "embeddings";
  if (extracted === total) return "embeddings";
  if (completedEvents.has("pipeline_extract")) return "extract";
  if (completedEvents.has("pipeline_preflight")) return "extract";
  return "preflight";
}

function restoreStageProgress(
  decisions: PersistedAiDecision[],
  stage: RestoredBatchStage,
  extracted: number,
  total: number,
) {
  if (stage === "extract") return { stageCompleted: extracted, stageTotal: total };
  if (stage === "cluster") {
    const assignedIds = new Set<string>();
    decisions
      .filter((decision) => decision.eventType === "pipeline_cluster_assignment")
      .forEach((decision) => {
        const output = decision.output as { assignments?: Array<{ thoughtId?: unknown }> } | undefined;
        output?.assignments?.forEach((assignment) => {
          if (typeof assignment.thoughtId === "string") assignedIds.add(assignment.thoughtId);
        });
      });
    return { stageCompleted: Math.min(total, assignedIds.size), stageTotal: total };
  }
  if (stage === "hierarchy") {
    const clusterDecision = [...decisions].reverse().find((decision) => decision.eventType === "pipeline_cluster");
    const clusterOutput = clusterDecision?.output as { clusters?: Array<{ id?: unknown }> } | undefined;
    const clusterIds = new Set((clusterOutput?.clusters ?? []).flatMap((cluster) => typeof cluster.id === "string" ? [cluster.id] : []));
    const assignedIds = new Set<string>();
    decisions
      .filter((decision) => decision.eventType === "pipeline_hierarchy_assignment")
      .forEach((decision) => {
        const output = decision.output as { assignments?: Array<{ clusterId?: unknown }> } | undefined;
        output?.assignments?.forEach((assignment) => {
          if (typeof assignment.clusterId === "string") assignedIds.add(assignment.clusterId);
        });
      });
    return { stageCompleted: Math.min(clusterIds.size, assignedIds.size), stageTotal: clusterIds.size || undefined };
  }
  if (stage !== "embeddings") return {};
  const embeddedIds = new Set<string>();
  decisions
    .filter((decision) => decision.eventType === "pipeline_embeddings")
    .forEach((decision) => {
      const output = decision.output as { embeddings?: Record<string, unknown> } | undefined;
      Object.keys(output?.embeddings ?? {}).forEach((id) => embeddedIds.add(id));
    });
  return { stageCompleted: Math.min(total, embeddedIds.size), stageTotal: total };
}

function countEmbeddedThoughts(decisions: PersistedAiDecision[], total: number) {
  const embeddedIds = new Set<string>();
  decisions
    .filter((decision) => decision.eventType === "pipeline_embeddings")
    .forEach((decision) => {
      const output = decision.output as { embeddings?: Record<string, unknown> } | undefined;
      Object.keys(output?.embeddings ?? {}).forEach((id) => embeddedIds.add(id));
    });
  return Math.min(total, embeddedIds.size);
}

export function pipelineProgressPercent(progress: {
  stage?: RestoredBatchStage;
  stageCompleted?: number;
  stageTotal?: number;
  status: string;
}) {
  if (progress.status === "completed" || progress.stage === "complete") return 100;
  const ratio = progress.stageTotal && progress.stageCompleted !== undefined
    ? Math.max(0, Math.min(1, progress.stageCompleted / progress.stageTotal))
    : 0;
  const ranges: Record<Exclude<RestoredBatchStage, "complete">, [number, number]> = {
    preflight: [0, 1],
    extract: [1, 45],
    embeddings: [45, 55],
    cluster: [55, 70],
    hierarchy: [70, 82],
    candidates: [82, 88],
    relations: [88, 99],
  };
  const [start, end] = ranges[progress.stage ?? "extract"];
  return start + (end - start) * ratio;
}

function latestRunModel(decisions: PersistedAiDecision[]) {
  return [...decisions].reverse().find((decision) =>
    decision.engine === "ollama" && typeof decision.model === "string"
  )?.model;
}

function decisionRunId(decision: PersistedAiDecision) {
  const input = decision.input as { runId?: unknown } | undefined;
  return typeof input?.runId === "string" ? input.runId : undefined;
}

function decisionStage(decision: PersistedAiDecision): RestoredBatchStage | undefined {
  const input = decision.input as { stage?: unknown } | undefined;
  const value = input?.stage;
  return value === "preflight"
    || value === "extract"
    || value === "embeddings"
    || value === "cluster"
    || value === "hierarchy"
    || value === "candidates"
    || value === "relations"
    || value === "complete"
    ? value
    : undefined;
}

function isOrderVariant(value: unknown): value is RestoredBatchProgress["orderVariant"] {
  return value === "round_robin" || value === "original" || value === "reverse" || value === "seeded";
}
