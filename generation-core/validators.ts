import type { WorkspaceKind } from "../domain/run.ts";
import {
  CONTROL_REGISTRY_NAME,
  CONTROL_REGISTRY_SCHEMA_VERSION,
  GENERATION_DATABASE_PREFIX,
  GENERATION_MANIFEST_VERSION,
  GENERATION_MAPPING_VERSION,
  GENERATION_STORAGE_SCHEMA,
  LEGACY_DATABASE_NAMES,
  MODEL_MODE,
  RETRY_POLICY,
  TEMPORARY_DATABASE_PREFIXES,
} from "./constants.ts";
import type {
  ActiveGenerationPointer,
  ArtifactIdentity,
  ControlRegistrySnapshot,
  ExpectedCounts,
  GenerationExecutionManifest,
  GenerationIdentity,
} from "./identities.ts";

const SHA256 = /^[0-9a-f]{64}$/;
const GIT_SHA = /^[0-9a-f]{40}$/;
const IDENTIFIER = /^[a-z0-9][a-z0-9-]{2,79}$/;
const REPOSITORY = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;

export function assertSha256(value: string, field: string): void {
  if (!SHA256.test(value)) throw new Error(`invalid_sha256:${field}`);
}

export function assertGitSha(value: string, field: string): void {
  if (!GIT_SHA.test(value)) throw new Error(`invalid_git_sha:${field}`);
}

export function assertNonEmpty(value: string, field: string): void {
  if (value.trim().length === 0) throw new Error(`invalid_empty_value:${field}`);
}

export function sameCounts(left: ExpectedCounts, right: ExpectedCounts): boolean {
  return left.thoughts === right.thoughts
    && left.nodes === right.nodes
    && left.links === right.links
    && left.decisions === right.decisions
    && left.embeddings === right.embeddings
    && left.runs === right.runs
    && left.personalThoughts === right.personalThoughts
    && left.unresolved === right.unresolved
    && left.damagedReferences === right.damagedReferences;
}

export function samePointer(
  left: ActiveGenerationPointer | undefined,
  right: ActiveGenerationPointer | undefined,
): boolean {
  if (!left || !right) return left === right;
  return left.workspace === right.workspace
    && left.generationId === right.generationId
    && left.databaseName === right.databaseName
    && left.targetSnapshotHash === right.targetSnapshotHash
    && left.sourceSha256 === right.sourceSha256
    && left.attemptId === right.attemptId
    && left.activationEpoch === right.activationEpoch
    && left.registryRevision === right.registryRevision
    && left.state === right.state;
}

export function assertExpectedCounts(counts: ExpectedCounts): void {
  for (const [field, value] of Object.entries(counts)) {
    if (!Number.isSafeInteger(value) || value < 0) throw new Error(`invalid_count:${field}`);
  }
  if (counts.personalThoughts !== 0) throw new Error("personal_data_present");
}

export function assertArtifactIdentity(identity: ArtifactIdentity): void {
  if (!REPOSITORY.test(identity.repository)) throw new Error("invalid_repository_identity");
  assertGitSha(identity.commitSha, "artifact.commitSha");
  assertGitSha(identity.treeSha, "artifact.treeSha");
  assertSha256(identity.archiveSha256, "artifact.archiveSha256");
}

export function assertGenerationIdentity(identity: GenerationIdentity): void {
  if (!IDENTIFIER.test(identity.generationId)) throw new Error("invalid_generation_id");
  const expectedName = `${GENERATION_DATABASE_PREFIX}${identity.generationId}`;
  if (identity.databaseName !== expectedName) throw new Error("generation_database_name_mismatch");
  if (LEGACY_DATABASE_NAMES.includes(identity.databaseName as (typeof LEGACY_DATABASE_NAMES)[number])) {
    throw new Error("legacy_namespace_rejected");
  }
  if (TEMPORARY_DATABASE_PREFIXES.some((prefix) => identity.databaseName.startsWith(prefix))) {
    throw new Error("temporary_namespace_rejected");
  }
  assertNonEmpty(identity.attemptId, "generation.attemptId");
  if (identity.workspace !== "synthetic") throw new Error("personal_workspace_rejected");
  if (identity.storageSchema !== GENERATION_STORAGE_SCHEMA) throw new Error("storage_schema_mismatch");
  if (identity.mappingVersion !== GENERATION_MAPPING_VERSION) throw new Error("mapping_version_mismatch");
}

export function assertActivePointer(pointer: ActiveGenerationPointer): void {
  assertGenerationIdentity({
    generationId: pointer.generationId,
    databaseName: pointer.databaseName,
    workspace: pointer.workspace,
    attemptId: pointer.attemptId,
    storageSchema: GENERATION_STORAGE_SCHEMA,
    mappingVersion: GENERATION_MAPPING_VERSION,
  });
  assertSha256(pointer.targetSnapshotHash, "pointer.targetSnapshotHash");
  assertSha256(pointer.sourceSha256, "pointer.sourceSha256");
  if (!Number.isSafeInteger(pointer.activationEpoch) || pointer.activationEpoch < 0) {
    throw new Error("invalid_activation_epoch");
  }
  if (!Number.isSafeInteger(pointer.registryRevision) || pointer.registryRevision < 0) {
    throw new Error("invalid_registry_revision");
  }
  if (pointer.state !== "active") throw new Error("invalid_pointer_state");
}

