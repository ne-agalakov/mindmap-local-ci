import {
  TERMINAL_RUN_STATUSES,
  assertRunIdentity,
  canTransition,
  type AttemptRecord,
  type CommandMeta,
  type PipelineStage,
  type RunAggregate,
  type RunBlock,
  type RunIdentity,
  type RunStatus,
  type RuntimeIdentity,
  type StageProgress,
} from "../domain/run.ts";

type EventBase = Readonly<{
  eventId: string;
  commandId: string;
  sequence: number;
  occurredAt: string;
}>;

export type RunEvent =
  | (EventBase & { readonly type: "run_created"; readonly identity: RunIdentity; readonly stage: PipelineStage })
  | (EventBase & { readonly type: "attempt_requested"; readonly attempt: AttemptRecord })
  | (EventBase & { readonly type: "attempt_authorized"; readonly attemptId: string; readonly authorizationId: string })
  | (EventBase & { readonly type: "attempt_started"; readonly attemptId: string })
  | (EventBase & { readonly type: "stage_progress_recorded"; readonly attemptId: string; readonly progress: StageProgress })
  | (EventBase & { readonly type: "stage_completion_started"; readonly attemptId: string; readonly artifactHash: string })
  | (EventBase & { readonly type: "stage_saved"; readonly completedStage: PipelineStage; readonly nextStage?: PipelineStage; readonly final: boolean })
  | (EventBase & { readonly type: "stage_paused"; readonly attemptId: string; readonly reason: string })
  | (EventBase & { readonly type: "stage_failed"; readonly attemptId?: string; readonly failureCode: string })
  | (EventBase & { readonly type: "continuation_blocked"; readonly block: RunBlock })
  | (EventBase & { readonly type: "run_abandoned"; readonly reason: string });

export type RejectionCode =
  | "invalid_command_meta"
  | "stale_revision"
  | "invalid_transition"
  | "run_blocked"
  | "run_terminal"
  | "identity_conflict"
  | "stage_mismatch"
  | "model_mismatch"
  | "active_attempt_exists"
  | "attempt_not_found"
  | "attempt_not_authorizable"
  | "attempt_not_startable"
  | "attempt_not_running"
  | "idempotency_conflict"
  | "invalid_progress"
  | "invalid_next_stage"
  | "invalid_artifact_hash";

export type CommandResult =
  | Readonly<{
      ok: true;
      events: readonly RunEvent[];
      aggregate: RunAggregate;
      idempotent: boolean;
      attemptId?: string;
    }>
  | Readonly<{
      ok: false;
      rejection: Readonly<{
        code: RejectionCode;
        message: string;
        details?: Readonly<Record<string, string | number | boolean | null>>;
      }>;
    }>;

export interface RunInspection {
  readonly persistedStatus: RunStatus;
  readonly effectiveStatus: RunStatus;
  readonly stage: PipelineStage;
  readonly block?: RunBlock;
  readonly activeAttempt?: AttemptRecord;
  readonly aiCallAllowed: boolean;
  readonly requiresContinuationClick: false;
  readonly availableActions: readonly string[];
}

type RequestAttemptInput = Readonly<{
  attemptId: string;
  stage: PipelineStage;
  model: string;
  inputHash: string;
  idempotencyKey: string;
}>;
type AuthorizeAttemptInput = Readonly<{ attemptId: string; authorizationId: string }>;
type BeginAttemptInput = Readonly<{ attemptId: string }>;
type ProgressInput = Readonly<{
  attemptId: string;
  completed: number;
  total: number;
  heartbeatAt: string;
  message?: string;
}>;
type CompleteInput = Readonly<{ attemptId: string; artifactHash: string }>;
type SaveInput = Readonly<{ nextStage?: PipelineStage; final: boolean }>;

const reject = (
  code: RejectionCode,
  message: string,
  details?: Readonly<Record<string, string | number | boolean | null>>,
): CommandResult => ({ ok: false, rejection: { code, message, details } });

function validateMeta(meta: CommandMeta, revision: number): CommandResult | undefined {
  if (!meta.commandId.trim() || !meta.occurredAt.trim() || meta.expectedRevision < 0) {
    return reject("invalid_command_meta", "Command metadata is incomplete.");
  }
  return meta.expectedRevision === revision
    ? undefined
    : reject("stale_revision", "Command revision does not match the aggregate revision.", {
        expectedRevision: meta.expectedRevision,
        currentRevision: revision,
      });
}

