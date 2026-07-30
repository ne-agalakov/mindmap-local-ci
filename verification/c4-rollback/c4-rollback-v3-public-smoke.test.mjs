import assert from "node:assert/strict";
import test from "node:test";
import { IDBFactory } from "fake-indexeddb";
import {
  C4_FIXTURE_COUNTS,
  IndexedDbSanitizedGenerationStore,
  InMemoryAtomicC4RollbackAuthorizationLedger,
  NativeC1C2PromotionAdapter,
  NativeC3ResolverAdapter,
  NativeC4RollbackAdapter,
  buildC4RollbackBinding,
  reconcileUncertainC4Rollback,
  runNativeSanitizedC4Attempt,
  runSanitizedC4Rollback,
} from "../../c4-execution/index.ts";
import { NativeIndexedDbGenerationRegistry } from "../../generation-storage/index.ts";
import { createRunnerContext, sha256 } from "../../tests/c4-execution-phase2cc-c4-fixture.mjs";

const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

function rollbackAuthorization(binding, suffix) {
  return Object.freeze({
    authorizationVersion: "phase2cc-c4-sanitized-rollback-v1",
    scope: "sanitized-fixtures-only",
    rollbackAuthorizationId: `fixture-c4-rollback-v3-${suffix}`,
    attemptId: binding.attemptId,
    currentRegistryRevision: binding.currentRegistryRevision,
    failedGenerationId: binding.failedGenerationId,
    failedLogicalGenerationDatabaseName: binding.failedLogicalGenerationDatabaseName,
    failedPhysicalGenerationDatabaseName: binding.failedPhysicalGenerationDatabaseName,
    previousPointerFingerprint: binding.previousPointerFingerprint,
    activationReceiptFingerprint: binding.activationReceiptFingerprint,
    failureCode: binding.failureCode,
    failureEvidenceHash: binding.failureEvidenceHash,
    issuedAt: "2026-07-30T12:00:00.000Z",
    expiresAt: "2026-07-31T12:00:00.000Z",
  });
}

async function prepareResolverFailure() {
  const indexedDB = new IDBFactory();
  const base = createRunnerContext();
  const nativeOptions = {
    indexedDB,
    hasher: sha256,
    counts: C4_FIXTURE_COUNTS,
    faults: { resolverFailure: true },
    nowIso: () => base.clock.nowIso(),
  };
  const promotion = new NativeC1C2PromotionAdapter(nativeOptions);
  const resolver = new NativeC3ResolverAdapter(nativeOptions);
  const context = createRunnerContext({ promotion, resolver });
  const migration = await runNativeSanitizedC4Attempt({
    ...context.runnerOptions,
    indexedDB,
  });
  assert.equal(migration.ok, false, JSON.stringify(migration.diagnostics));
  assert.equal(migration.state.status, "rollback_required");
  const generationStore = new IndexedDbSanitizedGenerationStore({
    indexedDB,
    hasher: sha256,
    counts: C4_FIXTURE_COUNTS,
    nowIso: () => context.clock.nowIso(),
  });
  return { indexedDB, context, migration, generationStore, promotion };
}

test("rollback v3 uses the real async durable generation store and preserves payload", async () => {
  const prepared = await prepareResolverFailure();
  const { indexedDB, context, migration, generationStore, promotion } = prepared;
  const binding = buildC4RollbackBinding(context.manifest, migration.state, sha256);
  const adapter = new NativeC4RollbackAdapter({ indexedDB, hasher: sha256 });
  const before = await generationStore.payloadFingerprint(
    context.manifest.physicalGenerationDatabaseName,
    sha256,
  );
  assert.ok(before);
  const result = await runSanitizedC4Rollback({
    manifest: context.manifest,
    state: migration.state,
    stateStore: context.stateStore,
    authorization: rollbackAuthorization(binding, "direct"),
    authorizationLedger: new InMemoryAtomicC4RollbackAuthorizationLedger(),
    adapter,
    generationStore,
    hasher: sha256,
    clock: context.clock,
  });
  assert.equal(result.ok, true, result.ok ? undefined : result.message);
  assert.equal(result.rollbackCallCount, 1);
  assert.equal(result.payloadFingerprintBefore, before);
  assert.equal(result.payloadFingerprintAfter, before);
  assert.equal(await generationStore.payloadFingerprint(context.manifest.physicalGenerationDatabaseName, sha256), before);
  const registry = new NativeIndexedDbGenerationRegistry({
    indexedDB,
    databaseName: context.manifest.physicalRegistryDatabaseName,
    hasher: sha256,
  });
  const snapshot = await registry.exportSnapshot();
  assert.equal(snapshot.registry.revision, 2);
  assert.equal(snapshot.registry.activePointers.length, 0);
  assert.equal(snapshot.activationReceipts.length, 1);
  assert.equal(snapshot.rollbackReceipts.length, 1);
  registry.close();
  generationStore.close();
  promotion.close();
});

