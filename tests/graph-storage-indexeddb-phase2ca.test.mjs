import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { IDBFactory } from "fake-indexeddb";

import { MINDMAP_GRAPH_NAMESPACE } from "../graph-storage/contracts.ts";
import { NativeIndexedDbGraphStorage } from "../graph-storage/indexeddb/native-indexeddb-graph-storage.ts";
import { NativeIndexedDbStorage } from "../storage/indexeddb/native-indexeddb-storage.ts";
import { STATE_STORAGE_NAMESPACE } from "../storage/contracts.ts";
import { createRun } from "../state-core/run-state-core.ts";

const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const hashCanonical = (value) => sha256(value);
const hashPayload = (record) => sha256(
  record.encoding === "base64" || record.encoding === "float32-le-base64"
    ? Buffer.from(record.data, "base64")
    : Buffer.from(record.data, "utf8"),
);
let databaseCounter = 0;
const databaseName = () => `${STATE_STORAGE_NAMESPACE}-phase2ca-${++databaseCounter}`;

function graphStorage(factory, name, options = {}) {
  return new NativeIndexedDbGraphStorage({
    indexedDB: factory,
    databaseName: name,
    hashCanonical,
    hashPayload,
    ...options,
  });
}

function graphRequest(recordWorkspace = "synthetic", suffix = "one") {
  const data = `IndexedDB graph thought ${suffix}`;
  const bytes = Buffer.from(data, "utf8");
  const payload = {
    namespace: MINDMAP_GRAPH_NAMESPACE,
    workspace: recordWorkspace,
    contentHash: sha256(bytes),
    kind: "thought-text",
    mediaType: "text/plain; charset=utf-8",
    encoding: "utf8",
    byteLength: bytes.byteLength,
    data,
  };
  const thought = {
    namespace: MINDMAP_GRAPH_NAMESPACE,
    workspace: recordWorkspace,
    thoughtId: `thought-${suffix}`,
    revision: 1,
    textPayloadHash: payload.contentHash,
    semanticType: "observation",
    status: "inbox",
    createdAt: "2026-07-25T22:00:00.000Z",
    updatedAt: "2026-07-25T22:00:00.000Z",
  };
  const placement = {
    namespace: MINDMAP_GRAPH_NAMESPACE,
    workspace: recordWorkspace,
    thoughtId: thought.thoughtId,
    revision: 1,
    kind: "unresolved",
    reason: "awaiting_review",
    updatedAt: "2026-07-25T22:00:00.000Z",
  };
  const events = [
    {
      namespace: MINDMAP_GRAPH_NAMESPACE,
      workspace: recordWorkspace,
      sequence: 1,
      eventId: `event-${suffix}-payload`,
      occurredAt: "2026-07-25T22:00:01.000Z",
      payload: { type: "payload_put", record: payload },
    },
    {
      namespace: MINDMAP_GRAPH_NAMESPACE,
      workspace: recordWorkspace,
      sequence: 2,
      eventId: `event-${suffix}-thought`,
      occurredAt: "2026-07-25T22:00:02.000Z",
      payload: { type: "thought_put", record: thought },
    },
    {
      namespace: MINDMAP_GRAPH_NAMESPACE,
      workspace: recordWorkspace,
      sequence: 3,
      eventId: `event-${suffix}-placement`,
      occurredAt: "2026-07-25T22:00:03.000Z",
      payload: { type: "placement_put", record: placement },
    },
  ];
  return {
    namespace: MINDMAP_GRAPH_NAMESPACE,
    transactionId: `transaction-${suffix}`,
    idempotencyKey: `transaction-${suffix}:idem`,
    workspace: recordWorkspace,
    expectedRevision: 0,
    events,
  };
}

async function deleteDatabase(factory, name) {
  await new Promise((resolve, reject) => {
    const request = factory.deleteDatabase(name);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error("delete_database_failed"));
    request.onblocked = () => reject(new Error("delete_database_blocked"));
  });
}

test("graph transaction persists atomically and remains idempotent after reopen", async (t) => {
  const factory = new IDBFactory();
  const name = databaseName();
  t.after(() => deleteDatabase(factory, name));
  const request = graphRequest();
  const first = graphStorage(factory, name);
  const committed = await first.commit(request);
  assert.equal(committed.ok, true);
  const beforeClose = await first.exportSnapshot("synthetic");
  first.close();

  const reopened = graphStorage(factory, name);
  assert.deepEqual(await reopened.exportSnapshot("synthetic"), beforeClose);
  const repeated = await reopened.commit(request);
  assert.equal(repeated.ok, true);
  assert.equal(repeated.receipt.idempotent, true);
  assert.equal((await reopened.loadEvents("synthetic")).length, 3);
  reopened.close();
});

