import type { RunAggregate, WorkspaceKind } from "../../domain/run.ts";
import { applyRunEvent } from "../../state-core/run-state-core.ts";
import { canonicalClone, canonicalJson } from "../canonical-json.ts";
import {
  STATE_STORAGE_NAMESPACE,
  type CanonicalContentHasher,
  type StorageCommitReceipt,
  type StorageCommitRequest,
  type StorageCommitResult,
  type StorageRejectionCode,
  type StorageSnapshot,
  type StoredArtifactRecord,
  type StoredEventRecord,
  type StoredRunRecord,
  type TransactionalStateStorage,
} from "../contracts.ts";

export const NATIVE_STATE_DATABASE_VERSION = 1;
export const LEGACY_STATE_DATABASE_NAME = "mindmap-local-semantic-v060" as const;

const META_STORE = "meta";
const RUNS_STORE = "runs";
const EVENTS_STORE = "events";
const ARTIFACTS_STORE = "artifacts";
const RECEIPTS_STORE = "receipts";
const BY_RUN_INDEX = "byRun";

interface MetaRow {
  readonly key: "schema";
  readonly namespace: typeof STATE_STORAGE_NAMESPACE;
  readonly databaseVersion: number;
}

interface ReceiptRow {
  readonly workspace: WorkspaceKind;
  readonly idempotencyKey: string;
  readonly fingerprint: string;
  readonly receipt: StorageCommitReceipt;
}

interface CurrentRunState {
  readonly run?: StoredRunRecord;
  readonly events: readonly StoredEventRecord[];
  readonly artifacts: readonly StoredArtifactRecord[];
  readonly receipt?: ReceiptRow;
}

interface PreparedCommit {
  readonly fingerprint: string;
  readonly baseRevision: number;
  readonly baseContentHash?: string;
  readonly nextRun: StoredRunRecord;
  readonly nextEvents: readonly StoredEventRecord[];
  readonly appendedEvents: readonly StoredEventRecord[];
  readonly nextArtifacts: readonly StoredArtifactRecord[];
  readonly appendedArtifacts: readonly StoredArtifactRecord[];
  readonly receipt: StorageCommitReceipt;
}

export interface NativeIndexedDbTestHooks {
  readonly beforeUpgradeComplete?: (context: Readonly<{
    database: IDBDatabase;
    transaction: IDBTransaction;
    oldVersion: number;
    newVersion: number | null;
  }>) => void;
  readonly afterWriteRequestsQueued?: (transaction: IDBTransaction) => void;
}

export interface NativeIndexedDbStorageOptions {
  readonly indexedDB: IDBFactory;
  readonly hashCanonical: CanonicalContentHasher;
  readonly databaseName?: string;
  readonly databaseVersion?: number;
  readonly testHooks?: NativeIndexedDbTestHooks;
}

export function assertSafeStateDatabaseName(databaseName: string): void {
  if (!databaseName.trim() || !databaseName.startsWith(STATE_STORAGE_NAMESPACE)) {
    throw new Error(`invalid_state_database_name:${databaseName}`);
  }
  if (
    databaseName === LEGACY_STATE_DATABASE_NAME
    || databaseName.includes("semantic-v060")
    || databaseName.includes("mindmap-v0.6.sqlite")
  ) {
    throw new Error(`legacy_state_database_forbidden:${databaseName}`);
  }
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("indexeddb_request_failed"));
  });
}

function transactionCompletion(transaction: IDBTransaction): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error ?? new Error("indexeddb_transaction_aborted"));
    transaction.onerror = () => {
      // `abort` is the authoritative final transaction result.
    };
  });
}

function reject(
  code: StorageRejectionCode,
  message: string,
  details?: Readonly<Record<string, string | number | boolean | null>>,
): StorageCommitResult {
  return { ok: false, rejection: { code, message, details } };
}

function sameCanonical(left: unknown, right: unknown): boolean {
  return canonicalJson(left) === canonicalJson(right);
}

function runKey(workspace: WorkspaceKind, runId: string): readonly [WorkspaceKind, string] {
  return [workspace, runId];
}

function receiptKey(workspace: WorkspaceKind, idempotencyKey: string): readonly [WorkspaceKind, string] {
  return [workspace, idempotencyKey];
}

function sortEvents(events: readonly StoredEventRecord[]): readonly StoredEventRecord[] {
  return [...events].sort((left, right) => left.sequence - right.sequence);
}

