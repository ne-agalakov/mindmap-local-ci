import type { RegistryWriteContext } from "./c2-indexeddb-common.ts";
import { attestGenerationSealSerialized, commitAttemptResultSerialized } from "./c2-attempt-operations.ts";
import { commitPromotionSerialized, commitRollbackSerialized } from "./c2-pointer-operations.ts";
import { CONTROL_REGISTRY_NAME, CONTROL_REGISTRY_SCHEMA_VERSION } from "../../generation-core/constants.ts";
import { hashCanonical, type CanonicalHasher } from "../../generation-core/canonical-json.ts";
import {
  executeGenerationAttemptCommand,
  inspectGenerationAttempt,
} from "../../generation-core/attempt-commands.ts";
import { planGenerationAttempt } from "../../generation-core/command-common.ts";
import type {
  AttemptCommandMeta,
  AttemptCommandResult,
  GenerationAttemptAggregate,
  GenerationAttemptEvent,
  GenerationAttemptInspection,
} from "../../generation-core/attempt-types.ts";
import type {
  ActiveGenerationPointer,
  ControlRegistrySnapshot,
  GenerationExecutionManifest,
} from "../../generation-core/identities.ts";
import type { ActivationReceipt, RollbackReceipt } from "../../generation-core/registry-types.ts";
import { assertRegistrySnapshot } from "../../generation-core/validators.ts";
import {
  ACTIVATION_RECEIPTS_STORE,
  ATTEMPTS_STORE,
  BY_ATTEMPT_INDEX,
  C2_REGISTRY_DATABASE_VERSION,
  C2_STORAGE_SCHEMA,
  EVENTS_STORE,
  IDEMPOTENCY_STORE,
  META_STORE,
  POINTERS_STORE,
  REGISTRY_STORE,
  ROLLBACK_RECEIPTS_STORE,
  SEAL_ATTESTATIONS_STORE,
  type AttemptEventRow,
  type AttemptRow,
  type AttestGenerationSealRequest,
  type C2RegistrySnapshot,
  type C2RegistryTestHooks,
  type C2SanitizedEvidence,
  type C2StorageResult,
  type CommitCommandRequest,
  type CommitPromotionRequest,
  type CommitRollbackRequest,
  type IdempotencyRow,
  type NativeGenerationRegistryOptions,
  type RegistryMetaRow,
  type RegistryRow,
  type SealAttestationRow,
  assertRegistryMetaRow,
  assertRegistryRow,
  assertSafeC2RegistryDatabaseName,
  buildSnapshot,
  cloneCanonical,
  domainFailure,
  idempotencyFingerprint,
  isAttemptCommandSuccess,
  operationIdValid,
  reject,
  requestResult,
  sortAttempts,
  sortEvents,
  sortReceipts,
  sortSeals,
  transactionCompletion,
} from "./c2-indexeddb-common.ts";

export class NativeIndexedDbGenerationRegistry {
  readonly databaseName: string;
  private readonly indexedDbFactory: IDBFactory;
  private readonly hasher: CanonicalHasher;
  private readonly testHooks: C2RegistryTestHooks;
  private databasePromise?: Promise<IDBDatabase>;
  private writer: Promise<void> = Promise.resolve();

  constructor(options: NativeGenerationRegistryOptions) {
    assertSafeC2RegistryDatabaseName(options.databaseName);
    this.databaseName = options.databaseName;
    this.indexedDbFactory = options.indexedDB;
    this.hasher = options.hasher;
    this.testHooks = options.testHooks ?? {};
  }

  initializeRegistry(snapshot: ControlRegistrySnapshot, operationId: string): Promise<C2StorageResult<ControlRegistrySnapshot>> {
    const operation = this.writer.then(() => this.initializeRegistrySerialized(snapshot, operationId));
    this.writer = operation.then(() => undefined, () => undefined);
    return operation;
  }

