import {
  CONTROL_REGISTRY_NAME,
  CONTROL_REGISTRY_SCHEMA_VERSION,
  GENERATION_MAPPING_VERSION,
  GENERATION_STORAGE_SCHEMA,
} from "../../generation-core/constants.ts";
import { canonicalJson } from "../../generation-core/canonical-json.ts";
import type { ActiveGenerationPointer, ControlRegistrySnapshot, GenerationIdentity, GenerationSeal } from "../../generation-core/identities.ts";
import { assertActivePointer, assertGenerationIdentity, assertRegistrySnapshot, assertSha256 } from "../../generation-core/validators.ts";
import {
  C2_GENERATION_DATABASE_VERSION,
  C2_REGISTRY_DATABASE_VERSION,
  GENERATION_META_STORE,
  GENERATION_SEAL_STORE,
  META_STORE,
  POINTERS_STORE,
  REGISTRY_STORE,
  SEAL_ATTESTATIONS_STORE,
  type GenerationMetaRow,
  type GenerationSealRow,
  type RegistryMetaRow,
  type RegistryRow,
  type SealAttestationRow,
  assertGenerationMetaRow,
  assertRegistryMetaRow,
  assertRegistryRow,
  assertSafeC2GenerationDatabaseName,
  buildSnapshot,
  cloneCanonical,
  requestResult,
  transactionCompletion,
} from "../../generation-storage/indexeddb/c2-indexeddb-common.ts";
import type { C3ResolverOptions, C3ResolverStage } from "../resolver-types.ts";
import { ResolverFailure, failure } from "./resolver-errors.ts";

export interface RegistryRead {
  readonly snapshot: ControlRegistrySnapshot;
  readonly pointer: ActiveGenerationPointer;
  readonly attestation: SealAttestationRow;
}

export interface GenerationRead {
  readonly logicalGeneration: GenerationIdentity;
  readonly seal: GenerationSeal;
}

function factoryWithEnumeration(indexedDB: IDBFactory): IDBFactory & {
  databases?: () => Promise<IDBDatabaseInfo[]>;
} {
  return indexedDB;
}

async function assertDatabaseExists(
  indexedDB: IDBFactory,
  databaseName: string,
  stage: C3ResolverStage,
  missingCode: "registry_database_missing" | "generation_database_missing",
): Promise<void> {
  const enumerator = factoryWithEnumeration(indexedDB).databases;
  if (typeof enumerator !== "function") {
    failure(
      "database_enumeration_unavailable",
      stage,
      "IndexedDB database enumeration is required to open existing storage without creating a fallback database.",
    );
  }
  let databases: IDBDatabaseInfo[];
  try {
    databases = await enumerator.call(indexedDB);
  } catch (error) {
    failure(
      "database_enumeration_unavailable",
      stage,
      error instanceof Error ? error.message : "IndexedDB database enumeration failed.",
    );
  }
  if (!databases.some((database) => database.name === databaseName)) {
    failure(missingCode, stage, `${missingCode}:${databaseName}`);
  }
}

async function openExistingDatabase(
  indexedDB: IDBFactory,
  databaseName: string,
  expectedVersion: number,
  stage: C3ResolverStage,
  missingCode: "registry_database_missing" | "generation_database_missing",
  openCode: "registry_open_failed" | "generation_open_failed",
): Promise<IDBDatabase> {
  await assertDatabaseExists(indexedDB, databaseName, stage, missingCode);
  return new Promise<IDBDatabase>((resolve, rejectOpen) => {
    let upgradeAttempted = false;
    const request = indexedDB.open(databaseName);
    request.onupgradeneeded = () => {
      upgradeAttempted = true;
      try { request.transaction?.abort(); } catch { /* transaction is already inactive */ }
    };
    request.onsuccess = () => {
      const database = request.result;
      if (upgradeAttempted) {
        database.close();
        rejectOpen(new ResolverFailure(missingCode, stage, `${missingCode}:${databaseName}`));
        return;
      }
      if (database.version !== expectedVersion) {
        database.close();
        rejectOpen(new ResolverFailure(
          stage === "read_registry" ? "registry_schema_mismatch" : "generation_schema_mismatch",
          stage,
          `indexeddb_version_mismatch:${database.version}`,
          { expectedVersion, actualVersion: database.version },
        ));
        return;
      }
      database.onversionchange = () => database.close();
      resolve(database);
    };
    request.onerror = () => rejectOpen(
      upgradeAttempted
        ? new ResolverFailure(missingCode, stage, `${missingCode}:${databaseName}`)
        : new ResolverFailure(openCode, stage, request.error?.message ?? `${openCode}:${databaseName}`),
    );
    request.onblocked = () => rejectOpen(new ResolverFailure(openCode, stage, `indexeddb_open_blocked:${databaseName}`));
  });
}