function sortArtifacts(artifacts: readonly StoredArtifactRecord[]): readonly StoredArtifactRecord[] {
  return [...artifacts].sort((left, right) => (
    left.artifactId.localeCompare(right.artifactId) || left.version - right.version
  ));
}

export class NativeIndexedDbStorage implements TransactionalStateStorage {
  readonly databaseName: string;
  readonly databaseVersion: number;

  private readonly indexedDbFactory: IDBFactory;
  private readonly hashCanonical: CanonicalContentHasher;
  private readonly testHooks: NativeIndexedDbTestHooks;
  private databasePromise?: Promise<IDBDatabase>;
  private writer: Promise<void> = Promise.resolve();

  constructor(options: NativeIndexedDbStorageOptions) {
    this.databaseName = options.databaseName ?? STATE_STORAGE_NAMESPACE;
    this.databaseVersion = options.databaseVersion ?? NATIVE_STATE_DATABASE_VERSION;
    assertSafeStateDatabaseName(this.databaseName);
    if (!Number.isInteger(this.databaseVersion) || this.databaseVersion < 1) {
      throw new Error(`invalid_state_database_version:${this.databaseVersion}`);
    }
    this.indexedDbFactory = options.indexedDB;
    this.hashCanonical = options.hashCanonical;
    this.testHooks = options.testHooks ?? {};
  }

  commit(request: StorageCommitRequest): Promise<StorageCommitResult> {
    const operation = this.writer.then(() => this.commitSerialized(request));
    this.writer = operation.then(() => undefined, () => undefined);
    return operation;
  }

  async loadRun(workspace: WorkspaceKind, runId: string): Promise<StoredRunRecord | undefined> {
    await this.writer;
    const state = await this.readCurrentState(workspace, runId);
    return state.run ? canonicalClone(state.run) : undefined;
  }

  async loadEvents(workspace: WorkspaceKind, runId: string): Promise<readonly StoredEventRecord[]> {
    await this.writer;
    return canonicalClone((await this.readCurrentState(workspace, runId)).events);
  }

  async loadArtifacts(workspace: WorkspaceKind, runId: string): Promise<readonly StoredArtifactRecord[]> {
    await this.writer;
    return canonicalClone((await this.readCurrentState(workspace, runId)).artifacts);
  }

  async exportSnapshot(): Promise<StorageSnapshot> {
    await this.writer;
    const database = await this.open();
    const transaction = database.transaction([RUNS_STORE, EVENTS_STORE, ARTIFACTS_STORE], "readonly");
    const completion = transactionCompletion(transaction);
    const runsRequest = transaction.objectStore(RUNS_STORE).getAll();
    const eventsRequest = transaction.objectStore(EVENTS_STORE).getAll();
    const artifactsRequest = transaction.objectStore(ARTIFACTS_STORE).getAll();
    const [runs, events, artifacts] = await Promise.all([
      requestResult(runsRequest) as Promise<StoredRunRecord[]>,
      requestResult(eventsRequest) as Promise<StoredEventRecord[]>,
      requestResult(artifactsRequest) as Promise<StoredArtifactRecord[]>,
    ]);
    await completion;

    const sortedRuns = [...runs].sort((left, right) => (
      `${left.workspace}\u0000${left.runId}`.localeCompare(`${right.workspace}\u0000${right.runId}`)
    ));
    const sortedEvents = [...events].sort((left, right) => {
      const keyOrder = `${left.workspace}\u0000${left.runId}`
        .localeCompare(`${right.workspace}\u0000${right.runId}`);
      return keyOrder || left.sequence - right.sequence;
    });
    const sortedArtifacts = [...artifacts].sort((left, right) => {
      const keyOrder = `${left.workspace}\u0000${left.runId}`
        .localeCompare(`${right.workspace}\u0000${right.runId}`);
      return keyOrder || left.artifactId.localeCompare(right.artifactId) || left.version - right.version;
    });
    const contentHash = await this.hashCanonical(canonicalJson({
      namespace: STATE_STORAGE_NAMESPACE,
      runs: sortedRuns,
      events: sortedEvents,
      artifacts: sortedArtifacts,
    }));
    return canonicalClone({
      namespace: STATE_STORAGE_NAMESPACE,
      runs: sortedRuns,
      events: sortedEvents,
      artifacts: sortedArtifacts,
      contentHash,
    });
  }

