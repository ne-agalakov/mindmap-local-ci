import type { WorkspaceKind } from "../domain/run.ts";
import type { CONTROL_REGISTRY_NAME } from "./constants.ts";
import type { ActiveGenerationPointer } from "./identities.ts";

export interface ActivationReceipt {
  readonly receiptId: string;
  readonly attemptId: string;
  readonly authorizationId: string;
  readonly workspace: WorkspaceKind;
  readonly expectedRegistryRevision: number;
  readonly committedRegistryRevision: number;
  readonly previousPointer?: ActiveGenerationPointer;
  readonly nextPointer: ActiveGenerationPointer;
  readonly committedAt: string;
  readonly outcome: "committed";
}

export interface RollbackReceipt {
  readonly receiptId: string;
  readonly attemptId: string;
  readonly workspace: WorkspaceKind;
  readonly expectedRegistryRevision: number;
  readonly committedRegistryRevision: number;
  readonly replacedPointer: ActiveGenerationPointer;
  readonly restoredPointer?: ActiveGenerationPointer;
  readonly committedAt: string;
  readonly outcome: "rolled_back";
}

export interface ResolverVerification {
  readonly generationId: string;
  readonly databaseName: string;
  readonly targetSnapshotHash: string;
  readonly opened: true;
  readonly hashVerified: true;
  readonly networkCalls: 0;
  readonly modelCalls: 0;
}

export interface PromotionPlan {
  readonly kind: "promotion";
  readonly attemptId: string;
  readonly authorizationId: string;
  readonly registryName: typeof CONTROL_REGISTRY_NAME;
  readonly expectedRegistryRevision: number;
  readonly previousPointer?: ActiveGenerationPointer;
  readonly nextPointer: ActiveGenerationPointer;
  readonly receiptDraft: Readonly<{
    receiptId: string;
    attemptId: string;
    authorizationId: string;
    workspace: WorkspaceKind;
    expectedRegistryRevision: number;
    previousPointer?: ActiveGenerationPointer;
    nextPointer: ActiveGenerationPointer;
  }>;
  readonly dataCopyRequired: false;
  readonly networkAllowed: false;
  readonly modelAllowed: false;
}

export interface RollbackPlan {
  readonly kind: "rollback";
  readonly attemptId: string;
  readonly registryName: typeof CONTROL_REGISTRY_NAME;
  readonly expectedRegistryRevision: number;
  readonly replacedPointer: ActiveGenerationPointer;
  readonly restoredPointer?: ActiveGenerationPointer;
  readonly receiptDraft: Readonly<{
    receiptId: string;
    attemptId: string;
    workspace: WorkspaceKind;
    expectedRegistryRevision: number;
    replacedPointer: ActiveGenerationPointer;
    restoredPointer?: ActiveGenerationPointer;
  }>;
  readonly payloadMutationRequired: false;
  readonly networkAllowed: false;
  readonly modelAllowed: false;
}