  createAttempt(
    manifest: GenerationExecutionManifest,
    meta: AttemptCommandMeta,
  ): Promise<C2StorageResult<GenerationAttemptAggregate>> {
    let planned: AttemptCommandResult;
    try {
      planned = planGenerationAttempt(manifest, meta, this.hasher);
    } catch (error) {
      return Promise.resolve(reject("domain_rejection", error instanceof Error ? error.message : String(error)));
    }
    if (!isAttemptCommandSuccess(planned)) {
      return Promise.resolve(domainFailure<GenerationAttemptAggregate>(planned));
    }
    return this.commitAttemptResult(meta.commandId, 0, planned.aggregate, planned.events);
  }

  async commitCommand(request: CommitCommandRequest): Promise<C2StorageResult<GenerationAttemptAggregate>> {
    if (!operationIdValid(request.operationId)) return reject("invalid_request", "Command operation ID is required.");
    if (request.command.type === "record_promotion_committed" || request.command.type === "record_rollback_committed") {
      return reject("invalid_request", "Promotion and rollback commands require their dedicated atomic registry methods.");
    }
    const aggregate = await this.loadAttempt(request.command.attemptId);
    if (!aggregate) return reject("attempt_not_found", "Attempt does not exist.");
    const result = executeGenerationAttemptCommand(aggregate, request.command, this.hasher);
    if (!isAttemptCommandSuccess(result)) return domainFailure<GenerationAttemptAggregate>(result);
    if (result.idempotent) return { ok: true, value: aggregate, idempotent: true };
    return this.commitAttemptResult(request.operationId, aggregate.revision, result.aggregate, result.events);
  }

  attestGenerationSeal(request: AttestGenerationSealRequest): Promise<C2StorageResult<SealAttestationRow>> {
    const operation = this.writer.then(() => attestGenerationSealSerialized(this.operationContext(), request));
    this.writer = operation.then(() => undefined, () => undefined);
    return operation;
  }

  commitPromotion(request: CommitPromotionRequest): Promise<C2StorageResult<ActivationReceipt>> {
    const operation = this.writer.then(() => commitPromotionSerialized(this.operationContext(), request));
    this.writer = operation.then(() => undefined, () => undefined);
    return operation;
  }

  commitRollback(request: CommitRollbackRequest): Promise<C2StorageResult<RollbackReceipt>> {
    const operation = this.writer.then(() => commitRollbackSerialized(this.operationContext(), request));
    this.writer = operation.then(() => undefined, () => undefined);
    return operation;
  }

  async loadRegistry(): Promise<ControlRegistrySnapshot | undefined> {
    await this.writer;
    const database = await this.open();
    const transaction = database.transaction([REGISTRY_STORE, POINTERS_STORE], "readonly");
    const completion = transactionCompletion(transaction);
    const row = await requestResult(transaction.objectStore(REGISTRY_STORE).get("registry")) as RegistryRow | undefined;
    const pointers = await requestResult(transaction.objectStore(POINTERS_STORE).getAll()) as ActiveGenerationPointer[];
    await completion;
    return row ? cloneCanonical(buildSnapshot(assertRegistryRow(row).revision, pointers)) : undefined;
  }

  async loadAttempt(attemptId: string): Promise<GenerationAttemptAggregate | undefined> {
    await this.writer;
    const database = await this.open();
    const transaction = database.transaction(ATTEMPTS_STORE, "readonly");
    const completion = transactionCompletion(transaction);
    const row = await requestResult(transaction.objectStore(ATTEMPTS_STORE).get(attemptId)) as AttemptRow | undefined;
    await completion;
    return row ? cloneCanonical(row.aggregate) : undefined;
  }

  async loadAttemptEvents(attemptId: string): Promise<readonly GenerationAttemptEvent[]> {
    await this.writer;
    const database = await this.open();
    const transaction = database.transaction(EVENTS_STORE, "readonly");
    const completion = transactionCompletion(transaction);
    const rows = await requestResult(
      transaction.objectStore(EVENTS_STORE).index(BY_ATTEMPT_INDEX).getAll(attemptId),
    ) as AttemptEventRow[];
    await completion;
    return cloneCanonical(rows.sort((left, right) => left.sequence - right.sequence).map((row) => row.event));
  }

