import type { WorkspaceKind } from "../../domain/run.ts";
import { canonicalClone, canonicalJson } from "../../storage/canonical-json.ts";
import { assertSafeStateDatabaseName } from "../../storage/indexeddb/native-indexeddb-storage.ts";
import { validateCompleteGraphState } from "../complete-state-validation.ts";
import {
  MINDMAP_GRAPH_NAMESPACE,
  type ContentAddressedPayloadRecord,
  type GraphCommitReceipt,
  type GraphCommitRequest,
  type GraphCommitResult,
  type GraphContentHasher,
  type GraphEvent,
  type GraphStorageSnapshot,
  type MindMapGraphState,
  type TransactionalGraphStorage,
} from "../contracts.ts";
import {
  GraphInvariantError,
  applyGraphEvent,
  canonicalGraphState,
  emptyGraphState,
  replayGraphEvents,
} from "../graph-state.ts";
import type { GraphPayloadHasher } from "../in-memory-reference-storage.ts";
import {
  GRAPH_STORE_NAMES,
  UNIFIED_MINDMAP_DATABASE_VERSION,
  ensureUnifiedMindMapStores,
  missingUnifiedStoreNames,
} from "./unified-schema.ts";

interface GraphWorkspaceRow {
  readonly workspace: WorkspaceKind;
  readonly revision: number;
  readonly stateContentHash: string;
}

interface GraphReceiptRow {
  readonly workspace: WorkspaceKind;
  readonly idempotencyKey: string;
  readonly fingerprint: string;
  readonly receipt: GraphCommitReceipt;
}

interface CurrentGraphState {
  readonly state: MindMapGraphState;
  readonly events: readonly GraphEvent[];
  readonly workspaceRow?: GraphWorkspaceRow;
  readonly receipt?: GraphReceiptRow;
}

export interface NativeIndexedDbGraphTestHooks {
  readonly beforeUpgradeComplete?: (context: Readonly<{
    database: IDBDatabase;
    transaction: IDBTransaction;
    oldVersion: number;
    newVersion: number | null;
  }>) => void;
  readonly afterWriteRequestsQueued?: (transaction: IDBTransaction) => void;
}

export interface NativeIndexedDbGraphStorageOptions {
  readonly indexedDB: IDBFactory;
  readonly databaseName: string;
  readonly hashCanonical: GraphContentHasher;
  readonly hashPayload: GraphPayloadHasher;
  readonly testHooks?: NativeIndexedDbGraphTestHooks;
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
      // Abort is the authoritative final transaction state.
    };
  });
}

function reject(
  code: GraphCommitResult extends { ok: false; rejection: infer R }
    ? R extends { code: infer C }
      ? C
      : never
    : never,
  message: string,
  details?: Readonly<Record<string, string | number | boolean | null>>,
): GraphCommitResult {
  return { ok: false, rejection: { code, message, details } };
}

function receiptKey(workspace: WorkspaceKind, idempotencyKey: string): readonly [WorkspaceKind, string] {
  return [workspace, idempotencyKey];
}

export class NativeIndexedDbGraphStorage implements TransactionalGraphStorage {
  readonly databaseName: string;
  readonly databaseVersion = UNIFIED_MINDMAP_DATABASE_VERSION;

  private readonly indexedDbFactory: IDBFactory;
  private readonly hashCanonical: GraphContentHasher;
  private readonly hashPayload: GraphPayloadHasher;
  private readonly testHooks: NativeIndexedDbGraphTestHooks;
  private databasePromise?: Promise<IDBDatabase>;
  private writer: Promise<void> = Promise.resolve();

  constructor(options: NativeIndexedDbGraphStorageOptions) {
    assertSafeStateDatabaseName(options.databaseName);
    this.databaseName = options.databaseName;
    this.indexedDbFactory = options.indexedDB;
    this.hashCanonical = options.hashCanonical;
    this.hashPayload = options.hashPayload;
    this.testHooks = options.testHooks ?? {};
  }

  commit(request: GraphCommitRequest): Promise<GraphCommitResult> {
    const operation = this.writer.then(() => this.commitSerialized(request));
    this.writer = operation.then(() => undefined, () => undefined);
    return operation;
  }

  async load(workspace: WorkspaceKind): Promise<MindMapGraphState> {
    await this.writer;
    return canonicalClone((await this.readCurrentState(workspace)).state);
  }

