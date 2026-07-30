import assert from "node:assert/strict";
import test from "node:test";
import { IDBFactory } from "fake-indexeddb";
import {
  NativeIndexedDbGenerationRegistry,
} from "../generation-storage/index.ts";
import {
  SANITIZED_GENERATION_MANIFEST,
  SANITIZED_GENERATION_SEAL,
  SANITIZED_REGISTRY_SNAPSHOT,
  at,
  commitPromotion,
  createStores,
  deleteDatabase,
  initializeStores,
  mustStorageReject,
  requireRollback,
  sha256,
} from "./generation-storage-phase2cc-c2-fixture.mjs";

function freshIndexedDb() {
  return new IDBFactory();
}

async function closeAndDelete(indexedDB, stores) {
  stores.registry.close();
  stores.generation.close();
  await deleteDatabase(indexedDB, stores.physical.registry);
  await deleteDatabase(indexedDB, stores.physical.generation);
}

async function mutateRegistry(indexedDB, databaseName, mutate) {
  const database = await new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("raw_registry_open_failed"));
  });
  try {
    await new Promise((resolve, reject) => {
      const transaction = database.transaction(["registry", "activePointers"], "readwrite");
      mutate(transaction);
      transaction.oncomplete = () => resolve();
      transaction.onabort = () => reject(transaction.error ?? new Error("raw_registry_mutation_aborted"));
      transaction.onerror = () => {
        // Abort is authoritative.
      };
    });
  } finally {
    database.close();
  }
}

test("C2 rollback transaction abort leaves pointer, attempt, event stream, receipt set, and sealed generation unchanged", async () => {
  const indexedDB = freshIndexedDb();
  const stores = createStores(indexedDB, "rollback-abort", {
    registryHooks: { afterRollbackWritesQueued(transaction) { transaction.abort(); } },
  });
  try {
    await initializeStores(stores, "rollback-abort");
    const promoted = await commitPromotion(stores, "rollback-abort");
    const rollbackRequired = await requireRollback(stores, "rollback-abort", promoted);
    const before = await stores.registry.exportSnapshot();
    const result = await stores.registry.commitRollback({
      operationId: "rollback-abort-operation",
      attemptId: rollbackRequired.aggregate.attemptId,
      plan: rollbackRequired.plan,
      commandId: "rollback-abort-command",
      occurredAt: at(rollbackRequired.nextSecond),
    });
    mustStorageReject(result, "transaction_aborted");
    const after = await stores.registry.exportSnapshot();
    assert.deepEqual(after, before);
    assert.equal(after.attempts[0].status, "rollback_required");
    assert.equal(after.rollbackReceipts.length, 0);
    assert.deepEqual(await stores.generation.loadSeal(), SANITIZED_GENERATION_SEAL);
  } finally {
    await closeAndDelete(indexedDB, stores);
  }
});

test("C2 active-pointer conflict blocks promotion without pointer, attempt, event, or receipt mutation", async () => {
  const indexedDB = freshIndexedDb();
  const stores = createStores(indexedDB, "pointer-conflict");
  try {
    await initializeStores(stores, "pointer-conflict");
    const ready = await (await import("./generation-storage-phase2cc-c2-fixture.mjs")).runToPromotionReady(stores, "pointer-conflict");
    stores.registry.close();
    await mutateRegistry(indexedDB, stores.physical.registry, (transaction) => {
      transaction.objectStore("activePointers").put({
        ...SANITIZED_REGISTRY_SNAPSHOT.activePointers[0],
        generationId: "gen-san-old-conflict",
        databaseName: "mindmap-state-core-v1-generation-gen-san-old-conflict",
        targetSnapshotHash: "9".repeat(64),
      });
    });
    const reopened = new NativeIndexedDbGenerationRegistry({ indexedDB, databaseName: stores.physical.registry, hasher: sha256 });
    stores.registry = reopened;
    const before = await reopened.exportSnapshot();
    const result = await reopened.commitPromotion({
      operationId: "pointer-conflict-operation",
      attemptId: ready.aggregate.attemptId,
      plan: ready.plan,
      seal: SANITIZED_GENERATION_SEAL,
      physicalGenerationDatabaseName: stores.physical.generation,
      commandId: "pointer-conflict-command",
      occurredAt: at(ready.nextSecond),
    });
    mustStorageReject(result, "active_pointer_mismatch");
    assert.deepEqual(await reopened.exportSnapshot(), before);
  } finally {
    await closeAndDelete(indexedDB, stores);
  }
});

test("C2 stale registry revision blocks explicit rollback without partial mutation", async () => {
  const indexedDB = freshIndexedDb();
  const stores = createStores(indexedDB, "rollback-stale-revision");
  try {
    await initializeStores(stores, "rollback-stale-revision");
    const promoted = await commitPromotion(stores, "rollback-stale-revision");
    const rollbackRequired = await requireRollback(stores, "rollback-stale-revision", promoted);
    stores.registry.close();
    await mutateRegistry(indexedDB, stores.physical.registry, (transaction) => {
      const store = transaction.objectStore("registry");
      const request = store.get("registry");
      request.onsuccess = () => store.put({ ...request.result, revision: request.result.revision + 1 });
    });
    const reopened = new NativeIndexedDbGenerationRegistry({ indexedDB, databaseName: stores.physical.registry, hasher: sha256 });
    stores.registry = reopened;
    const before = await reopened.exportSnapshot();
    const result = await reopened.commitRollback({
      operationId: "rollback-stale-operation",
      attemptId: rollbackRequired.aggregate.attemptId,
      plan: rollbackRequired.plan,
      commandId: "rollback-stale-command",
      occurredAt: at(rollbackRequired.nextSecond),
    });
    mustStorageReject(result, "registry_revision_mismatch");
    assert.deepEqual(await reopened.exportSnapshot(), before);
  } finally {
    await closeAndDelete(indexedDB, stores);
  }
});

test("C2 idempotency operation ID rejects a promotion payload with a different fingerprint", async () => {
  const indexedDB = freshIndexedDb();
  const stores = createStores(indexedDB, "promotion-idempotency-conflict");
  try {
    await initializeStores(stores, "promotion-idempotency-conflict");
    const promoted = await commitPromotion(stores, "promotion-idempotency-conflict");
    const before = await stores.registry.exportSnapshot();
    const conflicting = {
      ...promoted.request,
      commandId: `${promoted.request.commandId}-different`,
      occurredAt: at(promoted.nextSecond + 3),
    };
    mustStorageReject(await stores.registry.commitPromotion(conflicting), "idempotency_conflict");
    assert.deepEqual(await stores.registry.exportSnapshot(), before);
    assert.equal(before.activationReceipts.length, 1);
    assert.equal(before.attempts[0].status, "promotion_committed");
  } finally {
    await closeAndDelete(indexedDB, stores);
  }
});