  async loadSealAttestation(generationId: string): Promise<SealAttestationRow | undefined> {
    await this.writer;
    const database = await this.open();
    const transaction = database.transaction(SEAL_ATTESTATIONS_STORE, "readonly");
    const completion = transactionCompletion(transaction);
    const row = await requestResult(transaction.objectStore(SEAL_ATTESTATIONS_STORE).get(generationId)) as SealAttestationRow | undefined;
    await completion;
    return row ? cloneCanonical(row) : undefined;
  }

  async inspectRecovery(attemptId: string): Promise<GenerationAttemptInspection | undefined> {
    const aggregate = await this.loadAttempt(attemptId);
    return aggregate ? inspectGenerationAttempt(aggregate) : undefined;
  }

  async exportSnapshot(): Promise<C2RegistrySnapshot> {
    await this.writer;
    const database = await this.open();
    const transaction = database.transaction(
      [REGISTRY_STORE, POINTERS_STORE, ATTEMPTS_STORE, EVENTS_STORE, SEAL_ATTESTATIONS_STORE,
        ACTIVATION_RECEIPTS_STORE, ROLLBACK_RECEIPTS_STORE],
      "readonly",
    );
    const completion = transactionCompletion(transaction);
    const registryRow = await requestResult(transaction.objectStore(REGISTRY_STORE).get("registry")) as RegistryRow | undefined;
    if (!registryRow) {
      await completion;
      throw new Error("registry_not_initialized");
    }
    const [pointers, attemptRows, eventRows, seals, activations, rollbacks] = await Promise.all([
      requestResult(transaction.objectStore(POINTERS_STORE).getAll()) as Promise<ActiveGenerationPointer[]>,
      requestResult(transaction.objectStore(ATTEMPTS_STORE).getAll()) as Promise<AttemptRow[]>,
      requestResult(transaction.objectStore(EVENTS_STORE).getAll()) as Promise<AttemptEventRow[]>,
      requestResult(transaction.objectStore(SEAL_ATTESTATIONS_STORE).getAll()) as Promise<SealAttestationRow[]>,
      requestResult(transaction.objectStore(ACTIVATION_RECEIPTS_STORE).getAll()) as Promise<ActivationReceipt[]>,
      requestResult(transaction.objectStore(ROLLBACK_RECEIPTS_STORE).getAll()) as Promise<RollbackReceipt[]>,
    ]);
    await completion;
    const registry = buildSnapshot(assertRegistryRow(registryRow).revision, pointers);
    const attempts = sortAttempts(attemptRows.map((row) => row.aggregate));
    const events = sortEvents(eventRows.map((row) => row.event));
    const sealAttestations = sortSeals(seals);
    const activationReceipts = sortReceipts(activations);
    const rollbackReceipts = sortReceipts(rollbacks);
    const snapshotHash = hashCanonical({
      storageSchema: C2_STORAGE_SCHEMA,
      registry,
      attempts,
      events,
      sealAttestations,
      activationReceipts,
      rollbackReceipts,
    }, this.hasher);
    return cloneCanonical({
      physicalDatabaseName: this.databaseName,
      registry,
      attempts,
      events,
      sealAttestations,
      activationReceipts,
      rollbackReceipts,
      snapshotHash,
    });
  }

  async exportSanitizedEvidence(): Promise<C2SanitizedEvidence> {
    const snapshot = await this.exportSnapshot();
    return {
      phase: "phase2cc-c2",
      storage: "native-indexeddb",
      physicalDatabaseName: this.databaseName,
      registryRevision: snapshot.registry.revision,
      activePointerCount: snapshot.registry.activePointers.length,
      attemptCount: snapshot.attempts.length,
      attemptStatuses: snapshot.attempts.map((attempt) => ({
        attemptId: attempt.attemptId,
        status: attempt.status,
        revision: attempt.revision,
      })),
      eventCount: snapshot.events.length,
      sealAttestationCount: snapshot.sealAttestations.length,
      activationReceiptCount: snapshot.activationReceipts.length,
      rollbackReceiptCount: snapshot.rollbackReceipts.length,
      snapshotHash: snapshot.snapshotHash,
      automaticResumeAllowed: false,
      automaticRetryAllowed: false,
      productionNamespaceUsed: false,
      exactSourceOpened: false,
      backupAccessed: false,
      actualMigrationPerformed: false,
      networkCalls: 0,
      modelCalls: 0,
      personalDataUsed: false,
    };
  }

