import assert from "node:assert/strict";
import { createHash, webcrypto } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  LEGACY_STORAGE,
  buildLegacyEvidence,
  readLegacyDatabaseReadOnly,
  sha256Hex,
} from "../tools/browser-legacy-exporter/core.mjs";

const nextTask = (callback) => queueMicrotask(callback);

function createIndexedDbStub(bytes, { databaseExists = true, upgrade = false, manualComplete = false } = {}) {
  const audit = {
    databasesCalls: 0,
    openArguments: [],
    transactionModes: [],
    storeNames: [],
    keys: [],
    closeCalls: 0,
    abortCalls: 0,
    transactionCompleteCalls: 0,
    writeMethodCalls: [],
  };
  const controller = {
    complete: null,
    abort: null,
  };
  const indexedDb = {
    async databases() {
      audit.databasesCalls += 1;
      return databaseExists ? [{ name: LEGACY_STORAGE.databaseName, version: 1 }] : [];
    },
    open(...args) {
      audit.openArguments.push(args);
      const request = {};
      nextTask(() => {
        if (upgrade) {
          request.transaction = { abort: () => { audit.abortCalls += 1; } };
          request.onupgradeneeded?.();
          return;
        }
        const database = {
          objectStoreNames: { contains: (name) => name === LEGACY_STORAGE.storeName },
          close() { audit.closeCalls += 1; },
          transaction(storeName, mode) {
            audit.storeNames.push(storeName);
            audit.transactionModes.push(mode);
            const transaction = {
              error: null,
              objectStore(name) {
                assert.equal(name, LEGACY_STORAGE.storeName);
                const forbiddenWrite = (method) => (..._args) => {
                  audit.writeMethodCalls.push(method);
                  throw new Error(`write method called: ${method}`);
                };
                return {
                  get(key) {
                    audit.keys.push(key);
                    const getRequest = {};
                    nextTask(() => {
                      getRequest.result = bytes.slice().buffer;
                      getRequest.onsuccess?.();
                      if (!manualComplete) nextTask(() => controller.complete?.());
                    });
                    return getRequest;
                  },
                  put: forbiddenWrite("put"),
                  add: forbiddenWrite("add"),
                  delete: forbiddenWrite("delete"),
                  clear: forbiddenWrite("clear"),
                };
              },
            };
            controller.complete = () => {
              audit.transactionCompleteCalls += 1;
              transaction.oncomplete?.();
            };
            controller.abort = () => transaction.onabort?.();
            return transaction;
          },
        };
        request.result = database;
        request.onsuccess?.();
      });
      return request;
    },
  };
  return { indexedDb, audit, controller };
}

test("legacy exporter confirms existence, opens without version, and reads readonly", async () => {
  const source = new Uint8Array([83, 81, 76, 105, 116, 101]);
  const { indexedDb, audit } = createIndexedDbStub(source);
  const result = await readLegacyDatabaseReadOnly(indexedDb);
  assert.deepEqual(result, source);
  assert.notEqual(result.buffer, source.buffer, "exported bytes must be a detached copy");
  assert.equal(audit.databasesCalls, 1);
  assert.deepEqual(audit.openArguments, [[LEGACY_STORAGE.databaseName]], "no version may be passed");
  assert.deepEqual(audit.transactionModes, ["readonly"]);
  assert.deepEqual(audit.storeNames, [LEGACY_STORAGE.storeName]);
  assert.deepEqual(audit.keys, [LEGACY_STORAGE.key]);
  assert.deepEqual(audit.writeMethodCalls, []);
  assert.equal(audit.transactionCompleteCalls, 1);
  assert.equal(audit.closeCalls, 1);
});

test("export is not resolved before the readonly transaction completes", async () => {
  const { indexedDb, controller } = createIndexedDbStub(new Uint8Array([1, 2, 3]), { manualComplete: true });
  let resolution = "pending";
  const pending = readLegacyDatabaseReadOnly(indexedDb).then((value) => {
    resolution = "resolved";
    return value;
  });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(resolution, "pending");
  controller.complete();
  assert.deepEqual(await pending, new Uint8Array([1, 2, 3]));
});

