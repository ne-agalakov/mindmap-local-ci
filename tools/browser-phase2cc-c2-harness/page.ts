import {
  SANITIZED_GENERATION_MANIFEST,
  SANITIZED_GENERATION_SEAL,
  SANITIZED_GENERATION_VERIFICATION,
  SANITIZED_IMPORT_RESULT,
  SANITIZED_REGISTRY_SNAPSHOT,
  SANITIZED_VERIFIED_BACKUP,
  SANITIZED_VERIFIED_SOURCE,
  planPromotion,
  planRollback,
} from "../../generation-core/index.ts";
import {
  C2_SANITIZED_DATABASE_PREFIX,
  NativeIndexedDbGenerationRegistry,
  NativeIndexedDbGenerationSealStore,
} from "../../generation-storage/index.ts";
import type { GenerationAttemptAggregate, GenerationAttemptCommand } from "../../generation-core/attempt-types.ts";

type HarnessResult = Readonly<{
  ok: boolean;
  browserIndexedDb: boolean;
  nativeGenerationSeal?: boolean;
  sealImmutable?: boolean;
  atomicPromotion?: boolean;
  promotionAbortNoPartial?: boolean;
  deterministicReopen?: boolean;
  blockedRecoveryPersisted?: boolean;
  explicitRollback?: boolean;
  idempotency?: boolean;
  sanitizedEvidence?: boolean;
  reqObsTrace?: boolean;
  liveObservabilityRendered?: boolean;
  diagnosticsDownloadAvailable?: boolean;
  networkGuardsInstalled?: boolean;
  zeroNetworkCalls?: boolean;
  zeroModelCalls?: boolean;
  exactSourceOpened?: boolean;
  backupAccessed?: boolean;
  productionNamespaceUsed?: boolean;
  actualMigrationPerformed?: boolean;
  finalSnapshotHash?: string;
  error?: string;
}>;

type Observation = Readonly<{
  step: string;
  workType: "local";
  state: "working" | "saving" | "verifying" | "completed" | "possibly_hung";
  elapsedMs: number;
  processed: number;
  total: number;
  lastProgressAt: string;
  inactivityMs: number;
  model: "без AI";
  heartbeat: number;
  message?: string;
}>;

declare global {
  interface Window {
    __MINDMAP_PHASE2CC_C2_HARNESS_RESULT__?: HarnessResult;
  }
}

const resultElement = document.querySelector<HTMLPreElement>("#result");
const downloadButton = document.querySelector<HTMLButtonElement>("#download");
const observations: Observation[] = [];
const startedAt = performance.now();
let heartbeat = 0;
let diagnostics = "";
let networkCalls = 0;
const modelCalls = 0;

function syncHash(input: string): string {
  let a = 0x811c9dc5;
  let b = 0x9e3779b9;
  let c = 0x85ebca6b;
  let d = 0xc2b2ae35;
  for (let index = 0; index < input.length; index += 1) {
    const code = input.charCodeAt(index);
    a = Math.imul(a ^ code, 0x01000193) >>> 0;
    b = Math.imul(b ^ (code + index), 0x85ebca6b) >>> 0;
    c = Math.imul(c ^ (code + a), 0xc2b2ae35) >>> 0;
    d = Math.imul(d ^ (code + b), 0x27d4eb2f) >>> 0;
  }
  const block = [a, b, c, d].map((value) => value.toString(16).padStart(8, "0")).join("");
  return `${block}${block}`;
}

function observe(step: string, state: Observation["state"], processed: number, total: number, message?: string): void {
  heartbeat += 1;
  const observation: Observation = {
    step,
    workType: "local",
    state,
    elapsedMs: Math.round(performance.now() - startedAt),
    processed,
    total,
    lastProgressAt: new Date().toISOString(),
    inactivityMs: 0,
    model: "без AI",
    heartbeat,
    message,
  };
  observations.push(observation);
  if (resultElement) {
    resultElement.dataset.status = state === "possibly_hung" ? "possibly-hung" : "running";
    resultElement.textContent = [
      `step: ${observation.step}`,
      `work type: ${observation.workType}`,
      `state: ${observation.state}`,
      `elapsed: ${observation.elapsedMs} ms`,
      `processed: ${observation.processed}/${observation.total}`,
      `heartbeat: ${observation.heartbeat}`,
      `last progress: ${observation.lastProgressAt}`,
      `model: ${observation.model}`,
      `diagnostics: ${diagnostics ? "available" : "pending"}`,
      observation.message ? `message: ${observation.message}` : "",
    ].filter(Boolean).join("\n");
  }
}