  close(): void {
    void this.databasePromise?.then((database) => database.close(), () => undefined);
    this.databasePromise = undefined;
  }

  private async initializeRegistrySerialized(
    snapshot: ControlRegistrySnapshot,
    operationId: string,
  ): Promise<C2StorageResult<ControlRegistrySnapshot>> {
    if (!operationIdValid(operationId)) return reject("invalid_request", "Registry initialization operation ID is required.");
    try {
      assertRegistrySnapshot(snapshot);
    } catch (error) {
      return reject("registry_identity_mismatch", error instanceof Error ? error.message : String(error));
    }
    if (snapshot.activePointers.some((pointer) => pointer.workspace !== "synthetic")) {
      return reject("registry_identity_mismatch", "C2 registry accepts synthetic workspace pointers only.");
    }
    const fingerprint = idempotencyFingerprint("initialize_registry", snapshot, this.hasher);
    const database = await this.open();
    const transaction = database.transaction(
      [REGISTRY_STORE, POINTERS_STORE, IDEMPOTENCY_STORE],
      "readwrite",
    );
    const completion = transactionCompletion(transaction);
    try {
      const idempotency = transaction.objectStore(IDEMPOTENCY_STORE);
      const receipt = await requestResult(idempotency.get(operationId)) as IdempotencyRow<ControlRegistrySnapshot> | undefined;
      if (receipt) {
        if (receipt.fingerprint !== fingerprint) {
          transaction.abort();
          await completion.catch(() => undefined);
          return reject("idempotency_conflict", "Registry initialization operation is bound to different data.");
        }
        await completion;
        return { ok: true, value: cloneCanonical(receipt.result), idempotent: true };
      }
      const registryStore = transaction.objectStore(REGISTRY_STORE);
      const existing = await requestResult(registryStore.get("registry")) as RegistryRow | undefined;
      if (existing) {
        assertRegistryRow(existing);
        transaction.abort();
        await completion.catch(() => undefined);
        return reject("registry_already_initialized", "Registry is already initialized under another operation.");
      }
      registryStore.add({
        key: "registry",
        revision: snapshot.revision,
        logicalRegistryName: CONTROL_REGISTRY_NAME,
        logicalSchemaVersion: CONTROL_REGISTRY_SCHEMA_VERSION,
      } satisfies RegistryRow);
      const pointers = transaction.objectStore(POINTERS_STORE);
      for (const pointer of snapshot.activePointers) pointers.add(cloneCanonical(pointer));
      const result = cloneCanonical(buildSnapshot(snapshot.revision, snapshot.activePointers));
      idempotency.add({ operationId, kind: "initialize_registry", fingerprint, result } satisfies IdempotencyRow<ControlRegistrySnapshot>);
      await completion;
      return { ok: true, value: result, idempotent: false };
    } catch (error) {
      try { transaction.abort(); } catch { /* already inactive */ }
      await completion.catch(() => undefined);
      return reject("transaction_aborted", error instanceof Error ? error.message : String(error));
    }
  }

  private commitAttemptResult(
    operationId: string,
    expectedAttemptRevision: number,
    aggregate: GenerationAttemptAggregate,
    events: readonly GenerationAttemptEvent[],
  ): Promise<C2StorageResult<GenerationAttemptAggregate>> {
    const operation = this.writer.then(() => commitAttemptResultSerialized(
      this.operationContext(), operationId, expectedAttemptRevision, aggregate, events,
    ));
    this.writer = operation.then(() => undefined, () => undefined);
    return operation;
  }

  private operationContext(): RegistryWriteContext {
    return {
      databaseName: this.databaseName,
      indexedDbFactory: this.indexedDbFactory,
      hasher: this.hasher,
      testHooks: this.testHooks,
      openDatabase: () => this.open(),
    };
  }