function mapRegistryValidationFailure(error: unknown): ResolverFailure {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("revision")) return new ResolverFailure("registry_revision_mismatch", "read_registry", message);
  if (message.includes("schema") || message.includes("object store") || message.includes("Object store")) {
    return new ResolverFailure("registry_schema_mismatch", "read_registry", message);
  }
  return new ResolverFailure("registry_identity_mismatch", "read_registry", message);
}

function mapGenerationValidationFailure(error: unknown): ResolverFailure {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("workspace")) return new ResolverFailure("generation_workspace_mismatch", "read_generation", message);
  if (message.includes("schema") || message.includes("object store") || message.includes("Object store")) {
    return new ResolverFailure("generation_schema_mismatch", "read_generation", message);
  }
  return new ResolverFailure("generation_identity_mismatch", "read_generation", message);
}

export function validatePointer(pointer: ActiveGenerationPointer, registryRevision: number): void {
  try {
    assertActivePointer(pointer);
  } catch (error) {
    failure("pointer_identity_mismatch", "verify_pointer", error instanceof Error ? error.message : String(error));
  }
  if (pointer.workspace !== "synthetic") {
    failure("unknown_workspace", "verify_pointer", `Unsupported workspace: ${pointer.workspace}`);
  }
  if (pointer.registryRevision !== registryRevision) {
    failure("registry_revision_mismatch", "verify_pointer", "Active pointer revision does not match registry revision.", {
      registryRevision,
      pointerRevision: pointer.registryRevision,
    });
  }
}

function validateSeal(seal: GenerationSeal, pointer: ActiveGenerationPointer): void {
  try {
    assertSha256(seal.targetSnapshotHash, "seal.targetSnapshotHash");
  } catch (error) {
    failure("generation_seal_mismatch", "read_generation", error instanceof Error ? error.message : String(error));
  }
  if (
    seal.sealed !== true
    || !seal.sealId.trim()
    || !seal.sealedAt.trim()
    || seal.generationId !== pointer.generationId
    || seal.databaseName !== pointer.databaseName
    || seal.networkCalls !== 0
    || seal.modelCalls !== 0
  ) {
    failure("generation_seal_mismatch", "read_generation", "Generation seal does not match the active pointer.");
  }
  if (seal.targetSnapshotHash !== pointer.targetSnapshotHash) {
    failure("generation_snapshot_hash_mismatch", "read_generation", "Generation seal hash does not match the active pointer hash.");
  }
}

export function validateAttestation(attestation: SealAttestationRow, pointer: ActiveGenerationPointer): void {
  try {
    assertGenerationIdentity(attestation.logicalGeneration);
    assertSafeC2GenerationDatabaseName(attestation.physicalGenerationDatabaseName);
  } catch (error) {
    failure("seal_attestation_mismatch", "verify_pointer", error instanceof Error ? error.message : String(error));
  }
  if (
    attestation.generationId !== pointer.generationId
    || attestation.attemptId !== pointer.attemptId
    || attestation.logicalGeneration.generationId !== pointer.generationId
    || attestation.logicalGeneration.databaseName !== pointer.databaseName
    || attestation.logicalGeneration.workspace !== pointer.workspace
    || attestation.logicalGeneration.attemptId !== pointer.attemptId
  ) {
    failure("seal_attestation_mismatch", "verify_pointer", "Seal attestation is not bound to the active pointer.");
  }
  validateSeal(attestation.seal, pointer);
}