const eventBase = (meta: CommandMeta): EventBase => ({
  eventId: `${meta.commandId}:0`,
  commandId: meta.commandId,
  sequence: meta.expectedRevision + 1,
  occurredAt: meta.occurredAt,
});

function transitionError(aggregate: RunAggregate, target: RunStatus): CommandResult | undefined {
  return canTransition(aggregate.status, target)
    ? undefined
    : reject("invalid_transition", `Transition ${aggregate.status} -> ${target} is not allowed.`, {
        from: aggregate.status,
        to: target,
      });
}

function activeAttempt(aggregate: RunAggregate): AttemptRecord | undefined {
  return aggregate.activeAttemptId
    ? aggregate.attempts.find((attempt) => attempt.attemptId === aggregate.activeAttemptId)
    : undefined;
}

function replaceAttempt(
  attempts: readonly AttemptRecord[],
  attemptId: string,
  update: (attempt: AttemptRecord) => AttemptRecord,
): readonly AttemptRecord[] {
  let found = false;
  const next = attempts.map((attempt) => {
    if (attempt.attemptId !== attemptId) return attempt;
    found = true;
    return update(attempt);
  });
  if (!found) throw new Error(`event_attempt_not_found:${attemptId}`);
  return next;
}

export function applyRunEvent(aggregate: RunAggregate | undefined, event: RunEvent): RunAggregate {
  const expectedSequence = (aggregate?.revision ?? 0) + 1;
  if (event.sequence !== expectedSequence) {
    throw new Error(`non_contiguous_event_sequence:${event.sequence}:${expectedSequence}`);
  }
  if (event.type === "run_created") {
    if (aggregate) throw new Error("run_already_exists");
    assertRunIdentity(event.identity);
    return {
      identity: event.identity,
      status: "created",
      stage: event.stage,
      revision: event.sequence,
      attempts: [],
      completedStages: [],
    };
  }
  if (!aggregate) throw new Error("run_missing");

  switch (event.type) {
    case "attempt_requested":
      return {
        ...aggregate,
        status: "awaiting_authorization",
        revision: event.sequence,
        attempts: [...aggregate.attempts, event.attempt],
        activeAttemptId: event.attempt.attemptId,
        progress: undefined,
        failureCode: undefined,
      };
    case "attempt_authorized":
      return {
        ...aggregate,
        revision: event.sequence,
        attempts: replaceAttempt(aggregate.attempts, event.attemptId, (attempt) => ({
          ...attempt,
          status: "authorized",
          authorizationId: event.authorizationId,
          authorizedBy: "user",
          authorizedAt: event.occurredAt,
        })),
      };
    case "attempt_started":
      return {
        ...aggregate,
        status: "running",
        revision: event.sequence,
        attempts: replaceAttempt(aggregate.attempts, event.attemptId, (attempt) => ({
          ...attempt,
          status: "running",
          startedAt: event.occurredAt,
        })),
      };
    case "stage_progress_recorded":
      return { ...aggregate, revision: event.sequence, progress: event.progress };
    case "stage_completion_started":
      return {
        ...aggregate,
        status: "saving",
        revision: event.sequence,
        attempts: replaceAttempt(aggregate.attempts, event.attemptId, (attempt) => ({
          ...attempt,
          status: "succeeded",
          finishedAt: event.occurredAt,
        })),
      };
    case "stage_saved":
      return {
        ...aggregate,
        status: event.final ? "completed" : "paused",
        stage: event.nextStage ?? aggregate.stage,
        revision: event.sequence,
        activeAttemptId: undefined,
        progress: undefined,
        completedStages: aggregate.completedStages.includes(event.completedStage)
          ? aggregate.completedStages
          : [...aggregate.completedStages, event.completedStage],
      };
    case "stage_paused":
      return {
        ...aggregate,
        status: "paused",
        revision: event.sequence,
        activeAttemptId: undefined,
        progress: undefined,
        attempts: replaceAttempt(aggregate.attempts, event.attemptId, (attempt) => ({
          ...attempt,
          status: "cancelled",
          finishedAt: event.occurredAt,
        })),
      };
    case "stage_failed":
      return {
        ...aggregate,
        status: "failed",
        revision: event.sequence,
        activeAttemptId: undefined,
        progress: undefined,
        failureCode: event.failureCode,
        attempts: event.attemptId
          ? replaceAttempt(aggregate.attempts, event.attemptId, (attempt) => ({
              ...attempt,
              status: "failed",
              failureCode: event.failureCode,
              finishedAt: event.occurredAt,
            }))
          : aggregate.attempts,
      };
    case "continuation_blocked":
      return {
        ...aggregate,
        status: "blocked",
        revision: event.sequence,
        activeAttemptId: undefined,
        progress: undefined,
        explicitBlock: event.block,
      };
    case "run_abandoned":
      return {
        ...aggregate,
        status: "abandoned",
        revision: event.sequence,
        activeAttemptId: undefined,
        progress: undefined,
      };
  }
}

