import { TERMINAL_ATTEMPT_STATUSES, ALLOWED_ATTEMPT_TRANSITIONS } from "./constants.ts";
import type {
  AttemptCommandResult,
  GenerationAttemptAggregate,
  GenerationAttemptCommand,
  GenerationAttemptInspection,
  GenerationAttemptEvent,
} from "./attempt-types.ts";
import { hashCanonical, type CanonicalHasher } from "./canonical-json.ts";
import { baseFor, commandFingerprint, reject, validateExecutionContext } from "./command-common.ts";
import { handlePrePromotionCommand } from "./command-prepromotion.ts";
import { handlePostPromotionCommand } from "./command-postpromotion.ts";

export function executeGenerationAttemptCommand(
  aggregate: GenerationAttemptAggregate,
  command: GenerationAttemptCommand,
  hasher: CanonicalHasher,
): AttemptCommandResult {
  const fingerprint = commandFingerprint(command, hasher);
  const contextError = validateExecutionContext(aggregate, command, fingerprint);
  if (contextError) return contextError;
  const base = baseFor(aggregate, command, fingerprint);
  const prePromotion = handlePrePromotionCommand(aggregate, command, base);
  if (prePromotion) return prePromotion;
  const postPromotion = handlePostPromotionCommand(aggregate, command, base);
  if (postPromotion) return postPromotion;
  return reject("invalid_transition", `Unsupported command ${command.type}.`);
}

export function inspectGenerationAttempt(
  aggregate: GenerationAttemptAggregate,
): GenerationAttemptInspection {
  const commands: Record<GenerationAttemptAggregate["status"], readonly GenerationAttemptCommand["type"][]> = {
    planned: ["consume_authorization", "interrupt", "stop_attempt"],
    authorization_consumed: ["verify_backup", "interrupt", "stop_attempt"],
    backup_verified: ["verify_source", "interrupt", "stop_attempt"],
    source_verified: ["record_generation_created", "interrupt", "stop_attempt"],
    generation_created: ["begin_import", "interrupt", "stop_attempt"],
    importing: ["record_import_completed", "interrupt", "stop_attempt"],
    imported: ["record_generation_verified", "interrupt", "stop_attempt"],
    verified: ["record_generation_sealed", "interrupt", "stop_attempt"],
    sealed: ["mark_promotion_ready", "interrupt", "stop_attempt"],
    promotion_ready: ["record_promotion_committed", "interrupt", "stop_attempt"],
    promotion_committed: ["record_resolver_verified", "require_rollback", "interrupt"],
    resolver_verified: ["complete_attempt", "require_rollback", "interrupt"],
    completed: [],
    rollback_required: ["record_rollback_committed"],
    rolled_back: [],
    blocked_recovery: [],
    stopped: [],
  };
  return {
    attemptId: aggregate.attemptId,
    status: aggregate.status,
    revision: aggregate.revision,
    terminal: TERMINAL_ATTEMPT_STATUSES.has(aggregate.status),
    retryAllowed: false,
    automaticResumeAllowed: false,
    sourceOpenAllowed: aggregate.status === "backup_verified",
    productionWriteAllowed: false,
    networkAllowed: false,
    modelAllowed: false,
    recoveryAction: aggregate.status === "rollback_required"
      ? "explicit_rollback"
      : aggregate.status === "blocked_recovery" || aggregate.status === "stopped"
        ? "offline_diagnosis"
        : "none",
    availableCommands: commands[aggregate.status],
  };
}

export function hashGenerationAttemptState(
  aggregate: GenerationAttemptAggregate,
  hasher: CanonicalHasher,
): string {
  return hashCanonical(aggregate, hasher);
}

export function hashGenerationAttemptEvents(
  events: readonly GenerationAttemptEvent[],
  hasher: CanonicalHasher,
): string {
  return hashCanonical(events, hasher);
}

export function attemptTransitionTable(): typeof ALLOWED_ATTEMPT_TRANSITIONS {
  return ALLOWED_ATTEMPT_TRANSITIONS;
}