test("abort after queued graph writes leaves no workspace, records, events or receipt", async (t) => {
  const factory = new IDBFactory();
  const name = databaseName();
  t.after(() => deleteDatabase(factory, name));
  let abort = true;
  const graph = graphStorage(factory, name, {
    testHooks: {
      afterWriteRequestsQueued(transaction) {
        if (abort) transaction.abort();
      },
    },
  });
  const request = graphRequest("synthetic", "abort");
  const failed = await graph.commit(request);
  assert.equal(failed.ok, false);
  assert.equal(failed.rejection.code, "transaction_aborted");
  assert.equal((await graph.load("synthetic")).revision, 0);
  assert.deepEqual(await graph.loadEvents("synthetic"), []);

  abort = false;
  const retried = await graph.commit(request);
  assert.equal(retried.ok, true);
  assert.equal(retried.receipt.idempotent, false);
  graph.close();
});

test("fresh unified graph database remains compatible with the accepted run adapter", async (t) => {
  const factory = new IDBFactory();
  const name = databaseName();
  t.after(() => deleteDatabase(factory, name));
  const graph = graphStorage(factory, name);
  assert.equal((await graph.commit(graphRequest())).ok, true);
  graph.close();

  const runIdentity = Object.freeze({
    runId: "unified-run",
    workspace: "synthetic",
    datasetId: "approved-96-v1",
    orderVariant: "original",
    semanticModel: "qwen3:8b",
    embeddingModel: "embeddinggemma",
    pipelineVersion: "state-core-v1",
    buildId: "phase2ca-test",
    storageSchema: STATE_STORAGE_NAMESPACE,
  });
  const created = createRun(runIdentity, "preflight", {
    commandId: "unified-run-create",
    expectedRevision: 0,
    occurredAt: "2026-07-25T22:10:00.000Z",
  });
  assert.equal(created.ok, true);
  const runStorage = new NativeIndexedDbStorage({ indexedDB: factory, databaseName: name, hashCanonical });
  const runResult = await runStorage.commit({
    namespace: STATE_STORAGE_NAMESPACE,
    transactionId: "unified-run-transaction",
    idempotencyKey: "unified-run-transaction:idem",
    workspace: "synthetic",
    runId: runIdentity.runId,
    expectedRevision: 0,
    events: created.events,
    aggregate: created.aggregate,
  });
  assert.equal(runResult.ok, true);
  assert.equal((await runStorage.loadRun("synthetic", runIdentity.runId))?.revision, 1);
  runStorage.close();

  const graphReopened = graphStorage(factory, name);
  assert.equal((await graphReopened.load("synthetic")).thoughts.length, 1);
  graphReopened.close();
});

test("graph adapter refuses an existing run-only database without upgrading or modifying it", async (t) => {
  const factory = new IDBFactory();
  const name = databaseName();
  t.after(() => deleteDatabase(factory, name));
  const runOnly = new NativeIndexedDbStorage({ indexedDB: factory, databaseName: name, hashCanonical });
  assert.equal(await runOnly.loadRun("synthetic", "missing"), undefined);
  runOnly.close();

  const graph = graphStorage(factory, name);
  await assert.rejects(graph.load("synthetic"), /unified_graph_schema_missing/);
  graph.close();

  const runReopened = new NativeIndexedDbStorage({ indexedDB: factory, databaseName: name, hashCanonical });
  assert.equal(await runReopened.loadRun("synthetic", "missing"), undefined);
  runReopened.close();
});

test("two graph adapters serialize stale writers and isolate workspaces", async (t) => {
  const factory = new IDBFactory();
  const name = databaseName();
  t.after(() => deleteDatabase(factory, name));
  const first = graphStorage(factory, name);
  const second = graphStorage(factory, name);
  const syntheticRequest = graphRequest("synthetic", "same");
  assert.equal((await first.commit(syntheticRequest)).ok, true);

  const personalRequest = graphRequest("personal", "same");
  assert.equal((await second.commit(personalRequest)).ok, true);
  assert.equal((await first.load("synthetic")).thoughts[0].workspace, "synthetic");
  assert.equal((await second.load("personal")).thoughts[0].workspace, "personal");

  const stale = await second.commit({
    ...graphRequest("synthetic", "stale"),
    expectedRevision: 0,
  });
  assert.equal(stale.ok, false);
  assert.equal(stale.rejection.code, "stale_revision");
  first.close();
  second.close();
});

test("failed fresh schema creation can be retried without leaving a partial database", async (t) => {
  const factory = new IDBFactory();
  const name = databaseName();
  t.after(() => deleteDatabase(factory, name));
  const failing = graphStorage(factory, name, {
    testHooks: {
      beforeUpgradeComplete() {
        throw new Error("simulated_unified_schema_failure");
      },
    },
  });
  await assert.rejects(failing.load("synthetic"), /simulated_unified_schema_failure/);
  failing.close();

  const retried = graphStorage(factory, name);
  assert.equal((await retried.load("synthetic")).revision, 0);
  assert.equal((await retried.commit(graphRequest("synthetic", "retry"))).ok, true);
  retried.close();
});