export function assertRegistrySnapshot(snapshot: ControlRegistrySnapshot): void {
  if (snapshot.registryName !== CONTROL_REGISTRY_NAME) throw new Error("invalid_registry_name");
  if (snapshot.schemaVersion !== CONTROL_REGISTRY_SCHEMA_VERSION) throw new Error("registry_schema_mismatch");
  if (!Number.isSafeInteger(snapshot.revision) || snapshot.revision < 0) {
    throw new Error("invalid_registry_revision");
  }
  const workspaces = new Set<WorkspaceKind>();
  for (const pointer of snapshot.activePointers) {
    assertActivePointer(pointer);
    if (workspaces.has(pointer.workspace)) throw new Error("duplicate_workspace_pointer");
    workspaces.add(pointer.workspace);
  }
}

export function activePointerFor(
  snapshot: ControlRegistrySnapshot,
  workspace: WorkspaceKind,
): ActiveGenerationPointer | undefined {
  return snapshot.activePointers.find((pointer) => pointer.workspace === workspace);
}

function assertAuthorizationBinding(manifest: GenerationExecutionManifest): void {
  const authorization = manifest.authorization;
  assertNonEmpty(authorization.authorizationId, "authorization.authorizationId");
  if (authorization.attemptId !== manifest.attemptId) throw new Error("authorization_attempt_mismatch");
  assertArtifactIdentity(authorization.artifact);
  if (
    authorization.artifact.repository !== manifest.artifact.repository
    || authorization.artifact.commitSha !== manifest.artifact.commitSha
    || authorization.artifact.treeSha !== manifest.artifact.treeSha
    || authorization.artifact.archiveSha256 !== manifest.artifact.archiveSha256
  ) throw new Error("authorization_artifact_mismatch");
  if (authorization.sourceSizeBytes !== manifest.source.sizeBytes) throw new Error("authorization_source_size_mismatch");
  if (authorization.sourceSha256 !== manifest.source.sha256) throw new Error("authorization_source_hash_mismatch");
  if (authorization.generationDatabaseName !== manifest.generation.databaseName) {
    throw new Error("authorization_generation_mismatch");
  }
  if (authorization.expectedPortablePlanHash !== manifest.expectedPortablePlanHash) {
    throw new Error("authorization_plan_hash_mismatch");
  }
  if (authorization.expectedTargetSnapshotHash !== manifest.expectedTargetSnapshotHash) {
    throw new Error("authorization_target_hash_mismatch");
  }
  if (authorization.consumed) throw new Error("authorization_already_consumed");
}

export function assertGenerationManifest(manifest: GenerationExecutionManifest): void {
  if (manifest.manifestVersion !== GENERATION_MANIFEST_VERSION) throw new Error("manifest_version_mismatch");
  assertNonEmpty(manifest.attemptId, "manifest.attemptId");
  if (manifest.workspace !== "synthetic") throw new Error("personal_workspace_rejected");
  assertArtifactIdentity(manifest.artifact);
  assertSha256(manifest.source.sha256, "source.sha256");
  if (!Number.isSafeInteger(manifest.source.sizeBytes) || manifest.source.sizeBytes <= 0) {
    throw new Error("invalid_source_size");
  }
  if (manifest.source.workspace !== manifest.workspace) throw new Error("workspace_mismatch");
  assertExpectedCounts(manifest.source.counts);
  assertNonEmpty(manifest.backup.backupId, "backup.backupId");
  if (manifest.backup.expectedSizeBytes !== manifest.source.sizeBytes) throw new Error("backup_size_mismatch");
  if (manifest.backup.expectedSha256 !== manifest.source.sha256) throw new Error("backup_hash_mismatch");
  if (!manifest.backup.exclusiveCreateRequired || manifest.backup.overwriteAllowed) {
    throw new Error("unsafe_backup_policy");
  }
  if (manifest.registry.registryName !== CONTROL_REGISTRY_NAME) throw new Error("invalid_registry_name");
  if (manifest.registry.schemaVersion !== CONTROL_REGISTRY_SCHEMA_VERSION) throw new Error("registry_schema_mismatch");
  if (!Number.isSafeInteger(manifest.registry.expectedRevision) || manifest.registry.expectedRevision < 0) {
    throw new Error("invalid_registry_revision");
  }
  if (manifest.registry.expectedActivePointer) assertActivePointer(manifest.registry.expectedActivePointer);
  assertGenerationIdentity(manifest.generation);
  if (manifest.generation.attemptId !== manifest.attemptId) throw new Error("generation_attempt_mismatch");
  if (manifest.generation.workspace !== manifest.workspace) throw new Error("workspace_mismatch");
  assertSha256(manifest.expectedPortablePlanHash, "manifest.expectedPortablePlanHash");
  assertSha256(manifest.expectedTargetSnapshotHash, "manifest.expectedTargetSnapshotHash");
  if (manifest.retryPolicy !== RETRY_POLICY) throw new Error("unsafe_retry_policy");
  if (manifest.modelMode !== MODEL_MODE || manifest.networkAllowed || manifest.modelAllowed) {
    throw new Error("external_call_boundary_violation");
  }
  assertAuthorizationBinding(manifest);
}
