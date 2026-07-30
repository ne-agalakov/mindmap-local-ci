import type { CanonicalHasher } from "../../generation-core/canonical-json.ts";
import { assertGenerationIdentity } from "../../generation-core/validators.ts";
import type { GenerationIdentity, GenerationSeal } from "../../generation-core/identities.ts";
import {
  C2_GENERATION_DATABASE_VERSION,
  C2_STORAGE_SCHEMA,
  GENERATION_IDEMPOTENCY_STORE,
  GENERATION_META_STORE,
  GENERATION_SEAL_STORE,
  type C2StorageResult,
  type GenerationMetaRow,
  type GenerationSealRow,
  type IdempotencyRow,
  type NativeGenerationSealStoreOptions,
  assertGenerationMetaRow,
  assertSafeC2GenerationDatabaseName,
  cloneCanonical,
  idempotencyFingerprint,
  operationIdValid,
  reject,
  requestResult,
  sameCanonical,
  transactionCompletion,
} from "./c2-indexeddb-common.ts";

export class NativeIndexedDbGenerationSealStore {
  readonly databaseName: string;
  private readonly indexedDbFactory: IDBFactory;
  private readonly hasher: CanonicalHasher;
  private readonly testHooks: NonNullable<NativeGenerationSealStoreOptions["testHooks"]>;
  private databasePromise?: Promise<IDBDatabase>;
  private writer: Promise<void> = Promise.resolve();

  constructor(options: NativeGenerationSealStoreOptions) {
    assertSafeC2GenerationDatabaseName(options.databaseName);
    this.databaseName = options.databaseName;
    this.indexedDbFactory = options.indexedDB;
    this.hasher = options.hasher;
    this.testHooks = options.testHooks ?? {};
  }

  initialize(logicalGeneration: GenerationIdentity, operationId: string): Promise<C2StorageResult<GenerationIdentity>> {
    const operation = this.writer.then(() => this.initializeSerialized(logicalGeneration, operationId));
    this.writer = operation.then(() => undefined, () => undefined);
    return operation;
  }

  seal(seal: GenerationSeal, operationId: string): Promise<C2StorageResult<GenerationSeal>> {
    const operation = this.writer.then(() => this.sealSerialized(seal, operationId));
    this.writer = operation.then(() => undefined, () => undefined);
    return operation;
  }

  async loadIdentity(): Promise<GenerationIdentity | undefined> {
    await this.writer;
    const database = await this.open();
    const transaction = database.transaction(GENERATION_META_STORE, "readonly");
    const completion = transactionCompletion(transaction);
    const row = await requestResult(transaction.objectStore(GENERATION_META_STORE).get("generation")) as GenerationMetaRow | undefined;
    await completion;
    return row ? cloneCanonical(assertGenerationMetaRow(row, this.databaseName).logicalGeneration) : undefined;
  }

  async loadSeal(): Promise<GenerationSeal | undefined> {
    await this.writer;
    const database = await this.open();
    const transaction = database.transaction(GENERATION_SEAL_STORE, "readonly");
    const completion = transactionCompletion(transaction);
    const row = await requestResult(transaction.objectStore(GENERATION_SEAL_STORE).get("seal")) as GenerationSealRow | undefined;
    await completion;
    return row ? cloneCanonical(row.seal) : undefined;
  }

  close(): void {
    void this.databasePromise?.then((database) => database.close(), () => undefined);
    this.databasePromise = undefined;
  }

  private async initializeSerialized(
    logicalGeneration: GenerationIdentity,
    operationId: string,
  ): Promise<C2StorageResult<GenerationIdentity>> {
    if (!operationIdValid(operationId)) return reject("invalid_request", "Generation initialization operation ID is required.");
    try {
      assertGenerationIdentity(logicalGeneration);
    } catch (error) {
      return reject("generation_identity_mismatch", error instanceof Error ? error.message : String(error));
    }
    if (logicalGeneration.workspace !== "synthetic") {
      return reject("generation_identity_mismatch", "C2 generation stores accept synthetic workspace only.");
    }
    const fingerprint = idempotencyFingerprint("initialize_generation", logicalGeneration, this.hasher);
    const database = await this.open();
    const transaction = database.transaction(
      [GENERATION_META_STORE, GENERATION_IDEMPOTENCY_STORE],
      "readwrite",
    );
    const completion = transactionCompletion(transaction);
    try {
      const idempotency = transaction.objectStore(GENERATION_IDEMPOTENCY_STORE);
      const existingReceipt = await requestResult(idempotency.get(operationId)) as IdempotencyRow<GenerationIdentity> | undefined;
      if (existingReceipt) {
        if (existingReceipt.fingerprint !== fingerprint) {
          transaction.abort();
          await completion.catch(() => undefined);
          return reject("idempotency_conflict", "Generation initialization operation is bound to different data.");
        }
        await completion;
        return { ok: true, value: cloneCanonical(existingReceipt.result), idempotent: true };
      }
      const metaStore = transaction.objectStore(GENERATION_META_STORE);
      const existing = await requestResult(metaStore.get("generation")) as GenerationMetaRow | undefined;
      if (existing) {
        assertGenerationMetaRow(existing, this.databaseName);
        transaction.abort();
        await completion.catch(() => undefined);
        return sameCanonical(existing.logicalGeneration, logicalGeneration)
          ? reject("generation_already_initialized", "Generation store is already initialized under another operation.")
          : reject("generation_identity_mismatch", "Physical generation store is bound to a different logical generation.");
      }
      const result = cloneCanonical(logicalGeneration);
      metaStore.add({
        key: "generation",
        physicalDatabaseName: this.databaseName,
        logicalGeneration: result,
        storageSchema: C2_STORAGE_SCHEMA,
        sanitizedOnly: true,
      } satisfies GenerationMetaRow);
      idempotency.add({ operationId, kind: "initialize_generation", fingerprint, result } satisfies IdempotencyRow<GenerationIdentity>);
      await completion;
      return { ok: true, value: result, idempotent: false };
    } catch (error) {
      try { transaction.abort(); } catch { /* already inactive */ }
      await completion.catch(() => undefined);
      return reject("transaction_aborted", error instanceof Error ? error.message : String(error));
    }
  }

