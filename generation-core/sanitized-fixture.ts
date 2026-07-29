import {
  CONTROL_REGISTRY_NAME,
  CONTROL_REGISTRY_SCHEMA_VERSION,
  GENERATION_DATABASE_PREFIX,
  GENERATION_MANIFEST_VERSION,
  GENERATION_MAPPING_VERSION,
  GENERATION_STORAGE_SCHEMA,
  MODEL_MODE,
  RETRY_POLICY,
} from "./constants.ts";
import type {
  ActiveGenerationPointer,
  ControlRegistrySnapshot,
  GenerationExecutionManifest,
  GenerationImportResult,
  GenerationSeal,
  GenerationVerification,
  VerifiedBackup,
  VerifiedSource,
} from "./identities.ts";
import type { ResolverVerification } from "./registry-types.ts";

const hash = (character: string): string => character.repeat(64);
const git = (character: string): string => character.repeat(40);

export const SANITIZED_PREVIOUS_POINTER: ActiveGenerationPointer = Object.freeze({
  workspace: "synthetic",
  generationId: "gen-sanitized-prev",
  databaseName: `${GENERATION_DATABASE_PREFIX}gen-sanitized-prev`,
  targetSnapshotHash: hash("7"),
  sourceSha256: hash("8"),
  attemptId: "attempt-sanitized-prev",
  activationEpoch: 3,
  registryRevision: 7,
  state: "active",
});

export const SANITIZED_REGISTRY_SNAPSHOT: ControlRegistrySnapshot = Object.freeze({
  registryName: CONTROL_REGISTRY_NAME,
  schemaVersion: CONTROL_REGISTRY_SCHEMA_VERSION,
  revision: 7,
  activePointers: Object.freeze([SANITIZED_PREVIOUS_POINTER]),
});

const artifact = Object.freeze({
  repository: "example/mindmap-sanitized",
  commitSha: git("1"),
  treeSha: git("2"),
  archiveSha256: hash("3"),
});

const source = Object.freeze({
  sizeBytes: 4096,
  sha256: hash("4"),
  workspace: "synthetic" as const,
  counts: Object.freeze({
    thoughts: 4,
    nodes: 3,
    links: 1,
    decisions: 5,
    embeddings: 4,
    runs: 2,
    personalThoughts: 0,
    unresolved: 1,
    damagedReferences: 0,
  }),
});

const generation = Object.freeze({
  generationId: "gen-sanitized-001",
  databaseName: `${GENERATION_DATABASE_PREFIX}gen-sanitized-001`,
  workspace: "synthetic" as const,
  attemptId: "attempt-sanitized-001",
  storageSchema: GENERATION_STORAGE_SCHEMA,
  mappingVersion: GENERATION_MAPPING_VERSION,
});

export const SANITIZED_GENERATION_MANIFEST: GenerationExecutionManifest = Object.freeze({
  manifestVersion: GENERATION_MANIFEST_VERSION,
  attemptId: "attempt-sanitized-001",
  workspace: "synthetic",
  artifact,
  authorization: Object.freeze({
    authorizationId: "authorization-sanitized-001",
    attemptId: "attempt-sanitized-001",
    artifact,
    sourceSizeBytes: source.sizeBytes,
    sourceSha256: source.sha256,
    generationDatabaseName: generation.databaseName,
    expectedPortablePlanHash: hash("5"),
    expectedTargetSnapshotHash: hash("6"),
    consumed: false,
  }),
  source,
  backup: Object.freeze({
    backupId: "backup-sanitized-001",
    expectedSizeBytes: source.sizeBytes,
    expectedSha256: source.sha256,
    exclusiveCreateRequired: true,
    overwriteAllowed: false,
  }),
  registry: Object.freeze({
    registryName: CONTROL_REGISTRY_NAME,
    schemaVersion: CONTROL_REGISTRY_SCHEMA_VERSION,
    expectedRevision: SANITIZED_REGISTRY_SNAPSHOT.revision,
    expectedActivePointer: SANITIZED_PREVIOUS_POINTER,
  }),
  generation,
  expectedPortablePlanHash: hash("5"),
  expectedTargetSnapshotHash: hash("6"),
  retryPolicy: RETRY_POLICY,
  modelMode: MODEL_MODE,
  networkAllowed: false,
  modelAllowed: false,
});

export const SANITIZED_VERIFIED_BACKUP: VerifiedBackup = Object.freeze({
  backupId: SANITIZED_GENERATION_MANIFEST.backup.backupId,
  sizeBytes: SANITIZED_GENERATION_MANIFEST.source.sizeBytes,
  sha256: SANITIZED_GENERATION_MANIFEST.source.sha256,
  quickCheck: "ok",
  integrityCheck: "ok",
  independentlyVerified: true,
});

export const SANITIZED_VERIFIED_SOURCE: VerifiedSource = Object.freeze({
  sizeBytes: SANITIZED_GENERATION_MANIFEST.source.sizeBytes,
  sha256: SANITIZED_GENERATION_MANIFEST.source.sha256,
  quickCheck: "ok",
  integrityCheck: "ok",
  readonlyMode: true,
  queryOnly: true,
  writePerformed: false,
});

export const SANITIZED_IMPORT_RESULT: GenerationImportResult = Object.freeze({
  portablePlanHash: SANITIZED_GENERATION_MANIFEST.expectedPortablePlanHash,
  targetSnapshotHash: SANITIZED_GENERATION_MANIFEST.expectedTargetSnapshotHash,
  counts: SANITIZED_GENERATION_MANIFEST.source.counts,
  sourceWritePerformed: false,
  networkCalls: 0,
  modelCalls: 0,
});

export const SANITIZED_GENERATION_VERIFICATION: GenerationVerification = Object.freeze({
  targetSnapshotHash: SANITIZED_GENERATION_MANIFEST.expectedTargetSnapshotHash,
  counts: SANITIZED_GENERATION_MANIFEST.source.counts,
  reopened: true,
  referencesValid: true,
  unresolvedPreserved: true,
  networkCalls: 0,
  modelCalls: 0,
});

export const SANITIZED_GENERATION_SEAL: GenerationSeal = Object.freeze({
  sealId: "seal-sanitized-001",
  generationId: SANITIZED_GENERATION_MANIFEST.generation.generationId,
  databaseName: SANITIZED_GENERATION_MANIFEST.generation.databaseName,
  targetSnapshotHash: SANITIZED_GENERATION_MANIFEST.expectedTargetSnapshotHash,
  sealedAt: "2026-01-01T00:00:09.000Z",
  sealed: true,
  networkCalls: 0,
  modelCalls: 0,
});

export const SANITIZED_RESOLVER_VERIFICATION: ResolverVerification = Object.freeze({
  generationId: SANITIZED_GENERATION_MANIFEST.generation.generationId,
  databaseName: SANITIZED_GENERATION_MANIFEST.generation.databaseName,
  targetSnapshotHash: SANITIZED_GENERATION_MANIFEST.expectedTargetSnapshotHash,
  opened: true,
  hashVerified: true,
  networkCalls: 0,
  modelCalls: 0,
});