  private async open(): Promise<IDBDatabase> {
    if (this.databasePromise) return this.databasePromise;
    this.databasePromise = new Promise<IDBDatabase>((resolve, rejectOpen) => {
      let upgradeError: unknown;
      const request = this.indexedDbFactory.open(this.databaseName, C2_REGISTRY_DATABASE_VERSION);
      request.onupgradeneeded = () => {
        const database = request.result;
        const transaction = request.transaction;
        if (!transaction) {
          upgradeError = new Error("indexeddb_upgrade_transaction_missing");
          return;
        }
        try {
          if (!database.objectStoreNames.contains(META_STORE)) database.createObjectStore(META_STORE, { keyPath: "key" });
          if (!database.objectStoreNames.contains(REGISTRY_STORE)) database.createObjectStore(REGISTRY_STORE, { keyPath: "key" });
          if (!database.objectStoreNames.contains(POINTERS_STORE)) database.createObjectStore(POINTERS_STORE, { keyPath: "workspace" });
          if (!database.objectStoreNames.contains(ATTEMPTS_STORE)) database.createObjectStore(ATTEMPTS_STORE, { keyPath: "attemptId" });
          if (!database.objectStoreNames.contains(EVENTS_STORE)) {
            const events = database.createObjectStore(EVENTS_STORE, { keyPath: ["attemptId", "sequence"] });
            events.createIndex(BY_ATTEMPT_INDEX, "attemptId", { unique: false });
          }
          if (!database.objectStoreNames.contains(SEAL_ATTESTATIONS_STORE)) database.createObjectStore(SEAL_ATTESTATIONS_STORE, { keyPath: "generationId" });
          if (!database.objectStoreNames.contains(ACTIVATION_RECEIPTS_STORE)) database.createObjectStore(ACTIVATION_RECEIPTS_STORE, { keyPath: "receiptId" });
          if (!database.objectStoreNames.contains(ROLLBACK_RECEIPTS_STORE)) database.createObjectStore(ROLLBACK_RECEIPTS_STORE, { keyPath: "receiptId" });
          if (!database.objectStoreNames.contains(IDEMPOTENCY_STORE)) database.createObjectStore(IDEMPOTENCY_STORE, { keyPath: "operationId" });
          transaction.objectStore(META_STORE).put({
            key: "schema",
            physicalDatabaseName: this.databaseName,
            logicalRegistryName: CONTROL_REGISTRY_NAME,
            logicalSchemaVersion: CONTROL_REGISTRY_SCHEMA_VERSION,
            storageSchema: C2_STORAGE_SCHEMA,
            databaseVersion: C2_REGISTRY_DATABASE_VERSION,
            sanitizedOnly: true,
          } satisfies RegistryMetaRow);
          this.testHooks.beforeUpgradeComplete?.(transaction);
        } catch (error) {
          upgradeError = error;
          try { transaction.abort(); } catch { /* preserve original error */ }
        }
      };
      request.onsuccess = () => {
        const database = request.result;
        database.onversionchange = () => database.close();
        try {
          const transaction = database.transaction(META_STORE, "readonly");
          const metaRequest = transaction.objectStore(META_STORE).get("schema");
          metaRequest.onsuccess = () => {
            try {
              assertRegistryMetaRow(metaRequest.result as RegistryMetaRow | undefined, this.databaseName);
              resolve(database);
            } catch (error) {
              database.close();
              rejectOpen(error);
            }
          };
          metaRequest.onerror = () => {
            database.close();
            rejectOpen(metaRequest.error ?? new Error("registry_database_metadata_read_failed"));
          };
        } catch (error) {
          database.close();
          rejectOpen(error);
        }
      };
      request.onerror = () => rejectOpen(
        upgradeError instanceof Error ? upgradeError : request.error ?? new Error("indexeddb_database_open_failed"),
      );
      request.onblocked = () => rejectOpen(new Error(`indexeddb_database_open_blocked:${this.databaseName}`));
    });
    try {
      return await this.databasePromise;
    } catch (error) {
      this.databasePromise = undefined;
      throw error;
    }
  }
}