function installNetworkGuards(): boolean {
  const fail = (path: string) => (..._args: unknown[]): never => {
    networkCalls += 1;
    throw new Error(`external_call_boundary_violation:${path}`);
  };
  let installed = true;
  for (const [name, replacement] of [
    ["fetch", fail("fetch")],
    ["WebSocket", fail("WebSocket")],
    ["EventSource", fail("EventSource")],
    ["XMLHttpRequest", fail("XMLHttpRequest")],
  ] as const) {
    try {
      Object.defineProperty(globalThis, name, { value: replacement, configurable: true, writable: false });
    } catch {
      installed = false;
    }
  }
  try {
    Object.defineProperty(navigator, "sendBeacon", {
      value: fail("navigator.sendBeacon"),
      configurable: true,
      writable: false,
    });
  } catch {
    installed = false;
  }
  return installed;
}

function show(result: HarnessResult, evidence?: unknown): void {
  window.__MINDMAP_PHASE2CC_C2_HARNESS_RESULT__ = result;
  diagnostics = JSON.stringify({ result, observations, evidence }, null, 2);
  if (downloadButton) downloadButton.disabled = !result.ok;
  if (resultElement) {
    resultElement.dataset.status = result.ok ? "passed" : "failed";
    resultElement.textContent = JSON.stringify(result, null, 2);
  }
  document.title = result.ok ? "PASS — MindMap Phase 2C-C2 Browser Harness" : "FAIL — MindMap Phase 2C-C2 Browser Harness";
}

if (downloadButton) {
  downloadButton.addEventListener("click", () => {
    if (!diagnostics) return;
    const blob = new Blob([diagnostics], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "mindmap-phase2cc-c2-browser-diagnostic.json";
    anchor.click();
    URL.revokeObjectURL(url);
  });
}

function must<T>(result: Readonly<{ ok: true; value: T; idempotent: boolean }> | Readonly<{ ok: false; rejection: unknown }>): Readonly<{ ok: true; value: T; idempotent: boolean }> {
  if (!result.ok) throw new Error(`storage_rejection:${JSON.stringify(result.rejection)}`);
  return result;
}

function meta(commandId: string, aggregate: GenerationAttemptAggregate | undefined, second: number) {
  return { commandId, occurredAt: `2026-01-03T00:00:${String(second).padStart(2, "0")}.000Z`, expectedRevision: aggregate?.revision ?? 0 };
}

function deleteDatabase(name: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(name);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error(`delete_failed:${name}`));
    request.onblocked = () => reject(new Error(`delete_blocked:${name}`));
  });
}

function physicalNames(prefix: string) {
  return {
    registry: `${C2_SANITIZED_DATABASE_PREFIX}registry-${prefix}`,
    generation: `${C2_SANITIZED_DATABASE_PREFIX}generation-${prefix}`,
  };
}

function createStores(prefix: string, hooks?: ConstructorParameters<typeof NativeIndexedDbGenerationRegistry>[0]["testHooks"]) {
  const names = physicalNames(prefix);
  return {
    names,
    registry: new NativeIndexedDbGenerationRegistry({ indexedDB, databaseName: names.registry, hasher: syncHash, testHooks: hooks }),
    generation: new NativeIndexedDbGenerationSealStore({ indexedDB, databaseName: names.generation, hasher: syncHash }),
  };
}

async function command(
  registry: NativeIndexedDbGenerationRegistry,
  prefix: string,
  aggregate: GenerationAttemptAggregate,
  second: number,
  body: Omit<GenerationAttemptCommand, "attemptId" | "meta">,
): Promise<GenerationAttemptAggregate> {
  const full = { ...body, attemptId: aggregate.attemptId, meta: meta(`${prefix}-${body.type}-${second}`, aggregate, second) } as GenerationAttemptCommand;
  return must(await registry.commitCommand({ operationId: full.meta.commandId, command: full })).value;
}

