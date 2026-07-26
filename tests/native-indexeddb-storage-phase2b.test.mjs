import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { IDBFactory } from "fake-indexeddb";

import { canonicalJson } from "../storage/canonical-json.ts";
import { STATE_STORAGE_NAMESPACE } from "../storage/contracts.ts";
import {
  LEGACY_STATE_DATABASE_NAME,
  NativeIndexedDbStorage,
} from "../storage/indexeddb/native-indexeddb-storage.ts";
import {
  authorizeAttempt,
  createRun,
  requestAttempt,
} from "../state-core/run-state-core.ts";

const hashCanonical = (value) => createHash("sha256").update(value).digest("hex");
let databaseCounter = 0;
const nextDatabaseName = () => `${STATE_STORAGE_NAMESPACE}-phase2b-${++databaseCounter}`;

const identity = (overrides = {}) => Object.freeze({
  runId: "phase2b-run-1",
  workspace: "synthetic",
  datasetId: "approved-96-v1",
  orderVariant: "original",
  semanticModel: "qwen3:8b",
  embeddingModel: "embeddinggemma",
  pipelineVersion: "state-core-v1",
  buildId: "phase2b-test-build",
  storageSchema: STATE_STORAGE_NAMESPACE,
  ...overrides,
});

const runtime = Object.freeze({
  configuredSemanticModel: "qwen3:8b",
  configuredEmbeddingModel: "embeddinggemma",
  buildId: "phase2b-test-build",
  storageSchema: STATE_STORAGE_NAMESPACE,
  supportedPipelineVersions: ["state-core-v1"],
  compatibleSourceBuildIds: [],
});

const meta = (commandId, expectedRevision) => ({
  commandId,
  expectedRevision,
  occurredAt: `2026-07-25T18:${String(expectedRevision).padStart(2, "0")}:00.000Z`,
});

function accepted(result) {
  assert.equal(result.ok, true, result.ok ? "" : JSON.stringify(result.rejection));
  return result;
}

function createCommit(runIdentity = identity(), suffix = "create") {
  const created = accepted(createRun(runIdentity, "preflight", meta(`cmd-${suffix}`, 0)));
  return {
    aggregate: created.aggregate,
    request: {
      namespace: STATE_STORAGE_NAMESPACE,
      transactionId: `tx-${suffix}`,
      idempotencyKey: `tx-${suffix}:idem`,
      workspace: runIdentity.workspace,
      runId: runIdentity.runId,
      expectedRevision: 0,
      events: created.events,
      aggregate: created.aggregate,
    },
  };
}

function authorizedBatch(baseAggregate, suffix = "authorized") {
  const requested = accepted(requestAttempt(baseAggregate, {
    attemptId: `attempt-${suffix}`,
    stage: "preflight",
    model: "qwen3:8b",
    inputHash: `input-${suffix}`,
    idempotencyKey: `attempt-${suffix}:idem`,
  }, runtime, meta(`request-${suffix}`, baseAggregate.revision)));
  const authorized = accepted(authorizeAttempt(requested.aggregate, {
    attemptId: `attempt-${suffix}`,
    authorizationId: `authorization-${suffix}`,
  }, runtime, meta(`authorize-${suffix}`, requested.aggregate.revision)));
  return {
    events: [...requested.events, ...authorized.events],
    aggregate: authorized.aggregate,
  };
}

function createStore(factory, databaseName, options = {}) {
  return new NativeIndexedDbStorage({
    indexedDB: factory,
    databaseName,
    hashCanonical,
    ...options,
  });
}

async function deleteDatabase(factory, databaseName) {
  await new Promise((resolve, reject) => {
    const request = factory.deleteDatabase(databaseName);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error("delete_database_failed"));
    request.onblocked = () => reject(new Error("delete_database_blocked"));
  });
}

test("adapter refuses legacy and arbitrary database names before indexedDB.open", () => {
  const factory = new IDBFactory();
  assert.throws(() => createStore(factory, LEGACY_STATE_DATABASE_NAME), /legacy_state_database_forbidden|invalid_state_database_name/);
  assert.throws(() => createStore(factory, "random-database"), /invalid_state_database_name/);
});

