import { canonicalJson, type CanonicalHasher } from "../generation-core/canonical-json.ts";
import { validateC4AuthorizationBinding } from "./authorization-ledger.ts";
import { classifyC4Reload } from "./state-machine.ts";
import type {
  C4AuthorizationLedger,
  C4AuthorizationReceipt,
  C4DetachedAuthorization,
  C4ExecutionManifest,
  C4ExecutionState,
  C4ReloadClassification,
  C4StopCode,
} from "./types.ts";

export const C4_JOURNAL_DATABASE_PREFIX = "mindmap-state-core-v1-phase2cc-c4-fixture-journal-" as const;
const C4_JOURNAL_VERSION = 1;
const META_STORE = "meta";
const STATE_STORE = "attemptStates";
const AUTH_STORE = "authorizationReceipts";
const AUTH_BY_ATTEMPT = "byAttempt";

export type C4StateStoreResult<T> = Readonly<
  | { ok: true; value: T }
  | { ok: false; code: "journal_collision" | "state_missing" | "stale_revision" | "state_replay_mismatch" | "transaction_aborted"; message: string }
>;

export interface C4ExecutionStateStore {
  initialize(state: C4ExecutionState): Promise<C4StateStoreResult<C4ExecutionState>>;
  commit(expectedRevision: number, state: C4ExecutionState): Promise<C4StateStoreResult<C4ExecutionState>>;
  load(attemptId: string): Promise<C4ExecutionState | undefined>;
}

function clone<T>(value: T): T {
  return JSON.parse(canonicalJson(value)) as T;
}

function stateFailure(
  code: "journal_collision" | "state_missing" | "stale_revision" | "state_replay_mismatch" | "transaction_aborted",
  message: string,
): C4StateStoreResult<never> {
  return Object.freeze({ ok: false, code, message });
}

export class InMemoryC4ExecutionStateStore implements C4ExecutionStateStore {
  private readonly states = new Map<string, C4ExecutionState>();
  private writer: Promise<void> = Promise.resolve();

  initialize(state: C4ExecutionState): Promise<C4StateStoreResult<C4ExecutionState>> {
    return this.serialized(() => {
      if (this.states.has(state.attemptId)) return stateFailure("journal_collision", "Attempt state already exists.");
      const value = Object.freeze(clone(state));
      this.states.set(state.attemptId, value);
      return Object.freeze({ ok: true, value });
    });
  }

  commit(expectedRevision: number, state: C4ExecutionState): Promise<C4StateStoreResult<C4ExecutionState>> {
    return this.serialized(() => {
      const current = this.states.get(state.attemptId);
      if (!current) return stateFailure("state_missing", "Durable attempt state is missing.");
      if (current.revision !== expectedRevision) return stateFailure("stale_revision", "Durable attempt revision changed.");
      if (state.revision !== expectedRevision + 1) return stateFailure("state_replay_mismatch", "Next attempt revision is not exactly previous+1.");
      const value = Object.freeze(clone(state));
      this.states.set(state.attemptId, value);
      return Object.freeze({ ok: true, value });
    });
  }

  async load(attemptId: string): Promise<C4ExecutionState | undefined> {
    await this.writer;
    const value = this.states.get(attemptId);
    return value ? Object.freeze(clone(value)) : undefined;
  }

  private serialized<T>(operation: () => C4StateStoreResult<T>): Promise<C4StateStoreResult<T>> {
    const result = this.writer.then(operation);
    this.writer = result.then(() => undefined, () => undefined);
    return result;
  }
}

interface JournalMetaRow {
  readonly key: "schema";
  readonly databaseName: string;
  readonly schema: "phase2cc-c4-journal-v1";
  readonly sanitizedOnly: true;
}

interface StateRow {
  readonly attemptId: string;
  readonly state: C4ExecutionState;
}

interface AuthorizationRow {
  readonly authorizationId: string;
  readonly attemptId: string;
  readonly receipt: C4AuthorizationReceipt;
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("indexeddb_request_failed"));
  });
}

function transactionCompletion(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error ?? new Error("indexeddb_transaction_aborted"));
    transaction.onerror = () => { /* abort is authoritative */ };
  });
}

