import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { IDBFactory } from "fake-indexeddb";
import {
  C2_SANITIZED_DATABASE_PREFIX,
  NativeIndexedDbGenerationRegistry,
  NativeIndexedDbGenerationSealStore,
  assertSafeC2GenerationDatabaseName,
  assertSafeC2RegistryDatabaseName,
} from "../generation-storage/index.ts";
import {
  SANITIZED_GENERATION_MANIFEST,
  SANITIZED_GENERATION_SEAL,
  SANITIZED_REGISTRY_SNAPSHOT,
  at,
  commitDomainCommand,
  commitPromotion,
  commitRollback,
  createAttempt,
  createStores,
  deleteDatabase,
  initializeStores,
  mustStorageReject,
  mustStorageSucceed,
  names,
  requireRollback,
  runToPromotionReady,
  runToSealed,
  sha256,
} from "./generation-storage-phase2cc-c2-fixture.mjs";

function freshIndexedDb() {
  return new IDBFactory();
}

async function rawMutateRegistryRevision(indexedDB, databaseName, revision) {
  const database = await new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("raw_open_failed"));
  });
  await new Promise((resolve, reject) => {
    const transaction = database.transaction("registry", "readwrite");
    const store = transaction.objectStore("registry");
    const get = store.get("registry");
    get.onsuccess = () => store.put({ ...get.result, revision });
    get.onerror = () => reject(get.error ?? new Error("raw_get_failed"));
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error ?? new Error("raw_mutation_aborted"));
  });
  database.close();
}

async function closeAndDelete(indexedDB, stores) {
  stores.registry.close();
  stores.generation.close();
  await deleteDatabase(indexedDB, stores.physical.registry);
  await deleteDatabase(indexedDB, stores.physical.generation);
}

test("C2 refuses logical production, legacy, and non-fixture physical database names", () => {
  assert.doesNotThrow(() => assertSafeC2RegistryDatabaseName(`${C2_SANITIZED_DATABASE_PREFIX}registry-safe`));
  assert.doesNotThrow(() => assertSafeC2GenerationDatabaseName(`${C2_SANITIZED_DATABASE_PREFIX}generation-safe`));
  for (const unsafe of [
    "mindmap-state-core-control-v1",
    "mindmap-state-core-v1-generation-gen-sanitized-001",
    "mindmap-local-semantic-v060",
    "mindmap-v0.6.sqlite",
    "random-database",
  ]) {
    assert.throws(
      () => assertSafeC2RegistryDatabaseName(unsafe),
      /invalid_c2_registry_database_name|production_or_legacy/,
    );
    assert.throws(
      () => assertSafeC2GenerationDatabaseName(unsafe),
      /invalid_c2_generation_database_name|production_or_legacy/,
    );
  }
});

test("C2 physical generation store seals once, survives reopen, and aborts without partial seal", async () => {
  const indexedDB = freshIndexedDb();
  const successName = names("seal-success").generation;
  const store = new NativeIndexedDbGenerationSealStore({ indexedDB, databaseName: successName, hasher: sha256 });
  mustStorageSucceed(await store.initialize(SANITIZED_GENERATION_MANIFEST.generation, "seal-init"));
  const first = mustStorageSucceed(await store.seal(SANITIZED_GENERATION_SEAL, "seal-commit"));
  assert.equal(first.idempotent, false);
  const duplicate = mustStorageSucceed(await store.seal(SANITIZED_GENERATION_SEAL, "seal-commit"));
  assert.equal(duplicate.idempotent, true);
  mustStorageReject(await store.seal(SANITIZED_GENERATION_SEAL, "seal-new-operation"), "seal_immutable_conflict");
  store.close();

  const reopened = new NativeIndexedDbGenerationSealStore({ indexedDB, databaseName: successName, hasher: sha256 });
  assert.deepEqual(await reopened.loadIdentity(), SANITIZED_GENERATION_MANIFEST.generation);
  assert.deepEqual(await reopened.loadSeal(), SANITIZED_GENERATION_SEAL);
  reopened.close();
  await deleteDatabase(indexedDB, successName);

  const abortName = names("seal-abort").generation;
  const aborting = new NativeIndexedDbGenerationSealStore({
    indexedDB,
    databaseName: abortName,
    hasher: sha256,
    testHooks: { afterSealWritesQueued(transaction) { transaction.abort(); } },
  });
  mustStorageSucceed(await aborting.initialize(SANITIZED_GENERATION_MANIFEST.generation, "abort-init"));
  mustStorageReject(await aborting.seal(SANITIZED_GENERATION_SEAL, "abort-seal"), "transaction_aborted");
  assert.equal(await aborting.loadSeal(), undefined);
  aborting.close();
  await deleteDatabase(indexedDB, abortName);
});