export function replayRunEvents(events: readonly RunEvent[]): RunAggregate {
  let aggregate: RunAggregate | undefined;
  for (const event of events) aggregate = applyRunEvent(aggregate, event);
  if (!aggregate) throw new Error("empty_run_event_stream");
  return aggregate;
}

function succeed(
  aggregate: RunAggregate,
  events: readonly RunEvent[],
  idempotent = false,
  attemptId?: string,
): CommandResult {
  let next = aggregate;
  for (const event of events) next = applyRunEvent(next, event);
  return { ok: true, events, aggregate: next, idempotent, attemptId };
}

export function createRun(identity: RunIdentity, stage: PipelineStage, meta: CommandMeta): CommandResult {
  const metaError = validateMeta(meta, 0);
  if (metaError) return metaError;
  try {
    assertRunIdentity(identity);
  } catch (error) {
    return reject("identity_conflict", error instanceof Error ? error.message : "Invalid run identity.");
  }
  const event: RunEvent = { ...eventBase(meta), type: "run_created", identity, stage };
  return { ok: true, events: [event], aggregate: applyRunEvent(undefined, event), idempotent: false };
}

export function deriveCompatibilityBlock(
  aggregate: RunAggregate,
  runtime: RuntimeIdentity,
): RunBlock | undefined {
  if (aggregate.explicitBlock) return aggregate.explicitBlock;
  if (TERMINAL_RUN_STATUSES.has(aggregate.status)) return undefined;
  if (aggregate.identity.storageSchema !== runtime.storageSchema) {
    return { reason: "storage_schema_mismatch", expected: aggregate.identity.storageSchema, actual: runtime.storageSchema };
  }
  if (aggregate.identity.semanticModel !== runtime.configuredSemanticModel) {
    return { reason: "run_model_mismatch", expected: aggregate.identity.semanticModel, actual: runtime.configuredSemanticModel };
  }
  if (aggregate.identity.embeddingModel !== runtime.configuredEmbeddingModel) {
    return { reason: "embedding_model_mismatch", expected: aggregate.identity.embeddingModel, actual: runtime.configuredEmbeddingModel };
  }
  if (!runtime.supportedPipelineVersions.includes(aggregate.identity.pipelineVersion)) {
    return {
      reason: "pipeline_version_mismatch",
      expected: aggregate.identity.pipelineVersion,
      actual: runtime.supportedPipelineVersions.join(","),
    };
  }
  if (
    aggregate.identity.buildId !== runtime.buildId
    && !runtime.compatibleSourceBuildIds.includes(aggregate.identity.buildId)
  ) {
    return { reason: "build_mismatch", expected: aggregate.identity.buildId, actual: runtime.buildId };
  }
  return undefined;
}

