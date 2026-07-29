import type { AttemptCommandResult, GenerationAttemptAggregate, GenerationAttemptCommand } from "./attempt-types.ts";
import type { AttemptEventBase } from "./attempt-types.ts";
import type { PromotionPlan } from "./registry-types.ts";
import { planPromotion } from "./plans.ts";
import { exactGenerationMatches, reject, succeed, transitionRejection } from "./command-common.ts";
import { sameCounts } from "./validators.ts";

export function handlePrePromotionCommand(
  aggregate: GenerationAttemptAggregate,
  command: GenerationAttemptCommand,
  base: AttemptEventBase,
): AttemptCommandResult | undefined {
  switch (command.type) {
    case "consume_authorization": {
      if (aggregate.authorizationConsumedAt) {
        return reject("authorization_already_consumed", "One-shot authorization is already consumed.");
      }
      const transition = transitionRejection(aggregate, "authorization_consumed");
      if (transition) return transition;
      if (command.authorizationId !== aggregate.manifest.authorization.authorizationId) {
        return reject("authorization_mismatch", "Authorization identity does not match the frozen manifest.");
      }
      return succeed(aggregate, { ...base, type: "authorization_consumed", authorizationId: command.authorizationId });
    }
    case "verify_backup": {
      const transition = transitionRejection(aggregate, "backup_verified");
      if (transition) return transition;
      const expected = aggregate.manifest.backup;
      if (
        command.backup.backupId !== expected.backupId
        || command.backup.sizeBytes !== expected.expectedSizeBytes
        || command.backup.sha256 !== expected.expectedSha256
        || command.backup.quickCheck !== "ok"
        || command.backup.integrityCheck !== "ok"
        || !command.backup.independentlyVerified
      ) return reject("backup_identity_mismatch", "Verified backup does not match the immutable expectation.");
      return succeed(aggregate, { ...base, type: "backup_verified", backup: command.backup });
    }
    case "verify_source": {
      const transition = transitionRejection(aggregate, "source_verified");
      if (transition) return transition;
      const expected = aggregate.manifest.source;
      if (
        command.source.sizeBytes !== expected.sizeBytes
        || command.source.sha256 !== expected.sha256
        || command.source.quickCheck !== "ok"
        || command.source.integrityCheck !== "ok"
        || !command.source.readonlyMode
        || !command.source.queryOnly
        || command.source.writePerformed
      ) return reject("source_identity_mismatch", "Verified source does not match the frozen read-only identity.");
      return succeed(aggregate, { ...base, type: "source_verified", source: command.source });
    }
    case "record_generation_created": {
      const transition = transitionRejection(aggregate, "generation_created");
      if (transition) return transition;
      if (!exactGenerationMatches(aggregate.manifest.generation, command.generation)) {
        return reject("generation_identity_mismatch", "Created generation does not match the manifest.");
      }
      return succeed(aggregate, { ...base, type: "generation_created", generation: command.generation });
    }
    case "begin_import": {
      const transition = transitionRejection(aggregate, "importing");
      if (transition) return transition;
      return succeed(aggregate, { ...base, type: "import_started" });
    }
    case "record_import_completed": {
      const transition = transitionRejection(aggregate, "imported");
      if (transition) return transition;
      const expected = aggregate.manifest;
      if (
        command.result.portablePlanHash !== expected.expectedPortablePlanHash
        || command.result.targetSnapshotHash !== expected.expectedTargetSnapshotHash
        || !sameCounts(command.result.counts, expected.source.counts)
        || command.result.sourceWritePerformed
        || command.result.networkCalls !== 0
        || command.result.modelCalls !== 0
      ) return reject("import_result_mismatch", "Import result does not match the frozen deterministic projection.");
      return succeed(aggregate, { ...base, type: "import_completed", result: command.result });
    }
    case "record_generation_verified": {
      const transition = transitionRejection(aggregate, "verified");
      if (transition) return transition;
      const expected = aggregate.manifest;
      if (
        command.verification.targetSnapshotHash !== expected.expectedTargetSnapshotHash
        || !sameCounts(command.verification.counts, expected.source.counts)
        || !command.verification.reopened
        || !command.verification.referencesValid
        || !command.verification.unresolvedPreserved
        || command.verification.networkCalls !== 0
        || command.verification.modelCalls !== 0
      ) return reject("verification_mismatch", "Reopened generation verification does not match the manifest.");
      return succeed(aggregate, { ...base, type: "generation_verified", verification: command.verification });
    }
    case "record_generation_sealed": {
      const transition = transitionRejection(aggregate, "sealed");
      if (transition) return transition;
      const expected = aggregate.manifest;
      if (
        !command.seal.sealed
        || command.seal.generationId !== expected.generation.generationId
        || command.seal.databaseName !== expected.generation.databaseName
        || command.seal.targetSnapshotHash !== expected.expectedTargetSnapshotHash
        || command.seal.networkCalls !== 0
        || command.seal.modelCalls !== 0
        || !command.seal.sealId.trim()
        || !command.seal.sealedAt.trim()
      ) return reject("seal_mismatch", "Generation seal does not match the verified generation.");
      return succeed(aggregate, { ...base, type: "generation_sealed", seal: command.seal });
    }
    case "mark_promotion_ready": {
      const transition = transitionRejection(aggregate, "promotion_ready");
      if (transition) return transition;
      let plan: PromotionPlan;
      try {
        plan = planPromotion(aggregate, command.registrySnapshot);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Promotion plan rejected.";
        if (message.includes("revision")) return reject("registry_revision_mismatch", message);
        if (message.includes("pointer")) return reject("active_pointer_mismatch", message);
        return reject("registry_identity_mismatch", message);
      }
      return succeed(aggregate, {
        ...base,
        type: "promotion_marked_ready",
        registrySnapshot: command.registrySnapshot,
        plan,
      });
    }
    default:
      return undefined;
  }
}