export interface IndexedDbC4JournalOptions {
  readonly indexedDB: IDBFactory;
  readonly databaseName: string;
  readonly hasher: CanonicalHasher;
  readonly testHooks?: Readonly<{
    afterStateWriteQueued?: (transaction: IDBTransaction) => void;
    afterAuthorizationWriteQueued?: (transaction: IDBTransaction) => void;
  }>;
}

export class IndexedDbC4ExecutionJournal implements C4ExecutionStateStore, C4AuthorizationLedger {
  readonly databaseName: string;
  private readonly indexedDB: IDBFactory;
  private readonly hasher: CanonicalHasher;
  private readonly testHooks: NonNullable<IndexedDbC4JournalOptions["testHooks"]>;
  private databasePromise?: Promise<IDBDatabase>;
  private writer: Promise<void> = Promise.resolve();

  constructor(options: IndexedDbC4JournalOptions) {
    if (!options.databaseName.startsWith(C4_JOURNAL_DATABASE_PREFIX) || options.databaseName.length <= C4_JOURNAL_DATABASE_PREFIX.length) {
      throw new Error(`invalid_c4_journal_database_name:${options.databaseName}`);
    }
    if (
      options.databaseName.includes("semantic-v060")
      || options.databaseName.includes("mindmap-v0.6.sqlite")
      || options.databaseName === "mindmap-state-core-control-v1"
    ) throw new Error(`production_or_legacy_journal_forbidden:${options.databaseName}`);
    this.databaseName = options.databaseName;
    this.indexedDB = options.indexedDB;
    this.hasher = options.hasher;
    this.testHooks = options.testHooks ?? {};
  }

  initialize(state: C4ExecutionState): Promise<C4StateStoreResult<C4ExecutionState>> {
    return this.enqueue(() => this.initializeSerialized(state));
  }

  commit(expectedRevision: number, state: C4ExecutionState): Promise<C4StateStoreResult<C4ExecutionState>> {
    return this.enqueue(() => this.commitSerialized(expectedRevision, state));
  }

  consume(
    authorization: C4DetachedAuthorization,
    manifest: C4ExecutionManifest,
    consumedAt: string,
    sourceOpenCount: number,
    hasher: CanonicalHasher,
  ): Promise<Readonly<
    | { ok: true; receipt: C4AuthorizationReceipt }
    | { ok: false; code: C4StopCode; message: string }
  >> {
    return this.enqueue(() => this.consumeSerialized(authorization, manifest, consumedAt, sourceOpenCount, hasher));
  }

  async load(attemptId: string): Promise<C4ExecutionState | undefined> {
    await this.writer;
    const database = await this.open();
    const transaction = database.transaction(STATE_STORE, "readonly");
    const completion = transactionCompletion(transaction);
    const row = await requestResult(transaction.objectStore(STATE_STORE).get(attemptId)) as StateRow | undefined;
    await completion;
    return row ? Object.freeze(clone(row.state)) : undefined;
  }

  async read(authorizationId: string): Promise<C4AuthorizationReceipt | undefined> {
    await this.writer;
    const database = await this.open();
    const transaction = database.transaction(AUTH_STORE, "readonly");
    const completion = transactionCompletion(transaction);
    const row = await requestResult(transaction.objectStore(AUTH_STORE).get(authorizationId)) as AuthorizationRow | undefined;
    await completion;
    return row ? Object.freeze(clone(row.receipt)) : undefined;
  }

  close(): void {
    void this.databasePromise?.then((database) => database.close(), () => undefined);
    this.databasePromise = undefined;
  }

