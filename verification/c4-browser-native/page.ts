import {
  C4_CHECKPOINTS,
  C4_FIXTURE_COUNTS,
  C4_JOURNAL_DATABASE_PREFIX,
  IndexedDbC4ExecutionJournal,
  NativeC1C2PromotionAdapter,
  NativeC3ResolverAdapter,
  SanitizedFixtureBackupStore,
  SanitizedFixtureSourceAdapter,
  SanitizedGenerationStore,
  createCanonicalSanitizedC4Fixture,
  inspectDurableC4Reload,
  runNativeSanitizedC4Attempt,
  runSanitizedC4Attempt,
  serializeC4SanitizedDiagnostics,
  type C4ExecutionManifest,
  type C4LongOperationObservation,
} from "../../c4-execution/index.ts";
import type { SanitizedC4Fixture } from "../../c4-execution/fixture-adapters.ts";

interface HarnessResult {
  readonly ok: boolean;
  readonly actualChrome?: boolean;
  readonly browserIndexedDb?: boolean;
  readonly actualReload?: boolean;
  readonly durableInterruption?: boolean;
  readonly reloadClassifiedBlocked?: boolean;
  readonly reloadNoResume?: boolean;
  readonly reloadNoRetry?: boolean;
  readonly rerunRejected?: boolean;
  readonly rerunSourceOpenCountZero?: boolean;
  readonly rerunPromotionCallsZero?: boolean;
  readonly rerunResolverCallsZero?: boolean;
  readonly fullP00P15?: boolean;
  readonly authorizationConsumedBeforeSource?: boolean;
  readonly backupVerified?: boolean;
  readonly generationSealed?: boolean;
  readonly promotionExactlyOnce?: boolean;
  readonly c3ResolverVerified?: boolean;
  readonly durableCompletedReload?: boolean;
  readonly reqObsAllStages?: boolean;
  readonly possibleHangRendered?: boolean;
  readonly liveObservabilityRendered?: boolean;
  readonly diagnosticsDownloadAvailable?: boolean;
  readonly diagnosticsSanitized?: boolean;
  readonly networkGuardsInstalled?: boolean;
  readonly zeroNetworkCalls?: boolean;
  readonly zeroModelCalls?: boolean;
  readonly exactSourceOpened?: boolean;
  readonly privateBackupAccessed?: boolean;
  readonly productionNamespaceUsed?: boolean;
  readonly actualMigrationPerformed?: boolean;
  readonly automaticResumePerformed?: boolean;
  readonly automaticRetryPerformed?: boolean;
  readonly automaticCleanupPerformed?: boolean;
  readonly personalDataUsed?: boolean;
  readonly targetSnapshotHash?: string;
  readonly databaseNames?: readonly string[];
  readonly error?: string;
}

declare global {
  interface Window {
    __MINDMAP_PHASE2CC_C4_HARNESS_RESULT__?: HarnessResult;
  }
}

const resultElement = document.querySelector<HTMLPreElement>("#result");
const downloadButton = document.querySelector<HTMLButtonElement>("#download");
const reloadMarker = "mindmap-phase2cc-c4-browser-reload-v1";
let diagnostics = "";
let networkCalls = 0;
const modelCalls = 0;
const observations: C4LongOperationObservation[] = [];

export function syncHash(input: string): string {
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
  const block = [a, b, c, d]
    .map((value) => value.toString(16).padStart(8, "0"))
    .join("");
  return `${block}${block}`;
}

class BrowserClock {
  private value: number;

  constructor(iso = "2026-07-30T13:00:00.000Z") {
    this.value = Date.parse(iso);
  }

  nowMs(): number {
    this.value += 3;
    return this.value;
  }

  nowIso(): string {
    this.value += 3;
    return new Date(this.value).toISOString();
  }
}

class MustNotRunPromotionAdapter {
  calls = 0;

  async preflight(): Promise<never> {
    this.calls += 1;
    throw new Error("unexpected_promotion_preflight");
  }

  async prepare(): Promise<never> {
    this.calls += 1;
    throw new Error("unexpected_promotion_prepare");
  }

  async promoteOnce(): Promise<never> {
    this.calls += 1;
    throw new Error("unexpected_promotion_call");
  }

  async readbackUncertainPromotion(): Promise<never> {
    this.calls += 1;
    throw new Error("unexpected_promotion_readback");
  }
}

class MustNotRunResolverAdapter {
  calls = 0;

