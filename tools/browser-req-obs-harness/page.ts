import {
  buildOperationDiagnostics,
  heartbeatOperation,
  observationFromCheckpoint,
  operationLiveness,
  stageDurationSeconds,
  updateOperationObservation,
  type OperationObservation,
  type OperationRuntimeState,
} from "../../app/lib/operation-observability.ts";

type ProofCard = {
  id: string;
  label: string;
  observation: OperationObservation;
  nowMs: number;
};

declare global {
  var __MINDMAP_REQ_OBS_RESULT__: Record<string, unknown> | undefined;
}

const start = "2026-07-31T15:00:00.000Z";
const at = (seconds: number) => Date.parse(start) + seconds * 1000;
const iso = (seconds: number) => new Date(at(seconds)).toISOString();

const base = {
  operationId: "req-obs-browser-proof",
  stageKey: "candidates",
  stageLabel: "Численные кандидаты",
  workKind: "local" as const,
  runtimeState: "working" as OperationRuntimeState,
  stallAfterMs: 20_000,
  modelLabel: "без AI",
  activity: "Synthetic fixture activity",
  completed: 10,
  total: 100,
};

const initial = updateOperationObservation(undefined, base, start);
const statusOnly = updateOperationObservation(initial, {
  ...base,
  runtimeState: "saving",
  activity: "Synthetic checkpoint save",
}, iso(5));
const progressed = updateOperationObservation(statusOnly, {
  ...base,
  completed: 20,
}, iso(7));
const heartbeat = heartbeatOperation(progressed, base.operationId, iso(9))!;
const waitingAi = updateOperationObservation(undefined, {
  ...base,
  operationId: "waiting-ai",
  stageKey: "relations",
  stageLabel: "Проверка связей",
  workKind: "ai",
  runtimeState: "waiting_ai",
  modelLabel: "synthetic-model",
}, start);
const saving = updateOperationObservation(undefined, {
  ...base,
  operationId: "saving",
  stageKey: "checkpoint",
  stageLabel: "Сохранение checkpoint",
  workKind: "storage",
  runtimeState: "saving",
}, start);
const paused = updateOperationObservation(initial, {
  ...base,
  runtimeState: "paused",
  activity: "Synthetic explicit pause",
}, iso(12));
const stopped = updateOperationObservation(initial, {
  ...base,
  runtimeState: "stopped",
  activity: "Synthetic safe stop",
}, iso(13));
const completed = updateOperationObservation(initial, {
  ...base,
  stageKey: "complete",
  stageLabel: "Завершено",
  workKind: "storage",
  runtimeState: "completed",
  modelLabel: "без AI",
  activity: "Synthetic checkpoint completed",
  completed: 100,
  total: 100,
}, iso(14));
const legacy = observationFromCheckpoint({
  operationId: "legacy-checkpoint",
  stageKey: "hierarchy",
  stageLabel: "Иерархия",
  checkpointAt: start,
  workKind: "local",
  modelLabel: "без AI",
  activity: "Synthetic legacy checkpoint",
});

const cards: ProofCard[] = [
  { id: "working", label: "работает", observation: heartbeat, nowMs: at(10) },
  { id: "waiting_ai", label: "ожидает AI", observation: waitingAi, nowMs: at(10) },
  { id: "saving", label: "сохраняет", observation: saving, nowMs: at(10) },
  { id: "paused", label: "приостановлен", observation: paused, nowMs: at(60) },
  { id: "stopped", label: "остановлен", observation: stopped, nowMs: at(60) },
  { id: "completed", label: "завершён", observation: completed, nowMs: at(60) },
  { id: "possibly_stalled", label: "возможно завис", observation: initial, nowMs: at(21) },
  { id: "legacy_unknown", label: "старый checkpoint", observation: legacy, nowMs: at(60) },
];

const diagnostics = buildOperationDiagnostics(heartbeat, {
  exportedAt: iso(10),
  nowMs: at(10),
  networkCalls: 0,
  modelCalls: 0,
});

