import assert from "node:assert/strict";
import { IDBFactory } from "fake-indexeddb";
import {
  C2_GENERATION_DATABASE_VERSION,
  C2_REGISTRY_DATABASE_VERSION,
  GENERATION_META_STORE,
  GENERATION_SEAL_STORE,
  META_STORE,
  POINTERS_STORE,
  REGISTRY_STORE,
  SEAL_ATTESTATIONS_STORE,
} from "../generation-storage/index.ts";
import {
  SANITIZED_GENERATION_MANIFEST,
  SANITIZED_GENERATION_SEAL,
  commitPromotion,
  createStores,
  deleteDatabase,
  initializeStores,
  sha256,
} from "./generation-storage-phase2cc-c2-fixture.mjs";

export function freshIndexedDb() {
  return new IDBFactory();
}

export async function createPromotedFixture(prefix) {
  const indexedDB = freshIndexedDb();
  const stores = createStores(indexedDB, prefix);
  await initializeStores(stores, prefix);
  const promoted = await commitPromotion(stores, prefix);
  stores.registry.close();
  stores.generation.close();
  return { indexedDB, stores, promoted };
}

export async function cleanupFixture(fixture) {
  fixture.stores.registry.close();
  fixture.stores.generation.close();
  await deleteDatabase(fixture.indexedDB, fixture.stores.physical.registry).catch(() => undefined);
  await deleteDatabase(fixture.indexedDB, fixture.stores.physical.generation).catch(() => undefined);
}

export async function openDatabase(indexedDB, databaseName, version) {
  return new Promise((resolve, reject) => {
    const request = version === undefined ? indexedDB.open(databaseName) : indexedDB.open(databaseName, version);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error(`open_failed:${databaseName}`));
    request.onblocked = () => reject(new Error(`open_blocked:${databaseName}`));
  });
}

export async function mutateStore(indexedDB, databaseName, storeName, mutation) {
  const database = await openDatabase(indexedDB, databaseName);
  try {
    await new Promise((resolve, reject) => {
      const transaction = database.transaction(storeName, "readwrite");
      try {
        mutation(transaction.objectStore(storeName));
      } catch (error) {
        reject(error);
        return;
      }
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error("mutation_failed"));
      transaction.onabort = () => reject(transaction.error ?? new Error("mutation_aborted"));
    });
  } finally {
    database.close();
  }
}

export async function replaceRow(indexedDB, databaseName, storeName, key, transform) {
  const database = await openDatabase(indexedDB, databaseName);
  try {
    await new Promise((resolve, reject) => {
      const transaction = database.transaction(storeName, "readwrite");
      const store = transaction.objectStore(storeName);
      const request = store.get(key);
      request.onsuccess = () => {
        try {
          const next = transform(request.result);
          if (next === undefined) store.delete(key);
          else store.put(next);
        } catch (error) {
          transaction.abort();
          reject(error);
        }
      };
      request.onerror = () => reject(request.error ?? new Error("row_read_failed"));
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error("row_replace_failed"));
      transaction.onabort = () => reject(transaction.error ?? new Error("row_replace_aborted"));
    });
  } finally {
    database.close();
  }
}

export async function createMalformedRegistry(indexedDB, databaseName) {
  const database = await new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, C2_REGISTRY_DATABASE_VERSION);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(META_STORE, { keyPath: "key" });
      request.result.createObjectStore(REGISTRY_STORE, { keyPath: "key" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("malformed_registry_create_failed"));
  });
  database.close();
}

export async function replaceGenerationWithMalformedDatabase(indexedDB, databaseName) {
  await deleteDatabase(indexedDB, databaseName);
  const database = await new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, C2_GENERATION_DATABASE_VERSION);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(GENERATION_META_STORE, { keyPath: "key" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("malformed_generation_create_failed"));
  });
  database.close();
}

