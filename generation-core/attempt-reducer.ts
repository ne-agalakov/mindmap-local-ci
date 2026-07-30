import { canTransitionAttempt } from "./constants.ts";
import type {
  GenerationAttemptAggregate,
  GenerationAttemptEvent,
  ProcessedCommandReceipt,
} from "./attempt-types.ts";
import { assertGenerationManifest } from "./validators.ts";

function withReceipt(
  aggregate: GenerationAttemptAggregate,
  event: GenerationAttemptEvent,
  changes: Omit<Partial<GenerationAttemptAggregate>, "processedCommands" | "revision">,
): GenerationAttemptAggregate {
  if (aggregate.processedCommands.some((receipt) => receipt.commandId === event.commandId)) {
    throw new Error(`duplicate_command_event:${event.commandId}`);
  }
  const receipt: ProcessedCommandReceipt = {
    commandId: event.commandId,
    commandFingerprint: event.commandFingerprint,
    sequence: event.sequence,
  };
  return {
    ...aggregate,
    ...changes,
    revision: event.sequence,
    processedCommands: [...aggregate.processedCommands, receipt],
  };
}

function assertEventTransition(
  aggregate: GenerationAttemptAggregate,
  target: GenerationAttemptAggregate["status"],
): void {
  if (!canTransitionAttempt(aggregate.status, target)) {
    throw new Error(`invalid_attempt_event_transition:${aggregate.status}:${target}`);
  }
}

export function applyGenerationAttemptEvent(
  aggregate: GenerationAttemptAggregate | undefined,
  event: GenerationAttemptEvent,
): GenerationAttemptAggregate {
  const expectedSequence = (aggregate?.revision ?? 0) + 1;
  if (event.sequence !== expectedSequence) {
    throw new Error(`non_contiguous_attempt_event_sequence:${event.sequence}:${expectedSequence}`);
  }

  if (event.type === "attempt_planned") {
    if (aggregate) throw new Error("attempt_already_exists");
    assertGenerationManifest(event.manifest);
    if (event.attemptId !== event.manifest.attemptId) throw new Error("attempt_identity_mismatch");
    return {
      attemptId: event.attemptId,
      status: "planned",
      revision: event.sequence,
      manifest: event.manifest,
      processedCommands: [{
        commandId: event.commandId,
        commandFingerprint: event.commandFingerprint,
        sequence: event.sequence,
      }],
    };
  }

  if (!aggregate) throw new Error("attempt_missing");
  if (event.attemptId !== aggregate.attemptId) throw new Error("attempt_identity_mismatch");

  switch (event.type) {
    case "authorization_consumed":
      assertEventTransition(aggregate, "authorization_consumed");
      return withReceipt(aggregate, event, {
        status: "authorization_consumed",
        authorizationConsumedAt: event.occurredAt,
      });
    case "backup_verified":
      assertEventTransition(aggregate, "backup_verified");
      return withReceipt(aggregate, event, { status: "backup_verified", backup: event.backup });
    case "source_verified":
      assertEventTransition(aggregate, "source_verified");
      return withReceipt(aggregate, event, { status: "source_verified", source: event.source });
    case "generation_created":
      assertEventTransition(aggregate, "generation_created");
      return withReceipt(aggregate, event, { status: "generation_created", generation: event.generation });
    case "import_started":
      assertEventTransition(aggregate, "importing");
      return withReceipt(aggregate, event, { status: "importing" });
    case "import_completed":
      assertEventTransition(aggregate, "imported");
      return withReceipt(aggregate, event, { status: "imported", importResult: event.result });
    case "generation_verified":
      assertEventTransition(aggregate, "verified");
      return withReceipt(aggregate, event, { status: "verified", verification: event.verification });
    case "generation_sealed":
      assertEventTransition(aggregate, "sealed");
      return withReceipt(aggregate, event, { status: "sealed", seal: event.seal });
    case "promotion_marked_ready":
      assertEventTransition(aggregate, "promotion_ready");
      return withReceipt(aggregate, event, {
        status: "promotion_ready",
        promotionRegistrySnapshot: event.registrySnapshot,
        promotionPlan: event.plan,
      });
    case "promotion_committed":
      assertEventTransition(aggregate, "promotion_committed");
      return withReceipt(aggregate, event, {
        status: "promotion_committed",
        activationReceipt: event.receipt,
      });
    case "resolver_verified":
      assertEventTransition(aggregate, "resolver_verified");
      return withReceipt(aggregate, event, {
        status: "resolver_verified",
        resolverVerification: event.verification,
      });
    case "attempt_completed":
      assertEventTransition(aggregate, "completed");
      return withReceipt(aggregate, event, { status: "completed" });
    case "rollback_required":
      assertEventTransition(aggregate, "rollback_required");
      return withReceipt(aggregate, event, {
        status: "rollback_required",
        rollbackReason: { code: event.reasonCode, message: event.message },
      });
    case "rollback_committed":
      assertEventTransition(aggregate, "rolled_back");
      return withReceipt(aggregate, event, { status: "rolled_back", rollbackReceipt: event.receipt });
    case "recovery_blocked":
      assertEventTransition(aggregate, "blocked_recovery");
      return withReceipt(aggregate, event, {
        status: "blocked_recovery",
        recovery: {
          checkpoint: event.checkpoint,
          reason: event.reason,
          previousStatus: event.previousStatus,
        },
      });
    case "attempt_stopped":
      assertEventTransition(aggregate, "stopped");
      return withReceipt(aggregate, event, {
        status: "stopped",
        stop: {
          code: event.stopCode,
          message: event.message,
          previousStatus: event.previousStatus,
        },
      });
  }
}

export function replayGenerationAttemptEvents(
  events: readonly GenerationAttemptEvent[],
): GenerationAttemptAggregate {
  let aggregate: GenerationAttemptAggregate | undefined;
  for (const event of events) aggregate = applyGenerationAttemptEvent(aggregate, event);
  if (!aggregate) throw new Error("empty_attempt_event_stream");
  return aggregate;
}
