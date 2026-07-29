import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  SANITIZED_GENERATION_MANIFEST,
  SANITIZED_GENERATION_SEAL,
  SANITIZED_GENERATION_VERIFICATION,
  SANITIZED_IMPORT_RESULT,
  SANITIZED_REGISTRY_SNAPSHOT,
  SANITIZED_VERIFIED_BACKUP,
  SANITIZED_VERIFIED_SOURCE,
  executeGenerationAttemptCommand,
  planPromotion,
  planRollback,
} from "../generation-core/index.ts";
import {
  C2_SANITIZED_DATABASE_PREFIX,
  NativeIndexedDbGenerationRegistry,
  NativeIndexedDbGenerationSealStore,
} from "../generation-storage/index.ts";

export const sha256 = (content) => createHash("sha256").update(content).digest("hex");
export const at = (second) => `2026-01-02T00:00:${String(second).padStart(2, "0")}.000Z`;
export const commandMeta = (commandId, aggregate, second) => ({
  commandId,
  occurredAt: at(second),
  expectedRevision: aggregate?.revision ?? 0,
});

export function mustStorageSucceed(result) {
  assert.equal(result.ok, true, result.ok ? undefined : JSON.stringify(result.rejection));
  return result;
}

export function mustStorageReject(result, code) {
  assert.equal(result.ok, false, "storage operation unexpectedly succeeded");
  assert.equal(result.rejection.code, code);
  return result.rejection;
}

export function mustDomainSucceed(result) {
  assert.equal(result.ok, true, result.ok ? undefined : JSON.stringify(result.rejection));
  return result;
}

export function names(prefix) {
  return {
    registry: `${C2_SANITIZED_DATABASE_PREFIX}registry-${prefix}`,
    generation: `${C2_SANITIZED_DATABASE_PREFIX}generation-${prefix}`,
  };
}

export function createStores(indexedDB, prefix, options = {}) {
  const physical = names(prefix);
  return {
    physical,
    registry: new NativeIndexedDbGenerationRegistry({
      indexedDB,
      databaseName: physical.registry,
      hasher: sha256,
      testHooks: options.registryHooks,
    }),
    generation: new NativeIndexedDbGenerationSealStore({
      indexedDB,
      databaseName: physical.generation,
      hasher: sha256,
      testHooks: options.generationHooks,
    }),
  };
}

export function deleteDatabase(indexedDB, databaseName) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(databaseName);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error(`delete_failed:${databaseName}`));
    request.onblocked = () => reject(new Error(`delete_blocked:${databaseName}`));
  });
}

export async function cleanupStores(indexedDB, stores) {
  stores.registry.close();
  stores.generation.close();
  await deleteDatabase(indexedDB, stores.physical.registry);
  await deleteDatabase(indexedDB, stores.physical.generation);
}

export async function initializeStores(stores, prefix) {
  mustStorageSucceed(await stores.registry.initializeRegistry(
    SANITIZED_REGISTRY_SNAPSHOT,
    `${prefix}-initialize-registry`,
  ));
  mustStorageSucceed(await stores.generation.initialize(
    SANITIZED_GENERATION_MANIFEST.generation,
    `${prefix}-initialize-generation`,
  ));
}

export async function createAttempt(stores, prefix) {
  const result = mustStorageSucceed(await stores.registry.createAttempt(
    SANITIZED_GENERATION_MANIFEST,
    commandMeta(`${prefix}-plan`, undefined, 1),
  ));
  return result.value;
}

export async function commitDomainCommand(stores, prefix, aggregate, second, command) {
  const full = {
    ...command,
    attemptId: aggregate.attemptId,
    meta: commandMeta(`${prefix}-${command.type}-${second}`, aggregate, second),
  };
  const result = mustStorageSucceed(await stores.registry.commitCommand({
    operationId: full.meta.commandId,
    command: full,
  }));
  return result.value;
}

export async function runToVerified(stores, prefix) {
  let aggregate = await createAttempt(stores, prefix);
  const commands = [
    { type: "consume_authorization", authorizationId: SANITIZED_GENERATION_MANIFEST.authorization.authorizationId },
    { type: "verify_backup", backup: SANITIZED_VERIFIED_BACKUP },
    { type: "verify_source", source: SANITIZED_VERIFIED_SOURCE },
    { type: "record_generation_created", generation: SANITIZED_GENERATION_MANIFEST.generation },
    { type: "begin_import" },
    { type: "record_import_completed", result: SANITIZED_IMPORT_RESULT },
    { type: "record_generation_verified", verification: SANITIZED_GENERATION_VERIFICATION },
  ];
  let second = 2;
  for (const command of commands) {
    aggregate = await commitDomainCommand(stores, prefix, aggregate, second, command);
    second += 1;
  }
  return { aggregate, nextSecond: second };
}

