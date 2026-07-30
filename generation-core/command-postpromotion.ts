import {
  ATTEMPT_STOP_CODES,
  RECOVERY_CHECKPOINTS,
  ROLLBACK_REASON_CODES,
} from "./constants.ts";
import type {
  AttemptCommandResult,
  AttemptEventBase,
  GenerationAttemptAggregate,
  GenerationAttemptCommand,
} from "./attempt-types.ts";
import type { RollbackPlan } from "./registry-types.ts";
import { planRollback } from "./plans.ts";
import { reject, succeed, transitionRejection } from "./command-common.ts";
import { samePointer } from "./validators.ts";

export function handlePostPromotionCommand(
  aggregate: GenerationAttemptAggregate,
  command: GenerationAttemptCommand,
  base: AttemptEventBase,
): AttemptCommandResult | undefined {
  switch (command.type) {
    case "record_promotion_committed": {
      const transition = transitionRejection(aggregate, "promotion_committed");
      if (transition) return transition;
      const plan = aggregate.promotionPlan;
      if (!plan) return reject("activation_receipt_mismatch", "Promotion plan is missing.");
      const receipt = command.receipt;
      if (
        receipt.attemptId !== plan.attemptId
        || receipt.authorizationId !== plan.authorizationId
        || receipt.workspace !== aggregate.manifest.workspace
        || receipt.expectedRegistryRevision !== plan.expectedRegistryRevision
        || receipt.committedRegistryRevision !== plan.expectedRegistryRevision + 1
        || !samePointer(receipt.previousPointer, plan.previousPointer)
        || !samePointer(receipt.nextPointer, plan.nextPointer)
        || receipt.outcome !== "committed"
        || !receipt.receiptId.trim()
        || !receipt.committedAt.trim()
      ) return reject("activation_receipt_mismatch", "Activation receipt does not match the promotion plan.");
      return succeed(aggregate, { ...base, type: "promotion_committed", receipt });
    }
    case "record_resolver_verified": {
      const transition = transitionRejection(aggregate, "resolver_verified");
      if (transition) return transition;
      const expected = aggregate.manifest;
      if (
        command.verification.generationId !== expected.generation.generationId
        || command.verification.databaseName !== expected.generation.databaseName
        || command.verification.targetSnapshotHash !== expected.expectedTargetSnapshotHash
        || !command.verification.opened
        || !command.verification.hashVerified
        || command.verification.networkCalls !== 0
        || command.verification.modelCalls !== 0
      ) return reject("resolver_verification_mismatch", "Resolver verification does not match the activated generation.");
      return succeed(aggregate, { ...base, type: "resolver_verified", verification: command.verification });
    }
    case "complete_attempt": {
      const transition = transitionRejection(aggregate, "completed");
      if (transition) return transition;
      return succeed(aggregate, { ...base, type: "attempt_completed" });
    }
    case "require_rollback": {
      const transition = transitionRejection(aggregate, "rollback_required");
      if (transition) return transition;
      if (!ROLLBACK_REASON_CODES.includes(command.reasonCode) || !command.message.trim()) {
        return reject("invalid_stop", "Typed rollback reason and message are required.");
      }
      return succeed(aggregate, {
        ...base,
        type: "rollback_required",
        reasonCode: command.reasonCode,
        message: command.message,
      });
    }
    case "record_rollback_committed": {
      const transition = transitionRejection(aggregate, "rolled_back");
      if (transition) return transition;
      let plan: RollbackPlan;
      try {
        plan = planRollback(aggregate, command.registrySnapshot);
      } catch (error) {
        return reject("rollback_not_required", error instanceof Error ? error.message : "Rollback plan unavailable.");
      }
      const receipt = command.receipt;
      if (
        receipt.attemptId !== plan.attemptId
        || receipt.workspace !== aggregate.manifest.workspace
        || receipt.expectedRegistryRevision !== plan.expectedRegistryRevision
        || receipt.committedRegistryRevision !== plan.expectedRegistryRevision + 1
        || !samePointer(receipt.replacedPointer, plan.replacedPointer)
        || !samePointer(receipt.restoredPointer, plan.restoredPointer)
        || receipt.outcome !== "rolled_back"
        || !receipt.receiptId.trim()
        || !receipt.committedAt.trim()
      ) return reject("rollback_receipt_mismatch", "Rollback receipt does not match the explicit rollback plan.");
      return succeed(aggregate, { ...base, type: "rollback_committed", receipt });
    }
    case "interrupt": {
      if (!RECOVERY_CHECKPOINTS.includes(command.checkpoint) || !command.reason.trim()) {
        return reject("invalid_recovery_checkpoint", "Typed interruption checkpoint and reason are required.");
      }
      if (["promotion_committed", "resolver_verified"].includes(aggregate.status)) {
        const transition = transitionRejection(aggregate, "rollback_required");
        if (transition) return transition;
        return succeed(aggregate, {
          ...base,
          type: "rollback_required",
          reasonCode: "interrupted_after_promotion",
          message: `${command.checkpoint}:${command.reason}`,
        });
      }
      const transition = transitionRejection(aggregate, "blocked_recovery");
      if (transition) return transition;
      return succeed(aggregate, {
        ...base,
        type: "recovery_blocked",
        checkpoint: command.checkpoint,
        reason: command.reason,
        previousStatus: aggregate.status,
      });
    }
    case "stop_attempt": {
      if (["promotion_committed", "resolver_verified", "rollback_required"].includes(aggregate.status)) {
        return reject(
          "post_promotion_stop_requires_rollback",
          "A post-promotion attempt must use explicit rollback; it cannot stop silently.",
        );
      }
      const transition = transitionRejection(aggregate, "stopped");
      if (transition) return transition;
      if (!ATTEMPT_STOP_CODES.includes(command.stopCode) || !command.message.trim()) {
        return reject("invalid_stop", "Typed stop code and message are required.");
      }
      return succeed(aggregate, {
        ...base,
        type: "attempt_stopped",
        stopCode: command.stopCode,
        message: command.message,
        previousStatus: aggregate.status,
      });
    }
    default:
      return undefined;
  }
}