export async function mutateActivePointer(indexedDB, databaseName) {
  const database = await openDatabase(indexedDB, databaseName);
  try {
    await new Promise((resolve, reject) => {
      const transaction = database.transaction([REGISTRY_STORE, POINTERS_STORE], "readwrite");
      const registryStore = transaction.objectStore(REGISTRY_STORE);
      const pointerStore = transaction.objectStore(POINTERS_STORE);
      const registryRequest = registryStore.get("registry");
      const pointerRequest = pointerStore.get("synthetic");
      let registryRow;
      let pointerRow;
      let queued = false;
      const queue = () => {
        if (queued || !registryRow || !pointerRow) return;
        queued = true;
        const revision = registryRow.revision + 1;
        registryStore.put({ ...registryRow, revision });
        pointerStore.put({
          ...pointerRow,
          registryRevision: revision,
          activationEpoch: pointerRow.activationEpoch + 1,
        });
      };
      registryRequest.onsuccess = () => { registryRow = registryRequest.result; queue(); };
      pointerRequest.onsuccess = () => { pointerRow = pointerRequest.result; queue(); };
      registryRequest.onerror = () => reject(registryRequest.error ?? new Error("registry_read_failed"));
      pointerRequest.onerror = () => reject(pointerRequest.error ?? new Error("pointer_read_failed"));
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error("pointer_mutation_failed"));
      transaction.onabort = () => reject(transaction.error ?? new Error("pointer_mutation_aborted"));
    });
  } finally {
    database.close();
  }
}

export async function listDatabaseNames(indexedDB) {
  const databases = await indexedDB.databases();
  return databases.map((database) => database.name).filter(Boolean).sort();
}

export async function readRegistryRows(indexedDB, databaseName) {
  const database = await openDatabase(indexedDB, databaseName);
  try {
    const transaction = database.transaction(
      [META_STORE, REGISTRY_STORE, POINTERS_STORE, SEAL_ATTESTATIONS_STORE],
      "readonly",
    );
    const complete = new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error("read_failed"));
      transaction.onabort = () => reject(transaction.error ?? new Error("read_aborted"));
    });
    const request = (storeName, key) => new Promise((resolve, reject) => {
      const item = key === undefined
        ? transaction.objectStore(storeName).getAll()
        : transaction.objectStore(storeName).get(key);
      item.onsuccess = () => resolve(item.result);
      item.onerror = () => reject(item.error ?? new Error("request_failed"));
    });
    const result = {
      meta: await request(META_STORE, "schema"),
      registry: await request(REGISTRY_STORE, "registry"),
      pointers: await request(POINTERS_STORE),
      attestations: await request(SEAL_ATTESTATIONS_STORE),
    };
    await complete;
    return result;
  } finally {
    database.close();
  }
}

export async function removeGenerationSeal(indexedDB, databaseName) {
  await mutateStore(indexedDB, databaseName, GENERATION_SEAL_STORE, (store) => store.delete("seal"));
}

export async function corruptGenerationIdentity(indexedDB, databaseName, workspace = "synthetic") {
  await replaceRow(indexedDB, databaseName, GENERATION_META_STORE, "generation", (row) => ({
    ...row,
    logicalGeneration: {
      ...SANITIZED_GENERATION_MANIFEST.generation,
      generationId: "gen-sanitized-other",
      databaseName: "mindmap-state-core-v1-generation-gen-sanitized-other",
      attemptId: "attempt-sanitized-other",
      workspace,
    },
  }));
}

export async function corruptSnapshotHash(indexedDB, registryDatabaseName, generationDatabaseName) {
  const wrongHash = "9".repeat(64);
  await replaceRow(indexedDB, registryDatabaseName, SEAL_ATTESTATIONS_STORE, SANITIZED_GENERATION_SEAL.generationId, (row) => ({
    ...row,
    seal: { ...row.seal, targetSnapshotHash: wrongHash },
  }));
  await replaceRow(indexedDB, generationDatabaseName, GENERATION_SEAL_STORE, "seal", (row) => ({
    ...row,
    seal: { ...row.seal, targetSnapshotHash: wrongHash },
  }));
}

export { SANITIZED_GENERATION_MANIFEST, SANITIZED_GENERATION_SEAL, sha256 };
