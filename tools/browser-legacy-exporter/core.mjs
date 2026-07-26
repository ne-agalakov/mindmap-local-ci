export const LEGACY_STORAGE = Object.freeze({
  databaseName: "mindmap-local-semantic-v060",
  storeName: "database",
  key: "mindmap-v0.6.sqlite",
  expectedOrigin: "http://127.0.0.1:5173",
});

const toBytes = (value) => {
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  }
  throw new Error("legacy_database_value_is_not_binary");
};

const containsStore = (names, storeName) => {
  if (typeof names?.contains === "function") return names.contains(storeName);
  return Array.from(names ?? []).includes(storeName);
};

export async function readLegacyDatabaseReadOnly(indexedDb = globalThis.indexedDB) {
  if (!indexedDb || typeof indexedDb.databases !== "function" || typeof indexedDb.open !== "function") {
    throw new Error("indexeddb_database_listing_is_unavailable");
  }

  const existing = await indexedDb.databases();
  if (!existing.some((entry) => entry?.name === LEGACY_STORAGE.databaseName)) {
    throw new Error("legacy_database_not_found");
  }

  return new Promise((resolve, reject) => {
    let settled = false;
    let database = null;
    let copiedBytes = null;

    const closeDatabase = () => {
      try {
        database?.close?.();
      } catch {
        // Closing is best-effort and must not replace the original result.
      }
      database = null;
    };

    const fail = (error) => {
      if (settled) return;
      settled = true;
      closeDatabase();
      reject(error instanceof Error ? error : new Error(String(error)));
    };

    const request = indexedDb.open(LEGACY_STORAGE.databaseName);

    request.onupgradeneeded = () => {
      try {
        request.transaction?.abort();
      } finally {
        fail(new Error("legacy_database_unexpected_upgrade"));
      }
    };
    request.onerror = () => fail(request.error ?? new Error("legacy_database_open_failed"));
    request.onsuccess = () => {
      database = request.result;
      if (settled) {
        closeDatabase();
        return;
      }
      if (!containsStore(database.objectStoreNames, LEGACY_STORAGE.storeName)) {
        fail(new Error("legacy_database_store_not_found"));
        return;
      }

      let transaction;
      try {
        transaction = database.transaction(LEGACY_STORAGE.storeName, "readonly");
      } catch (error) {
        fail(error);
        return;
      }

      let getRequest;
      try {
        getRequest = transaction.objectStore(LEGACY_STORAGE.storeName).get(LEGACY_STORAGE.key);
      } catch (error) {
        fail(error);
        return;
      }

      getRequest.onerror = () => fail(getRequest.error ?? new Error("legacy_database_read_failed"));
      getRequest.onsuccess = () => {
        try {
          const bytes = toBytes(getRequest.result);
          if (bytes.byteLength === 0) throw new Error("legacy_database_is_empty");
          copiedBytes = bytes.slice();
        } catch (error) {
          fail(error);
        }
      };
      transaction.onerror = () => fail(transaction.error ?? new Error("legacy_database_transaction_failed"));
      transaction.onabort = () => fail(transaction.error ?? new Error("legacy_database_transaction_aborted"));
      transaction.oncomplete = () => {
        if (settled) {
          closeDatabase();
          return;
        }
        if (!(copiedBytes instanceof Uint8Array)) {
          fail(new Error("legacy_database_read_incomplete"));
          return;
        }
        settled = true;
        closeDatabase();
        resolve(copiedBytes);
      };
    };
  });
}

export async function sha256Hex(bytes, cryptoImpl = globalThis.crypto) {
  if (!cryptoImpl?.subtle?.digest) throw new Error("webcrypto_sha256_is_unavailable");
  const normalized = toBytes(bytes);
  const digest = new Uint8Array(await cryptoImpl.subtle.digest("SHA-256", normalized));
  return Array.from(digest, (value) => value.toString(16).padStart(2, "0")).join("");
}

export function buildLegacyEvidence({ bytes, sha256, origin, exportedAt = new Date().toISOString() }) {
  const normalized = toBytes(bytes);
  if (!/^[a-f0-9]{64}$/.test(sha256)) throw new Error("invalid_sha256");
  if (origin !== LEGACY_STORAGE.expectedOrigin) throw new Error("invalid_export_origin");
  return {
    format: "mindmap-legacy-browser-export-evidence",
    schemaVersion: 1,
    exportedAt,
    origin,
    storage: {
      databaseName: LEGACY_STORAGE.databaseName,
      storeName: LEGACY_STORAGE.storeName,
      key: LEGACY_STORAGE.key,
      transactionMode: "readonly",
    },
    blob: {
      sizeBytes: normalized.byteLength,
      sha256,
      bytesModified: false,
    },
    execution: {
      databaseUpgradePerformed: false,
      databaseWritePerformed: false,
      databaseMigrationPerformed: false,
      networkFetchCalls: 0,
      ollamaCalls: 0,
      qwenCalls: 0,
      deepseekCalls: 0,
    },
    warning: "The matching SQLite file contains private local MindMap data and must not be published.",
  };
}
