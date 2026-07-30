import { CONTROL_REGISTRY_NAME } from "./constants.ts";
import type {
  ActiveGenerationPointer,
  ControlRegistrySnapshot,
} from "./identities.ts";
import type { GenerationAttemptAggregate } from "./attempt-types.ts";
import type { PromotionPlan, RollbackPlan } from "./registry-types.ts";
import {
  activePointerFor,
  assertRegistrySnapshot,
  samePointer,
} from "./validators.ts";

function expectedNextPointer(
  aggregate: GenerationAttemptAggregate,
  snapshot: ControlRegistrySnapshot,
): ActiveGenerationPointer {
  const current = activePointerFor(snapshot, aggregate.manifest.workspace);
  return {
    workspace: aggregate.manifest.workspace,
    generationId: aggregate.manifest.generation.generationId,
    databaseName: aggregate.manifest.generation.databaseName,
    targetSnapshotHash: aggregate.manifest.expectedTargetSnapshotHash,
    sourceSha256: aggregate.manifest.source.sha256,
    attemptId: aggregate.attemptId,
    activationEpoch: (current?.activationEpoch ?? 0) + 1,
    registryRevision: snapshot.revision + 1,
    state: "active",
  };
}

export function planPromotion(
  aggregate: GenerationAttemptAggregate,
  snapshot: ControlRegistrySnapshot,
): PromotionPlan {
  if (aggregate.status !== "sealed" && aggregate.status !== "promotion_ready") {
    throw new Error(`promotion_not_plannable:${aggregate.status}`);
  }
  assertRegistrySnapshot(snapshot);
  const expected = aggregate.manifest.registry;
  if (snapshot.registryName !== expected.registryName || snapshot.registryName !== CONTROL_REGISTRY_NAME) {
    throw new Error("registry_identity_mismatch");
  }
  if (snapshot.schemaVersion !== expected.schemaVersion) throw new Error("registry_schema_mismatch");
  if (snapshot.revision !== expected.expectedRevision) throw new Error("registry_revision_mismatch");
  const current = activePointerFor(snapshot, aggregate.manifest.workspace);
  if (!samePointer(current, expected.expectedActivePointer)) throw new Error("active_pointer_mismatch");
  if (!aggregate.seal || aggregate.seal.targetSnapshotHash !== aggregate.manifest.expectedTargetSnapshotHash) {
    throw new Error("generation_not_sealed");
  }
  const nextPointer = expectedNextPointer(aggregate, snapshot);
  return {
    kind: "promotion",
    attemptId: aggregate.attemptId,
    authorizationId: aggregate.manifest.authorization.authorizationId,
    registryName: CONTROL_REGISTRY_NAME,
    expectedRegistryRevision: snapshot.revision,
    previousPointer: current,
    nextPointer,
    receiptDraft: {
      receiptId: `activation-${aggregate.attemptId}-${snapshot.revision + 1}`,
      attemptId: aggregate.attemptId,
      authorizationId: aggregate.manifest.authorization.authorizationId,
      workspace: aggregate.manifest.workspace,
      expectedRegistryRevision: snapshot.revision,
      previousPointer: current,
      nextPointer,
    },
    dataCopyRequired: false,
    networkAllowed: false,
    modelAllowed: false,
  };
}

export function planRollback(
  aggregate: GenerationAttemptAggregate,
  snapshot: ControlRegistrySnapshot,
): RollbackPlan {
  if (aggregate.status !== "rollback_required") throw new Error(`rollback_not_plannable:${aggregate.status}`);
  if (!aggregate.activationReceipt) throw new Error("activation_receipt_missing");
  assertRegistrySnapshot(snapshot);
  const active = activePointerFor(snapshot, aggregate.manifest.workspace);
  if (!samePointer(active, aggregate.activationReceipt.nextPointer)) throw new Error("rollback_active_pointer_mismatch");
  if (snapshot.revision !== aggregate.activationReceipt.committedRegistryRevision) {
    throw new Error("rollback_registry_revision_mismatch");
  }
  return {
    kind: "rollback",
    attemptId: aggregate.attemptId,
    registryName: CONTROL_REGISTRY_NAME,
    expectedRegistryRevision: snapshot.revision,
    replacedPointer: aggregate.activationReceipt.nextPointer,
    restoredPointer: aggregate.activationReceipt.previousPointer,
    receiptDraft: {
      receiptId: `rollback-${aggregate.attemptId}-${snapshot.revision + 1}`,
      attemptId: aggregate.attemptId,
      workspace: aggregate.manifest.workspace,
      expectedRegistryRevision: snapshot.revision,
      replacedPointer: aggregate.activationReceipt.nextPointer,
      restoredPointer: aggregate.activationReceipt.previousPointer,
    },
    payloadMutationRequired: false,
    networkAllowed: false,
    modelAllowed: false,
  };
}
