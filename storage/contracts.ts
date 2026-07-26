import type { PipelineStage, RunAggregate, RunIdentity, WorkspaceKind } from "../domain/run.ts";
import type { RunEvent } from "../state-core/run-state-core.ts";

export const STATE_STORAGE_NAMESPACE = "mindmap-state-core-v1" as const;
export type StateStorageNamespace = typeof STATE_STORAGE_NAMESPACE;

export interface StoredRunRecord {
  readonly namespace: StateStorageNamespace;
  readonly workspace: WorkspaceKind;
  readonly runId: string;
  readonly revision: number;
  readonly aggregate: RunAggregate;
  readonly contentHash: string;
}

export interface StoredEventRecord {
  readonly namespace: StateStorageNamespace;
  readonly workspace: WorkspaceKind;
  readonly runId: string;
  readonly sequence: number;
  readonly event: RunEvent;
}

export interface StoredArtifactRecord {
  readonly namespace: StateStorageNamespace;
  readonly workspace: WorkspaceKind;
  readonly runId: string;
  readonly artifactId: string;
  readonly stage: PipelineStage;
  readonly version: number;
  readonly kind: string;
  readonly contentHash: string;
  readonly createdAt: string;
}

export interface StorageCommitRequest {
  readonly namespace: StateStorageNamespace;
  readonly transactionId: string;
  readonly idempotencyKey: string;
  readonly workspace: WorkspaceKind;
  readonly runId: string;
  readonly expectedRevision: number;
  readonly events: readonly RunEvent[];
  readonly aggregate: RunAggregate;
  readonly artifacts?: readonly StoredArtifactRecord[];
}

export interface StorageCommitReceipt {
  readonly transactionId: string;
  readonly idempotencyKey: string;
  readonly workspace: WorkspaceKind;
  readonly runId: string;
  readonly revision: number;
  readonly firstSequence: number;
  readonly lastSequence: number;
  readonly contentHash: string;
  readonly idempotent: boolean;
}

export type StorageRejectionCode =
  | "invalid_namespace"
  | "invalid_transaction"
  | "empty_event_batch"
  | "run_not_found"
  | "run_already_exists"
  | "stale_revision"
  | "non_contiguous_event_sequence"
  | "aggregate_revision_mismatch"
  | "aggregate_replay_mismatch"
  | "identity_mismatch"
  | "workspace_mismatch"
  | "artifact_mismatch"
  | "idempotency_conflict"
  | "transaction_aborted";

export type StorageCommitResult =
  | Readonly<{ ok: true; receipt: StorageCommitReceipt }>
  | Readonly<{
      ok: false;
      rejection: Readonly<{
        code: StorageRejectionCode;
        message: string;
        details?: Readonly<Record<string, string | number | boolean | null>>;
      }>;
    }>;

export interface StorageSnapshot {
  readonly namespace: StateStorageNamespace;
  readonly runs: readonly StoredRunRecord[];
  readonly events: readonly StoredEventRecord[];
  readonly artifacts: readonly StoredArtifactRecord[];
  readonly contentHash: string;
}

export interface TransactionalStateStorage {
  commit(request: StorageCommitRequest): Promise<StorageCommitResult>;
  loadRun(workspace: WorkspaceKind, runId: string): Promise<StoredRunRecord | undefined>;
  loadEvents(workspace: WorkspaceKind, runId: string): Promise<readonly StoredEventRecord[]>;
  loadArtifacts(workspace: WorkspaceKind, runId: string): Promise<readonly StoredArtifactRecord[]>;
  exportSnapshot(): Promise<StorageSnapshot>;
}

export type CanonicalContentHasher = (canonicalContent: string) => Promise<string> | string;

export interface MigrationSourceIdentity {
  readonly sourceDatabaseSha256: string;
  readonly sourceSizeBytes: number;
  readonly sourceWorkspace: WorkspaceKind;
  readonly thoughtCount: number;
  readonly nodeCount: number;
  readonly linkCount: number;
  readonly eventCount: number;
  readonly personalThoughtCount: number;
}

export interface MigrationRunPlan {
  readonly identity: RunIdentity;
  readonly sourceEventCount: number;
  readonly expectedTargetRevision: number;
}

export type MigrationStopCode =
  | "source_hash_mismatch"
  | "source_size_mismatch"
  | "personal_data_present"
  | "workspace_mismatch"
  | "ambiguous_legacy_state"
  | "invalid_reference"
  | "target_not_empty";

export type MigrationPlanResult =
  | Readonly<{
      ok: true;
      source: MigrationSourceIdentity;
      targetNamespace: StateStorageNamespace;
      runs: readonly MigrationRunPlan[];
      sourceWriteAllowed: false;
      targetWritePerformed: false;
      networkCallAllowed: false;
      aiCallAllowed: false;
    }>
  | Readonly<{
      ok: false;
      stop: Readonly<{
        code: MigrationStopCode;
        message: string;
        details?: Readonly<Record<string, string | number | boolean | null>>;
      }>;
      sourceWriteAllowed: false;
      targetWritePerformed: false;
      networkCallAllowed: false;
      aiCallAllowed: false;
    }>;