const app = document.querySelector<HTMLElement>("#app");
if (!app) throw new Error("req_obs_app_missing");
app.innerHTML = `
  <h1>REQ-OBS-001</h1>
  <p id="safety">Автоматический restart/resume/retry отключён. Network/model calls: 0/0.</p>
  <section id="cards"></section>
  <button id="download" type="button">Скачать диагностику этапа</button>
`;
const cardsNode = document.querySelector<HTMLElement>("#cards")!;
for (const card of cards) {
  const liveness = operationLiveness(card.observation, card.nowMs);
  const duration = stageDurationSeconds(card.observation, card.nowMs);
  const element = document.createElement("article");
  element.dataset.proof = card.id;
  element.dataset.liveness = liveness;
  element.innerHTML = `
    <strong>${card.label}</strong>
    <span>state=${liveness}</span>
    <span>work=${card.observation.workKind}</span>
    <span>model=${card.observation.modelLabel}</span>
    <span>duration=${duration === undefined ? "unknown" : duration}</span>
  `;
  cardsNode.append(element);
}

document.querySelector<HTMLButtonElement>("#download")!.addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(diagnostics, null, 2)], { type: "application/json;charset=utf-8" });
  const anchor = document.createElement("a");
  anchor.href = URL.createObjectURL(blob);
  anchor.download = "mindmap-operation-diagnostics-synthetic.json";
  anchor.click();
  URL.revokeObjectURL(anchor.href);
});

const livenessByCard = Object.fromEntries(cards.map((card) => [card.id, operationLiveness(card.observation, card.nowMs)]));
const serializedDiagnostics = JSON.stringify(diagnostics);
const checks = {
  timerStableOnStatus: statusOnly.stageStartedAt === initial.stageStartedAt,
  statusDidNotFakeProgress: statusOnly.lastProgressAt === initial.lastProgressAt,
  factualProgressRecorded: progressed.lastProgressAt === iso(7),
  heartbeatDidNotFakeProgress: heartbeat.lastProgressAt === progressed.lastProgressAt,
  heartbeatRecorded: heartbeat.lastHeartbeatAt === iso(9),
  configuredThresholdHonored: operationLiveness(initial, at(16)) === "working" && operationLiveness(initial, at(21)) === "possibly_stalled",
  pausedDurationFrozen: stageDurationSeconds(paused, at(60)) === 12,
  stoppedDurationFrozen: stageDurationSeconds(stopped, at(60)) === 13,
  completedDurationFrozen: stageDurationSeconds(completed, at(60)) === 0,
  legacyDurationUnknown: stageDurationSeconds(legacy, at(60)) === undefined,
  completedStorageNoAi: completed.workKind === "storage" && completed.modelLabel === "без AI",
  everyStateRendered: Object.values(livenessByCard).includes("working")
    && Object.values(livenessByCard).includes("waiting_ai")
    && Object.values(livenessByCard).includes("saving")
    && Object.values(livenessByCard).includes("paused")
    && Object.values(livenessByCard).includes("stopped")
    && Object.values(livenessByCard).includes("completed")
    && Object.values(livenessByCard).includes("possibly_stalled"),
  diagnosticsSanitized: !serializedDiagnostics.includes(base.activity) && !serializedDiagnostics.includes(base.stageLabel),
  zeroCallsExplicit: diagnostics.safety.networkCalls === 0 && diagnostics.safety.modelCalls === 0,
  noAutomaticActions: diagnostics.safety.automaticRetryAllowed === false
    && diagnostics.safety.automaticResumeAllowed === false
    && diagnostics.safety.automaticRestartAllowed === false,
};

globalThis.__MINDMAP_REQ_OBS_RESULT__ = {
  ok: Object.values(checks).every(Boolean),
  checks,
  livenessByCard,
  diagnostics,
  renderedCards: document.querySelectorAll("[data-proof]").length,
  downloadButtonVisible: Boolean(document.querySelector("#download")),
};
