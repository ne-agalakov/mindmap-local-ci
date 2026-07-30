import type { AttemptCommandMeta, AttemptCommandResult, GenerationAttemptAggregate, GenerationAttemptCommand, GenerationAttemptEvent } from "../../generation-core/attempt-types.ts";
import { CONTROL_REGISTRY_NAME, CONTROL_REGISTRY_SCHEMA_VERSION, GENERATION_DATABASE_PREFIX } from "../../generation-core/constants.ts";
import { canonicalJson, hashCanonical, type CanonicalHasher } from "../../generation-core/canonical-json.ts";
import type { ActiveGenerationPointer, ControlRegistrySnapshot, GenerationIdentity, GenerationSeal } from "../../generation-core/identities.ts";
import type { ActivationReceipt, PromotionPlan, RollbackPlan, RollbackReceipt } from "../../generation-core/registry-types.ts";
import { assertGenerationIdentity } from "../../generation-core/validators.ts";

export const C2_SANITIZED_DATABASE_PREFIX = "mindmap-state-core-v1-phase2cc-c2-fixture-" as const;
export const C2_REGISTRY_DATABASE_VERSION = 1;
export const C2_GENERATION_DATABASE_VERSION = 1;
export const C2_STORAGE_SCHEMA = "phase2cc-c2-indexeddb-v1" as const;

export const META_STORE = "meta";
export const REGISTRY_STORE = "registry";
export const POINTERS_STORE = "activePointers";
export const ATTEMPTS_STORE = "attempts";
export const EVENTS_STORE = "attemptEvents";
export const SEAL_ATTESTATIONS_STORE = "sealAttestations";
export const ACTIVATION_RECEIPTS_STORE = "activationReceipts";
export const ROLLBACK_RECEIPTS_STORE = "rollbackReceipts";
export const IDEMPOTENCY_STORE = "idempotency";
export const BY_ATTEMPT_INDEX = "byAttempt";

export const GENERATION_META_STORE = "generationMeta";
export const GENERATION_SEAL_STORE = "generationSeal";
export const GENERATION_IDEMPOTENCY_STORE = "generationIdempotency";

export interface RegistryMetaRow {
  readonly key: "schema";
  readonly physicalDatabaseName: string;
  readonly logicalRegistryName: typeof CONTROL_REGISTRY_NAME;
  readonly logicalSchemaVersion: typeof CONTROL_REGISTRY_SCHEMA_VERSION;
  readonly storageSchema: typeof C2_STORAGE_SCHEMA;
  readonly databaseVersion: number;
  readonly sanitizedOnly: true;
}

export interface RegistryRow {
  readonly key: "registry";
  readonly revision: number;
  readonly logicalRegistryName: typeof CONTROL_REGISTRY_NAME;
  readonly logicalSchemaVersion: typeof CONTROL_REGISTRY_SCHEMA_VERSION;
}

export interface AttemptRow {
  readonly attemptId: string;
  readonly aggregate: GenerationAttemptAggregate;
}

export interface AttemptEventRow {
  readonly attemptId: string;
  readonly sequence: number;
  readonly event: GenerationAttemptEvent;
}

export interface SealAttestationRow {
  readonly generationId: string;
  readonly attemptId: string;
  readonly seal: GenerationSeal;
  readonly logicalGeneration: GenerationIdentity;
  readonly physicalGenerationDatabaseName: string;
}

export interface IdempotencyRow<T = unknown> {
  readonly operationId: string;
  readonly kind: string;
  readonly fingerprint: string;
  readonly result: T;
}

export interface GenerationMetaRow {
  readonly key: "generation";
  readonly physicalDatabaseName: string;
  readonly logicalGeneration: GenerationIdentity;
  readonly storageSchema: typeof C2_STORAGE_SCHEMA;
  readonly sanitizedOnly: true;
}

export interface GenerationSealRow {
  readonly key: "seal";
  readonly seal: GenerationSeal;
}

export type C2StorageRejectionCode =
  | "invalid_database_name"
  | "invalid_request"
  | "registry_not_initialized"
  | "registry_already_initialized"
  | "registry_identity_mismatch"
  | "registry_revision_mismatch"
  | "active_pointer_mismatch"
  | "attempt_not_found"
  | "attempt_already_exists"
  | "stale_attempt_revision"
  | "attempt_replay_mismatch"
  | "domain_rejection"
  | "idempotency_conflict"
  | "generation_identity_mismatch"
  | "generation_not_initialized"
  | "generation_already_initialized"
  | "seal_mismatch"
  | "seal_immutable_conflict"
  | "promotion_not_ready"
  | "activation_receipt_conflict"
  | "rollback_not_required"
  | "rollback_receipt_conflict"
  | "transaction_aborted";

export interface C2StorageRejection {
  readonly code: C2StorageRejectionCode;
  readonly message: string;
  readonly details?: Readonly<Record<string, string | number | boolean | null>>;
}