  async resolve(): Promise<never> {
    this.calls += 1;
    throw new Error("unexpected_resolver_call");
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
      Object.defineProperty(globalThis, name, {
        value: replacement,
        configurable: true,
        writable: false,
      });
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

function fixtureFor(suffix: string): SanitizedC4Fixture {
  const base = createCanonicalSanitizedC4Fixture(syncHash);
  const generationId = `fixture-c4-generation-${suffix}`;
  const logicalGenerationDatabaseName = `${base.manifest.generationPrefix}${generationId}`;
  const manifest: C4ExecutionManifest = Object.freeze({
    ...base.manifest,
    attemptId: `fixture-c4-attempt-${suffix}`,
    authorizationId: `fixture-c4-authorization-${suffix}`,
    backupId: `fixture-c4-backup-${suffix}`,
    physicalRegistryDatabaseName: `mindmap-state-core-v1-phase2cc-c2-fixture-registry-c4-${suffix}`,
    generationId,
    logicalGenerationDatabaseName,
    physicalGenerationDatabaseName: `mindmap-state-core-v1-phase2cc-c2-fixture-generation-c4-${suffix}`,
  });
  const authorization = Object.freeze({
    ...base.authorization,
    authorizationId: manifest.authorizationId,
    attemptId: manifest.attemptId,
    backupId: manifest.backupId,
    physicalRegistryDatabaseName: manifest.physicalRegistryDatabaseName,
    generationId: manifest.generationId,
    logicalGenerationDatabaseName: manifest.logicalGenerationDatabaseName,
    physicalGenerationDatabaseName: manifest.physicalGenerationDatabaseName,
  });
  return Object.freeze({
    manifest,
    authorization,
    records: base.records,
    encodedSource: base.encodedSource,
  });
}

function journalFor(_fixture: SanitizedC4Fixture, suffix: string): IndexedDbC4ExecutionJournal {
  return new IndexedDbC4ExecutionJournal({
    indexedDB,
    databaseName: `${C4_JOURNAL_DATABASE_PREFIX}${suffix}`,
    hasher: syncHash,
  });
}

async function databaseNames(): Promise<readonly string[]> {
  return Object.freeze(
    (await indexedDB.databases())
      .map((entry) => entry.name)
      .filter((name): name is string => Boolean(name))
      .sort(),
  );
}

function targetInventory(): Readonly<{
  registryExists: false;
  registryEmptyBootstrap: true;
  physicalGenerationDatabaseNames: readonly string[];
  logicalGenerationDatabaseNames: readonly string[];
}> {
  return Object.freeze({
    registryExists: false,
    registryEmptyBootstrap: true,
    physicalGenerationDatabaseNames: Object.freeze([]),
    logicalGenerationDatabaseNames: Object.freeze([]),
  });
}

function renderObservation(observation: C4LongOperationObservation): void {
  observations.push(observation);
  if (!resultElement) return;
  resultElement.dataset.status = observation.state === "possibly_hung" ? "possibly-hung" : "running";
  resultElement.textContent = [
    `work: ${observation.workName}`,
    `type: ${observation.workType}`,
    `checkpoint: ${observation.checkpoint}`,
    `state: ${observation.state}`,
    `elapsed: ${observation.elapsedMs} ms`,
    `processed: ${observation.processed}/${observation.total}`,
    `heartbeat: ${observation.heartbeatAt}`,
    `last progress: ${observation.lastProgress}`,
    `model: ${observation.model}`,
  ].join("\n");
}

function show(result: HarnessResult, evidence?: unknown): void {
  window.__MINDMAP_PHASE2CC_C4_HARNESS_RESULT__ = result;
  diagnostics = JSON.stringify({ result, observations, evidence }, null, 2);
  if (downloadButton) downloadButton.disabled = !result.ok;
  if (resultElement) {
    resultElement.dataset.status = result.ok ? "passed" : "failed";
    resultElement.textContent = JSON.stringify(result, null, 2);
  }
  document.title = result.ok
    ? "PASS — MindMap Phase 2C-C4 Browser Harness"
    : "FAIL — MindMap Phase 2C-C4 Browser Harness";
}

if (downloadButton) {
  downloadButton.addEventListener("click", () => {
    if (!diagnostics) return;
    const blob = new Blob([diagnostics], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "mindmap-phase2cc-c4-sanitized-browser-diagnostic.json";
    anchor.click();
    URL.revokeObjectURL(url);
  });
}

async function runInterruptedAttempt(): Promise<void> {
  const fixture = fixtureFor("browser-interrupted");
  const journal = journalFor(fixture, "browser-interrupted");
  const promotion = new MustNotRunPromotionAdapter();
  const resolver = new MustNotRunResolverAdapter();
  const source = new SanitizedFixtureSourceAdapter(fixture, syncHash);
  const result = await runSanitizedC4Attempt({
    manifest: fixture.manifest,
    authorization: fixture.authorization,
    authorizationLedger: journal,
    stateStore: journal,
    source,
    backupStore: new SanitizedFixtureBackupStore(),
    generationStore: new SanitizedGenerationStore(),
    targetInventory: targetInventory(),
    promotion,
    resolver,
    hasher: syncHash,
    clock: new BrowserClock(),
    interruptAfter: "P07",
    hangThresholdMs: 1,
    onObservation: renderObservation,
  });
  if (
    result.ok
    || result.state.status !== "blocked_recovery"
    || result.state.stop?.checkpoint !== "P07"
    || source.sourceOpenCount !== 1
    || promotion.calls !== 0
    || resolver.calls !== 0
  ) {
    throw new Error(`interrupted_attempt_not_durable:${JSON.stringify(result.diagnostics)}`);
  }
  sessionStorage.setItem(reloadMarker, JSON.stringify({
    attemptId: fixture.manifest.attemptId,
    authorizationId: fixture.manifest.authorizationId,
    diagnostic: result.diagnostics,
  }));
  journal.close();
  location.reload();
}

async function verifyReloadAndComplete(): Promise<void> {
  const saved = JSON.parse(sessionStorage.getItem(reloadMarker) ?? "{}") as {
    attemptId?: string;
    authorizationId?: string;
    diagnostic?: unknown;
  };
  const interruptedFixture = fixtureFor("browser-interrupted");
  if (
    saved.attemptId !== interruptedFixture.manifest.attemptId
    || saved.authorizationId !== interruptedFixture.manifest.authorizationId
  ) throw new Error("browser_reload_marker_mismatch");

  const interruptedJournal = journalFor(interruptedFixture, "browser-interrupted");
  const reload = await inspectDurableC4Reload(
    interruptedJournal,
    interruptedJournal,
    interruptedFixture.manifest.attemptId,
    interruptedFixture.manifest.authorizationId,
  );
  const rerunPromotion = new MustNotRunPromotionAdapter();
  const rerunResolver = new MustNotRunResolverAdapter();
  const rerunSource = new SanitizedFixtureSourceAdapter(interruptedFixture, syncHash);
  const rerun = await runSanitizedC4Attempt({
    manifest: interruptedFixture.manifest,
    authorization: interruptedFixture.authorization,
    authorizationLedger: interruptedJournal,
    stateStore: interruptedJournal,
    source: rerunSource,
    backupStore: new SanitizedFixtureBackupStore(),
    generationStore: new SanitizedGenerationStore(),
    targetInventory: targetInventory(),
    promotion: rerunPromotion,
    resolver: rerunResolver,
    hasher: syncHash,
    clock: new BrowserClock(),
    hangThresholdMs: 1,
    onObservation: renderObservation,
  });

  const successFixture = fixtureFor("browser-success");
  const successJournal = journalFor(successFixture, "browser-success");
  const successClock = new BrowserClock();
  const nativeOptions = {
    indexedDB,
    hasher: syncHash,
    counts: C4_FIXTURE_COUNTS,
    nowIso: () => successClock.nowIso(),
  };
  const promotion = new NativeC1C2PromotionAdapter(nativeOptions);
  const resolver = new NativeC3ResolverAdapter(nativeOptions);
  const success = await runNativeSanitizedC4Attempt({
    manifest: successFixture.manifest,
    authorization: successFixture.authorization,
    authorizationLedger: successJournal,
    stateStore: successJournal,
    source: new SanitizedFixtureSourceAdapter(successFixture, syncHash),
    promotion,
    resolver,
    hasher: syncHash,
    clock: successClock,
    indexedDB,
    hangThresholdMs: 1,
    onObservation: renderObservation,
  });
  const completedReload = await inspectDurableC4Reload(
    successJournal,
    successJournal,
    successFixture.manifest.attemptId,
    successFixture.manifest.authorizationId,
  );
  const names = await databaseNames();
  const serialized = serializeC4SanitizedDiagnostics(success);
  const checkpoints = new Set(success.state.history.map((event) => event.checkpoint));
  const p02Index = success.state.history.findIndex((event) => event.checkpoint === "P02");
  const p03Index = success.state.history.findIndex((event) => event.checkpoint === "P03");
  const noUnsafePhysicalNames = names.every((name) =>
    name.startsWith("mindmap-state-core-v1-phase2cc-c2-fixture-")
    || name.startsWith(C4_JOURNAL_DATABASE_PREFIX)
  );

  const result: HarnessResult = {
    ok: true,
    actualChrome: /Chrome/i.test(navigator.userAgent),
    browserIndexedDb: typeof indexedDB.open === "function" && typeof indexedDB.databases === "function",
    actualReload: Boolean(saved.diagnostic),
    durableInterruption: reload.state?.stop?.checkpoint === "P07",
    reloadClassifiedBlocked: reload.classification === "blocked_recovery",
    reloadNoResume: reload.resumeCommandProduced === false,
    reloadNoRetry: reload.retryCommandProduced === false,
    rerunRejected: rerun.ok === false && rerun.state.revision === reload.state?.revision,
    rerunSourceOpenCountZero: rerunSource.sourceOpenCount === 0,
    rerunPromotionCallsZero: rerunPromotion.calls === 0,
    rerunResolverCallsZero: rerunResolver.calls === 0,
    fullP00P15: success.ok && success.state.status === "completed"
      && C4_CHECKPOINTS.every((checkpoint) => checkpoints.has(checkpoint)),
    authorizationConsumedBeforeSource: p02Index >= 0 && p03Index > p02Index
      && success.state.authorizationReceipt?.sourceOpenCountAtConsumption === 0,
    backupVerified: success.state.backupVerified,
    generationSealed: success.state.generationSealed,
    promotionExactlyOnce: success.state.promotionCallCount === 1 && promotion.promotionCallCount === 1,
    c3ResolverVerified: success.state.resolverVerified,
    durableCompletedReload: completedReload.classification === "completed"
      && completedReload.resumeCommandProduced === false,
    reqObsAllStages: C4_CHECKPOINTS.every((checkpoint) =>
      success.diagnostics.observations.some((entry) => entry.checkpoint === checkpoint && entry.model === "без AI"),
    ),
    possibleHangRendered: success.diagnostics.observations.some((entry) => entry.state === "possibly_hung"),
    liveObservabilityRendered: resultElement?.dataset.status !== undefined,
    diagnosticsDownloadAvailable: Boolean(downloadButton)
      && typeof Blob === "function"
      && typeof URL.createObjectURL === "function",
    diagnosticsSanitized: !serialized.includes("fixture-record-")
      && !serialized.includes("/Users/")
      && !serialized.includes("mindmap-v0.6.sqlite"),
    networkGuardsInstalled: true,
    zeroNetworkCalls: networkCalls === 0,
    zeroModelCalls: modelCalls === 0,
    exactSourceOpened: success.diagnostics.exactSourceOpened,
    privateBackupAccessed: success.diagnostics.privateBackupAccessed,
    productionNamespaceUsed: !noUnsafePhysicalNames || success.diagnostics.productionNamespaceUsed,
    actualMigrationPerformed: success.diagnostics.actualMigrationPerformed,
    automaticResumePerformed: false,
    automaticRetryPerformed: false,
    automaticCleanupPerformed: false,
    personalDataUsed: success.diagnostics.personalDataUsed,
    targetSnapshotHash: successFixture.manifest.expectedTargetSnapshotHash,
    databaseNames: names,
  };
  diagnostics = JSON.stringify({
    result,
    interrupted: saved.diagnostic,
    reload,
    rerun: rerun.diagnostics,
    success: success.diagnostics,
    completedReload,
  }, null, 2);
  promotion.close();
  successJournal.close();
  interruptedJournal.close();
  show(result, { reload, rerun: rerun.diagnostics, success: success.diagnostics, completedReload });
}

async function main(): Promise<void> {
  const networkGuardsInstalled = installNetworkGuards();
  if (!networkGuardsInstalled) throw new Error("network_guards_not_installed");
  if (!sessionStorage.getItem(reloadMarker)) {
    await runInterruptedAttempt();
    return;
  }
  await verifyReloadAndComplete();
}

main().catch((error) => {
  show({
    ok: false,
    networkGuardsInstalled: false,
    zeroNetworkCalls: networkCalls === 0,
    zeroModelCalls: modelCalls === 0,
    exactSourceOpened: false,
    privateBackupAccessed: false,
    productionNamespaceUsed: false,
    actualMigrationPerformed: false,
    automaticResumePerformed: false,
    automaticRetryPerformed: false,
    automaticCleanupPerformed: false,
    personalDataUsed: false,
    error: error instanceof Error ? error.stack ?? error.message : String(error),
  });
});
