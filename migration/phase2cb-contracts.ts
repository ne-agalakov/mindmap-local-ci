import type { PipelineStage, WorkspaceKind } from "../domain/run.ts";
import type {
  DamagedReferenceReason,
  GraphLinkKind,
  MindMapGraphState,
  PlacementReason,
  ProjectState,
  ThoughtLifecycleStatus,
  ThoughtSemanticType,
} from "../graph-storage/contracts.ts";
import type { GraphCommitRequest } from "../graph-storage/contracts.ts";
import type { StorageCommitRequest } from "../storage/contracts.ts";

export const PHASE2CB_MAPPING_VERSION = "phase2cb-mapping-v1" as const;
export const PHASE2CB_TEMP_DATABASE_PREFIX = "mindmap-state-core-v1-phase2cb-dry-run-" as const;

export interface Phase2CbSourceIdentity {
  readonly databaseSha256: string;
  readonly sizeBytes: number;
  readonly sqliteHeaderValid: boolean;
  readonly quickCheck: "ok" | string;
  readonly integrityCheck: "ok" | string;
  readonly workspace: WorkspaceKind;
  readonly thoughtCount: number;
  readonly nodeCount: number;
  readonly linkCount: number;
  readonly embeddingCount: number;
  readonly unresolvedThoughtCount: number;
  readonly damagedReferenceCount: number;
  readonly eventCount: number;
  readonly runCount: number;
  readonly personalThoughtCount: number;
}

export interface Phase2CbTargetIdentity {
  readonly databaseName: string;
  readonly workspace: WorkspaceKind;
  readonly mode: "isolated-temporary";
  readonly isEmpty: boolean;
  readonly isTargetMacProduction: false;
}

export interface Phase2CbLegacyNode {
  readonly id: string;
  readonly name: string;
  readonly kind: string;
  readonly parentId?: string;
  readonly createdAt: string;
  readonly updatedAt?: string;
  readonly status: string;
  readonly legacyMetadata?: unknown;
}

export interface Phase2CbLegacyDamagedReference {
  readonly field: string;
  readonly targetKind: "thought" | "node";
  readonly targetId: string;
  readonly reason: DamagedReferenceReason;
  readonly detectedAt: string;
}

export interface Phase2CbLegacyThought {
  readonly id: string;
  readonly originalContent: string;
  readonly type: string;
  readonly status: string;
  readonly createdAt: string;
  readonly updatedAt?: string;
  readonly embeddingModel: string;
  readonly embedding: readonly number[];
  readonly primaryNodeId?: string;
  readonly additionalNodeIds?: readonly string[];
  readonly unresolved?: Readonly<{ reason: PlacementReason }>;
  readonly damagedReferences?: readonly Phase2CbLegacyDamagedReference[];
  readonly legacyMetadata?: unknown;
}

export interface Phase2CbLegacyLink {
  readonly id: string;
  readonly sourceId: string;
  readonly targetId: string;
  readonly type: string;
  readonly status: string;
  readonly createdAt: string;
  readonly updatedAt?: string;
  readonly legacyMetadata?: unknown;
}

export interface Phase2CbLegacyRun {
  readonly runId: string;
  readonly datasetId: string;
  readonly orderVariant: string;
  readonly semanticModel: string;
  readonly embeddingModel: string;
  readonly pipelineVersion: string;
  readonly sourceBuildId: string;
  readonly initialStage: PipelineStage;
  readonly sourceEventCount: number;
  readonly historyCreatedAt: string;
  readonly history: unknown;
  readonly ambiguityCodes?: readonly string[];
  readonly invalidReferenceCount?: number;
}

export interface Phase2CbMappingCandidate {
  readonly source: Phase2CbSourceIdentity;
  readonly target: Phase2CbTargetIdentity;
  readonly thoughts: readonly Phase2CbLegacyThought[];
  readonly nodes: readonly Phase2CbLegacyNode[];
  readonly links: readonly Phase2CbLegacyLink[];
  readonly runs: readonly Phase2CbLegacyRun[];
}

