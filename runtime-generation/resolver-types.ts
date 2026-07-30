import type { WorkspaceKind } from "../domain/run.ts";
import type { ActiveGenerationPointer, GenerationIdentity, GenerationSeal } from "../generation-core/identities.ts";
import type { CanonicalHasher } from "../generation-core/canonical-json.ts";

export const C3_RESOLVER_PHASE = "phase2cc-c3" as const;
export const C3_RESOLVER_MODEL = "без AI" as const;

export type C3ResolverStage =
  | "validate_request"
  | "read_registry"
  | "verify_pointer"
  | "read_generation"
  | "recheck_registry"
  | "complete";

export type C3ResolverRuntimeState =
  | "working"
  | "verifying"
  | "completed"
  | "failed"
  | "possibly_hung";

export interface C3ResolverObservation {
  readonly phase: typeof C3_RESOLVER_PHASE;
  readonly workName: "Packaged active generation resolver";
  readonly workType: "local";
  readonly stage: C3ResolverStage;
  readonly state: C3ResolverRuntimeState;
  readonly elapsedMs: number;
  readonly stageElapsedMs: number;
  readonly processed: number;
  readonly total: number;
  readonly heartbeat: number;
  readonly lastProgressAt: string;
  readonly inactivityMs: number;
  readonly model: typeof C3_RESOLVER_MODEL;
  readonly message?: string;
}

export type C3ResolverRejectionCode =
  | "invalid_request"
  | "unknown_workspace"
  | "database_enumeration_unavailable"
  | "registry_database_missing"
  | "registry_open_failed"
  | "registry_schema_mismatch"
  | "registry_identity_mismatch"
  | "registry_revision_mismatch"
  | "workspace_pointer_missing"
  | "pointer_identity_mismatch"
  | "seal_attestation_missing"
  | "seal_attestation_mismatch"
  | "generation_database_missing"
  | "generation_open_failed"
  | "generation_schema_mismatch"
  | "generation_identity_mismatch"
  | "generation_workspace_mismatch"
  | "generation_seal_missing"
  | "generation_seal_mismatch"
  | "generation_snapshot_hash_mismatch"
  | "registry_pointer_changed"
  | "interrupted_verification"
  | "unexpected_failure";

export interface C3ResolverRejection {
  readonly code: C3ResolverRejectionCode;
  readonly message: string;
  readonly stage: C3ResolverStage;
  readonly details?: Readonly<Record<string, string | number | boolean | null>>;
}

export interface C3ResolvedGeneration {
  readonly workspace: "synthetic";
  readonly registryDatabaseName: string;
  readonly registryRevision: number;
  readonly activePointer: ActiveGenerationPointer;
  readonly physicalGenerationDatabaseName: string;
  readonly logicalGeneration: GenerationIdentity;
  readonly seal: GenerationSeal;
  readonly targetSnapshotHash: string;
  readonly verificationFingerprint: string;
  readonly resolvedAt: string;
  readonly openedReadOnly: true;
  readonly hashVerified: true;
  readonly fallbackUsed: false;
  readonly mutationCount: 0;
  readonly networkCalls: 0;
  readonly modelCalls: 0;
  readonly personalDataUsed: false;
}

export interface C3SanitizedDiagnostics {
  readonly phase: typeof C3_RESOLVER_PHASE;
  readonly status: "passed" | "failed";
  readonly workspace: "synthetic";
  readonly registryDatabaseName: string;
  readonly registryRevision?: number;
  readonly physicalGenerationDatabaseName?: string;
  readonly generationId?: string;
  readonly targetSnapshotHash?: string;
  readonly verificationFingerprint?: string;
  readonly rejection?: C3ResolverRejection;
  readonly observations: readonly C3ResolverObservation[];
  readonly readOnly: true;
  readonly fallbackUsed: false;
  readonly automaticResumeAllowed: false;
  readonly automaticRetryAllowed: false;
  readonly exactSourceOpened: false;
  readonly backupAccessed: false;
  readonly productionNamespaceUsed: false;
  readonly actualMigrationPerformed: false;
  readonly networkCalls: 0;
  readonly modelCalls: 0;
  readonly personalDataUsed: false;
}

export type C3ResolverResult =
  | Readonly<{
      ok: true;
      value: C3ResolvedGeneration;
      diagnostics: C3SanitizedDiagnostics;
    }>
  | Readonly<{
      ok: false;
      rejection: C3ResolverRejection;
      diagnostics: C3SanitizedDiagnostics;
    }>;

export type C3ResolverCheckpoint =
  | "after_request_validation"
  | "after_registry_read"
  | "after_pointer_verification"
  | "after_generation_verification"
  | "before_final_registry_read";

export interface C3ResolverOptions {
  readonly indexedDB: IDBFactory;
  readonly registryDatabaseName: string;
  readonly workspace: WorkspaceKind;
  readonly hasher: CanonicalHasher;
  readonly signal?: AbortSignal;
  readonly hangThresholdMs?: number;
  readonly now?: () => number;
  readonly nowIso?: () => string;
  readonly onObservation?: (observation: C3ResolverObservation) => void;
  readonly onCheckpoint?: (checkpoint: C3ResolverCheckpoint) => void | Promise<void>;
}