test("atomic commit persists run, events, artifacts and receipt across reopen", async (t) => {
  const factory = new IDBFactory();
  const databaseName = nextDatabaseName();
  t.after(() => deleteDatabase(factory, databaseName));
  const store = createStore(factory, databaseName);
  const created = createCommit();
  const createdResult = await store.commit(created.request);
  assert.equal(createdResult.ok, true);

  const batch = authorizedBatch(created.aggregate);
  const artifact = {
    namespace: STATE_STORAGE_NAMESPACE,
    workspace: "synthetic",
    runId: identity().runId,
    artifactId: "artifact-preflight-1",
    stage: "preflight",
    version: 1,
    kind: "preflight-proof",
    contentHash: hashCanonical("preflight-proof"),
    createdAt: "2026-07-25T18:03:00.000Z",
  };
  const request = {
    namespace: STATE_STORAGE_NAMESPACE,
    transactionId: "tx-authorized",
    idempotencyKey: "tx-authorized:idem",
    workspace: "synthetic",
    runId: identity().runId,
    expectedRevision: 1,
    events: batch.events,
    aggregate: batch.aggregate,
    artifacts: [artifact],
  };
  const result = await store.commit(request);
  assert.equal(result.ok, true);
  assert.equal(result.receipt.revision, 3);
  store.close();

  const reopened = createStore(factory, databaseName);
  const run = await reopened.loadRun("synthetic", identity().runId);
  const events = await reopened.loadEvents("synthetic", identity().runId);
  const artifacts = await reopened.loadArtifacts("synthetic", identity().runId);
  assert.equal(run?.revision, 3);
  assert.equal(events.length, 3);
  assert.deepEqual(artifacts, [artifact]);
  assert.equal(canonicalJson(run?.aggregate), canonicalJson(batch.aggregate));

  const repeated = await reopened.commit(request);
  assert.equal(repeated.ok, true);
  assert.equal(repeated.receipt.idempotent, true);
  assert.equal(repeated.receipt.contentHash, result.receipt.contentHash);
  reopened.close();
});

test("conflicting idempotency payload is rejected after reopen", async (t) => {
  const factory = new IDBFactory();
  const databaseName = nextDatabaseName();
  t.after(() => deleteDatabase(factory, databaseName));
  const created = createCommit();
  const first = createStore(factory, databaseName);
  assert.equal((await first.commit(created.request)).ok, true);
  first.close();

  const reopened = createStore(factory, databaseName);
  const conflict = await reopened.commit({
    ...created.request,
    transactionId: "tx-conflict",
  });
  assert.equal(conflict.ok, false);
  assert.equal(conflict.rejection.code, "idempotency_conflict");
  assert.equal((await reopened.loadEvents("synthetic", identity().runId)).length, 1);
  reopened.close();
});

test("two adapter instances serialize through IndexedDB and stale writer loses", async (t) => {
  const factory = new IDBFactory();
  const databaseName = nextDatabaseName();
  t.after(() => deleteDatabase(factory, databaseName));
  const firstStore = createStore(factory, databaseName);
  const secondStore = createStore(factory, databaseName);
  const created = createCommit();
  assert.equal((await firstStore.commit(created.request)).ok, true);

  const firstBatch = authorizedBatch(created.aggregate, "first");
  const secondBatch = authorizedBatch(created.aggregate, "second");
  const [first, second] = await Promise.all([
    firstStore.commit({
      namespace: STATE_STORAGE_NAMESPACE,
      transactionId: "tx-first",
      idempotencyKey: "tx-first:idem",
      workspace: "synthetic",
      runId: identity().runId,
      expectedRevision: 1,
      events: firstBatch.events,
      aggregate: firstBatch.aggregate,
    }),
    secondStore.commit({
      namespace: STATE_STORAGE_NAMESPACE,
      transactionId: "tx-second",
      idempotencyKey: "tx-second:idem",
      workspace: "synthetic",
      runId: identity().runId,
      expectedRevision: 1,
      events: secondBatch.events,
      aggregate: secondBatch.aggregate,
    }),
  ]);
  assert.equal(first.ok, true);
  assert.equal(second.ok, false);
  assert.equal(second.rejection.code, "stale_revision");
  assert.equal((await firstStore.loadRun("synthetic", identity().runId))?.revision, 3);
  firstStore.close();
  secondStore.close();
});