test("C2 seal attestation independently reopens the physical generation and rejects an unsealed substitute", async () => {
  const indexedDB = freshIndexedDb();
  const stores = createStores(indexedDB, "attestation-proof");
  const substituteName = names("attestation-unsealed").generation;
  const substitute = new NativeIndexedDbGenerationSealStore({ indexedDB, databaseName: substituteName, hasher: sha256 });
  try {
    await initializeStores(stores, "attestation-proof");
    const sealed = await runToSealed(stores, "attestation-proof");
    assert.equal(sealed.aggregate.status, "sealed");

    mustStorageSucceed(await substitute.initialize(
      SANITIZED_GENERATION_MANIFEST.generation,
      "attestation-substitute-init",
    ));
    mustStorageReject(await stores.registry.attestGenerationSeal({
      operationId: "attestation-unsealed-substitute",
      attemptId: sealed.aggregate.attemptId,
      seal: SANITIZED_GENERATION_SEAL,
      physicalGenerationDatabaseName: substituteName,
    }), "seal_mismatch");

    const attested = await stores.registry.loadSealAttestation(
      SANITIZED_GENERATION_MANIFEST.generation.generationId,
    );
    assert.equal(attested.physicalGenerationDatabaseName, stores.physical.generation);
  } finally {
    substitute.close();
    await deleteDatabase(indexedDB, substituteName);
    await closeAndDelete(indexedDB, stores);
  }
});

test("C2 atomically persists attempt, seal attestation, promotion, receipts, idempotency, and deterministic reopen", async () => {
  const indexedDB = freshIndexedDb();
  const stores = createStores(indexedDB, "promotion-success");
  try {
    await initializeStores(stores, "promotion-success");
    const promoted = await commitPromotion(stores, "promotion-success");
    const duplicate = mustStorageSucceed(await stores.registry.commitPromotion(promoted.request));
    assert.equal(duplicate.idempotent, true);
    assert.deepEqual(duplicate.value, promoted.receipt);

    const snapshotBefore = await stores.registry.exportSnapshot();
    const registry = await stores.registry.loadRegistry();
    assert.equal(registry.revision, SANITIZED_REGISTRY_SNAPSHOT.revision + 1);
    assert.equal(registry.activePointers[0].generationId, SANITIZED_GENERATION_MANIFEST.generation.generationId);
    assert.equal(snapshotBefore.activationReceipts.length, 1);
    assert.equal(snapshotBefore.rollbackReceipts.length, 0);
    assert.equal(snapshotBefore.sealAttestations.length, 1);
    assert.equal(snapshotBefore.attempts[0].status, "promotion_committed");

    stores.registry.close();
    stores.generation.close();
    const reopenedRegistry = new NativeIndexedDbGenerationRegistry({
      indexedDB,
      databaseName: stores.physical.registry,
      hasher: sha256,
    });
    const reopenedGeneration = new NativeIndexedDbGenerationSealStore({
      indexedDB,
      databaseName: stores.physical.generation,
      hasher: sha256,
    });
    const snapshotAfter = await reopenedRegistry.exportSnapshot();
    assert.deepEqual(snapshotAfter, snapshotBefore);
    assert.deepEqual(await reopenedGeneration.loadSeal(), SANITIZED_GENERATION_SEAL);
    const inspection = await reopenedRegistry.inspectRecovery(SANITIZED_GENERATION_MANIFEST.attemptId);
    assert.equal(inspection.status, "promotion_committed");
    assert.equal(inspection.automaticResumeAllowed, false);
    assert.equal(inspection.retryAllowed, false);
    reopenedRegistry.close();
    reopenedGeneration.close();
  } finally {
    await closeAndDelete(indexedDB, stores);
  }
});