  async loadEvents(workspace: WorkspaceKind): Promise<readonly GraphEvent[]> {
    await this.writer;
    return canonicalClone((await this.readCurrentState(workspace)).events);
  }

  async exportSnapshot(workspace: WorkspaceKind): Promise<GraphStorageSnapshot> {
    await this.writer;
    const state = canonicalGraphState((await this.readCurrentState(workspace)).state);
    const contentHash = await this.hashCanonical(canonicalJson(state));
    return canonicalClone({ ...state, contentHash });
  }

  close(): void {
    void this.databasePromise?.then((database) => database.close(), () => undefined);
    this.databasePromise = undefined;
  }

  private async commitSerialized(request: GraphCommitRequest): Promise<GraphCommitResult> {
    if (request.namespace !== MINDMAP_GRAPH_NAMESPACE) {
      return reject("invalid_namespace", "Graph transaction uses an unknown namespace.");
    }
    if (
      !request.transactionId.trim()
      || !request.idempotencyKey.trim()
      || !Number.isInteger(request.expectedRevision)
      || request.expectedRevision < 0
    ) {
      return reject("invalid_transaction", "Graph transaction identity or revision is invalid.");
    }
    if (request.events.length === 0) {
      return reject("empty_event_batch", "Graph transaction must contain at least one event.");
    }

    const fingerprint = await this.hashCanonical(canonicalJson(request));
    let current: CurrentGraphState;
    try {
      current = await this.readCurrentState(request.workspace, request.idempotencyKey);
    } catch (error) {
      return reject("integrity_mismatch", error instanceof Error ? error.message : String(error));
    }
    if (current.receipt) {
      return current.receipt.fingerprint === fingerprint
        ? { ok: true, receipt: { ...current.receipt.receipt, idempotent: true } }
        : reject("idempotency_conflict", "Idempotency key is bound to different graph data.");
    }
    if (current.state.revision !== request.expectedRevision) {
      return reject("stale_revision", "Graph revision changed before the transaction.", {
        expectedRevision: request.expectedRevision,
        currentRevision: current.state.revision,
      });
    }

    const existingEventIds = new Set(current.events.map((event) => event.eventId));
    const batchEventIds = new Set<string>();
    for (const [index, event] of request.events.entries()) {
      const expectedSequence = request.expectedRevision + index + 1;
      if (event.sequence !== expectedSequence) {
        return reject("non_contiguous_event_sequence", "Graph event batch is not contiguous.", {
          actualSequence: event.sequence,
          expectedSequence,
        });
      }
      if (
        event.namespace !== MINDMAP_GRAPH_NAMESPACE
        || event.workspace !== request.workspace
        || !event.eventId.trim()
        || existingEventIds.has(event.eventId)
        || batchEventIds.has(event.eventId)
      ) {
        return reject("duplicate_identity", "Graph event identity is invalid or already used.", {
          eventId: event.eventId,
        });
      }
      batchEventIds.add(event.eventId);
      if (event.payload.type === "payload_put") {
        const actualHash = await this.hashPayload(event.payload.record);
        if (actualHash !== event.payload.record.contentHash) {
          return reject("payload_hash_mismatch", "Payload content does not match its content hash.", {
            contentHash: event.payload.record.contentHash,
          });
        }
      }
    }

    let nextState = canonicalClone(current.state);
    try {
      for (const event of request.events) nextState = applyGraphEvent(nextState, event);
      validateCompleteGraphState(nextState);
    } catch (error) {
      if (error instanceof GraphInvariantError) return reject(error.code, error.message, error.details);
      return reject("transaction_aborted", error instanceof Error ? error.message : String(error));
    }
    const canonicalState = canonicalGraphState(nextState);
    const stateContentHash = await this.hashCanonical(canonicalJson(canonicalState));
    const receipt: GraphCommitReceipt = Object.freeze({
      transactionId: request.transactionId,
      idempotencyKey: request.idempotencyKey,
      workspace: request.workspace,
      revision: canonicalState.revision,
      firstSequence: request.events[0].sequence,
      lastSequence: request.events.at(-1)?.sequence ?? request.events[0].sequence,
      stateContentHash,
      idempotent: false,
    });

    const database = await this.open();
    const storeNames = [
      GRAPH_STORE_NAMES.workspaces,
      GRAPH_STORE_NAMES.events,
      GRAPH_STORE_NAMES.payloads,
      GRAPH_STORE_NAMES.thoughts,
      GRAPH_STORE_NAMES.nodes,
      GRAPH_STORE_NAMES.placements,
      GRAPH_STORE_NAMES.links,
      GRAPH_STORE_NAMES.embeddings,
      GRAPH_STORE_NAMES.damagedReferences,
      GRAPH_STORE_NAMES.receipts,
    ];
    const transaction = database.transaction(storeNames, "readwrite");
    const completion = transactionCompletion(transaction);

    try {
      const receiptStore = transaction.objectStore(GRAPH_STORE_NAMES.receipts);
      const persistedReceipt = await requestResult(
        receiptStore.get(receiptKey(request.workspace, request.idempotencyKey)),
      ) as GraphReceiptRow | undefined;
      if (persistedReceipt) {
        transaction.abort();
        await completion.catch(() => undefined);
        return persistedReceipt.fingerprint === fingerprint
          ? { ok: true, receipt: { ...persistedReceipt.receipt, idempotent: true } }
          : reject("idempotency_conflict", "Idempotency key was committed concurrently with different data.");
      }

      const workspaceStore = transaction.objectStore(GRAPH_STORE_NAMES.workspaces);
      const persistedWorkspace = await requestResult(
        workspaceStore.get(request.workspace),
      ) as GraphWorkspaceRow | undefined;
      const persistedRevision = persistedWorkspace?.revision ?? 0;
      if (
        persistedRevision !== request.expectedRevision
        || (current.workspaceRow && persistedWorkspace?.stateContentHash !== current.workspaceRow.stateContentHash)
      ) {
        transaction.abort();
        await completion.catch(() => undefined);
        return reject("stale_revision", "Persisted graph changed before the atomic write.", {
          expectedRevision: request.expectedRevision,
          currentRevision: persistedRevision,
        });
      }

      for (const event of request.events) {
        transaction.objectStore(GRAPH_STORE_NAMES.events).add(canonicalClone(event));
      }
      for (const record of canonicalState.payloads) {
        transaction.objectStore(GRAPH_STORE_NAMES.payloads).put(canonicalClone(record));
      }
      for (const record of canonicalState.thoughts) {
        transaction.objectStore(GRAPH_STORE_NAMES.thoughts).put(canonicalClone(record));
      }
      for (const record of canonicalState.nodes) {
        transaction.objectStore(GRAPH_STORE_NAMES.nodes).put(canonicalClone(record));
      }
      for (const record of canonicalState.placements) {
        transaction.objectStore(GRAPH_STORE_NAMES.placements).put(canonicalClone(record));
      }
      for (const record of canonicalState.links) {
        transaction.objectStore(GRAPH_STORE_NAMES.links).put(canonicalClone(record));
      }
      for (const record of canonicalState.embeddings) {
        transaction.objectStore(GRAPH_STORE_NAMES.embeddings).put(canonicalClone(record));
      }
      for (const record of canonicalState.damagedReferences) {
        transaction.objectStore(GRAPH_STORE_NAMES.damagedReferences).put(canonicalClone(record));
      }
      workspaceStore.put({
        workspace: request.workspace,
        revision: canonicalState.revision,
        stateContentHash,
      } satisfies GraphWorkspaceRow);
      receiptStore.add({
        workspace: request.workspace,
        idempotencyKey: request.idempotencyKey,
        fingerprint,
        receipt,
      } satisfies GraphReceiptRow);

      this.testHooks.afterWriteRequestsQueued?.(transaction);
      await completion;
      return { ok: true, receipt };
    } catch (error) {
      try {
        transaction.abort();
      } catch {
        // Transaction may already be inactive or aborted.
      }
      await completion.catch(() => undefined);
      return reject("transaction_aborted", error instanceof Error ? error.message : String(error));
    }
  }

