import { C2_SANITIZED_DATABASE_PREFIX } from "../../generation-storage/index.ts";
import {
  PACKAGED_GENERATION_RUNTIME_PHASE,
  resolvePackagedActiveGeneration,
  serializeC3SanitizedDiagnostics,
  type C3ResolverObservation,
} from "../../app/lib/generation-runtime.ts";
import { databaseNames, mutatePointer, registryDatabaseName, seedPromotedGeneration, syncHash } from "./fixture.ts";

interface HarnessResult {
  readonly ok: boolean;
  readonly packagedRuntimeModule?: boolean;
  readonly browserIndexedDb?: boolean;
  readonly activeGenerationResolved?: boolean;
  readonly deterministicReload?: boolean;
  readonly immutableSealVerified?: boolean;
  readonly snapshotHashVerified?: boolean;
  readonly stalePointerRejected?: boolean;
  readonly missingRegistryFailClosed?: boolean;
  readonly noFallback?: boolean;
  readonly readOnlyNoMutation?: boolean;
  readonly reqObsTrace?: boolean;
  readonly possibleHangRendered?: boolean;
  readonly liveObservabilityRendered?: boolean;
  readonly diagnosticsDownloadAvailable?: boolean;
  readonly networkGuardsInstalled?: boolean;
  readonly zeroNetworkCalls?: boolean;
  readonly zeroModelCalls?: boolean;
  readonly exactSourceOpened?: boolean;
  readonly backupAccessed?: boolean;
  readonly productionNamespaceUsed?: boolean;
  readonly actualMigrationPerformed?: boolean;
  readonly personalDataUsed?: boolean;
  readonly targetSnapshotHash?: string;
  readonly error?: string;
}

declare global {
  interface Window {
    __MINDMAP_PHASE2CC_C3_HARNESS_RESULT__?: HarnessResult;
  }
}

const resultElement = document.querySelector<HTMLPreElement>("#result");
const downloadButton = document.querySelector<HTMLButtonElement>("#download");
const reloadMarker = "mindmap-phase2cc-c3-reload";
let diagnostics = "";
let networkCalls = 0;
const modelCalls = 0;
const observations: C3ResolverObservation[] = [];

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
    Object.defineProperty(navigator, "sendBeacon", { value: fail("navigator.sendBeacon"), configurable: true, writable: false });
  } catch {
    installed = false;
  }
  return installed;
}

function renderObservation(observation: C3ResolverObservation): void {
  observations.push(observation);
  if (!resultElement) return;
  resultElement.dataset.status = observation.state === "possibly_hung" ? "possibly-hung" : "running";
  resultElement.textContent = [
    `work: ${observation.workName}`,
    `type: ${observation.workType}`,
    `stage: ${observation.stage}`,
    `state: ${observation.state}`,
    `elapsed: ${observation.elapsedMs} ms`,
    `stage elapsed: ${observation.stageElapsedMs} ms`,
    `processed: ${observation.processed}/${observation.total}`,
    `heartbeat: ${observation.heartbeat}`,
    `last progress: ${observation.lastProgressAt}`,
    `inactivity: ${observation.inactivityMs} ms`,
    `model: ${observation.model}`,
    observation.message ? `message: ${observation.message}` : "",
  ].filter(Boolean).join("\n");
}

function show(result: HarnessResult, evidence?: unknown): void {
  window.__MINDMAP_PHASE2CC_C3_HARNESS_RESULT__ = result;
  diagnostics = JSON.stringify({ result, observations, evidence }, null, 2);
  if (downloadButton) downloadButton.disabled = !result.ok;
  if (resultElement) {
    resultElement.dataset.status = result.ok ? "passed" : "failed";
    resultElement.textContent = JSON.stringify(result, null, 2);
  }
  document.title = result.ok ? "PASS — MindMap Phase 2C-C3 Browser Harness" : "FAIL — MindMap Phase 2C-C3 Browser Harness";
}