export async function runToSealed(stores, prefix) {
  const verified = await runToVerified(stores, prefix);
  mustStorageSucceed(await stores.generation.seal(
    SANITIZED_GENERATION_SEAL,
    `${prefix}-physical-seal`,
  ));
  let aggregate = await commitDomainCommand(
    stores,
    prefix,
    verified.aggregate,
    verified.nextSecond,
    { type: "record_generation_sealed", seal: SANITIZED_GENERATION_SEAL },
  );
  mustStorageSucceed(await stores.registry.attestGenerationSeal({
    operationId: `${prefix}-attest-seal`,
    attemptId: aggregate.attemptId,
    seal: SANITIZED_GENERATION_SEAL,
    physicalGenerationDatabaseName: stores.physical.generation,
  }));
  return { aggregate, nextSecond: verified.nextSecond + 1 };
}

export async function runToPromotionReady(stores, prefix) {
  const sealed = await runToSealed(stores, prefix);
  const snapshot = await stores.registry.loadRegistry();
  assert.ok(snapshot);
  const aggregate = await commitDomainCommand(
    stores,
    prefix,
    sealed.aggregate,
    sealed.nextSecond,
    { type: "mark_promotion_ready", registrySnapshot: snapshot },
  );
  assert.equal(aggregate.status, "promotion_ready");
  return { aggregate, snapshot, plan: planPromotion(aggregate, snapshot), nextSecond: sealed.nextSecond + 1 };
}

export async function commitPromotion(stores, prefix) {
  const ready = await runToPromotionReady(stores, prefix);
  const request = {
    operationId: `${prefix}-atomic-promotion`,
    attemptId: ready.aggregate.attemptId,
    plan: ready.plan,
    seal: SANITIZED_GENERATION_SEAL,
    physicalGenerationDatabaseName: stores.physical.generation,
    commandId: `${prefix}-record-promotion`,
    occurredAt: at(ready.nextSecond),
  };
  const promoted = mustStorageSucceed(await stores.registry.commitPromotion(request));
  const aggregate = await stores.registry.loadAttempt(ready.aggregate.attemptId);
  assert.ok(aggregate);
  assert.equal(aggregate.status, "promotion_committed");
  return { ...ready, request, receipt: promoted.value, aggregate, nextSecond: ready.nextSecond + 1 };
}

export async function requireRollback(stores, prefix, promoted) {
  const aggregate = await commitDomainCommand(
    stores,
    prefix,
    promoted.aggregate,
    promoted.nextSecond,
    {
      type: "interrupt",
      checkpoint: "after_promotion_completion",
      reason: "sanitized-crash-simulation",
    },
  );
  assert.equal(aggregate.status, "rollback_required");
  const snapshot = await stores.registry.loadRegistry();
  assert.ok(snapshot);
  return {
    aggregate,
    snapshot,
    plan: planRollback(aggregate, snapshot),
    nextSecond: promoted.nextSecond + 1,
  };
}

export async function commitRollback(stores, prefix, rollbackRequired) {
  const request = {
    operationId: `${prefix}-atomic-rollback`,
    attemptId: rollbackRequired.aggregate.attemptId,
    plan: rollbackRequired.plan,
    commandId: `${prefix}-record-rollback`,
    occurredAt: at(rollbackRequired.nextSecond),
  };
  const result = mustStorageSucceed(await stores.registry.commitRollback(request));
  const aggregate = await stores.registry.loadAttempt(rollbackRequired.aggregate.attemptId);
  assert.ok(aggregate);
  assert.equal(aggregate.status, "rolled_back");
  return { request, receipt: result.value, aggregate };
}

export {
  SANITIZED_GENERATION_MANIFEST,
  SANITIZED_GENERATION_SEAL,
  SANITIZED_REGISTRY_SNAPSHOT,
  executeGenerationAttemptCommand,
  planPromotion,
  planRollback,
};