export function inspectRun(aggregate: RunAggregate, runtime: RuntimeIdentity): RunInspection {
  const block = deriveCompatibilityBlock(aggregate, runtime);
  const attempt = activeAttempt(aggregate);
  const effectiveStatus: RunStatus = block ? "blocked" : aggregate.status;
  const aiCallAllowed = !block
    && aggregate.status === "running"
    && attempt?.status === "running"
    && attempt.authorizationId !== undefined
    && attempt.authorizedBy === "user";
  const actions: Record<RunStatus, readonly string[]> = {
    created: ["inspect", "request_attempt", "abandon"],
    awaiting_authorization: attempt?.status === "authorized"
      ? ["inspect", "begin_attempt", "fail_stage", "abandon"]
      : ["inspect", "authorize_attempt", "fail_stage", "abandon"],
    running: ["inspect", "record_progress", "complete_stage", "pause_stage", "fail_stage", "abandon"],
    saving: ["inspect", "confirm_stage_saved", "fail_stage", "abandon"],
    paused: ["inspect", "request_attempt", "abandon"],
    blocked: ["inspect", "start_clean_run", "abandon"],
    failed: ["inspect", "request_attempt", "abandon"],
    completed: ["inspect"],
    abandoned: ["inspect"],
  };
  return {
    persistedStatus: aggregate.status,
    effectiveStatus,
    stage: aggregate.stage,
    block,
    activeAttempt: attempt,
    aiCallAllowed,
    requiresContinuationClick: false,
    availableActions: actions[effectiveStatus],
  };
}

function executableGuard(
  aggregate: RunAggregate,
  runtime: RuntimeIdentity,
  meta: CommandMeta,
): CommandResult | undefined {
  const metaError = validateMeta(meta, aggregate.revision);
  if (metaError) return metaError;
  if (TERMINAL_RUN_STATUSES.has(aggregate.status)) return reject("run_terminal", `Run is ${aggregate.status}.`);
  const block = deriveCompatibilityBlock(aggregate, runtime);
  return block
    ? reject("run_blocked", "Run identity is incompatible with the current runtime.", {
        reason: block.reason,
        expected: block.expected,
        actual: block.actual,
      })
    : undefined;
}

const expectedModel = (identity: RunIdentity, stage: PipelineStage): string => (
  stage === "embeddings" ? identity.embeddingModel : identity.semanticModel
);

export function requestAttempt(
  aggregate: RunAggregate,
  input: RequestAttemptInput,
  runtime: RuntimeIdentity,
  meta: CommandMeta,
): CommandResult {
  const guard = executableGuard(aggregate, runtime, meta);
  if (guard) return guard;
  const existing = aggregate.attempts.find((attempt) => attempt.idempotencyKey === input.idempotencyKey);
  if (existing) {
    const same = existing.attemptId === input.attemptId
      && existing.stage === input.stage
      && existing.model === input.model
      && existing.inputHash === input.inputHash;
    return same
      ? { ok: true, events: [], aggregate, idempotent: true, attemptId: existing.attemptId }
      : reject("idempotency_conflict", "Idempotency key is already bound to different attempt data.");
  }
  const stateError = transitionError(aggregate, "awaiting_authorization");
  if (stateError) return stateError;
  if (input.stage !== aggregate.stage) {
    return reject("stage_mismatch", "Attempt stage does not match the active run stage.", {
      expected: aggregate.stage,
      actual: input.stage,
    });
  }
  const model = expectedModel(aggregate.identity, input.stage);
  if (input.model !== model) {
    return reject("model_mismatch", "Attempt model does not match immutable run identity.", {
      expected: model,
      actual: input.model,
    });
  }
  if (aggregate.activeAttemptId) {
    return reject("active_attempt_exists", "Run already has an active attempt.", {
      activeAttemptId: aggregate.activeAttemptId,
    });
  }
  if (![input.attemptId, input.model, input.inputHash, input.idempotencyKey].every((value) => value.trim())) {
    return reject("invalid_command_meta", "Attempt identity is incomplete.");
  }
  const attempt: AttemptRecord = {
    attemptId: input.attemptId,
    stage: input.stage,
    model: input.model,
    inputHash: input.inputHash,
    idempotencyKey: input.idempotencyKey,
    status: "pending_authorization",
    requestedAt: meta.occurredAt,
  };
  const event: RunEvent = { ...eventBase(meta), type: "attempt_requested", attempt };
  return succeed(aggregate, [event], false, attempt.attemptId);
}

