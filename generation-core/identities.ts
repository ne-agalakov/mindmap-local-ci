import type { WorkspaceKind } from "../domain/run.ts";
import type {
  CONTROL_REGISTRY_NAME,
  CONTROL_REGISTRY_SCHEMA_VERSION,
  GENERATION_MANIFEST_VERSION,
  GENERATION_MAPPING_VERSION,
  GENERATION_STORAGE_SCHEMA,
  MODEL_MODE,
  RETRY_POLICY,
} from "./constants.ts";

export interface ArtifactIdentity {
  readonly repository: string;
  readonly commitSha: string;
  readonly treeSha: string;
  readonly archiveSha256: string;
}

export interface ExpectedCounts {
  readonly thoughts: number;
  readonly nodes: number;
  readonly links: number;
  readonly decisions: number;
  readonly embeddings: number;
  readonly runs: number;
  readonly personalThoughts: number;
  readonly unresolved: number;
  readonly damagedReferences: number;
}

export interface SourceIdentity {
  readonly sizeBytes: number;
  readonly sha256: string;
  readonly workspace: WorkspaceKind;
  readonly counts: ExpectedCounts;
}

export interface BackupExpectation {
  readonly backupId: string;
  readonly expectedSizeBytes: number;
  readonly expectedSha256: string;
  readonly exclusiveCreateRequired: true;
  readonly overwriteAllowed: false;
}

export interface VerifiedBackup {
  readonly backupId: string;
  readonly sizeBytes: number;
  readonly sha256: string;
  readonly quickCheck: "ok";
  readonly integrityCheck: "ok";
  readonly independentlyVerified: true;
}

export interface VerifiedSource {
  readonly sizeBytes: number;
  readonly sha256: string;
  readonly quickCheck: "ok";
  readonly integrityCheck: "ok";
  readonly readonlyMode: true;
  readonly queryOnly: true;
  readonly writePerformed: false;
}

export interface GenerationIdentity {
  readonly generationId: string;
  readonly databaseName: string;
  readonly workspace: WorkspaceKind;
  readonly attemptId: string;
  readonly storageSchema: typeof GENERATION_STORAGE_SCHEMA;
  readonly mappingVersion: typeof GENERATION_MAPPING_VERSION;
}

export interface GenerationImportResult {
  readonly portablePlanHash: string;
  readonly targetSnapshotHash: string;
  readonly counts: ExpectedCounts;
  readonly sourceWritePerformed: false;
  readonly networkCalls: 0;
  readonly modelCalls: 0;
}

export interface GenerationVerification {
  readonly targetSnapshotHash: string;
  readonly counts: ExpectedCounts;
  readonly reopened: true;
  readonly referencesValid: true;
  readonly unresolvedPreserved: true;
  readonly networkCalls: 0;
  readonly modelCalls: 0;
}

export interface GenerationSeal {
  readonly sealId: string;
  readonly generationId: string;
  readonly databaseName: string;
  readonly targetSnapshotHash: string;
  readonly sealedAt: string;
  readonly sealed: true;
  readonly networkCalls: 0;
  readonly modelCalls: 0;
}

export interface ActiveGenerationPointer {
  readonly workspace: WorkspaceKind;
  readonly generationId: string;
  readonly databaseName: string;
  readonly targetSnapshotHash: string;
  readonly sourceSha256: string;
  readonly attemptId: string;
  readonly activationEpoch: number;
  readonly registryRevision: number;
  readonly state: "active";
}

export interface RegistryExpectation {
  readonly registryName: typeof CONTROL_REGISTRY_NAME;
  readonly schemaVersion: typeof CONTROL_REGISTRY_SCHEMA_VERSION;
  readonly expectedRevision: number;
  readonly expectedActivePointer?: ActiveGenerationPointer;
}

export interface ControlRegistrySnapshot {
  readonly registryName: typeof CONTROL_REGISTRY_NAME;
  readonly schemaVersion: typeof CONTROL_REGISTRY_SCHEMA_VERSION;
  readonly revision: number;
  readonly activePointers: readonly ActiveGenerationPointer[];
}

export interface DetachedAuthorization {
  readonly authorizationId: string;
  readonly attemptId: string;
  readonly artifact: ArtifactIdentity;
  readonly sourceSizeBytes: number;
  readonly sourceSha256: string;
  readonly generationDatabaseName: string;
  readonly expectedPortablePlanHash: string;
  readonly expectedTargetSnapshotHash: string;
  readonly consumed: false;
}

export interface GenerationExecutionManifest {
  readonly manifestVersion: typeof GENERATION_MANIFEST_VERSION;
  readonly attemptId: string;
  readonly workspace: WorkspaceKind;
  readonly artifact: ArtifactIdentity;
  readonly authorization: DetachedAuthorization;
  readonly source: SourceIdentity;
  readonly backup: BackupExpectation;
  readonly registry: RegistryExpectation;
  readonly generation: GenerationIdentity;
  readonly expectedPortablePlanHash: string;
  readonly expectedTargetSnapshotHash: string;
  readonly retryPolicy: typeof RETRY_POLICY;
  readonly modelMode: typeof MODEL_MODE;
  readonly networkAllowed: false;
  readonly modelAllowed: false;
}