test("abort after write requests are queued leaves no partial state or receipt", async (t) => {
  const factory = new IDBFactory();
  const databaseName = nextDatabaseName();
  t.after(() => deleteDatabase(factory, databaseName));
  let abort = true;
  const store = createStore(factory, databaseName, {
    testHooks: {
      afterWriteRequestsQueued(transaction) {
        if (abort) transaction.abort();
      },
    },
  });
  const created = createCommit();
  const failed = await store.commit(created.request);
  assert.equal(failed.ok, false);
  assert.equal(failed.rejection.code, "transaction_aborted");
  assert.equal(await store.loadRun("synthetic", identity().runId), undefined);
  assert.deepEqual(await store.loadEvents("synthetic", identity().runId), []);
  assert.deepEqual(await store.loadArtifacts("synthetic", identity().runId), []);

  abort = false;
  const retried = await store.commit(created.request);
  assert.equal(retried.ok, true);
  assert.equal(retried.receipt.idempotent, false);
  store.close();
});

test("identical run IDs remain mechanically isolated by workspace", async (t) => {
  const factory = new IDBFactory();
  const databaseName = nextDatabaseName();
  t.after(() => deleteDatabase(factory, databaseName));
  const store = createStore(factory, databaseName);
  const synthetic = createCommit(identity({ workspace: "synthetic" }), "synthetic-create");
  const personal = createCommit(identity({ workspace: "personal" }), "personal-create");
  assert.equal((await store.commit(synthetic.request)).ok, true);
  assert.equal((await store.commit(personal.request)).ok, true);
  assert.equal((await store.loadRun("synthetic", identity().runId))?.aggregate.identity.workspace, "synthetic");
  assert.equal((await store.loadRun("personal", identity().runId))?.aggregate.identity.workspace, "personal");
  store.close();
});

test("failed schema upgrade leaves the previous database version readable", async (t) => {
  const factory = new IDBFactory();
  const databaseName = nextDatabaseName();
  t.after(() => deleteDatabase(factory, databaseName));
  const versionOne = createStore(factory, databaseName, { databaseVersion: 1 });
  const created = createCommit();
  assert.equal((await versionOne.commit(created.request)).ok, true);
  versionOne.close();

  const failedUpgrade = createStore(factory, databaseName, {
    databaseVersion: 2,
    testHooks: {
      beforeUpgradeComplete() {
        throw new Error("simulated_upgrade_failure");
      },
    },
  });
  await assert.rejects(failedUpgrade.loadRun("synthetic", identity().runId), /simulated_upgrade_failure/);
  failedUpgrade.close();

  const reopenedVersionOne = createStore(factory, databaseName, { databaseVersion: 1 });
  assert.equal((await reopenedVersionOne.loadRun("synthetic", identity().runId))?.revision, 1);
  reopenedVersionOne.close();
});

test("snapshot hash is stable after close and reopen", async (t) => {
  const factory = new IDBFactory();
  const databaseName = nextDatabaseName();
  t.after(() => deleteDatabase(factory, databaseName));
  const store = createStore(factory, databaseName);
  assert.equal((await store.commit(createCommit().request)).ok, true);
  const first = await store.exportSnapshot();
  store.close();

  const reopened = createStore(factory, databaseName);
  const second = await reopened.exportSnapshot();
  assert.deepEqual(second, first);
  assert.match(second.contentHash, /^[a-f0-9]{64}$/);
  reopened.close();
});

test("adapter source opens only its validated new database name and has no model/network path", async () => {
  const source = await readFile(
    new URL("../storage/indexeddb/native-indexeddb-storage.ts", import.meta.url),
    "utf8",
  );
  assert.match(source, /assertSafeStateDatabaseName\(this\.databaseName\)/);
  assert.match(source, /this\.indexedDbFactory\.open\(this\.databaseName, this\.databaseVersion\)/);
  for (const forbidden of [
    "fetch(",
    "node:http",
    "node:https",
    "ollama",
    "deepseek-r1",
    "qwen3:8b",
    "sql.js",
    "app/page",
  ]) {
    assert.equal(source.toLowerCase().includes(forbidden), false, `forbidden adapter path: ${forbidden}`);
  }
});