test("rollback v3 reconciles a committed C2 rollback after journal completion failure without a second call", async () => {
  const prepared = await prepareResolverFailure();
  const { indexedDB, context, migration, generationStore, promotion } = prepared;
  const binding = buildC4RollbackBinding(context.manifest, migration.state, sha256);
  const adapter = new NativeC4RollbackAdapter({ indexedDB, hasher: sha256 });
  const ledger = new InMemoryAtomicC4RollbackAuthorizationLedger();
  let commitCalls = 0;
  const completionFailingStore = Object.freeze({
    initialize: (...args) => context.stateStore.initialize(...args),
    load: (...args) => context.stateStore.load(...args),
    commit: (...args) => {
      commitCalls += 1;
      if (commitCalls === 2) {
        return Promise.resolve(Object.freeze({
          ok: false,
          code: "transaction_aborted",
          message: "injected completion journal failure",
        }));
      }
      return context.stateStore.commit(...args);
    },
  });
  const result = await runSanitizedC4Rollback({
    manifest: context.manifest,
    state: migration.state,
    stateStore: completionFailingStore,
    authorization: rollbackAuthorization(binding, "completion-window"),
    authorizationLedger: ledger,
    adapter,
    generationStore,
    hasher: sha256,
    clock: context.clock,
  });
  assert.equal(result.ok, false);
  assert.equal(result.rollbackCallCount, 1);
  assert.equal(adapter.rollbackCallCount, 1);
  const durableIntent = await context.stateStore.load(context.manifest.attemptId);
  assert.equal(durableIntent.status, "rollback_required");
  assert.equal(durableIntent.history.some((event) => event.label === "rollback_single_call_intent"), true);

  const reconciled = await reconcileUncertainC4Rollback({
    manifest: context.manifest,
    stateStore: context.stateStore,
    adapter,
    generationStore,
    hasher: sha256,
    clock: context.clock,
  });
  assert.equal(reconciled.ok, true, reconciled.ok ? undefined : reconciled.message);
  assert.equal(reconciled.committed, true);
  assert.equal(reconciled.rollbackCallProduced, false);
  assert.equal(adapter.rollbackCallCount, 1);
  assert.equal(reconciled.state.status, "completed");
  generationStore.close();
  promotion.close();
});

test("rollback v3 consumes authorization before intent and blocks rerun when intent persistence fails", async () => {
  const prepared = await prepareResolverFailure();
  const { indexedDB, context, migration, generationStore, promotion } = prepared;
  const binding = buildC4RollbackBinding(context.manifest, migration.state, sha256);
  const authorization = rollbackAuthorization(binding, "intent-window");
  const ledger = new InMemoryAtomicC4RollbackAuthorizationLedger();
  const adapter = new NativeC4RollbackAdapter({ indexedDB, hasher: sha256 });
  const intentFailingStore = Object.freeze({
    initialize: (...args) => context.stateStore.initialize(...args),
    load: (...args) => context.stateStore.load(...args),
    commit: () => Promise.resolve(Object.freeze({
      ok: false,
      code: "transaction_aborted",
      message: "injected intent journal failure",
    })),
  });
  const first = await runSanitizedC4Rollback({
    manifest: context.manifest,
    state: migration.state,
    stateStore: intentFailingStore,
    authorization,
    authorizationLedger: ledger,
    adapter,
    generationStore,
    hasher: sha256,
    clock: context.clock,
  });
  assert.equal(first.ok, false);
  assert.equal(first.rollbackCallCount, 0);
  assert.equal(adapter.rollbackCallCount, 0);
  const second = await runSanitizedC4Rollback({
    manifest: context.manifest,
    state: migration.state,
    stateStore: context.stateStore,
    authorization,
    authorizationLedger: ledger,
    adapter,
    generationStore,
    hasher: sha256,
    clock: context.clock,
  });
  assert.equal(second.ok, false);
  assert.equal(second.code, "rollback_authorization_consumed");
  assert.equal(second.rollbackCallCount, 0);
  assert.equal(adapter.rollbackCallCount, 0);
  generationStore.close();
  promotion.close();
});

test("rollback v3 emits possibly-hung heartbeat without automatic retry or AI", async () => {
  const prepared = await prepareResolverFailure();
  const { indexedDB, context, migration, generationStore, promotion } = prepared;
  const binding = buildC4RollbackBinding(context.manifest, migration.state, sha256);
  const nativeAdapter = new NativeC4RollbackAdapter({ indexedDB, hasher: sha256 });
  const delayedAdapter = Object.freeze({
    async rollbackOnce(request) {
      await delay(40);
      return nativeAdapter.rollbackOnce(request);
    },
    readbackRollback: (request) => nativeAdapter.readbackRollback(request),
  });
  const streamed = [];
  const result = await runSanitizedC4Rollback({
    manifest: context.manifest,
    state: migration.state,
    stateStore: context.stateStore,
    authorization: rollbackAuthorization(binding, "heartbeat"),
    authorizationLedger: new InMemoryAtomicC4RollbackAuthorizationLedger(),
    adapter: delayedAdapter,
    generationStore,
    hasher: sha256,
    clock: context.clock,
    heartbeatIntervalMs: 5,
    hangThresholdMs: 10,
    onObservation: (observation) => streamed.push(observation),
  });
  assert.equal(result.ok, true, result.ok ? undefined : result.message);
  const hung = result.observations.filter((observation) => observation.state === "possibly_hung");
  assert.ok(hung.length >= 1, JSON.stringify(result.observations));
  assert.ok(hung.some((observation) => observation.lastProgress.includes("Safe actions")));
  assert.ok(hung.every((observation) => observation.model === "без AI"));
  assert.equal(streamed.some((observation) => observation.state === "possibly_hung"), true);
  assert.equal(result.networkCalls, 0);
  assert.equal(result.modelCalls, 0);
  assert.equal(nativeAdapter.rollbackCallCount, 1);
  generationStore.close();
  promotion.close();
});
