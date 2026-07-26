export const WORKSPACE_KINDS = ["synthetic", "personal"] as const;
export type WorkspaceKind = (typeof WORKSPACE_KINDS)[number];

export const RUN_STATUSES = [
  "created",
  "awaiting_authorization",
  "running",
  "saving",
  "paused",
  "blocked",
  "failed",
  "completed",
  "abandoned",
] as const;
export type RunStatus = (typeof RUN_STATUSES)[number];

export const PIPELINE_STAGES = [
  "preflight",
  "extraction",
  "embeddings",
  "clustering",
  "hierarchy",
  "projects_and_placement",
  "candidates",
  "relations",
  "duplicates",
  "contradictions",
  "next_action",
] as const;
export type PipelineStage = (typeof PIPELINE_STAGES)[number];

export const ATTEMPT_STATUSES = [
  "pending_authorization",
  "authorized",
  "running",
  "succeeded",
  "failed",
  "cancelled",
] as const;
export type AttemptStatus = (typeof ATTEMPT_STATUSES)[number];

export const BLOCK_REASONS = [
  "run_model_mismatch",
  "embedding_model_mismatch",
  "build_mismatch",
  "pipeline_version_mismatch",
  "storage_schema_mismatch",
  "explicitly_blocked",
] as const;
export type BlockReason = (typeof BLOCK_REASONS)[number];

export interface RunIdentity {
  readonly runId: string;
  readonly workspace: WorkspaceKind;
  readonly datasetId: string;
  readonly orderVariant: string;
  readonly semanticModel: string;
  readonly embeddingModel: string;
  readonly pipelineVersion: string;
  readonly buildId: string;
  readonly storageSchema: string;
}

export interface RuntimeIdentity {
  readonly configuredSemanticModel: string;
  readonly configuredEmbeddingModel: string;
  readonly buildId: string;
  readonly storageSchema: string;
  readonly supportedPipelineVersions: readonly string[];
  readonly compatibleSourceBuildIds: readonly string[];
}

export interface RunBlock {
  readonly reason: BlockReason;
  readonly expected: string;
  readonly actual: string;
}

export interface AttemptRecord {
  readonly attemptId: string;
  readonly stage: PipelineStage;
  readonly model: string;
  readonly inputHash: string;
  readonly idempotencyKey: string;
  readonly status: AttemptStatus;
  readonly requestedAt: string;
  readonly authorizationId?: string;
  readonly authorizedBy?: "user";
  readonly authorizedAt?: string;
  readonly startedAt?: string;
  readonly finishedAt?: string;
  readonly failureCode?: string;
}

export interface StageProgress {
  readonly completed: number;
  readonly total: number;
  readonly heartbeatAt: string;
  readonly message?: string;
}

export interface RunAggregate {
  readonly identity: RunIdentity;
  readonly status: RunStatus;
  readonly stage: PipelineStage;
  readonly revision: number;
  readonly attempts: readonly AttemptRecord[];
  readonly activeAttemptId?: string;
  readonly progress?: StageProgress;
  readonly explicitBlock?: RunBlock;
  readonly failureCode?: string;
  readonly completedStages: readonly PipelineStage[];
}

export interface CommandMeta {
  readonly commandId: string;
  readonly occurredAt: string;
  readonly expectedRevision: number;
}

export const TERMINAL_RUN_STATUSES: ReadonlySet<RunStatus> = new Set([
  "completed",
  "abandoned",
]);

export const ALLOWED_STATUS_TRANSITIONS: Readonly<Record<RunStatus, readonly RunStatus[]>> = {
  created: ["awaiting_authorization", "blocked", "abandoned"],
  awaiting_authorization: ["running", "blocked", "failed", "abandoned"],
  running: ["saving", "paused", "blocked", "failed", "abandoned"],
  saving: ["paused", "completed", "blocked", "failed", "abandoned"],
  paused: ["awaiting_authorization", "blocked", "abandoned"],
  blocked: ["abandoned"],
  failed: ["awaiting_authorization", "blocked", "abandoned"],
  completed: [],
  abandoned: [],
};

export function canTransition(from: RunStatus, to: RunStatus): boolean {
  return ALLOWED_STATUS_TRANSITIONS[from].includes(to);
}

export function assertRunIdentity(identity: RunIdentity): void {
  const values: readonly [string, string][] = [
    ["runId", identity.runId],
    ["datasetId", identity.datasetId],
    ["orderVariant", identity.orderVariant],
    ["semanticModel", identity.semanticModel],
    ["embeddingModel", identity.embeddingModel],
    ["pipelineVersion", identity.pipelineVersion],
    ["buildId", identity.buildId],
    ["storageSchema", identity.storageSchema],
  ];
  for (const [field, value] of values) {
    if (value.trim().length === 0) {
      throw new Error(`invalid_run_identity:${field}`);
    }
  }
  if (!WORKSPACE_KINDS.includes(identity.workspace)) {
    throw new Error("invalid_run_identity:workspace");
  }
}

export function sameRunIdentity(left: RunIdentity, right: RunIdentity): boolean {
  return left.runId === right.runId
    && left.workspace === right.workspace
    && left.datasetId === right.datasetId
    && left.orderVariant === right.orderVariant
    && left.semanticModel === right.semanticModel
    && left.embeddingModel === right.embeddingModel
    && left.pipelineVersion === right.pipelineVersion
    && left.buildId === right.buildId
    && left.storageSchema === right.storageSchema;
}