  close(): void {
    void this.databasePromise?.then((database) => database.close(), () => undefined);
    this.databasePromise = undefined;
  }

  private async commitSerialized(request: StorageCommitRequest): Promise<StorageCommitResult> {
    let prepared: PreparedCommit | StorageCommitResult;
    try {
      prepared = await this.prepareCommit(request);
    } catch (error) {
      return reject("transaction_aborted", error instanceof Error ? error.message : String(error));
    }
    if ("ok" in prepared) return prepared;

    const database = await this.open();
    const transaction = database.transaction(
      [RUNS_STORE, EVENTS_STORE, ARTIFACTS_STORE, RECEIPTS_STORE],
      "readwrite",
    );
    const completion = transactionCompletion(transaction);
    const runs = transaction.objectStore(RUNS_STORE);
    const events = transaction.objectStore(EVENTS_STORE);
    const artifacts = transaction.objectStore(ARTIFACTS_STORE);
    const receipts = transaction.objectStore(RECEIPTS_STORE);

    try {
      const priorReceipt = await requestResult(
        receipts.get(receiptKey(request.workspace, request.idempotencyKey)),
      ) as ReceiptRow | undefined;
      if (priorReceipt) {
        if (priorReceipt.fingerprint !== prepared.fingerprint) {
          transaction.abort();
          await completion.catch(() => undefined);
          return reject("idempotency_conflict", "Idempotency key is already bound to different data.");
        }
        await completion;
        return { ok: true, receipt: { ...priorReceipt.receipt, idempotent: true } };
      }

      const currentRun = await requestResult(
        runs.get(runKey(request.workspace, request.runId)),
      ) as StoredRunRecord | undefined;
      const currentRevision = currentRun?.revision ?? 0;
      if (
        currentRevision !== prepared.baseRevision
        || (prepared.baseContentHash !== undefined && currentRun?.contentHash !== prepared.baseContentHash)
      ) {
        transaction.abort();
        await completion.catch(() => undefined);
        return reject("stale_revision", "Persisted run changed before the atomic write transaction.", {
          expectedRevision: prepared.baseRevision,
          currentRevision,
        });
      }

      for (const event of prepared.appendedEvents) events.add(canonicalClone(event));
      for (const artifact of prepared.appendedArtifacts) artifacts.add(canonicalClone(artifact));
      runs.put(canonicalClone(prepared.nextRun));
      receipts.add(canonicalClone({
        workspace: request.workspace,
        idempotencyKey: request.idempotencyKey,
        fingerprint: prepared.fingerprint,
        receipt: prepared.receipt,
      } satisfies ReceiptRow));

      this.testHooks.afterWriteRequestsQueued?.(transaction);
      await completion;
      return { ok: true, receipt: prepared.receipt };
    } catch (error) {
      try {
        transaction.abort();
      } catch {
        // The transaction may already be inactive or aborted by a request failure.
      }
      await completion.catch(() => undefined);
      return reject("transaction_aborted", error instanceof Error ? error.message : String(error));
    }
  }

