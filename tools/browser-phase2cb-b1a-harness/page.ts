import { phase2CbB1aCandidate } from "../../migration/phase2cb-b1a-fixture.ts";
import { runPhase2CbB1aHarness } from "../../migration/phase2cb-b1a-executor.ts";
import { MemoryPhase2CbB1aSourceAdapter } from "../../migration/phase2cb-b1a-source.ts";
import { IndexedDbPhase2CbB1aTargetFactory } from "../../migration/phase2cb-b1a-targets.ts";

type HarnessResult = Readonly<{
  ok: boolean;
  browserIndexedDb: boolean;
  repeatPlanHashesEqual?: boolean;
  repeatTargetHashesEqual?: boolean;
  rollbackTargetEmpty?: boolean;
  sourceUnchangedAcrossHarness?: boolean;
  zeroNetworkCalls?: boolean;
  zeroModelCalls?: boolean;
  networkGuardsInstalled?: boolean;
  exactSourceOpened?: boolean;
  actualMigrationPerformed?: boolean;
  reqObsTrace?: boolean;
  liveObservabilityRendered?: boolean;
  diagnosticsDownloadAvailable?: boolean;
  portablePlanHash?: string;
  targetSnapshotHash?: string;
  error?: string;
}>;

declare global {
  interface Window {
    __MINDMAP_PHASE2CB_B1A_HARNESS_RESULT__?: HarnessResult;
  }
}

const resultElement = document.querySelector<HTMLPreElement>("#result");
const downloadButton = document.querySelector<HTMLButtonElement>("#download");
let diagnosticContent = "";

function renderObservation(observation: Readonly<{
  step: string; workType: string; state: string; elapsedMs: number;
  processed?: number; total?: number; lastProgressAt: string; inactivityMs: number; model: string; message?: string;
}>): void {
  if (!resultElement) return;
  resultElement.dataset.status = observation.state === "possibly_hung" ? "possibly-hung" : "running";
  resultElement.textContent = [
    `step: ${observation.step}`,
    `work type: ${observation.workType}`,
    `state: ${observation.state}`,
    `elapsed: ${observation.elapsedMs} ms`,
    `processed: ${observation.processed ?? "n/a"}/${observation.total ?? "n/a"}`,
    `last progress: ${observation.lastProgressAt}`,
    `inactivity: ${observation.inactivityMs} ms`,
    `model: ${observation.model}`,
    `diagnostics: available after completion`,
    observation.message ? `message: ${observation.message}` : "",
  ].filter(Boolean).join("\n");
}