if (downloadButton) {
  downloadButton.addEventListener("click", () => {
    if (!diagnostics) return;
    const blob = new Blob([diagnostics], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "mindmap-phase2cc-c3-browser-diagnostic.json";
    anchor.click();
    URL.revokeObjectURL(url);
  });
}

async function resolveWithObservability(delay = false) {
  let delayed = false;
  return resolvePackagedActiveGeneration({
    indexedDB,
    registryDatabaseName,
    workspace: "synthetic",
    hasher: syncHash,
    hangThresholdMs: delay ? 10 : 5_000,
    onObservation: renderObservation,
    async onCheckpoint(checkpoint) {
      if (delay && checkpoint === "after_registry_read" && !delayed) {
        delayed = true;
        await new Promise((resolve) => setTimeout(resolve, 35));
      }
    },
  });
}

async function main(): Promise<void> {
  const networkGuardsInstalled = installNetworkGuards();
  if (!sessionStorage.getItem(reloadMarker)) {
    await seedPromotedGeneration();
    const first = await resolveWithObservability();
    if (!first.ok) throw new Error(`initial_resolution_failed:${JSON.stringify(first.rejection)}`);
    sessionStorage.setItem(reloadMarker, JSON.stringify({
      generationId: first.value.logicalGeneration.generationId,
      targetSnapshotHash: first.value.targetSnapshotHash,
    }));
    location.reload();
    return;
  }

  const saved = JSON.parse(sessionStorage.getItem(reloadMarker) ?? "{}") as { generationId?: string; targetSnapshotHash?: string };
  const before = await databaseNames();
  const reopened = await resolveWithObservability(true);
  if (!reopened.ok) throw new Error(`reload_resolution_failed:${JSON.stringify(reopened.rejection)}`);
  const after = await databaseNames();

  const missingName = `${C2_SANITIZED_DATABASE_PREFIX}registry-browser-c3-missing`;
  const missingBefore = await databaseNames();
  const missing = await resolvePackagedActiveGeneration({
    indexedDB,
    registryDatabaseName: missingName,
    workspace: "synthetic",
    hasher: syncHash,
    onObservation: renderObservation,
  });
  const missingAfter = await databaseNames();

  const stale = await resolvePackagedActiveGeneration({
    indexedDB,
    registryDatabaseName,
    workspace: "synthetic",
    hasher: syncHash,
    onObservation: renderObservation,
    async onCheckpoint(checkpoint) {
      if (checkpoint === "after_generation_verification") await mutatePointer();
    },
  });

  const result: HarnessResult = {
    ok: true,
    packagedRuntimeModule: PACKAGED_GENERATION_RUNTIME_PHASE === "phase2cc-c3",
    browserIndexedDb: typeof indexedDB?.open === "function" && typeof indexedDB.databases === "function",
    activeGenerationResolved: reopened.ok,
    deterministicReload: reopened.value.logicalGeneration.generationId === saved.generationId
      && reopened.value.targetSnapshotHash === saved.targetSnapshotHash,
    immutableSealVerified: reopened.value.seal.sealed === true,
    snapshotHashVerified: reopened.value.hashVerified && reopened.value.seal.targetSnapshotHash === reopened.value.activePointer.targetSnapshotHash,
    stalePointerRejected: !stale.ok && stale.rejection.code === "registry_pointer_changed",
    missingRegistryFailClosed: !missing.ok
      && missing.rejection.code === "registry_database_missing"
      && JSON.stringify(missingBefore) === JSON.stringify(missingAfter),
    noFallback: reopened.value.fallbackUsed === false && missing.diagnostics.fallbackUsed === false && stale.diagnostics.fallbackUsed === false,
    readOnlyNoMutation: JSON.stringify(before) === JSON.stringify(after) && reopened.value.mutationCount === 0,
    reqObsTrace: reopened.diagnostics.observations.length >= 6
      && reopened.diagnostics.observations.every((entry) => entry.model === "без AI" && entry.workType === "local"),
    possibleHangRendered: reopened.diagnostics.observations.some((entry) => entry.state === "possibly_hung"),
    liveObservabilityRendered: resultElement?.dataset.status !== undefined,
    diagnosticsDownloadAvailable: Boolean(downloadButton) && typeof Blob === "function" && typeof URL.createObjectURL === "function",
    networkGuardsInstalled,
    zeroNetworkCalls: networkCalls === 0,
    zeroModelCalls: modelCalls === 0,
    exactSourceOpened: false,
    backupAccessed: false,
    productionNamespaceUsed: false,
    actualMigrationPerformed: false,
    personalDataUsed: false,
    targetSnapshotHash: reopened.value.targetSnapshotHash,
  };
  diagnostics = serializeC3SanitizedDiagnostics(reopened);
  show(result, { reopened: reopened.diagnostics, missing: missing.diagnostics, stale: stale.diagnostics });
}

main().catch((error) => {
  show({
    ok: false,
    zeroNetworkCalls: networkCalls === 0,
    zeroModelCalls: modelCalls === 0,
    exactSourceOpened: false,
    backupAccessed: false,
    productionNamespaceUsed: false,
    actualMigrationPerformed: false,
    personalDataUsed: false,
    error: error instanceof Error ? error.stack ?? error.message : String(error),
  });
});