  private async prepareCommit(request: StorageCommitRequest): Promise<PreparedCommit | StorageCommitResult> {
    if (request.namespace !== STATE_STORAGE_NAMESPACE) {
      return reject("invalid_namespace", "Target namespace is not the accepted Phase 2 namespace.");
    }
    if (
      !request.transactionId.trim()
      || !request.idempotencyKey.trim()
      || !request.runId.trim()
      || !Number.isInteger(request.expectedRevision)
      || request.expectedRevision < 0
    ) {
      return reject("invalid_transaction", "Transaction identity or expected revision is invalid.");
    }
    if (request.events.length === 0) {
      return reject("empty_event_batch", "A storage transaction must persist at least one event.");
    }

    const fingerprint = await this.hashCanonical(canonicalJson(request));
    const current = await this.readCurrentState(request.workspace, request.runId, request.idempotencyKey);
    if (current.receipt) {
      return current.receipt.fingerprint === fingerprint
        ? { ok: true, receipt: { ...current.receipt.receipt, idempotent: true } }
        : reject("idempotency_conflict", "Idempotency key is already bound to different data.");
    }

    if (!current.run && request.expectedRevision !== 0) {
      return reject("run_not_found", "Run does not exist at the expected revision.", {
        expectedRevision: request.expectedRevision,
      });
    }
    if (current.run && request.expectedRevision === 0) {
      return reject("run_already_exists", "Run already exists in this workspace.");
    }
    if (current.run && current.run.revision !== request.expectedRevision) {
      return reject("stale_revision", "Persisted revision does not match expected revision.", {
        expectedRevision: request.expectedRevision,
        currentRevision: current.run.revision,
      });
    }

    for (const [index, event] of request.events.entries()) {
      const expectedSequence = request.expectedRevision + index + 1;
      if (event.sequence !== expectedSequence) {
        return reject("non_contiguous_event_sequence", "Event sequence is not contiguous.", {
          actual: event.sequence,
          expected: expectedSequence,
        });
      }
    }
    const expectedAggregateRevision = request.expectedRevision + request.events.length;
    if (request.aggregate.revision !== expectedAggregateRevision) {
      return reject("aggregate_revision_mismatch", "Aggregate revision does not match event batch.", {
        actual: request.aggregate.revision,
        expected: expectedAggregateRevision,
      });
    }
    if (
      request.aggregate.identity.runId !== request.runId
      || request.aggregate.identity.workspace !== request.workspace
    ) {
      return reject("identity_mismatch", "Aggregate identity does not match storage key.");
    }
    if (current.run && !sameCanonical(current.run.aggregate.identity, request.aggregate.identity)) {
      return reject("identity_mismatch", "Immutable run identity changed between revisions.");
    }

    let replayed: RunAggregate | undefined = current.run?.aggregate;
    try {
      for (const event of request.events) replayed = applyRunEvent(replayed, event);
    } catch (error) {
      return reject("aggregate_replay_mismatch", error instanceof Error ? error.message : String(error));
    }
    if (!replayed || !sameCanonical(replayed, request.aggregate)) {
      return reject("aggregate_replay_mismatch", "Supplied aggregate is not deterministic replay result.");
    }

    const existingArtifactIds = new Set(current.artifacts.map((artifact) => artifact.artifactId));
    const appendedArtifacts: StoredArtifactRecord[] = [];
    for (const artifact of request.artifacts ?? []) {
      if (
        artifact.namespace !== STATE_STORAGE_NAMESPACE
        || artifact.workspace !== request.workspace
        || artifact.runId !== request.runId
        || !artifact.artifactId.trim()
        || !artifact.kind.trim()
        || !artifact.contentHash.trim()
        || !artifact.createdAt.trim()
        || !Number.isInteger(artifact.version)
        || artifact.version < 1
        || existingArtifactIds.has(artifact.artifactId)
      ) {
        return reject("artifact_mismatch", "Artifact does not belong to this atomic transaction.", {
          artifactId: artifact.artifactId,
        });
      }
      existingArtifactIds.add(artifact.artifactId);
      appendedArtifacts.push(canonicalClone(artifact));
    }

    const appendedEvents: StoredEventRecord[] = request.events.map((event) => ({
      namespace: STATE_STORAGE_NAMESPACE,
      workspace: request.workspace,
      runId: request.runId,
      sequence: event.sequence,
      event: canonicalClone(event),
    }));
    const nextEvents = sortEvents([...current.events, ...appendedEvents]);
    const nextArtifacts = sortArtifacts([...current.artifacts, ...appendedArtifacts]);
    const contentHash = await this.hashCanonical(canonicalJson({
      namespace: STATE_STORAGE_NAMESPACE,
      aggregate: replayed,
      events: nextEvents,
      artifacts: nextArtifacts,
    }));
    const nextRun: StoredRunRecord = canonicalClone({
      namespace: STATE_STORAGE_NAMESPACE,
      workspace: request.workspace,
      runId: request.runId,
      revision: replayed.revision,
      aggregate: replayed,
      contentHash,
    });
    const receipt: StorageCommitReceipt = {
      transactionId: request.transactionId,
      idempotencyKey: request.idempotencyKey,
      workspace: request.workspace,
      runId: request.runId,
      revision: replayed.revision,
      firstSequence: request.events[0].sequence,
      lastSequence: request.events.at(-1)?.sequence ?? request.events[0].sequence,
      contentHash,
      idempotent: false,
    };
    return {
      fingerprint,
      baseRevision: current.run?.revision ?? 0,
      baseContentHash: current.run?.contentHash,
      nextRun,
      nextEvents,
      appendedEvents,
      nextArtifacts,
      appendedArtifacts,
      receipt,
    };
  }