test("C2 promotion transaction abort leaves pointer, attempt, event stream, receipts, and seal attestation unchanged", async () => {
  const indexedDB = freshIndexedDb();
  const stores = createStores(indexedDB, "promotion-abort", {
    registryHooks: { afterPromotionWritesQueued(transaction) { transaction.abort(); } },
  });
  try {
    await initializeStores(stores, "promotion-abort");
    const ready = await runToPromotionReady(stores, "promotion-abort");
    const before = await stores.registry.exportSnapshot();
    const request = {
      operationId: "promotion-abort-operation",
      attemptId: ready.aggregate.attemptId,
      plan: ready.plan,
      seal: SANITIZED_GENERATION_SEAL,
      physicalGenerationDatabaseName: stores.physical.generation,
      commandId: "promotion-abort-command",
      occurredAt: at(ready.nextSecond),
    };
    mustStorageReject(await stores.registry.commitPromotion(request), "transaction_aborted");
    const after = await stores.registry.exportSnapshot();
    assert.deepEqual(after, before);
    assert.equal(after.attempts[0].status, "promotion_ready");
    assert.equal(after.activationReceipts.length, 0);
    assert.equal(after.registry.revision, SANITIZED_REGISTRY_SNAPSHOT.revision);

    const blocked = await commitDomainCommand(stores, "promotion-abort", after.attempts[0], ready.nextSecond + 1, {
      type: "interrupt",
      checkpoint: "after_pointer_requests_before_completion",
      reason: "atomic-promotion-aborted",
    });
    assert.equal(blocked.status, "blocked_recovery");
    const inspection = await stores.registry.inspectRecovery(blocked.attemptId);
    assert.equal(inspection.terminal, true);
    assert.equal(inspection.automaticResumeAllowed, false);
    assert.deepEqual(inspection.availableCommands, []);
  } finally {
    await closeAndDelete(indexedDB, stores);
  }
});

test("C2 stale registry revision blocks promotion without any partial write", async () => {
  const indexedDB = freshIndexedDb();
  const stores = createStores(indexedDB, "stale-registry");
  try {
    await initializeStores(stores, "stale-registry");
    const ready = await runToPromotionReady(stores, "stale-registry");
    stores.registry.close();
    await rawMutateRegistryRevision(indexedDB, stores.physical.registry, SANITIZED_REGISTRY_SNAPSHOT.revision + 1);
    const reopened = new NativeIndexedDbGenerationRegistry({ indexedDB, databaseName: stores.physical.registry, hasher: sha256 });
    const before = await reopened.exportSnapshot();
    const result = await reopened.commitPromotion({
      operationId: "stale-promotion-operation",
      attemptId: ready.aggregate.attemptId,
      plan: ready.plan,
      seal: SANITIZED_GENERATION_SEAL,
      physicalGenerationDatabaseName: stores.physical.generation,
      commandId: "stale-promotion-command",
      occurredAt: at(ready.nextSecond),
    });
    mustStorageReject(result, "registry_revision_mismatch");
    const after = await reopened.exportSnapshot();
    assert.deepEqual(after, before);
    assert.equal(after.activationReceipts.length, 0);
    reopened.close();
  } finally {
    stores.generation.close();
    await deleteDatabase(indexedDB, stores.physical.registry);
    await deleteDatabase(indexedDB, stores.physical.generation);
  }
});

test("C2 persists post-promotion rollback_required and commits explicit rollback without mutating the sealed generation", async () => {
  const indexedDB = freshIndexedDb();
  const stores = createStores(indexedDB, "rollback");
  try {
    await initializeStores(stores, "rollback");
    const promoted = await commitPromotion(stores, "rollback");
    const rollbackRequired = await requireRollback(stores, "rollback", promoted);
    stores.registry.close();

    const reopened = new NativeIndexedDbGenerationRegistry({ indexedDB, databaseName: stores.physical.registry, hasher: sha256 });
    stores.registry = reopened;
    const inspection = await reopened.inspectRecovery(rollbackRequired.aggregate.attemptId);
    assert.equal(inspection.status, "rollback_required");
    assert.equal(inspection.recoveryAction, "explicit_rollback");
    assert.equal(inspection.automaticResumeAllowed, false);

    const rolledBack = await commitRollback(stores, "rollback", rollbackRequired);
    const duplicate = mustStorageSucceed(await reopened.commitRollback(rolledBack.request));
    assert.equal(duplicate.idempotent, true);
    assert.deepEqual(duplicate.value, rolledBack.receipt);

    const snapshot = await reopened.exportSnapshot();
    assert.equal(snapshot.registry.revision, SANITIZED_REGISTRY_SNAPSHOT.revision + 2);
    assert.equal(snapshot.registry.activePointers[0].generationId, SANITIZED_REGISTRY_SNAPSHOT.activePointers[0].generationId);
    assert.equal(snapshot.activationReceipts.length, 1);
    assert.equal(snapshot.rollbackReceipts.length, 1);
    assert.equal(snapshot.attempts[0].status, "rolled_back");
    assert.deepEqual(await stores.generation.loadSeal(), SANITIZED_GENERATION_SEAL);
  } finally {
    await closeAndDelete(indexedDB, stores);
  }
});

