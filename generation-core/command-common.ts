import { TERMINAL_ATTEMPT_STATUSES, canTransitionAttempt } from "./constants.ts";
import type { GenerationExecutionManifest, GenerationIdentity } from "./identities.ts";
import type {
  AttemptCommandMeta,
  AttemptCommandResult,
  AttemptEventBase,
  AttemptRejectionCode,
  GenerationAttemptAggregate,
  GenerationAttemptCommand,
  GenerationAttemptEvent,
} from "./attempt-types.ts";
import { hashCanonical, type CanonicalHasher } from "./canonical-json.ts";
import { applyGenerationAttemptEvent } from "./attempt-reducer.ts";
import { assertGenerationIdentity, assertGenerationManifest } from "./validators.ts";

export const reject = (
  code: AttemptRejectionCode,
  message: string,
  details?: Readonly<Record<string, string | number | boolean | null>>,
): AttemptCommandResult => ({ ok: false, rejection: { code, message, details } });

export function validateMeta(
  meta: AttemptCommandMeta,
  revision: number,
): AttemptCommandResult | undefined {
  if (!meta.commandId.trim() || !meta.occurredAt.trim() || !Number.isSafeInteger(meta.expectedRevision) || meta.expectedRevision < 0) {
    return reject("invalid_command_meta", "Command metadata is incomplete or invalid.");
  }
  if (meta.expectedRevision !== revision) {
    return reject("stale_revision", "Command revision does not match the attempt revision.", {
      expectedRevision: meta.expectedRevision,
      currentRevision: revision,
    });
  }
  return undefined;
}

export function commandFingerprint(
  command: GenerationAttemptCommand,
  hasher: CanonicalHasher,
): string {
  const { meta: _meta, ...logicalCommand } = command;
  return hashCanonical(logicalCommand, hasher);
}

function plannedFingerprint(
  manifest: GenerationExecutionManifest,
  hasher: CanonicalHasher,
): string {
  return hashCanonical({ type: "plan_attempt", attemptId: manifest.attemptId, manifest }, hasher);
}

export function baseFor(
  aggregate: GenerationAttemptAggregate,
  command: GenerationAttemptCommand,
  fingerprint: string,
): AttemptEventBase {
  return {
    eventId: `${command.meta.commandId}:0`,
    commandId: command.meta.commandId,
    commandFingerprint: fingerprint,
    attemptId: aggregate.attemptId,
    sequence: aggregate.revision + 1,
    occurredAt: command.meta.occurredAt,
  };
}

export function idempotencyResult(
  aggregate: GenerationAttemptAggregate,
  command: GenerationAttemptCommand,
  fingerprint: string,
): AttemptCommandResult | undefined {
  const receipt = aggregate.processedCommands.find((item) => item.commandId === command.meta.commandId);
  if (!receipt) return undefined;
  return receipt.commandFingerprint === fingerprint
    ? { ok: true, aggregate, events: [], idempotent: true }
    : reject("idempotency_conflict", "Command ID was already used with different logical content.", {
        commandId: command.meta.commandId,
      });
}

export function transitionRejection(
  aggregate: GenerationAttemptAggregate,
  target: GenerationAttemptAggregate["status"],
): AttemptCommandResult | undefined {
  if (canTransitionAttempt(aggregate.status, target)) return undefined;
  return reject("invalid_transition", `Transition ${aggregate.status} -> ${target} is not allowed.`, {
    from: aggregate.status,
    to: target,
  });
}

export function succeed(
  aggregate: GenerationAttemptAggregate,
  event: GenerationAttemptEvent,
): AttemptCommandResult {
  return {
    ok: true,
    aggregate: applyGenerationAttemptEvent(aggregate, event),
    events: [event],
    idempotent: false,
  };
}

export function exactGenerationMatches(
  expected: GenerationIdentity,
  actual: GenerationIdentity,
): boolean {
  try {
    assertGenerationIdentity(actual);
  } catch {
    return false;
  }
  return expected.generationId === actual.generationId
    && expected.databaseName === actual.databaseName
    && expected.workspace === actual.workspace
    && expected.attemptId === actual.attemptId
    && expected.storageSchema === actual.storageSchema
    && expected.mappingVersion === actual.mappingVersion;
}

export function planGenerationAttempt(
  manifest: GenerationExecutionManifest,
  meta: AttemptCommandMeta,
  hasher: CanonicalHasher,
): AttemptCommandResult {
  const metaError = validateMeta(meta, 0);
  if (metaError) return metaError;
  try {
    assertGenerationManifest(manifest);
  } catch (error) {
    return reject(
      "generation_identity_mismatch",
      error instanceof Error ? error.message : "Invalid generation manifest.",
    );
  }
  const fingerprint = plannedFingerprint(manifest, hasher);
  const event: GenerationAttemptEvent = {
    type: "attempt_planned",
    eventId: `${meta.commandId}:0`,
    commandId: meta.commandId,
    commandFingerprint: fingerprint,
    attemptId: manifest.attemptId,
    sequence: 1,
    occurredAt: meta.occurredAt,
    manifest,
  };
  return {
    ok: true,
    aggregate: applyGenerationAttemptEvent(undefined, event),
    events: [event],
    idempotent: false,
  };
}

export function validateExecutionContext(
  aggregate: GenerationAttemptAggregate,
  command: GenerationAttemptCommand,
  fingerprint: string,
): AttemptCommandResult | undefined {
  const idempotent = idempotencyResult(aggregate, command, fingerprint);
  if (idempotent) return idempotent;
  if (command.attemptId !== aggregate.attemptId) {
    return reject("attempt_identity_mismatch", "Command attempt identity does not match the aggregate.");
  }
  const metaError = validateMeta(command.meta, aggregate.revision);
  if (metaError) return metaError;
  if (TERMINAL_ATTEMPT_STATUSES.has(aggregate.status)) {
    return reject("attempt_terminal", `Attempt is ${aggregate.status}; retry/resume is prohibited.`);
  }
  return undefined;
}