  private async readCurrentState(
    workspace: WorkspaceKind,
    idempotencyKey?: string,
  ): Promise<CurrentGraphState> {
    const database = await this.open();
    const storeNames = [
      GRAPH_STORE_NAMES.workspaces,
      GRAPH_STORE_NAMES.events,
      GRAPH_STORE_NAMES.payloads,
      GRAPH_STORE_NAMES.thoughts,
      GRAPH_STORE_NAMES.nodes,
      GRAPH_STORE_NAMES.placements,
      GRAPH_STORE_NAMES.links,
      GRAPH_STORE_NAMES.embeddings,
      GRAPH_STORE_NAMES.damagedReferences,
      ...(idempotencyKey ? [GRAPH_STORE_NAMES.receipts] : []),
    ];
    const transaction = database.transaction(storeNames, "readonly");
    const completion = transactionCompletion(transaction);
    const byWorkspace = (storeName: string) => (
      transaction.objectStore(storeName).index(GRAPH_STORE_NAMES.byWorkspace).getAll(workspace)
    );
    const receiptRequest = idempotencyKey
      ? transaction.objectStore(GRAPH_STORE_NAMES.receipts).get(receiptKey(workspace, idempotencyKey))
      : undefined;
    const [workspaceRow, events, payloads, thoughts, nodes, placements, links, embeddings, damagedReferences, receipt] = await Promise.all([
      requestResult(transaction.objectStore(GRAPH_STORE_NAMES.workspaces).get(workspace)) as Promise<GraphWorkspaceRow | undefined>,
      requestResult(byWorkspace(GRAPH_STORE_NAMES.events)) as Promise<GraphEvent[]>,
      requestResult(byWorkspace(GRAPH_STORE_NAMES.payloads)) as Promise<MindMapGraphState["payloads"]>,
      requestResult(byWorkspace(GRAPH_STORE_NAMES.thoughts)) as Promise<MindMapGraphState["thoughts"]>,
      requestResult(byWorkspace(GRAPH_STORE_NAMES.nodes)) as Promise<MindMapGraphState["nodes"]>,
      requestResult(byWorkspace(GRAPH_STORE_NAMES.placements)) as Promise<MindMapGraphState["placements"]>,
      requestResult(byWorkspace(GRAPH_STORE_NAMES.links)) as Promise<MindMapGraphState["links"]>,
      requestResult(byWorkspace(GRAPH_STORE_NAMES.embeddings)) as Promise<MindMapGraphState["embeddings"]>,
      requestResult(byWorkspace(GRAPH_STORE_NAMES.damagedReferences)) as Promise<MindMapGraphState["damagedReferences"]>,
      receiptRequest ? requestResult(receiptRequest) as Promise<GraphReceiptRow | undefined> : Promise.resolve(undefined),
    ]);
    await completion;
    const state = canonicalGraphState({
      ...emptyGraphState(workspace),
      revision: workspaceRow?.revision ?? 0,
      payloads,
      thoughts,
      nodes,
      placements,
      links,
      embeddings,
      damagedReferences,
    });
    const sortedEvents = [...events].sort((left, right) => left.sequence - right.sequence);
    const hasPersistedRecords = sortedEvents.length > 0
      || state.payloads.length > 0
      || state.thoughts.length > 0
      || state.nodes.length > 0
      || state.placements.length > 0
      || state.links.length > 0
      || state.embeddings.length > 0
      || state.damagedReferences.length > 0;
    if (!workspaceRow && hasPersistedRecords) {
      throw new Error(`graph_workspace_metadata_missing:${workspace}`);
    }
    if (workspaceRow) {
      let replayed: MindMapGraphState;
      try {
        replayed = canonicalGraphState(replayGraphEvents(workspace, sortedEvents));
      } catch (error) {
        throw new Error(`graph_event_replay_failed:${workspace}:${error instanceof Error ? error.message : String(error)}`);
      }
      if (canonicalJson(replayed) !== canonicalJson(state)) {
        throw new Error(`graph_state_replay_mismatch:${workspace}`);
      }
      const actualStateContentHash = await this.hashCanonical(canonicalJson(state));
      if (actualStateContentHash !== workspaceRow.stateContentHash) {
        throw new Error(`graph_state_hash_mismatch:${workspace}:${workspaceRow.stateContentHash}:${actualStateContentHash}`);
      }
    }
    return canonicalClone({ state, events: sortedEvents, workspaceRow, receipt });
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
          ensureUnifiedMindMapStores(database, transaction);
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
        const missing = missingUnifiedStoreNames(database);
        if (missing.length > 0) {
          database.close();
          rejectOpen(new Error(`unified_graph_schema_missing:${missing.join(",")}`));
          return;
        }
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