export async function readRegistry(options: C3ResolverOptions): Promise<RegistryRead> {
  let database: IDBDatabase | undefined;
  try {
    database = await openExistingDatabase(
      options.indexedDB,
      options.registryDatabaseName,
      C2_REGISTRY_DATABASE_VERSION,
      "read_registry",
      "registry_database_missing",
      "registry_open_failed",
    );
    const requiredStores = [META_STORE, REGISTRY_STORE, POINTERS_STORE, SEAL_ATTESTATIONS_STORE];
    for (const store of requiredStores) {
      if (!database.objectStoreNames.contains(store)) {
        failure("registry_schema_mismatch", "read_registry", `registry_object_store_missing:${store}`);
      }
    }
    const transaction = database.transaction(requiredStores, "readonly");
    const completion = transactionCompletion(transaction);
    const [metaCandidate, registryCandidate, pointers, attestations] = await Promise.all([
      requestResult(transaction.objectStore(META_STORE).get("schema")) as Promise<RegistryMetaRow | undefined>,
      requestResult(transaction.objectStore(REGISTRY_STORE).get("registry")) as Promise<RegistryRow | undefined>,
      requestResult(transaction.objectStore(POINTERS_STORE).getAll()) as Promise<ActiveGenerationPointer[]>,
      requestResult(transaction.objectStore(SEAL_ATTESTATIONS_STORE).getAll()) as Promise<SealAttestationRow[]>,
    ]);
    await completion;
    const meta = assertRegistryMetaRow(metaCandidate, options.registryDatabaseName);
    const registry = assertRegistryRow(registryCandidate);
    if (
      meta.logicalRegistryName !== CONTROL_REGISTRY_NAME
      || meta.logicalSchemaVersion !== CONTROL_REGISTRY_SCHEMA_VERSION
    ) {
      failure("registry_identity_mismatch", "read_registry", "Control registry identity mismatch.");
    }
    const snapshot = buildSnapshot(registry.revision, pointers);
    assertRegistrySnapshot(snapshot);
    const pointer = snapshot.activePointers.find((candidate) => candidate.workspace === options.workspace);
    if (!pointer) failure("workspace_pointer_missing", "read_registry", `No active pointer for workspace: ${options.workspace}`);
    const attestation = attestations.find((candidate) => candidate.generationId === pointer.generationId);
    if (!attestation) failure("seal_attestation_missing", "read_registry", "Active generation seal attestation is missing.");
    return cloneCanonical({ snapshot, pointer, attestation });
  } catch (error) {
    if (error instanceof ResolverFailure) throw error;
    throw mapRegistryValidationFailure(error);
  } finally {
    database?.close();
  }
}

export async function readGeneration(options: C3ResolverOptions, registry: RegistryRead): Promise<GenerationRead> {
  let database: IDBDatabase | undefined;
  try {
    database = await openExistingDatabase(
      options.indexedDB,
      registry.attestation.physicalGenerationDatabaseName,
      C2_GENERATION_DATABASE_VERSION,
      "read_generation",
      "generation_database_missing",
      "generation_open_failed",
    );
    const requiredStores = [GENERATION_META_STORE, GENERATION_SEAL_STORE];
    for (const store of requiredStores) {
      if (!database.objectStoreNames.contains(store)) {
        failure("generation_schema_mismatch", "read_generation", `generation_object_store_missing:${store}`);
      }
    }
    const transaction = database.transaction(requiredStores, "readonly");
    const completion = transactionCompletion(transaction);
    const [metaCandidate, sealCandidate] = await Promise.all([
      requestResult(transaction.objectStore(GENERATION_META_STORE).get("generation")) as Promise<GenerationMetaRow | undefined>,
      requestResult(transaction.objectStore(GENERATION_SEAL_STORE).get("seal")) as Promise<GenerationSealRow | undefined>,
    ]);
    await completion;
    if (!metaCandidate) failure("generation_identity_mismatch", "read_generation", "Generation metadata is missing.");
    const meta = assertGenerationMetaRow(metaCandidate, registry.attestation.physicalGenerationDatabaseName);
    if (!sealCandidate) failure("generation_seal_missing", "read_generation", "Generation seal is missing.");
    const seal = cloneCanonical(sealCandidate.seal);
    if (canonicalJson(meta.logicalGeneration) !== canonicalJson(registry.attestation.logicalGeneration)) {
      failure("generation_identity_mismatch", "read_generation", "Physical generation identity does not match registry attestation.");
    }
    if (canonicalJson(seal) !== canonicalJson(registry.attestation.seal)) {
      failure("generation_seal_mismatch", "read_generation", "Physical generation seal does not match registry attestation.");
    }
    if (
      meta.logicalGeneration.storageSchema !== GENERATION_STORAGE_SCHEMA
      || meta.logicalGeneration.mappingVersion !== GENERATION_MAPPING_VERSION
    ) {
      failure("generation_schema_mismatch", "read_generation", "Logical generation schema or mapping version mismatch.");
    }
    validateSeal(seal, registry.pointer);
    return cloneCanonical({ logicalGeneration: meta.logicalGeneration, seal });
  } catch (error) {
    if (error instanceof ResolverFailure) throw error;
    throw mapGenerationValidationFailure(error);
  } finally {
    database?.close();
  }
}
