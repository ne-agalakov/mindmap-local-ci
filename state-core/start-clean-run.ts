import type {
  CommandMeta,
  PipelineStage,
  RunAggregate,
  RunIdentity,
  RuntimeIdentity,
} from "../domain/run.ts";
import {
  createRun,
  deriveCompatibilityBlock,
  type CommandResult,
} from "./run-state-core.ts";

const reject = (
  code: "stale_revision" | "invalid_transition" | "identity_conflict",
  message: string,
  details?: Readonly<Record<string, string | number | boolean | null>>,
): CommandResult => ({ ok: false, rejection: { code, message, details } });

export function startCleanRunFromRuntimeGuard(
  historicalRun: RunAggregate,
  newIdentity: RunIdentity,
  stage: PipelineStage,
  runtime: RuntimeIdentity,
  meta: CommandMeta,
): CommandResult {
  if (meta.expectedRevision !== historicalRun.revision) {
    return reject("stale_revision", "Command revision does not match the historical run revision.", {
      expectedRevision: meta.expectedRevision,
      currentRevision: historicalRun.revision,
    });
  }

  const block = deriveCompatibilityBlock(historicalRun, runtime);
  if (!block) {
    return reject("invalid_transition", "A clean run requires a persisted or derived compatibility block.");
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
  if (
    newIdentity.semanticModel !== runtime.configuredSemanticModel
    || newIdentity.embeddingModel !== runtime.configuredEmbeddingModel
    || newIdentity.storageSchema !== runtime.storageSchema
    || newIdentity.buildId !== runtime.buildId
    || !runtime.supportedPipelineVersions.includes(newIdentity.pipelineVersion)
  ) {
    return reject("identity_conflict", "Clean run identity must match the current runtime identity.");
  }

  return createRun(newIdentity, stage, {
    ...meta,
    expectedRevision: 0,
  });
}