test("an abort after reading rejects instead of exporting uncommitted transaction state", async () => {
  const { indexedDb, controller } = createIndexedDbStub(new Uint8Array([1, 2, 3]), { manualComplete: true });
  const pending = readLegacyDatabaseReadOnly(indexedDb);
  await new Promise((resolve) => setImmediate(resolve));
  controller.abort();
  await assert.rejects(pending, /legacy_database_transaction_aborted/);
});

test("absent legacy database is rejected before indexedDB.open", async () => {
  const { indexedDb, audit } = createIndexedDbStub(new Uint8Array([1]), { databaseExists: false });
  await assert.rejects(readLegacyDatabaseReadOnly(indexedDb), /legacy_database_not_found/);
  assert.equal(audit.databasesCalls, 1);
  assert.deepEqual(audit.openArguments, []);
});

test("unexpected upgrade is aborted instead of creating or changing storage", async () => {
  const { indexedDb, audit } = createIndexedDbStub(new Uint8Array([1]), { upgrade: true });
  await assert.rejects(readLegacyDatabaseReadOnly(indexedDb), /legacy_database_unexpected_upgrade/);
  assert.equal(audit.abortCalls, 1);
});

test("SHA-256 and evidence describe unchanged bytes and zero calls", async () => {
  const bytes = new TextEncoder().encode("exact legacy bytes");
  const expected = createHash("sha256").update(bytes).digest("hex");
  const hash = await sha256Hex(bytes, webcrypto);
  const evidence = buildLegacyEvidence({
    bytes,
    sha256: hash,
    origin: LEGACY_STORAGE.expectedOrigin,
    exportedAt: "2026-07-25T12:00:00.000Z",
  });
  assert.equal(hash, expected);
  assert.equal(evidence.blob.sha256, expected);
  assert.equal(evidence.blob.sizeBytes, bytes.byteLength);
  assert.equal(evidence.blob.bytesModified, false);
  assert.equal(evidence.storage.transactionMode, "readonly");
  assert.equal(evidence.execution.databaseWritePerformed, false);
  assert.equal(evidence.execution.databaseUpgradePerformed, false);
  assert.equal(evidence.execution.networkFetchCalls, 0);
  assert.equal(evidence.execution.ollamaCalls, 0);
  assert.equal(evidence.execution.qwenCalls, 0);
  assert.equal(evidence.execution.deepseekCalls, 0);
});

test("evidence refuses an origin other than the exact legacy origin", () => {
  assert.throws(() => buildLegacyEvidence({
    bytes: new Uint8Array([1]),
    sha256: "0".repeat(64),
    origin: "http://localhost:5173",
  }), /invalid_export_origin/);
});

test("standalone server and page contain no old app, Vite, fetch, or write imports", async () => {
  const [server, page, launcher] = await Promise.all([
    readFile(new URL("../tools/browser-legacy-exporter/server.mjs", import.meta.url), "utf8"),
    readFile(new URL("../tools/browser-legacy-exporter/page.mjs", import.meta.url), "utf8"),
    readFile(new URL("../start-legacy-exporter.command", import.meta.url), "utf8"),
  ]);
  const combined = `${server}\n${page}\n${launcher}`;
  for (const forbidden of [
    "npm run dev",
    "vite",
    "wrangler",
    "miniflare",
    "fetch(",
    "saveSnapshot",
    "importDatabase",
    "sql.js",
    "app/api/",
    "app/page",
    ".put(",
    ".add(",
    ".delete(",
    ".clear(",
  ]) {
    assert.equal(combined.toLowerCase().includes(forbidden.toLowerCase()), false, `forbidden runtime path: ${forbidden}`);
  }
  assert.match(server, /connect-src 'none'/);
  assert.match(launcher, /только чтение/);
});