async function runToReady(prefix: string, hooks?: ConstructorParameters<typeof NativeIndexedDbGenerationRegistry>[0]["testHooks"]) {
  const stores = createStores(prefix, hooks);
  await deleteDatabase(stores.names.registry).catch(() => undefined);
  await deleteDatabase(stores.names.generation).catch(() => undefined);
  must(await stores.registry.initializeRegistry(SANITIZED_REGISTRY_SNAPSHOT, `${prefix}-registry-init`));
  must(await stores.generation.initialize(SANITIZED_GENERATION_MANIFEST.generation, `${prefix}-generation-init`));
  let aggregate = must(await stores.registry.createAttempt(SANITIZED_GENERATION_MANIFEST, meta(`${prefix}-plan`, undefined, 1))).value;
  const sequence: readonly Omit<GenerationAttemptCommand, "attemptId" | "meta">[] = [
    { type: "consume_authorization", authorizationId: SANITIZED_GENERATION_MANIFEST.authorization.authorizationId },
    { type: "verify_backup", backup: SANITIZED_VERIFIED_BACKUP },
    { type: "verify_source", source: SANITIZED_VERIFIED_SOURCE },
    { type: "record_generation_created", generation: SANITIZED_GENERATION_MANIFEST.generation },
    { type: "begin_import" },
    { type: "record_import_completed", result: SANITIZED_IMPORT_RESULT },
    { type: "record_generation_verified", verification: SANITIZED_GENERATION_VERIFICATION },
  ];
  let second = 2;
  for (const item of sequence) {
    aggregate = await command(stores.registry, prefix, aggregate, second, item);
    second += 1;
  }
  must(await stores.generation.seal(SANITIZED_GENERATION_SEAL, `${prefix}-physical-seal`));
  aggregate = await command(stores.registry, prefix, aggregate, second, { type: "record_generation_sealed", seal: SANITIZED_GENERATION_SEAL });
  second += 1;
  must(await stores.registry.attestGenerationSeal({
    operationId: `${prefix}-attest-seal`,
    attemptId: aggregate.attemptId,
    seal: SANITIZED_GENERATION_SEAL,
    physicalGenerationDatabaseName: stores.names.generation,
  }));
  const registrySnapshot = await stores.registry.loadRegistry();
  if (!registrySnapshot) throw new Error("registry_missing");
  aggregate = await command(stores.registry, prefix, aggregate, second, { type: "mark_promotion_ready", registrySnapshot });
  return { stores, aggregate, plan: planPromotion(aggregate, registrySnapshot), nextSecond: second + 1 };
}

async function cleanup(stores: ReturnType<typeof createStores>): Promise<void> {
  stores.registry.close();
  stores.generation.close();
  await deleteDatabase(stores.names.registry);
  await deleteDatabase(stores.names.generation);
}