export type C2StorageResult<T> =
  | Readonly<{ ok: true; value: T; idempotent: boolean }>
  | Readonly<{ ok: false; rejection: C2StorageRejection }>;

export interface C2RegistrySnapshot {
  readonly physicalDatabaseName: string;
  readonly registry: ControlRegistrySnapshot;
  readonly attempts: readonly GenerationAttemptAggregate[];
  readonly events: readonly GenerationAttemptEvent[];
  readonly sealAttestations: readonly SealAttestationRow[];
  readonly activationReceipts: readonly ActivationReceipt[];
  readonly rollbackReceipts: readonly RollbackReceipt[];
  readonly snapshotHash: string;
}

export interface C2SanitizedEvidence {
  readonly phase: "phase2cc-c2";
  readonly storage: "native-indexeddb";
  readonly physicalDatabaseName: string;
  readonly registryRevision: number;
  readonly activePointerCount: number;
  readonly attemptCount: number;
  readonly attemptStatuses: readonly Readonly<{ attemptId: string; status: GenerationAttemptAggregate["status"]; revision: number }>[];
  readonly eventCount: number;
  readonly sealAttestationCount: number;
  readonly activationReceiptCount: number;
  readonly rollbackReceiptCount: number;
  readonly snapshotHash: string;
  readonly automaticResumeAllowed: false;
  readonly automaticRetryAllowed: false;
  readonly productionNamespaceUsed: false;
  readonly exactSourceOpened: false;
  readonly backupAccessed: false;
  readonly actualMigrationPerformed: false;
  readonly networkCalls: 0;
  readonly modelCalls: 0;
  readonly personalDataUsed: false;
}

export interface C2RegistryTestHooks {
  readonly beforeUpgradeComplete?: (transaction: IDBTransaction) => void;
  readonly afterAttemptWritesQueued?: (transaction: IDBTransaction) => void;
  readonly afterPromotionWritesQueued?: (transaction: IDBTransaction) => void;
  readonly afterRollbackWritesQueued?: (transaction: IDBTransaction) => void;
}

export interface NativeGenerationRegistryOptions {
  readonly indexedDB: IDBFactory;
  readonly databaseName: string;
  readonly hasher: CanonicalHasher;
  readonly testHooks?: C2RegistryTestHooks;
}

export interface RegistryWriteContext {
  readonly indexedDbFactory: IDBFactory;
  readonly databaseName: string;
  readonly hasher: CanonicalHasher;
  readonly testHooks: C2RegistryTestHooks;
  readonly openDatabase: () => Promise<IDBDatabase>;
}

export interface NativeGenerationSealStoreOptions {
  readonly indexedDB: IDBFactory;
  readonly databaseName: string;
  readonly hasher: CanonicalHasher;
  readonly testHooks?: Readonly<{
    beforeUpgradeComplete?: (transaction: IDBTransaction) => void;
    afterSealWritesQueued?: (transaction: IDBTransaction) => void;
  }>;
}

export interface CommitCommandRequest {
  readonly operationId: string;
  readonly command: GenerationAttemptCommand;
}

export interface AttestGenerationSealRequest {
  readonly operationId: string;
  readonly attemptId: string;
  readonly seal: GenerationSeal;
  readonly physicalGenerationDatabaseName: string;
}

export interface CommitPromotionRequest {
  readonly operationId: string;
  readonly attemptId: string;
  readonly plan: PromotionPlan;
  readonly seal: GenerationSeal;
  readonly physicalGenerationDatabaseName: string;
  readonly commandId: string;
  readonly occurredAt: string;
}

export interface CommitRollbackRequest {
  readonly operationId: string;
  readonly attemptId: string;
  readonly plan: RollbackPlan;
  readonly commandId: string;
  readonly occurredAt: string;
}

export function reject<T>(
  code: C2StorageRejectionCode,
  message: string,
  details?: Readonly<Record<string, string | number | boolean | null>>,
): C2StorageResult<T> {
  return { ok: false, rejection: { code, message, details } };
}

export function cloneCanonical<T>(value: T): T {
  return JSON.parse(canonicalJson(value)) as T;
}

export function sameCanonical(left: unknown, right: unknown): boolean {
  return canonicalJson(left) === canonicalJson(right);
}

export function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise<T>((resolve, rejectRequest) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => rejectRequest(request.error ?? new Error("indexeddb_request_failed"));
  });
}

export function transactionCompletion(transaction: IDBTransaction): Promise<void> {
  return new Promise<void>((resolve, rejectTransaction) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => rejectTransaction(transaction.error ?? new Error("indexeddb_transaction_aborted"));
    transaction.onerror = () => {
      // Abort is the authoritative transaction result.
    };
  });
}

export function sortPointers(pointers: readonly ActiveGenerationPointer[]): readonly ActiveGenerationPointer[] {
  return [...pointers].sort((left, right) => left.workspace.localeCompare(right.workspace));
}

export function sortAttempts(attempts: readonly GenerationAttemptAggregate[]): readonly GenerationAttemptAggregate[] {
  return [...attempts].sort((left, right) => left.attemptId.localeCompare(right.attemptId));
}