export function authorizeAttempt(
  aggregate: RunAggregate,
  input: AuthorizeAttemptInput,
  runtime: RuntimeIdentity,
  meta: CommandMeta,
): CommandResult {
  const guard = executableGuard(aggregate, runtime, meta);
  if (guard) return guard;
  const attempt = aggregate.attempts.find((candidate) => candidate.attemptId === input.attemptId);
  if (!attempt) return reject("attempt_not_found", "Attempt does not exist.");
  if (attempt.status === "authorized" && attempt.authorizationId === input.authorizationId) {
    return { ok: true, events: [], aggregate, idempotent: true, attemptId: attempt.attemptId };
  }
  if (
    aggregate.status !== "awaiting_authorization"
    || aggregate.activeAttemptId !== attempt.attemptId
    || attempt.status !== "pending_authorization"
    || !input.authorizationId.trim()
  ) {
    return reject("attempt_not_authorizable", "Attempt is not awaiting explicit authorization.");
  }
  const event: RunEvent = {
    ...eventBase(meta),
    type: "attempt_authorized",
    attemptId: attempt.attemptId,
    authorizationId: input.authorizationId,
  };
  return succeed(aggregate, [event], false, attempt.attemptId);
}

export function beginAuthorizedAttempt(
  aggregate: RunAggregate,
  input: BeginAttemptInput,
  runtime: RuntimeIdentity,
  meta: CommandMeta,
): CommandResult {
  const guard = executableGuard(aggregate, runtime, meta);
  if (guard) return guard;
  const stateError = transitionError(aggregate, "running");
  if (stateError) return stateError;
  const attempt = aggregate.attempts.find((candidate) => candidate.attemptId === input.attemptId);
  if (!attempt) return reject("attempt_not_found", "Attempt does not exist.");
  if (
    aggregate.activeAttemptId !== attempt.attemptId
    || attempt.status !== "authorized"
    || !attempt.authorizationId
    || attempt.authorizedBy !== "user"
  ) {
    return reject("attempt_not_startable", "Attempt lacks persisted explicit authorization.");
  }
  const event: RunEvent = { ...eventBase(meta), type: "attempt_started", attemptId: attempt.attemptId };
  return succeed(aggregate, [event], false, attempt.attemptId);
}

export function recordProgress(
  aggregate: RunAggregate,
  input: ProgressInput,
  runtime: RuntimeIdentity,
  meta: CommandMeta,
): CommandResult {
  const guard = executableGuard(aggregate, runtime, meta);
  if (guard) return guard;
  const attempt = activeAttempt(aggregate);
  if (aggregate.status !== "running" || attempt?.status !== "running" || attempt.attemptId !== input.attemptId) {
    return reject("attempt_not_running", "Progress requires the active running attempt.");
  }
  if (
    !Number.isInteger(input.completed)
    || !Number.isInteger(input.total)
    || input.completed < 0
    || input.total <= 0
    || input.completed > input.total
    || !input.heartbeatAt.trim()
  ) {
    return reject("invalid_progress", "Progress values are invalid.");
  }
  const event: RunEvent = {
    ...eventBase(meta),
    type: "stage_progress_recorded",
    attemptId: input.attemptId,
    progress: {
      completed: input.completed,
      total: input.total,
      heartbeatAt: input.heartbeatAt,
      message: input.message,
    },
  };
  return succeed(aggregate, [event], false, input.attemptId);
}

export function completeStage(
  aggregate: RunAggregate,
  input: CompleteInput,
  runtime: RuntimeIdentity,
  meta: CommandMeta,
): CommandResult {
  const guard = executableGuard(aggregate, runtime, meta);
  if (guard) return guard;
  const stateError = transitionError(aggregate, "saving");
  if (stateError) return stateError;
  const attempt = activeAttempt(aggregate);
  if (attempt?.status !== "running" || attempt.attemptId !== input.attemptId) {
    return reject("attempt_not_running", "Only the active running attempt can complete a stage.");
  }
  if (!input.artifactHash.trim()) return reject("invalid_artifact_hash", "Artifact hash is required.");
  const event: RunEvent = {
    ...eventBase(meta),
    type: "stage_completion_started",
    attemptId: input.attemptId,
    artifactHash: input.artifactHash,
  };
  return succeed(aggregate, [event], false, input.attemptId);
}