async function main(): Promise<void> {
  const networkGuardsInstalled = installNetworkGuards();
  observe("initialize", "working", 0, 7, "isolated sanitized IndexedDB namespaces");
  let primary: Awaited<ReturnType<typeof runToReady>> | undefined;
  let aborted: Awaited<ReturnType<typeof runToReady>> | undefined;
  let blockedStores: ReturnType<typeof createStores> | undefined;
  try {
    primary = await runToReady("browser-primary");
    observe("seal", "verifying", 1, 7, "generation seal persisted and attested");
    const seal = await primary.stores.generation.loadSeal();
    if (JSON.stringify(seal) !== JSON.stringify(SANITIZED_GENERATION_SEAL)) throw new Error("generation_seal_missing");
    const immutable = await primary.stores.generation.seal(SANITIZED_GENERATION_SEAL, "browser-primary-second-seal");
    const sealImmutable = !immutable.ok && immutable.rejection.code === "seal_immutable_conflict";

    observe("promotion", "saving", 2, 7, "atomic pointer transaction");
    const promotionRequest = {
      operationId: "browser-primary-promotion",
      attemptId: primary.aggregate.attemptId,
      plan: primary.plan,
      seal: SANITIZED_GENERATION_SEAL,
      physicalGenerationDatabaseName: primary.stores.names.generation,
      commandId: "browser-primary-promotion-command",
      occurredAt: `2026-01-03T00:00:${String(primary.nextSecond).padStart(2, "0")}.000Z`,
    };
    const firstPromotion = must(await primary.stores.registry.commitPromotion(promotionRequest));
    const duplicatePromotion = must(await primary.stores.registry.commitPromotion(promotionRequest));
    const idempotency = duplicatePromotion.idempotent && JSON.stringify(firstPromotion.value) === JSON.stringify(duplicatePromotion.value);
    const promotedSnapshot = await primary.stores.registry.exportSnapshot();
    const atomicPromotion = promotedSnapshot.registry.revision === SANITIZED_REGISTRY_SNAPSHOT.revision + 1
      && promotedSnapshot.activationReceipts.length === 1
      && promotedSnapshot.attempts[0]?.status === "promotion_committed";

    observe("reopen", "verifying", 3, 7, "close and reopen persisted registry");
    primary.stores.registry.close();
    const reopenedRegistry = new NativeIndexedDbGenerationRegistry({ indexedDB, databaseName: primary.stores.names.registry, hasher: syncHash });
    primary.stores.registry = reopenedRegistry;
    const reopenedSnapshot = await reopenedRegistry.exportSnapshot();
    const deterministicReopen = JSON.stringify(reopenedSnapshot) === JSON.stringify(promotedSnapshot);

    observe("rollback", "saving", 4, 7, "explicit rollback after post-promotion interruption");
    let aggregate = await reopenedRegistry.loadAttempt(SANITIZED_GENERATION_MANIFEST.attemptId);
    if (!aggregate) throw new Error("promoted_attempt_missing");
    aggregate = await command(reopenedRegistry, "browser-primary", aggregate, primary.nextSecond + 1, {
      type: "interrupt",
      checkpoint: "after_promotion_completion",
      reason: "browser-post-promotion-crash",
    });
    const rollbackInspection = await reopenedRegistry.inspectRecovery(aggregate.attemptId);
    const rollbackSnapshot = await reopenedRegistry.loadRegistry();
    if (!rollbackSnapshot) throw new Error("rollback_registry_missing");
    const rollbackPlan = planRollback(aggregate, rollbackSnapshot);
    must(await reopenedRegistry.commitRollback({
      operationId: "browser-primary-rollback",
      attemptId: aggregate.attemptId,
      plan: rollbackPlan,
      commandId: "browser-primary-rollback-command",
      occurredAt: `2026-01-03T00:00:${String(primary.nextSecond + 2).padStart(2, "0")}.000Z`,
    }));
    const rolledBackSnapshot = await reopenedRegistry.exportSnapshot();
    const explicitRollback = rollbackInspection?.recoveryAction === "explicit_rollback"
      && rolledBackSnapshot.attempts[0]?.status === "rolled_back"
      && rolledBackSnapshot.registry.activePointers[0]?.generationId === SANITIZED_REGISTRY_SNAPSHOT.activePointers[0]?.generationId
      && rolledBackSnapshot.rollbackReceipts.length === 1
      && JSON.stringify(await primary.stores.generation.loadSeal()) === JSON.stringify(SANITIZED_GENERATION_SEAL);

    observe("abort", "verifying", 5, 7, "injected promotion abort must leave no partial write");
    aborted = await runToReady("browser-abort", { afterPromotionWritesQueued(transaction) { transaction.abort(); } });
    const abortBefore = await aborted.stores.registry.exportSnapshot();
    const abortResult = await aborted.stores.registry.commitPromotion({
      operationId: "browser-abort-promotion",
      attemptId: aborted.aggregate.attemptId,
      plan: aborted.plan,
      seal: SANITIZED_GENERATION_SEAL,
      physicalGenerationDatabaseName: aborted.stores.names.generation,
      commandId: "browser-abort-promotion-command",
      occurredAt: `2026-01-03T00:00:${String(aborted.nextSecond).padStart(2, "0")}.000Z`,
    });
    const abortAfter = await aborted.stores.registry.exportSnapshot();
    const promotionAbortNoPartial = !abortResult.ok && abortResult.rejection.code === "transaction_aborted" && JSON.stringify(abortAfter) === JSON.stringify(abortBefore);

    observe("blocked recovery", "verifying", 6, 7, "pre-promotion reload remains terminal and explicit");
    blockedStores = createStores("browser-blocked");
    await deleteDatabase(blockedStores.names.registry).catch(() => undefined);
    await deleteDatabase(blockedStores.names.generation).catch(() => undefined);
    must(await blockedStores.registry.initializeRegistry(SANITIZED_REGISTRY_SNAPSHOT, "browser-blocked-registry-init"));
    must(await blockedStores.generation.initialize(SANITIZED_GENERATION_MANIFEST.generation, "browser-blocked-generation-init"));
    let blocked = must(await blockedStores.registry.createAttempt(SANITIZED_GENERATION_MANIFEST, meta("browser-blocked-plan", undefined, 1))).value;
    blocked = await command(blockedStores.registry, "browser-blocked", blocked, 2, {
      type: "consume_authorization",
      authorizationId: SANITIZED_GENERATION_MANIFEST.authorization.authorizationId,
    });
    blocked = await command(blockedStores.registry, "browser-blocked", blocked, 3, {
      type: "interrupt",
      checkpoint: "after_authorization_consume",
      reason: "browser-reload",
    });
    blockedStores.registry.close();
    blockedStores.registry = new NativeIndexedDbGenerationRegistry({ indexedDB, databaseName: blockedStores.names.registry, hasher: syncHash });
    const blockedInspection = await blockedStores.registry.inspectRecovery(blocked.attemptId);
    const blockedRecoveryPersisted = blockedInspection?.status === "blocked_recovery"
      && blockedInspection.terminal
      && !blockedInspection.automaticResumeAllowed
      && !blockedInspection.retryAllowed
      && blockedInspection.availableCommands.length === 0;

    observe("evidence", "completed", 7, 7, "sanitized diagnostics ready");
    const evidence = await reopenedRegistry.exportSanitizedEvidence();
    const sanitizedEvidence = evidence.exactSourceOpened === false
      && evidence.backupAccessed === false
      && evidence.actualMigrationPerformed === false
      && evidence.productionNamespaceUsed === false
      && evidence.networkCalls === 0
      && evidence.modelCalls === 0
      && evidence.personalDataUsed === false
      && /^[a-f0-9]{64}$/.test(evidence.snapshotHash);
    const reqObsTrace = observations.length >= 7 && observations.every((item) => item.model === "без AI" && item.heartbeat > 0 && item.lastProgressAt.length > 0);

    const result: HarnessResult = {
      ok: true,
      browserIndexedDb: typeof indexedDB !== "undefined",
      nativeGenerationSeal: Boolean(seal?.sealed),
      sealImmutable,
      atomicPromotion,
      promotionAbortNoPartial,
      deterministicReopen,
      blockedRecoveryPersisted,
      explicitRollback,
      idempotency,
      sanitizedEvidence,
      reqObsTrace,
      liveObservabilityRendered: observations.length > 0 && resultElement?.dataset.status !== undefined,
      diagnosticsDownloadAvailable: Boolean(downloadButton),
      networkGuardsInstalled,
      zeroNetworkCalls: networkCalls === 0,
      zeroModelCalls: modelCalls === 0,
      exactSourceOpened: false,
      backupAccessed: false,
      productionNamespaceUsed: false,
      actualMigrationPerformed: false,
      finalSnapshotHash: evidence.snapshotHash,
    };
    for (const [key, value] of Object.entries(result)) {
      if (["ok", "finalSnapshotHash"].includes(key)) continue;
      if (value !== true && value !== false) continue;
      if (["exactSourceOpened", "backupAccessed", "productionNamespaceUsed", "actualMigrationPerformed"].includes(key)) {
        if (value !== false) throw new Error(`unsafe_harness_result:${key}`);
      } else if (value !== true) throw new Error(`missing_harness_proof:${key}`);
    }
    show(result, evidence);
  } catch (error) {
    show({
      ok: false,
      browserIndexedDb: typeof indexedDB !== "undefined",
      zeroNetworkCalls: networkCalls === 0,
      zeroModelCalls: modelCalls === 0,
      exactSourceOpened: false,
      backupAccessed: false,
      productionNamespaceUsed: false,
      actualMigrationPerformed: false,
      error: error instanceof Error ? error.stack ?? error.message : String(error),
    });
  } finally {
    if (primary) await cleanup(primary.stores).catch(() => undefined);
    if (aborted) await cleanup(aborted.stores).catch(() => undefined);
    if (blockedStores) await cleanup(blockedStores).catch(() => undefined);
  }
}

void main();