if (downloadButton) {
  downloadButton.addEventListener("click", () => {
    if (!diagnosticContent) return;
    const blob = new Blob([diagnosticContent], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "mindmap-phase2cb-b1a-browser-diagnostic.json";
    anchor.click();
    URL.revokeObjectURL(url);
  });
}

function show(result: HarnessResult, evidence?: unknown): void {
  window.__MINDMAP_PHASE2CB_B1A_HARNESS_RESULT__ = result;
  diagnosticContent = JSON.stringify({ result, evidence }, null, 2);
  if (downloadButton) downloadButton.disabled = !result.ok;
  if (resultElement) {
    resultElement.dataset.status = result.ok ? "passed" : "failed";
    resultElement.textContent = JSON.stringify(result, null, 2);
  }
  document.title = result.ok
    ? "PASS — MindMap Phase 2C-B1a Browser Harness"
    : "FAIL — MindMap Phase 2C-B1a Browser Harness";
}

async function sha256Bytes(bytes: Uint8Array): Promise<string> {
  const input = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  const digest = await crypto.subtle.digest("SHA-256", input);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function hashCanonical(value: string): Promise<string> {
  return sha256Bytes(new TextEncoder().encode(value));
}

async function hashPayload(record: Readonly<{ encoding: string; data: string }>): Promise<string> {
  if (record.encoding === "base64" || record.encoding === "float32-le-base64") {
    const binary = atob(record.data);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    return sha256Bytes(bytes);
  }
  return sha256Bytes(new TextEncoder().encode(record.data));
}

function installNetworkGuards(onCall: (path: string) => never): boolean {
  const guard = (path: string) => (..._args: unknown[]): never => onCall(path);
  let installed = true;
  for (const [name, replacement] of [
    ["fetch", guard("fetch")],
    ["WebSocket", guard("WebSocket")],
    ["EventSource", guard("EventSource")],
    ["XMLHttpRequest", guard("XMLHttpRequest")],
  ] as const) {
    try {
      Object.defineProperty(globalThis, name, { value: replacement, configurable: true, writable: false });
    } catch {
      installed = false;
    }
  }
  try {
    Object.defineProperty(navigator, "sendBeacon", {
      value: guard("navigator.sendBeacon"),
      configurable: true,
      writable: false,
    });
  } catch {
    installed = false;
  }
  return installed;
}

async function main(): Promise<void> {
  try {
    if (!("indexedDB" in globalThis)) throw new Error("browser_indexeddb_unavailable");
    const source = new MemoryPhase2CbB1aSourceAdapter({
      sourceId: "browser-sanitized-fixture",
      bytes: new TextEncoder().encode("browser-sanitized-sqlite-envelope-v1"),
      candidate: phase2CbB1aCandidate(),
      hashBytes: sha256Bytes,
    });
    const targetFactory = new IndexedDbPhase2CbB1aTargetFactory({
      indexedDB,
      hashCanonical,
      hashPayload,
    });
    let networkCalls = 0;
    let modelCalls = 0;
    const networkGuardsInstalled = installNetworkGuards((path) => {
      networkCalls += 1;
      throw new Error(`network_path_detected:${path}`);
    });
    if (!networkGuardsInstalled) throw new Error("browser_network_guards_not_installed");
    let observationCount = 0;
    const result = await runPhase2CbB1aHarness({
      runId: "actual-browser",
      source,
      targetFactory,
      mappingOptions: { hashCanonical, hashBytes: sha256Bytes },
      hashCanonical,
      boundaryCounters: () => ({ networkCalls, modelCalls }),
      observe(observation) {
        observationCount += 1;
        renderObservation(observation);
      },
    });
    if ("stop" in result) throw new Error(`b1a_browser_stop:${result.stop.code}:${result.stop.message}`);
    const requiredSteps = new Set([
      "freeze_manifest",
      "offline_preflight",
      "source_snapshot_before",
      "read_only_extraction",
      "deterministic_planning",
      "target_freshness",
      "target_creation",
      "transactional_write",
      "verification",
      "source_snapshot_after",
      "cleanup",
      "complete",
    ]);
    const observations = result.evidence.first.observations;
    const reqObsTrace = observations.every((item) => item.model === "без AI")
      && [...requiredSteps].every((step) => observations.some((item) => item.step === step))
      && observations.every((item, index) => index === 0 || item.sequence > observations[index - 1].sequence);
    if (!reqObsTrace) throw new Error("b1a_browser_req_obs_trace_incomplete");
    networkCalls = result.evidence.networkCalls;
    modelCalls = result.evidence.modelCalls;
    show({
      ok: true,
      browserIndexedDb: true,
      repeatPlanHashesEqual: result.evidence.repeatPlanHashesEqual,
      repeatTargetHashesEqual: result.evidence.repeatTargetHashesEqual,
      rollbackTargetEmpty: result.evidence.rollbackTargetEmpty,
      sourceUnchangedAcrossHarness: result.evidence.sourceUnchangedAcrossHarness,
      zeroNetworkCalls: networkCalls === 0,
      zeroModelCalls: modelCalls === 0,
      networkGuardsInstalled,
      exactSourceOpened: result.evidence.exactSourceOpened,
      actualMigrationPerformed: result.evidence.actualMigrationPerformed,
      reqObsTrace,
      liveObservabilityRendered: observationCount > 0,
      diagnosticsDownloadAvailable: Boolean(downloadButton),
      portablePlanHash: result.evidence.first.portablePlanHash,
      targetSnapshotHash: result.evidence.first.targetSnapshotHash,
    }, result.evidence);
  } catch (error) {
    show({
      ok: false,
      browserIndexedDb: "indexedDB" in globalThis,
      error: error instanceof Error ? `${error.message}\n${error.stack ?? ""}` : String(error),
    });
  }
}

void main();