  private async readCurrentState(
    workspace: WorkspaceKind,
    runId: string,
    idempotencyKey?: string,
  ): Promise<CurrentRunState> {
    const database = await this.open();
    const storeNames = idempotencyKey
      ? [RUNS_STORE, EVENTS_STORE, ARTIFACTS_STORE, RECEIPTS_STORE]
      : [RUNS_STORE, EVENTS_STORE, ARTIFACTS_STORE];
    const transaction = database.transaction(storeNames, "readonly");
    const completion = transactionCompletion(transaction);
    const runRequest = transaction.objectStore(RUNS_STORE).get(runKey(workspace, runId));
    const eventRequest = transaction.objectStore(EVENTS_STORE).index(BY_RUN_INDEX).getAll(runKey(workspace, runId));
    const artifactRequest = transaction.objectStore(ARTIFACTS_STORE).index(BY_RUN_INDEX).getAll(runKey(workspace, runId));
    const receiptRequest = idempotencyKey
      ? transaction.objectStore(RECEIPTS_STORE).get(receiptKey(workspace, idempotencyKey))
      : undefined;
    const [run, events, artifacts, receipt] = await Promise.all([
      requestResult(runRequest) as Promise<StoredRunRecord | undefined>,
      requestResult(eventRequest) as Promise<StoredEventRecord[]>,
      requestResult(artifactRequest) as Promise<StoredArtifactRecord[]>,
      receiptRequest
        ? requestResult(receiptRequest) as Promise<ReceiptRow | undefined>
        : Promise.resolve(undefined),
    ]);
    await completion;
    return canonicalClone({
      run,
      events: sortEvents(events),
      artifacts: sortArtifacts(artifacts),
      receipt,
    });
  }

  private async open(): Promise<IDBDatabase> {
    if (this.databasePromise) return this.databasePromise;
    this.databasePromise = new Promise<IDBDatabase>((resolve, rejectOpen) => {
      let upgradeError: unknown;
      const request = this.indexedDbFactory.open(this.databaseName, this.databaseVersion);
      request.onupgradeneeded = (event) => {
        const database = request.result;
        const transaction = request.transaction;
        if (!transaction) {
          upgradeError = new Error("indexeddb_upgrade_transaction_missing");
          return;
        }
        try {
          if (!database.objectStoreNames.contains(META_STORE)) {
            database.createObjectStore(META_STORE, { keyPath: "key" });
          }
          if (!database.objectStoreNames.contains(RUNS_STORE)) {
            database.createObjectStore(RUNS_STORE, { keyPath: ["workspace", "runId"] });
          }
          if (!database.objectStoreNames.contains(EVENTS_STORE)) {
            const events = database.createObjectStore(EVENTS_STORE, {
              keyPath: ["workspace", "runId", "sequence"],
            });
            events.createIndex(BY_RUN_INDEX, ["workspace", "runId"], { unique: false });
          }
          if (!database.objectStoreNames.contains(ARTIFACTS_STORE)) {
            const artifacts = database.createObjectStore(ARTIFACTS_STORE, {
              keyPath: ["workspace", "runId", "artifactId"],
            });
            artifacts.createIndex(BY_RUN_INDEX, ["workspace", "runId"], { unique: false });
          }
          if (!database.objectStoreNames.contains(RECEIPTS_STORE)) {
            database.createObjectStore(RECEIPTS_STORE, {
              keyPath: ["workspace", "idempotencyKey"],
            });
          }
          transaction.objectStore(META_STORE).put({
            key: "schema",
            namespace: STATE_STORAGE_NAMESPACE,
            databaseVersion: this.databaseVersion,
          } satisfies MetaRow);
          this.testHooks.beforeUpgradeComplete?.({
            database,
            transaction,
            oldVersion: event.oldVersion,
            newVersion: event.newVersion,
          });
        } catch (error) {
          upgradeError = error;
          try {
            transaction.abort();
          } catch {
            // Preserve the original upgrade failure.
          }
        }
      };
      request.onsuccess = () => {
        const database = request.result;
        database.onversionchange = () => database.close();
        resolve(database);
      };
      request.onerror = () => rejectOpen(
        upgradeError instanceof Error
          ? upgradeError
          : request.error ?? new Error("indexeddb_database_open_failed"),
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
