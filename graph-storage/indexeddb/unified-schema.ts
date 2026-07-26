import { STATE_STORAGE_NAMESPACE } from "../../storage/contracts.ts";
import { NATIVE_STATE_DATABASE_VERSION } from "../../storage/indexeddb/native-indexeddb-storage.ts";

export const UNIFIED_MINDMAP_DATABASE_VERSION = NATIVE_STATE_DATABASE_VERSION;

export const RUN_STORE_NAMES = Object.freeze({
  meta: "meta",
  runs: "runs",
  events: "events",
  artifacts: "artifacts",
  receipts: "receipts",
  byRun: "byRun",
});

export const GRAPH_STORE_NAMES = Object.freeze({
  meta: "graphMeta",
  workspaces: "graphWorkspaces",
  events: "graphEvents",
  payloads: "graphPayloads",
  thoughts: "graphThoughts",
  nodes: "graphNodes",
  placements: "graphPlacements",
  links: "graphLinks",
  embeddings: "graphEmbeddings",
  damagedReferences: "graphDamagedReferences",
  receipts: "graphReceipts",
  byWorkspace: "byWorkspace",
});

export const REQUIRED_UNIFIED_STORE_NAMES = Object.freeze([
  RUN_STORE_NAMES.meta,
  RUN_STORE_NAMES.runs,
  RUN_STORE_NAMES.events,
  RUN_STORE_NAMES.artifacts,
  RUN_STORE_NAMES.receipts,
  GRAPH_STORE_NAMES.meta,
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
] as const);

function createWorkspaceIndexedStore(
  database: IDBDatabase,
  name: string,
  keyPath: readonly string[],
): IDBObjectStore {
  const store = database.createObjectStore(name, { keyPath: [...keyPath] });
  store.createIndex(GRAPH_STORE_NAMES.byWorkspace, "workspace", { unique: false });
  return store;
}

export function ensureUnifiedMindMapStores(database: IDBDatabase, transaction: IDBTransaction): void {
  if (!database.objectStoreNames.contains(RUN_STORE_NAMES.meta)) {
    database.createObjectStore(RUN_STORE_NAMES.meta, { keyPath: "key" });
  }
  if (!database.objectStoreNames.contains(RUN_STORE_NAMES.runs)) {
    database.createObjectStore(RUN_STORE_NAMES.runs, { keyPath: ["workspace", "runId"] });
  }
  if (!database.objectStoreNames.contains(RUN_STORE_NAMES.events)) {
    const events = database.createObjectStore(RUN_STORE_NAMES.events, {
      keyPath: ["workspace", "runId", "sequence"],
    });
    events.createIndex(RUN_STORE_NAMES.byRun, ["workspace", "runId"], { unique: false });
  }
  if (!database.objectStoreNames.contains(RUN_STORE_NAMES.artifacts)) {
    const artifacts = database.createObjectStore(RUN_STORE_NAMES.artifacts, {
      keyPath: ["workspace", "runId", "artifactId"],
    });
    artifacts.createIndex(RUN_STORE_NAMES.byRun, ["workspace", "runId"], { unique: false });
  }
  if (!database.objectStoreNames.contains(RUN_STORE_NAMES.receipts)) {
    database.createObjectStore(RUN_STORE_NAMES.receipts, {
      keyPath: ["workspace", "idempotencyKey"],
    });
  }

  transaction.objectStore(RUN_STORE_NAMES.meta).put({
    key: "schema",
    namespace: STATE_STORAGE_NAMESPACE,
    databaseVersion: UNIFIED_MINDMAP_DATABASE_VERSION,
  });

  if (!database.objectStoreNames.contains(GRAPH_STORE_NAMES.meta)) {
    database.createObjectStore(GRAPH_STORE_NAMES.meta, { keyPath: "key" });
  }
  if (!database.objectStoreNames.contains(GRAPH_STORE_NAMES.workspaces)) {
    database.createObjectStore(GRAPH_STORE_NAMES.workspaces, { keyPath: "workspace" });
  }
  if (!database.objectStoreNames.contains(GRAPH_STORE_NAMES.events)) {
    createWorkspaceIndexedStore(database, GRAPH_STORE_NAMES.events, ["workspace", "sequence"]);
  }
  if (!database.objectStoreNames.contains(GRAPH_STORE_NAMES.payloads)) {
    createWorkspaceIndexedStore(database, GRAPH_STORE_NAMES.payloads, ["workspace", "contentHash"]);
  }
  if (!database.objectStoreNames.contains(GRAPH_STORE_NAMES.thoughts)) {
    createWorkspaceIndexedStore(database, GRAPH_STORE_NAMES.thoughts, ["workspace", "thoughtId"]);
  }
  if (!database.objectStoreNames.contains(GRAPH_STORE_NAMES.nodes)) {
    createWorkspaceIndexedStore(database, GRAPH_STORE_NAMES.nodes, ["workspace", "nodeId"]);
  }
  if (!database.objectStoreNames.contains(GRAPH_STORE_NAMES.placements)) {
    createWorkspaceIndexedStore(database, GRAPH_STORE_NAMES.placements, ["workspace", "thoughtId"]);
  }
  if (!database.objectStoreNames.contains(GRAPH_STORE_NAMES.links)) {
    createWorkspaceIndexedStore(database, GRAPH_STORE_NAMES.links, ["workspace", "linkId"]);
  }
  if (!database.objectStoreNames.contains(GRAPH_STORE_NAMES.embeddings)) {
    createWorkspaceIndexedStore(database, GRAPH_STORE_NAMES.embeddings, ["workspace", "embeddingId"]);
  }
  if (!database.objectStoreNames.contains(GRAPH_STORE_NAMES.damagedReferences)) {
    createWorkspaceIndexedStore(
      database,
      GRAPH_STORE_NAMES.damagedReferences,
      ["workspace", "damagedReferenceId"],
    );
  }
  if (!database.objectStoreNames.contains(GRAPH_STORE_NAMES.receipts)) {
    database.createObjectStore(GRAPH_STORE_NAMES.receipts, {
      keyPath: ["workspace", "idempotencyKey"],
    });
  }

  transaction.objectStore(GRAPH_STORE_NAMES.meta).put({
    key: "schema",
    schema: "unified-mindmap-v1",
    databaseVersion: UNIFIED_MINDMAP_DATABASE_VERSION,
  });
}

export function missingUnifiedStoreNames(database: IDBDatabase): readonly string[] {
  return REQUIRED_UNIFIED_STORE_NAMES.filter((name) => !database.objectStoreNames.contains(name));
}