export type Phase2CbStopCode =
  | "source_hash_mismatch"
  | "source_size_mismatch"
  | "source_schema_mismatch"
  | "source_integrity_failed"
  | "count_mismatch"
  | "personal_data_present"
  | "workspace_mismatch"
  | "target_namespace_forbidden"
  | "target_not_empty"
  | "duplicate_identity"
  | "payload_conflict"
  | "ambiguous_mapping"
  | "invalid_reference"
  | "invalid_hierarchy"
  | "invalid_embedding"
  | "invalid_timestamp"
  | "mapping_integrity_failed"
  | "transaction_failure";

export interface Phase2CbStop {
  readonly code: Phase2CbStopCode;
  readonly message: string;
  readonly details?: Readonly<Record<string, string | number | boolean | null>>;
}

export interface Phase2CbMappingDiagnostics {
  readonly sourceCounts: Readonly<{
    thoughts: number;
    nodes: number;
    links: number;
    embeddings: number;
    unresolved: number;
    damagedReferences: number;
    events: number;
    runs: number;
  }>;
  readonly targetCounts: Readonly<{
    payloads: number;
    thoughts: number;
    nodes: number;
    placements: number;
    links: number;
    embeddings: number;
    damagedReferences: number;
    runCommits: number;
    runHistoryArtifacts: number;
    legacyMetadataArtifacts: number;
  }>;
  readonly generatedAdditionalPlacementLinks: number;
  readonly sourceSemanticEntitiesInvented: 0;
  readonly sourceRecordsDropped: 0;
}

export interface Phase2CbRollbackContract {
  readonly strategy: "delete-isolated-target-on-any-failure";
  readonly sourceHashBeforeAfterRequired: true;
  readonly targetMustStartEmpty: true;
  readonly partialTargetAllowed: false;
  readonly repeatRunHashEqualityRequired: true;
  readonly diagnosticSchema: "mindmap-phase2cb-dry-run-diagnostic-v1";
}

export interface Phase2CbMappingPlan {
  readonly mappingVersion: typeof PHASE2CB_MAPPING_VERSION;
  readonly source: Phase2CbSourceIdentity;
  readonly target: Phase2CbTargetIdentity;
  readonly graphCommit: GraphCommitRequest;
  readonly graphState: MindMapGraphState;
  readonly graphContentHash: string;
  readonly runCommits: readonly StorageCommitRequest[];
  readonly mappingContentHash: string;
  readonly diagnostics: Phase2CbMappingDiagnostics;
  readonly rollbackContract: Phase2CbRollbackContract;
  readonly sourceWriteAllowed: false;
  readonly targetWritePerformed: false;
  readonly networkCallAllowed: false;
  readonly aiCallAllowed: false;
  readonly actualMigrationAllowed: false;
}

export type Phase2CbMappingResult =
  | Readonly<{ ok: true; plan: Phase2CbMappingPlan }>
  | Readonly<{
      ok: false;
      stop: Phase2CbStop;
      sourceWriteAllowed: false;
      targetWritePerformed: false;
      networkCallAllowed: false;
      aiCallAllowed: false;
      actualMigrationAllowed: false;
    }>;

export type Phase2CbHashCanonical = (canonicalContent: string) => string | Promise<string>;
export type Phase2CbHashBytes = (bytes: Uint8Array) => string | Promise<string>;

export interface Phase2CbMappingOptions {
  readonly hashCanonical: Phase2CbHashCanonical;
  readonly hashBytes: Phase2CbHashBytes;
}

export interface Phase2CbMappedVocabulary {
  readonly thoughtType: Readonly<Record<string, ThoughtSemanticType>>;
  readonly thoughtStatus: Readonly<Record<string, ThoughtLifecycleStatus>>;
  readonly projectState: Readonly<Record<string, ProjectState>>;
  readonly linkKind: Readonly<Record<string, GraphLinkKind>>;
}