  private async sealSerialized(seal: GenerationSeal, operationId: string): Promise<C2StorageResult<GenerationSeal>> {
    if (!operationIdValid(operationId)) return reject("invalid_request", "Generation seal operation ID is required.");
    const fingerprint = idempotencyFingerprint("seal_generation", seal, this.hasher);
    const database = await this.open();
    const transaction = database.transaction(
      [GENERATION_META_STORE, GENERATION_SEAL_STORE, GENERATION_IDEMPOTENCY_STORE],
      "readwrite",
    );
    const completion = transactionCompletion(transaction);
    try {
      const idempotency = transaction.objectStore(GENERATION_IDEMPOTENCY_STORE);
      const existingReceipt = await requestResult(idempotency.get(operationId)) as IdempotencyRow<GenerationSeal> | undefined;
      if (existingReceipt) {
        if (existingReceipt.fingerprint !== fingerprint) {
          transaction.abort();
          await completion.catch(() => undefined);
          return reject("idempotency_conflict", "Generation seal operation is bound to different data.");
        }
        await completion;
        return { ok: true, value: cloneCanonical(existingReceipt.result), idempotent: true };
      }
      const metaCandidate = await requestResult(transaction.objectStore(GENERATION_META_STORE).get("generation")) as GenerationMetaRow | undefined;
      if (!metaCandidate) {
        transaction.abort();
        await completion.catch(() => undefined);
        return reject("generation_not_initialized", "Generation store must be initialized before sealing.");
      }
      const meta = assertGenerationMetaRow(metaCandidate, this.databaseName);
      if (
        !seal.sealed
        || seal.generationId !== meta.logicalGeneration.generationId
        || seal.databaseName !== meta.logicalGeneration.databaseName
        || !seal.targetSnapshotHash.trim()
        || !seal.sealId.trim()
        || !seal.sealedAt.trim()
        || seal.networkCalls !== 0
        || seal.modelCalls !== 0
      ) {
        transaction.abort();
        await completion.catch(() => undefined);
        return reject("seal_mismatch", "Seal does not match the initialized logical generation.");
      }
      const sealStore = transaction.objectStore(GENERATION_SEAL_STORE);
      const existing = await requestResult(sealStore.get("seal")) as GenerationSealRow | undefined;
      if (existing) {
        transaction.abort();
        await completion.catch(() => undefined);
        return sameCanonical(existing.seal, seal)
          ? reject("seal_immutable_conflict", "Generation is already sealed under another operation.")
          : reject("seal_immutable_conflict", "A sealed generation cannot be resealed or modified.");
      }
      const result = cloneCanonical(seal);
      sealStore.add({ key: "seal", seal: result } satisfies GenerationSealRow);
      idempotency.add({ operationId, kind: "seal_generation", fingerprint, result } satisfies IdempotencyRow<GenerationSeal>);
      this.testHooks.afterSealWritesQueued?.(transaction);
      await completion;
      return { ok: true, value: result, idempotent: false };
    } catch (error) {
      try { transaction.abort(); } catch { /* already inactive */ }
      await completion.catch(() => undefined);
      return reject("transaction_aborted", error instanceof Error ? error.message : String(error));
    }
  }

  private async open(): Promise<IDBDatabase> {
    if (this.databasePromise) return this.databasePromise;
    this.databasePromise = new Promise<IDBDatabase>((resolve, rejectOpen) => {
      let upgradeError: unknown;
      const request = this.indexedDbFactory.open(this.databaseName, C2_GENERATION_DATABASE_VERSION);
      request.onupgradeneeded = () => {
        const database = request.result;
        const transaction = request.transaction;
        if (!transaction) {
          upgradeError = new Error("indexeddb_upgrade_transaction_missing");
          return;
        }
        try {
          if (!database.objectStoreNames.contains(GENERATION_META_STORE)) {
            database.createObjectStore(GENERATION_META_STORE, { keyPath: "key" });
          }
          if (!database.objectStoreNames.contains(GENERATION_SEAL_STORE)) {
            database.createObjectStore(GENERATION_SEAL_STORE, { keyPath: "key" });
          }
          if (!database.objectStoreNames.contains(GENERATION_IDEMPOTENCY_STORE)) {
            database.createObjectStore(GENERATION_IDEMPOTENCY_STORE, { keyPath: "operationId" });
          }
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
          const transaction = database.transaction(GENERATION_META_STORE, "readonly");
          const metaRequest = transaction.objectStore(GENERATION_META_STORE).get("generation");
          metaRequest.onsuccess = () => {
            try {
              if (metaRequest.result !== undefined) assertGenerationMetaRow(metaRequest.result as GenerationMetaRow, this.databaseName);
              resolve(database);
            } catch (error) {
              database.close();
              rejectOpen(error);
            }
          };
          metaRequest.onerror = () => {
            database.close();
            rejectOpen(metaRequest.error ?? new Error("generation_database_metadata_read_failed"));
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