export function sortEvents(events: readonly GenerationAttemptEvent[]): readonly GenerationAttemptEvent[] {
  return [...events].sort((left, right) => left.attemptId.localeCompare(right.attemptId) || left.sequence - right.sequence);
}

export function sortSeals(seals: readonly SealAttestationRow[]): readonly SealAttestationRow[] {
  return [...seals].sort((left, right) => left.generationId.localeCompare(right.generationId));
}

export function sortReceipts<T extends { readonly receiptId: string }>(receipts: readonly T[]): readonly T[] {
  return [...receipts].sort((left, right) => left.receiptId.localeCompare(right.receiptId));
}

function assertPhysicalC2DatabaseName(databaseName: string, kind: "registry" | "generation"): void {
  const expectedPrefix = `${C2_SANITIZED_DATABASE_PREFIX}${kind}-`;
  const suffix = databaseName.slice(expectedPrefix.length);
  if (!databaseName.trim() || !databaseName.startsWith(expectedPrefix) || !suffix.trim()) {
    throw new Error(`invalid_c2_${kind}_database_name:${databaseName}`);
  }
  if (
    databaseName === CONTROL_REGISTRY_NAME
    || databaseName.startsWith(GENERATION_DATABASE_PREFIX)
    || databaseName.includes("semantic-v060")
    || databaseName.includes("mindmap-v0.6.sqlite")
  ) {
    throw new Error(`production_or_legacy_database_forbidden:${databaseName}`);
  }
}

export function assertSafeC2RegistryDatabaseName(databaseName: string): void {
  assertPhysicalC2DatabaseName(databaseName, "registry");
}

export function assertSafeC2GenerationDatabaseName(databaseName: string): void {
  assertPhysicalC2DatabaseName(databaseName, "generation");
}

export function idempotencyFingerprint(kind: string, payload: unknown, hasher: CanonicalHasher): string {
  return hashCanonical({ kind, payload }, hasher);
}

export function operationIdValid(operationId: string): boolean {
  return typeof operationId === "string" && operationId.trim().length > 0;
}

export function buildSnapshot(
  revision: number,
  pointers: readonly ActiveGenerationPointer[],
): ControlRegistrySnapshot {
  return {
    registryName: CONTROL_REGISTRY_NAME,
    schemaVersion: CONTROL_REGISTRY_SCHEMA_VERSION,
    revision,
    activePointers: sortPointers(pointers),
  };
}

export function receiptCommandMeta(commandId: string, aggregate: GenerationAttemptAggregate, occurredAt: string): AttemptCommandMeta {
  return { commandId, occurredAt, expectedRevision: aggregate.revision };
}

export type SuccessfulAttemptCommandResult = Extract<AttemptCommandResult, { readonly ok: true }>;

export function isAttemptCommandSuccess(result: AttemptCommandResult): result is SuccessfulAttemptCommandResult {
  return result.ok === true;
}

export function domainFailure<T>(result: Exclude<AttemptCommandResult, { readonly ok: true }>): C2StorageResult<T> {
  return reject("domain_rejection", result.rejection.message, {
    domainCode: result.rejection.code,
  });
}

export function assertGenerationMetaRow(row: GenerationMetaRow | undefined, physicalDatabaseName: string): GenerationMetaRow {
  if (
    !row
    || row.key !== "generation"
    || row.physicalDatabaseName !== physicalDatabaseName
    || row.storageSchema !== C2_STORAGE_SCHEMA
    || row.sanitizedOnly !== true
  ) throw new Error("generation_database_metadata_mismatch");
  assertGenerationIdentity(row.logicalGeneration);
  if (row.logicalGeneration.workspace !== "synthetic") throw new Error("generation_database_workspace_mismatch");
  return row;
}

export function assertRegistryMetaRow(row: RegistryMetaRow | undefined, physicalDatabaseName: string): RegistryMetaRow {
  if (
    !row
    || row.key !== "schema"
    || row.physicalDatabaseName !== physicalDatabaseName
    || row.logicalRegistryName !== CONTROL_REGISTRY_NAME
    || row.logicalSchemaVersion !== CONTROL_REGISTRY_SCHEMA_VERSION
    || row.storageSchema !== C2_STORAGE_SCHEMA
    || row.databaseVersion !== C2_REGISTRY_DATABASE_VERSION
    || row.sanitizedOnly !== true
  ) throw new Error("registry_database_metadata_mismatch");
  return row;
}

export function assertRegistryRow(row: RegistryRow | undefined): RegistryRow {
  if (
    !row
    || row.key !== "registry"
    || row.logicalRegistryName !== CONTROL_REGISTRY_NAME
    || row.logicalSchemaVersion !== CONTROL_REGISTRY_SCHEMA_VERSION
    || !Number.isInteger(row.revision)
    || row.revision < 0
  ) throw new Error("registry_row_identity_mismatch");
  return row;
}