test("C2 pre-promotion interruption survives reopen as terminal blocked_recovery with no hidden continuation", async () => {
  const indexedDB = freshIndexedDb();
  const stores = createStores(indexedDB, "blocked-recovery");
  try {
    await initializeStores(stores, "blocked-recovery");
    let aggregate = await createAttempt(stores, "blocked-recovery");
    aggregate = await commitDomainCommand(stores, "blocked-recovery", aggregate, 2, {
      type: "consume_authorization",
      authorizationId: SANITIZED_GENERATION_MANIFEST.authorization.authorizationId,
    });
    aggregate = await commitDomainCommand(stores, "blocked-recovery", aggregate, 3, {
      type: "interrupt",
      checkpoint: "after_authorization_consume",
      reason: "browser-reload-simulation",
    });
    assert.equal(aggregate.status, "blocked_recovery");
    stores.registry.close();

    const reopened = new NativeIndexedDbGenerationRegistry({ indexedDB, databaseName: stores.physical.registry, hasher: sha256 });
    stores.registry = reopened;
    const persisted = await reopened.loadAttempt(aggregate.attemptId);
    assert.equal(persisted.status, "blocked_recovery");
    const inspection = await reopened.inspectRecovery(aggregate.attemptId);
    assert.deepEqual(inspection.availableCommands, []);
    assert.equal(inspection.automaticResumeAllowed, false);
    assert.equal(inspection.retryAllowed, false);
    assert.equal(inspection.recoveryAction, "offline_diagnosis");
  } finally {
    await closeAndDelete(indexedDB, stores);
  }
});

test("C2 sanitized evidence is deterministic and exposes no source bytes, paths, network, model, or personal payload", async () => {
  const indexedDB = freshIndexedDb();
  const stores = createStores(indexedDB, "evidence");
  try {
    await initializeStores(stores, "evidence");
    await runToSealed(stores, "evidence");
    const first = await stores.registry.exportSanitizedEvidence();
    const second = await stores.registry.exportSanitizedEvidence();
    assert.deepEqual(second, first);
    assert.match(first.snapshotHash, /^[a-f0-9]{64}$/);
    assert.equal(first.productionNamespaceUsed, false);
    assert.equal(first.exactSourceOpened, false);
    assert.equal(first.backupAccessed, false);
    assert.equal(first.actualMigrationPerformed, false);
    assert.equal(first.networkCalls, 0);
    assert.equal(first.modelCalls, 0);
    assert.equal(first.personalDataUsed, false);
    assert.equal(first.automaticResumeAllowed, false);
    assert.equal(first.automaticRetryAllowed, false);
    const serialized = JSON.stringify(first);
    for (const forbidden of [
      "mindmap-v0.6.sqlite",
      "mindmap-local-semantic-v060",
      "/Users/",
      "rawThought",
      "sourceBytes",
      "DeepSeek",
      "Qwen",
      "Ollama",
    ]) assert.equal(serialized.includes(forbidden), false, forbidden);
  } finally {
    await closeAndDelete(indexedDB, stores);
  }
});

test("C2 implementation has no filesystem, network, model, exact-source, or personal-data dependency path", async () => {
  const source = (await Promise.all([
    "../generation-storage/indexeddb/c2-indexeddb-common.ts",
    "../generation-storage/indexeddb/native-generation-seal-store.ts",
    "../generation-storage/indexeddb/native-generation-registry.ts",
  ].map((path) => readFile(new URL(path, import.meta.url), "utf8")))).join("\n");
  for (const forbidden of [
    'from "node:fs',
    "from 'node:fs",
    "fetch(",
    "XMLHttpRequest",
    "WebSocket",
    "EventSource",
    "sendBeacon",
    "ollama",
    "deepseek",
    "qwen",
    "tools/phase2cb",
    "migration/phase2cb",
    "legacy-database-inspector",
  ]) assert.equal(source.toLowerCase().includes(forbidden.toLowerCase()), false, forbidden);
  assert.equal(source.includes("productionWriteAllowed: true"), false);
  assert.equal(source.includes("production_or_legacy_database_forbidden"), true);
});