export function confirmStageSaved(
  aggregate: RunAggregate,
  input: SaveInput,
  runtime: RuntimeIdentity,
  meta: CommandMeta,
): CommandResult {
  const guard = executableGuard(aggregate, runtime, meta);
  if (guard) return guard;
  const target: RunStatus = input.final ? "completed" : "paused";
  const stateError = transitionError(aggregate, target);
  if (stateError) return stateError;
  if (!input.final && (!input.nextStage || input.nextStage === aggregate.stage)) {
    return reject("invalid_next_stage", "A different next stage is required.");
  }
  if (input.final && input.nextStage) return reject("invalid_next_stage", "Final save cannot specify a next stage.");
  const event: RunEvent = {
    ...eventBase(meta),
    type: "stage_saved",
    completedStage: aggregate.stage,
    nextStage: input.nextStage,
    final: input.final,
  };
  return succeed(aggregate, [event]);
}

export function pauseStage(
  aggregate: RunAggregate,
  input: Readonly<{ attemptId: string; reason: string }>,
  runtime: RuntimeIdentity,
  meta: CommandMeta,
): CommandResult {
  const guard = executableGuard(aggregate, runtime, meta);
  if (guard) return guard;
  const stateError = transitionError(aggregate, "paused");
  if (stateError) return stateError;
  const attempt = activeAttempt(aggregate);
  if (attempt?.status !== "running" || attempt.attemptId !== input.attemptId) {
    return reject("attempt_not_running", "Only the active running attempt can be paused.");
  }
  if (!input.reason.trim()) return reject("invalid_command_meta", "Pause reason is required.");
  const event: RunEvent = {
    ...eventBase(meta),
    type: "stage_paused",
    attemptId: input.attemptId,
    reason: input.reason,
  };
  return succeed(aggregate, [event], false, input.attemptId);
}

export function failStage(
  aggregate: RunAggregate,
  input: Readonly<{ failureCode: string }>,
  runtime: RuntimeIdentity,
  meta: CommandMeta,
): CommandResult {
  const guard = executableGuard(aggregate, runtime, meta);
  if (guard) return guard;
  const stateError = transitionError(aggregate, "failed");
  if (stateError) return stateError;
  if (!input.failureCode.trim()) return reject("invalid_command_meta", "Failure code is required.");
  const attempt = activeAttempt(aggregate);
  const event: RunEvent = {
    ...eventBase(meta),
    type: "stage_failed",
    attemptId: attempt?.attemptId,
    failureCode: input.failureCode,
  };
  return succeed(aggregate, [event], false, attempt?.attemptId);
}

export function blockContinuation(
  aggregate: RunAggregate,
  block: RunBlock,
  meta: CommandMeta,
): CommandResult {
  const metaError = validateMeta(meta, aggregate.revision);
  if (metaError) return metaError;
  if (TERMINAL_RUN_STATUSES.has(aggregate.status)) return reject("run_terminal", `Run is ${aggregate.status}.`);
  const stateError = transitionError(aggregate, "blocked");
  if (stateError) return stateError;
  const event: RunEvent = { ...eventBase(meta), type: "continuation_blocked", block };
  return succeed(aggregate, [event]);
}

export function abandonRun(aggregate: RunAggregate, reason: string, meta: CommandMeta): CommandResult {
  const metaError = validateMeta(meta, aggregate.revision);
  if (metaError) return metaError;
  const stateError = transitionError(aggregate, "abandoned");
  if (stateError) return stateError;
  if (!reason.trim()) return reject("invalid_command_meta", "Abandon reason is required.");
  const event: RunEvent = { ...eventBase(meta), type: "run_abandoned", reason };
  return succeed(aggregate, [event]);
}

export function startCleanRun(
  historicalRun: RunAggregate,
  newIdentity: RunIdentity,
  stage: PipelineStage,
  meta: CommandMeta,
): CommandResult {
  const metaError = validateMeta(meta, historicalRun.revision);
  if (metaError) return metaError;
  if (historicalRun.status !== "blocked") {
    return reject("invalid_transition", "A clean run is created only from a persisted blocked run.");
  }
  if (historicalRun.identity.runId === newIdentity.runId) {
    return reject("identity_conflict", "Clean run must use a new run ID.");
  }
  if (
    historicalRun.identity.workspace !== newIdentity.workspace
    || historicalRun.identity.datasetId !== newIdentity.datasetId
    || historicalRun.identity.orderVariant !== newIdentity.orderVariant
  ) {
    return reject("identity_conflict", "Clean run must preserve workspace, dataset, and order.");
  }
  return createRun(newIdentity, stage, { ...meta, expectedRevision: 0 });
}