  private enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.writer.then(operation);
    this.writer = result.then(() => undefined, () => undefined);
    return result;
  }

  private async initializeSerialized(state: C4ExecutionState): Promise<C4StateStoreResult<C4ExecutionState>> {
    const database = await this.open();
    const transaction = database.transaction(STATE_STORE, "readwrite");
    const completion = transactionCompletion(transaction);
    try {
      const store = transaction.objectStore(STATE_STORE);
      const existing = await requestResult(store.get(state.attemptId)) as StateRow | undefined;
      if (existing) {
        transaction.abort();
        await completion.catch(() => undefined);
        return stateFailure("journal_collision", "Attempt state already exists in C4 journal.");
      }
      const value = Object.freeze(clone(state));
      store.add({ attemptId: state.attemptId, state: value } satisfies StateRow);
      this.testHooks.afterStateWriteQueued?.(transaction);
      await completion;
      return Object.freeze({ ok: true, value });
    } catch (error) {
      try { transaction.abort(); } catch { /* inactive */ }
      await completion.catch(() => undefined);
      return stateFailure("transaction_aborted", error instanceof Error ? error.message : String(error));
    }
  }

  private async commitSerialized(expectedRevision: number, state: C4ExecutionState): Promise<C4StateStoreResult<C4ExecutionState>> {
    const database = await this.open();
    const transaction = database.transaction(STATE_STORE, "readwrite");
    const completion = transactionCompletion(transaction);
    try {
      const store = transaction.objectStore(STATE_STORE);
      const existing = await requestResult(store.get(state.attemptId)) as StateRow | undefined;
      if (!existing) {
        transaction.abort();
        await completion.catch(() => undefined);
        return stateFailure("state_missing", "Attempt state is missing in C4 journal.");
      }
      if (existing.state.revision !== expectedRevision) {
        transaction.abort();
        await completion.catch(() => undefined);
        return stateFailure("stale_revision", "C4 journal revision changed.");
      }
      if (state.revision !== expectedRevision + 1) {
        transaction.abort();
        await completion.catch(() => undefined);
        return stateFailure("state_replay_mismatch", "Next C4 state revision is invalid.");
      }
      const value = Object.freeze(clone(state));
      store.put({ attemptId: state.attemptId, state: value } satisfies StateRow);
      this.testHooks.afterStateWriteQueued?.(transaction);
      await completion;
      return Object.freeze({ ok: true, value });
    } catch (error) {
      try { transaction.abort(); } catch { /* inactive */ }
      await completion.catch(() => undefined);
      return stateFailure("transaction_aborted", error instanceof Error ? error.message : String(error));
    }
  }

  private async consumeSerialized(
    authorization: C4DetachedAuthorization,
    manifest: C4ExecutionManifest,
    consumedAt: string,
    sourceOpenCount: number,
    hasher: CanonicalHasher,
  ): Promise<Readonly<
    | { ok: true; receipt: C4AuthorizationReceipt }
    | { ok: false; code: C4StopCode; message: string }
  >> {
    if (sourceOpenCount !== 0) {
      return Object.freeze({ ok: false, code: "source_opened_before_authorization", message: "Authorization must be consumed before fixture-source open." });
    }
    if (hasher !== this.hasher) {
      return Object.freeze({ ok: false, code: "mismatched_authorization", message: "Journal hasher identity mismatch." });
    }
    const validation = validateC4AuthorizationBinding(authorization, manifest, consumedAt);
    if (!validation.ok) return validation;
    const database = await this.open();
    const transaction = database.transaction(AUTH_STORE, "readwrite");
    const completion = transactionCompletion(transaction);
    try {
      const store = transaction.objectStore(AUTH_STORE);
      const existing = await requestResult(store.get(authorization.authorizationId)) as AuthorizationRow | undefined;
      if (existing) {
        transaction.abort();
        await completion.catch(() => undefined);
        return Object.freeze({ ok: false, code: "authorization_consumed", message: "Authorization receipt already exists." });
      }
      const duplicateAttempt = await requestResult(store.index(AUTH_BY_ATTEMPT).get(authorization.attemptId)) as AuthorizationRow | undefined;
      if (duplicateAttempt) {
        transaction.abort();
        await completion.catch(() => undefined);
        return Object.freeze({ ok: false, code: "duplicate_authorization", message: "Attempt already consumed another authorization." });
      }
      const receipt: C4AuthorizationReceipt = Object.freeze({
        receiptVersion: "phase2cc-c4-authorization-receipt-v1",
        authorizationId: authorization.authorizationId,
        attemptId: authorization.attemptId,
        consumedAt,
        authorizationFingerprint: this.hasher(canonicalJson(authorization)),
        manifestFingerprint: this.hasher(canonicalJson(manifest)),
        sourceOpenCountAtConsumption: 0,
        consumed: true,
      });
      store.add({ authorizationId: receipt.authorizationId, attemptId: receipt.attemptId, receipt } satisfies AuthorizationRow);
      this.testHooks.afterAuthorizationWriteQueued?.(transaction);
      await completion;
      return Object.freeze({ ok: true, receipt: Object.freeze(clone(receipt)) });
    } catch (error) {
      try { transaction.abort(); } catch { /* inactive */ }
      await completion.catch(() => undefined);
      return Object.freeze({ ok: false, code: "authorization_consumed", message: error instanceof Error ? error.message : String(error) });
    }
  }

  private async open(): Promise<IDBDatabase> {
    if (this.databasePromise) return this.databasePromise;
    this.databasePromise = new Promise((resolve, reject) => {
      let upgradeError: unknown;
      const request = this.indexedDB.open(this.databaseName, C4_JOURNAL_VERSION);
      request.onupgradeneeded = () => {
        const database = request.result;
        const transaction = request.transaction;
        if (!transaction) { upgradeError = new Error("c4_journal_upgrade_transaction_missing"); return; }
        try {
          if (!database.objectStoreNames.contains(META_STORE)) database.createObjectStore(META_STORE, { keyPath: "key" });
          if (!database.objectStoreNames.contains(STATE_STORE)) database.createObjectStore(STATE_STORE, { keyPath: "attemptId" });
          if (!database.objectStoreNames.contains(AUTH_STORE)) {
            const store = database.createObjectStore(AUTH_STORE, { keyPath: "authorizationId" });
            store.createIndex(AUTH_BY_ATTEMPT, "attemptId", { unique: true });
          }
          transaction.objectStore(META_STORE).put({
            key: "schema",
            databaseName: this.databaseName,
            schema: "phase2cc-c4-journal-v1",
            sanitizedOnly: true,
          } satisfies JournalMetaRow);
        } catch (error) {
          upgradeError = error;
          try { transaction.abort(); } catch { /* preserve */ }
        }
      };
      request.onsuccess = () => {
        const database = request.result;
        database.onversionchange = () => database.close();
        const transaction = database.transaction(META_STORE, "readonly");
        const get = transaction.objectStore(META_STORE).get("schema");
        get.onsuccess = () => {
          const row = get.result as JournalMetaRow | undefined;
          if (
            !row
            || row.databaseName !== this.databaseName
            || row.schema !== "phase2cc-c4-journal-v1"
            || row.sanitizedOnly !== true
          ) {
            database.close();
            reject(new Error("c4_journal_identity_mismatch"));
          } else resolve(database);
        };
        get.onerror = () => { database.close(); reject(get.error ?? new Error("c4_journal_meta_read_failed")); };
      };
      request.onerror = () => reject(upgradeError instanceof Error ? upgradeError : request.error ?? new Error("c4_journal_open_failed"));
      request.onblocked = () => reject(new Error(`c4_journal_open_blocked:${this.databaseName}`));
    });
    try { return await this.databasePromise; }
    catch (error) { this.databasePromise = undefined; throw error; }
  }
}

export async function inspectDurableC4Reload(
  stateStore: C4ExecutionStateStore,
  authorizationLedger: C4AuthorizationLedger,
  attemptId: string,
  authorizationId: string,
): Promise<Readonly<{
  classification: C4ReloadClassification;
  state?: C4ExecutionState;
  authorizationReceiptPresent: boolean;
  resumeCommandProduced: false;
  retryCommandProduced: false;
  cleanupCommandProduced: false;
  promotionCommandProduced: false;
  rollbackCommandProduced: false;
}>> {
  const [state, receipt] = await Promise.all([
    stateStore.load(attemptId),
    authorizationLedger.read(authorizationId),
  ]);
  let classification: C4ReloadClassification;
  if (receipt && (!state || state.checkpoint === "P00" || state.checkpoint === "P01")) {
    classification = "authorization_consumed";
  } else if (state) {
    classification = classifyC4Reload(state);
  } else {
    classification = "rejected_preflight";
  }
  return Object.freeze({
    classification,
    ...(state ? { state } : {}),
    authorizationReceiptPresent: Boolean(receipt),
    resumeCommandProduced: false,
    retryCommandProduced: false,
    cleanupCommandProduced: false,
    promotionCommandProduced: false,
    rollbackCommandProduced: false,
  });
}
