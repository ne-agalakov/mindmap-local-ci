"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { BUILD_METADATA } from "./lib/build-metadata";
import {
  exportDatabase,
  importDatabase,
  loadSnapshot,
  saveSnapshot,
  type PersistedAiDecision,
} from "./lib/local-db";
import {
  assessOfflineCandidateCheckpoint,
  pipelineProgressPercent,
  restoreBatchProgress,
  restoreCheckpointExecutionContext,
} from "./lib/batch-run-state";
import {
  elapsedSeconds,
  heartbeatOperation,
  observationFromCheckpoint,
  operationLiveness,
  stageDurationSeconds,
  updateOperationObservation,
  type OperationObservation,
  type OperationRuntimeState,
  type OperationWorkKind,
} from "./lib/operation-observability";
import {
  descendantNodeIds,
  hierarchyLabel,
  knowledgePath,
  materializePlacement,
  selectKnowledgeContext,
  type KnowledgeNode,
  type ProposedPlacement,
} from "./lib/knowledge";
import {
  SYNTHETIC_TEST_THOUGHTS,
  SYNTHETIC_TEST_TOTAL,
  syntheticThoughtId,
} from "./lib/synthetic-test-data";
import {
  DEFAULT_SEMANTIC_THRESHOLDS,
  SEMANTIC_PIPELINE_VERSION,
  SEMANTIC_STAGE_LIMITS,
  buildClustersFromAssignments,
  buildHierarchyFromAssignments,
  compareClusterings,
  reconcileHierarchyCheckpoints,
  selectSemanticCandidatesIncremental,
  type SemanticCandidate,
  type SemanticCluster,
  type SemanticClusterAssignment,
  type SemanticClusterPlan,
  type SemanticExtraction,
  type SemanticHierarchyAssignment,
  type SemanticHierarchyRepair,
  type SemanticHierarchyRepairCheckpoint,
  type SemanticPlacement,
  type SemanticRelation,
  type StrictHierarchyNode,
} from "./lib/semantic-pipeline";
import { evaluateSyntheticHierarchy } from "./lib/synthetic-semantic-benchmark";
import {
  buildMapExportSvg,
  buildMapGraph,
  nodeSize,
} from "./lib/map-export";

type ThoughtType =
  | "Идея"
  | "Вопрос"
  | "Решение"
  | "Действие"
  | "Наблюдение"
  | "Проект"
  | "Не разобрано";

type LinkType =
  | "Связано"
  | "Продолжает"
  | "Противоречит"
  | "Зависит от"
  | "Альтернатива";

type Thought = {
  id: string;
  title: string;
  content: string;
  type: ThoughtType;
  project: string;
  tags: string[];
  createdAt: string;
  status: "inbox" | "active" | "archived";
  summary?: string;
  signals?: AnalysisSignal[];
  nextStep?: string;
  embedding?: number[];
  originalContent?: string;
  primaryNodeId?: string;
  additionalNodeIds?: string[];
};

type SignalKind =
  | "duplicate"
  | "contradiction"
  | "pattern"
  | "open_question"
  | "risk"
  | "opportunity";

type AnalysisSignal = {
  kind: SignalKind;
  targetId?: string;
  message: string;
};

type ThoughtLink = {
  id: string;
  source: string;
  target: string;
  type: LinkType;
  reason: string;
  confidence: number;
  status: "pending" | "approved" | "rejected";
};

type AnalysisResponse = {
  thought: Omit<Thought, "id" | "createdAt" | "status">;
  connections: Array<{
    targetId: string;
    type: LinkType;
    reason: string;
    confidence: number;
  }>;
  signals: AnalysisSignal[];
  placement: ProposedPlacement;
  engine: "ollama";
  model: string;
  recovery?: {
    used: true;
    mode: "local_json_repair" | "compact_reanalysis";
    reason: string;
    omittedConnections: boolean;
  };
};

type EmbeddingResponse = {
  embeddings: number[][];
  engine: "ollama";
};

type AnalysisReview = {
  decisionId: string;
  mode: "analyzed" | "offline";
  rawContent: string;
  thought: AnalysisResponse["thought"];
  connections: AnalysisResponse["connections"];
  signals: AnalysisSignal[];
  embedding?: number[];
  indexedThoughts: Thought[];
  placement: ProposedPlacement;
  model?: string;
};

type BatchProgress = {
  status: "idle" | "running" | "paused" | "failed" | "completed";
  completed: number;
  total: number;
  currentNumber?: number;
  currentContent?: string;
  error?: string;
  stage?: "preflight" | "extract" | "embeddings" | "cluster" | "hierarchy" | "candidates" | "relations" | "complete";
  stageCompleted?: number;
  stageTotal?: number;
  runId?: string;
  orderVariant?: "round_robin" | "original" | "reverse" | "seeded";
  interruptedByReload?: boolean;
  awaitingConfirmation?: boolean;
  checkpointAt?: string;
  observation?: OperationObservation;
  continuationBlock?: {
    code: "model_mismatch" | "model_config_unavailable";
    runModel?: string;
    configuredModel?: string;
  };
};

type WorkingSnapshot = {
  thoughts: Thought[];
  links: ThoughtLink[];
  nodes: KnowledgeNode[];
  decisions: PersistedAiDecision[];
};

type Tab = "today" | "inbox" | "thoughts" | "map";

type Theme = "dark" | "light";

type SpeechResultEvent = {
  resultIndex: number;
  results: ArrayLike<{ [index: number]: { transcript: string } }>;
};

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechResultEvent) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

const INITIAL_THOUGHTS: Thought[] = [
  {
    id: "mindmap",
    title: "Персональная система мышления",
    content:
      "Создать пространство, которое понимает мысли, связывает их и помогает доводить решения до результата.",
    type: "Проект",
    project: "MindMap",
    tags: ["AI", "продукт"],
    createdAt: "2026-07-21T09:10:00.000Z",
    status: "active",
    originalContent:
      "Создать пространство, которое понимает мысли, связывает их и помогает доводить решения до результата.",
    primaryNodeId: "node-mindmap",
    nextStep: "Проверить механику связей на реальных мыслях",
  },
  {
    id: "local-mvp",
    title: "Локальный MVP без подписки",
    content:
      "Первую версию запустить локально и проверить без дорогой подписки. Облако подключать только для сложных случаев.",
    type: "Решение",
    project: "MindMap",
    tags: ["MVP", "бюджет"],
    createdAt: "2026-07-21T09:25:00.000Z",
    status: "active",
    primaryNodeId: "node-mindmap",
  },
  {
    id: "map-first",
    title: "2D-карта обязательна в первой версии",
    content:
      "Интерактивная 2D-карта мыслей должна быть уже в первой версии, а не отложена на потом.",
    type: "Решение",
    project: "MindMap",
    tags: ["карта", "интерфейс"],
    createdAt: "2026-07-21T10:05:00.000Z",
    status: "active",
    primaryNodeId: "node-mindmap",
  },
  {
    id: "telegram-agent",
    title: "Автономный Telegram-канал",
    content:
      "Агент ежедневно ищет новости, готовит текст и изображение, а публикация происходит после подтверждения.",
    type: "Идея",
    project: "Контент",
    tags: ["агенты", "Telegram"],
    createdAt: "2026-07-20T19:10:00.000Z",
    status: "active",
    primaryNodeId: "node-content",
    nextStep: "Определить тему и аудиторию канала",
  },
  {
    id: "videographer-site",
    title: "Персональный сайт видеографа",
    content:
      "Минималистичный сайт-портфолио с сеткой работ и автоматическим видеопревью при наведении.",
    type: "Проект",
    project: "Сайт",
    tags: ["портфолио", "видео"],
    createdAt: "2026-07-12T12:30:00.000Z",
    status: "active",
    primaryNodeId: "node-videographer-site",
    nextStep: "Довести анимации текста и скролла",
  },
  {
    id: "infoproduct",
    title: "Отдельное направление инфопродукта",
    content:
      "Не смешивать личный сайт, AI-видео и инфопродукт: каждому направлению нужен отдельный проект.",
    type: "Решение",
    project: "Бизнес",
    tags: ["структура", "продукт"],
    createdAt: "2026-07-21T08:50:00.000Z",
    status: "active",
    primaryNodeId: "node-business",
  },
];

const INITIAL_NODES: KnowledgeNode[] = [
  { id: "node-work", name: "Работа", kind: "area", createdAt: "2026-07-21T09:00:00.000Z", source: "user", status: "active" },
  { id: "node-ai", name: "AI-системы", kind: "direction", parentId: "node-work", createdAt: "2026-07-21T09:02:00.000Z", source: "user", status: "active" },
  { id: "node-mindmap", name: "MindMap v0.6", kind: "project", parentId: "node-ai", createdAt: "2026-07-21T09:04:00.000Z", source: "user", status: "active" },
  { id: "node-content", name: "Контент", kind: "direction", parentId: "node-work", createdAt: "2026-07-20T19:00:00.000Z", source: "user", status: "active" },
  { id: "node-videography", name: "Видеография", kind: "direction", parentId: "node-work", createdAt: "2026-07-12T12:00:00.000Z", source: "user", status: "active" },
  { id: "node-videographer-site", name: "Личный сайт", kind: "project", parentId: "node-videography", createdAt: "2026-07-12T12:10:00.000Z", source: "user", status: "active" },
  { id: "node-business", name: "Бизнес", kind: "direction", parentId: "node-work", createdAt: "2026-07-21T08:40:00.000Z", source: "user", status: "active" },
];

const INITIAL_DECISIONS: PersistedAiDecision[] = [];

const INITIAL_LINKS: ThoughtLink[] = [
  {
    id: "l1",
    source: "mindmap",
    target: "local-mvp",
    type: "Продолжает",
    reason: "Решение определяет способ проверки проекта.",
    confidence: 0.98,
    status: "approved",
  },
  {
    id: "l2",
    source: "mindmap",
    target: "map-first",
    type: "Зависит от",
    reason: "Карта является обязательным представлением данных в MVP.",
    confidence: 0.99,
    status: "approved",
  },
  {
    id: "l3",
    source: "telegram-agent",
    target: "mindmap",
    type: "Связано",
    reason: "Это реальный сценарий для будущего раздела агентов.",
    confidence: 0.88,
    status: "approved",
  },
  {
    id: "l4",
    source: "infoproduct",
    target: "videographer-site",
    type: "Альтернатива",
    reason: "Направления должны развиваться раздельно, но конкурируют за внимание.",
    confidence: 0.84,
    status: "approved",
  },
];

const TYPE_CLASS: Record<ThoughtType, string> = {
  Идея: "idea",
  Вопрос: "question",
  Решение: "decision",
  Действие: "action",
  Наблюдение: "observation",
  Проект: "project",
  "Не разобрано": "unparsed",
};

const NAV: Array<{ id: Tab; label: string; glyph: string }> = [
  { id: "today", label: "Сегодня", glyph: "⌁" },
  { id: "inbox", label: "Входящие", glyph: "↓" },
  { id: "thoughts", label: "Все мысли", glyph: "≡" },
  { id: "map", label: "Карта", glyph: "◌" },
];

const uid = () => Math.random().toString(36).slice(2, 10);

function NeuralBackground({ theme }: { theme: Theme }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    type AmbientNode = { x: number; y: number; vx: number; vy: number; phase: number };
    let width = 0;
    let height = 0;
    let frame = 0;
    let lastFrame = 0;
    let nodes: AmbientNode[] = [];
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const reset = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.floor(width * ratio);
      canvas.height = Math.floor(height * ratio);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      const count = Math.max(36, Math.min(76, Math.round((width * height) / 26000)));
      nodes = Array.from({ length: count }, () => {
        const angle = Math.random() * Math.PI * 2;
        const speed = 0.008 + Math.random() * 0.018;
        return {
          x: Math.random() * width,
          y: Math.random() * height,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          phase: Math.random() * Math.PI * 2,
        };
      });
    };

    const draw = (time: number) => {
      frame = window.requestAnimationFrame(draw);
      if (time - lastFrame < 32) return;
      lastFrame = time;
      context.clearRect(0, 0, width, height);

      const lineColor = theme === "dark" ? "134, 177, 229" : "69, 104, 142";
      const dotColor = theme === "dark" ? "202, 225, 255" : "55, 86, 120";

      nodes.forEach((node, index) => {
        if (!reducedMotion) {
          node.vx += Math.sin(time * 0.000035 + node.phase) * 0.000025;
          node.vy += Math.cos(time * 0.000029 + node.phase) * 0.000025;
          const speed = Math.hypot(node.vx, node.vy);
          if (speed > 0.032) {
            node.vx = (node.vx / speed) * 0.032;
            node.vy = (node.vy / speed) * 0.032;
          }
          node.x += node.vx;
          node.y += node.vy;
          if (node.x < -30) node.x = width + 30;
          if (node.x > width + 30) node.x = -30;
          if (node.y < -30) node.y = height + 30;
          if (node.y > height + 30) node.y = -30;
        }

        for (let targetIndex = index + 1; targetIndex < nodes.length; targetIndex += 1) {
          const target = nodes[targetIndex];
          const distance = Math.hypot(node.x - target.x, node.y - target.y);
          if (distance > 190) continue;
          context.beginPath();
          context.moveTo(node.x, node.y);
          context.lineTo(target.x, target.y);
          context.strokeStyle = `rgba(${lineColor}, ${0.11 * (1 - distance / 190)})`;
          context.lineWidth = 0.7;
          context.stroke();
        }

        const pulse = 1 + Math.sin(time * 0.00032 + node.phase) * 0.35;
        context.beginPath();
        context.arc(node.x, node.y, pulse, 0, Math.PI * 2);
        context.fillStyle = `rgba(${dotColor}, ${theme === "dark" ? 0.32 : 0.22})`;
        context.fill();
      });
    };

    reset();
    window.addEventListener("resize", reset);
    frame = window.requestAnimationFrame(draw);
    return () => {
      window.removeEventListener("resize", reset);
      window.cancelAnimationFrame(frame);
    };
  }, [theme]);

  return <canvas ref={canvasRef} className="neural-background" aria-hidden="true" />;
}

function OperationObservability({
  observation,
}: {
  observation: OperationObservation;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const liveness = operationLiveness(observation, now);
  const livenessLabels: Record<ReturnType<typeof operationLiveness>, string> = {
    working: "работает",
    waiting_ai: "ожидает ответ AI",
    saving: "сохраняет checkpoint",
    paused: "приостановлен",
    stopped: "остановлен",
    completed: "завершён",
    possibly_stalled: "возможно, процесс завис",
  };
  const workLabels: Record<OperationWorkKind, string> = {
    ai: "AI",
    local: "локальный расчёт",
    storage: "сохранение",
  };
  const stageDuration = stageDurationSeconds(observation, now);
  const progressAge = elapsedSeconds(observation.lastProgressAt, now);
  const heartbeatAge = elapsedSeconds(observation.lastHeartbeatAt, now);
  const terminal = ["paused", "stopped", "completed"].includes(liveness);
  return (
    <div className={`operation-observability ${liveness === "possibly_stalled" ? "stalled" : ""}`}>
      <p>
        <span>
          {terminal ? "Длительность этапа" : "Таймер этапа"}:{" "}
          {stageDuration === undefined ? "не сохранена в старом checkpoint" : formatElapsed(stageDuration)}
        </span>
        <span>Тип: {workLabels[observation.workKind]}</span>
        <span>Состояние: {livenessLabels[liveness]}</span>
      </p>
      <p>
        <span>Последнее продвижение: {progressAge === 0 ? "только что" : `${formatElapsed(progressAge)} назад`}</span>
        <span>
          Heartbeat: {terminal
            ? "не требуется — процесс не выполняется"
            : heartbeatAge <= 2
              ? "активен"
              : `${formatElapsed(heartbeatAge)} назад`}
        </span>
        <span>Модель: {observation.modelLabel}</span>
      </p>
      <p>{observation.activity}</p>
      {liveness === "possibly_stalled" && (
        <p>Автоперезапуска и повторного AI-вызова не будет. Скачайте диагностику или безопасно остановите этап.</p>
      )}
    </div>
  );
}

export default function Home() {
  const [tab, setTab] = useState<Tab>("map");
  const [theme, setTheme] = useState<Theme>("dark");
  // Keep the first paint empty until IndexedDB is loaded. Rendering demo data
  // here made it flash for a moment on F5 during a real batch run.
  const [thoughts, setThoughts] = useState<Thought[]>([]);
  const [links, setLinks] = useState<ThoughtLink[]>([]);
  const [nodes, setNodes] = useState<KnowledgeNode[]>([]);
  const [decisions, setDecisions] = useState<PersistedAiDecision[]>([]);
  const [activeScopeId, setActiveScopeId] = useState<string | undefined>();
  const [draft, setDraft] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [engine, setEngine] = useState<"unknown" | "ollama" | "offline">(
    "unknown",
  );
  const [isListening, setIsListening] = useState(false);
  const [search, setSearch] = useState("");
  const [storage, setStorage] = useState<"loading" | "ready" | "saving" | "error">("loading");
  const [embeddingEngine, setEmbeddingEngine] = useState<"unknown" | "ollama" | "unavailable">("unknown");
  const [databaseReady, setDatabaseReady] = useState(false);
  const [editingThought, setEditingThought] = useState<Thought | null>(null);
  const [analysisReview, setAnalysisReview] = useState<AnalysisReview | null>(null);
  const [batchProgress, setBatchProgress] = useState<BatchProgress>({
    status: "idle",
    completed: 0,
    total: SYNTHETIC_TEST_TOTAL,
  });
  const [foregroundObservation, setForegroundObservation] = useState<OperationObservation>(
    () => createStartupObservation(),
  );
  const startupObservationRef = useRef(foregroundObservation);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const batchStopRef = useRef(false);
  const activeBatchRequestRef = useRef<AbortController | null>(null);
  useEffect(() => {
    const savedTheme = window.localStorage.getItem("mindmap.theme");
    if (savedTheme !== "light") return;
    const frame = window.requestAnimationFrame(() => setTheme("light"));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    let active = true;
    let observation = startupObservationRef.current;
    const operationId = observation.operationId;
    const legacyThoughts = localStorage.getItem("mindmap.thoughts");
    const legacyLinks = localStorage.getItem("mindmap.links");
    const seed = {
      thoughts: legacyThoughts ? (JSON.parse(legacyThoughts) as Thought[]) : INITIAL_THOUGHTS,
      links: legacyLinks ? (JSON.parse(legacyLinks) as ThoughtLink[]) : INITIAL_LINKS,
      nodes: INITIAL_NODES,
      decisions: INITIAL_DECISIONS,
    };
    loadSnapshot(seed)
      .then((snapshot) => {
        if (!active) return;
        setThoughts(snapshot.thoughts as Thought[]);
        setLinks(snapshot.links as ThoughtLink[]);
        setNodes(snapshot.nodes as KnowledgeNode[]);
        setDecisions(snapshot.decisions);
        const restoredProgress = restoreBatchProgress(snapshot.decisions, SYNTHETIC_TEST_TOTAL);
        const checkpointExecution = restoreCheckpointExecutionContext(
          snapshot.decisions,
          restoredProgress.runId,
          restoredProgress.stage,
        );
        const checkpointObservation = restoredProgress.runId
          && restoredProgress.stage
          && restoredProgress.checkpointAt
          ? observationFromCheckpoint({
              operationId: restoredProgress.runId,
              stageKey: restoredProgress.stage,
              stageLabel: pipelineStageLabel(restoredProgress.stage),
              checkpointAt: restoredProgress.checkpointAt,
              workKind: checkpointExecution.workKind,
              modelLabel: checkpointExecution.modelLabel,
              activity: restoredProgress.interruptedByReload
                ? "Состояние восстановлено после перезагрузки. Продолжение возможно только после явного подтверждения."
                : "Сохранённый checkpoint восстановлен. Процесс сейчас не выполняется.",
              completed: restoredProgress.stageCompleted,
              total: restoredProgress.stageTotal,
            })
          : undefined;
        setBatchProgress({ ...restoredProgress, observation: checkpointObservation });
        localStorage.removeItem("mindmap.thoughts");
        localStorage.removeItem("mindmap.links");
        setStorage("ready");
        setDatabaseReady(true);
        observation = updateOperationObservation(observation, {
          operationId,
          stageKey: "startup-recovery",
          stageLabel: "восстановление локального состояния",
          workKind: "storage",
          runtimeState: "completed",
          stallAfterMs: 30_000,
          modelLabel: "без AI",
          activity: "Локальная база и журнал checkpoint восстановлены.",
        });
        setForegroundObservation(observation);
      })
      .catch(() => {
        setStorage("error");
        observation = updateOperationObservation(observation, {
          operationId,
          stageKey: "startup-recovery",
          stageLabel: "восстановление локального состояния",
          workKind: "storage",
          runtimeState: "stopped",
          stallAfterMs: 30_000,
          modelLabel: "без AI",
          activity: "Восстановление локальной базы остановлено с ошибкой. AI не запускался.",
        });
        setForegroundObservation(observation);
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!databaseReady) return;
    const timeout = window.setTimeout(() => {
      setStorage("saving");
      saveSnapshot({ thoughts, links, nodes, decisions })
        .then(() => setStorage("ready"))
        .catch(() => setStorage("error"));
    }, 220);
    return () => window.clearTimeout(timeout);
  }, [databaseReady, thoughts, links, nodes, decisions]);

  useEffect(() => {
    const operationId = batchProgress.observation?.operationId;
    if (batchProgress.status !== "running" || !operationId) return;
    const timer = window.setInterval(() => {
      setBatchProgress((current) => {
        const observation = heartbeatOperation(current.observation, operationId);
        return observation ? { ...current, observation } : current;
      });
    }, 2_000);
    return () => window.clearInterval(timer);
  }, [batchProgress.status, batchProgress.observation?.operationId]);

  useEffect(() => {
    const operationId = foregroundObservation?.operationId;
    if (!operationId || !["working", "waiting_ai", "saving"].includes(foregroundObservation.runtimeState)) return;
    const timer = window.setInterval(() => {
      setForegroundObservation((current) => heartbeatOperation(current, operationId));
    }, 2_000);
    return () => window.clearInterval(timer);
  }, [foregroundObservation?.operationId, foregroundObservation?.runtimeState]);

  const pendingCount = links.filter((link) => link.status === "pending").length;
  const inboxCount = thoughts.filter((thought) => thought.status === "inbox").length;
  const offlineHierarchyReviewReady = [...decisions].reverse().find((decision) =>
    decisionRunId(decision) === batchProgress.runId
    && (decision.eventType === "batch_paused"
      || decision.eventType === "batch_failed"
      || decision.eventType === "batch_completed")
  )?.userAction === "offline_hierarchy_recovered_for_review";
  const foregroundVisible = batchProgress.status === "idle"
    && Boolean(foregroundObservation)
    && foregroundObservation?.runtimeState !== "completed";
  const displayedObservation = batchProgress.status !== "idle"
    ? batchProgress.observation
    : foregroundObservation;

  async function captureThought(event?: FormEvent) {
    event?.preventDefault();
    const content = draft.trim();
    if (!content || isAnalyzing) return;

    setIsAnalyzing(true);
    const decisionId = uid();
    const operationId = `thought-analysis-${decisionId}`;
    let indexedThoughts = thoughts;
    let newEmbedding: number[] | undefined;
    let workingDecisions = decisions;
    let observation = updateOperationObservation(undefined, {
      operationId,
      stageKey: "thought-embedding",
      stageLabel: "векторизация новой мысли",
      workKind: "storage",
      runtimeState: "saving",
      stallAfterMs: 75_000,
      modelLabel: "embeddinggemma",
      activity: "Сохраняю намерение AI-вызова до обращения к модели.",
      completed: 0,
      total: 2,
    });
    setForegroundObservation(observation);
    const recordDecision = async (decision: PersistedAiDecision) => {
      workingDecisions = [...workingDecisions, decision];
      await saveSnapshot({ thoughts, links, nodes, decisions: workingDecisions });
      setDecisions(workingDecisions);
    };
    try {
      const missingEmbeddings = thoughts.filter((thought) => !thought.embedding);
      const embeddingCallId = uid();
      await recordDecision({
        id: embeddingCallId,
        eventType: "pipeline_ai_call_planned",
        createdAt: new Date().toISOString(),
        engine: "offline",
        model: "embeddinggemma",
        input: {
          stage: "thought_embedding",
          attempt: 1,
          reason: "Подобрать локальный смысловой контекст для новой мысли.",
          expectedResult: "embedding_vector",
          recoverableFromCheckpoint: false,
          inputCount: missingEmbeddings.length + 1,
        },
        userAction: "explicit_add_thought",
      });
      observation = updateOperationObservation(observation, {
        operationId,
        stageKey: "thought-embedding",
        stageLabel: "векторизация новой мысли",
        workKind: "ai",
        runtimeState: "waiting_ai",
        stallAfterMs: 75_000,
        modelLabel: "embeddinggemma",
        activity: "Ожидаю локальные векторы. Автоматический повтор отключён.",
        completed: 0,
        total: 2,
      });
      setForegroundObservation(observation);
      const embeddingResponse = await fetch("/api/embed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inputs: [
            content,
            ...missingEmbeddings.map((thought) =>
              `${thought.title}\n${thought.content}\nПроект: ${thought.project}`,
            ),
          ],
        }),
      });
      await recordDecision({
        id: uid(),
        eventType: "pipeline_ai_call_completed",
        createdAt: new Date().toISOString(),
        engine: embeddingResponse.ok ? "ollama" : "offline",
        model: "embeddinggemma",
        input: {
          stage: "thought_embedding",
          attempt: 1,
          callId: embeddingCallId,
        },
        output: {
          completed: embeddingResponse.ok,
          status: embeddingResponse.status,
        },
        userAction: "ai_call_returned_without_retry",
      });
      if (embeddingResponse.ok) {
        const embedded = (await embeddingResponse.json()) as EmbeddingResponse;
        newEmbedding = embedded.embeddings[0];
        setEmbeddingEngine(embedded.engine);
        const byId = new Map(
          missingEmbeddings.map((thought, index) => [thought.id, embedded.embeddings[index + 1]]),
        );
        indexedThoughts = thoughts.map((thought) => ({
          ...thought,
          embedding: thought.embedding ?? byId.get(thought.id),
        }));
      } else {
        setEmbeddingEngine("unavailable");
      }
      const candidates = newEmbedding
        ? rankCandidates(newEmbedding, indexedThoughts).slice(0, 12)
        : indexedThoughts.slice(0, 16);
      const knowledgeContext = selectKnowledgeContext(nodes, candidates, content);
      const analysisPayload = {
        content,
        knowledgeNodes: knowledgeContext.map(({ id, name, kind, parentId }) => ({ id, name, kind, parentId })),
        thoughts: candidates.map(({ id, title, content: body, project, type, tags, nextStep, createdAt }) => ({
            id,
            title,
            content: body,
            project,
            type,
            tags,
            nextStep,
            createdAt,
        })),
      };
      const analysisCallId = uid();
      observation = updateOperationObservation(observation, {
        operationId,
        stageKey: "thought-analysis",
        stageLabel: "смысловой разбор новой мысли",
        workKind: "storage",
        runtimeState: "saving",
        stallAfterMs: 110_000,
        modelLabel: "локальная модель (уточняется)",
        activity: "Сохраняю намерение смыслового AI-вызова.",
        completed: 1,
        total: 2,
      });
      setForegroundObservation(observation);
      await recordDecision({
        id: analysisCallId,
        eventType: "pipeline_ai_call_planned",
        createdAt: new Date().toISOString(),
        engine: "offline",
        input: {
          stage: "thought_analysis",
          attempt: 1,
          reason: "Предложить тип, размещение, связи и следующий шаг.",
          expectedResult: "analysis_review",
          recoverableFromCheckpoint: false,
          candidateThoughtIds: candidates.map((thought) => thought.id),
          availableNodeIds: knowledgeContext.map((node) => node.id),
        },
        userAction: "explicit_add_thought",
      });
      observation = updateOperationObservation(observation, {
        operationId,
        stageKey: "thought-analysis",
        stageLabel: "смысловой разбор новой мысли",
        workKind: "ai",
        runtimeState: "waiting_ai",
        stallAfterMs: 110_000,
        modelLabel: "локальная модель (уточняется)",
        activity: "Ожидаю предложение локальной модели. Автоматический повтор отключён.",
        completed: 1,
        total: 2,
      });
      setForegroundObservation(observation);
      const analysis = await requestAnalysis(analysisPayload);
      await recordDecision({
        id: uid(),
        eventType: "pipeline_ai_call_completed",
        createdAt: new Date().toISOString(),
        engine: "ollama",
        model: analysis.model,
        input: {
          stage: "thought_analysis",
          attempt: 1,
          callId: analysisCallId,
        },
        output: { completed: true },
        userAction: "ai_call_returned_without_retry",
      });
      const proposedAt = new Date().toISOString();
      await recordDecision({
        id: decisionId,
        eventType: "analysis_proposed",
        createdAt: proposedAt,
        engine: "ollama",
        model: analysis.model,
        input: {
          rawContent: content,
          candidateThoughtIds: candidates.map((thought) => thought.id),
          availableNodeIds: knowledgeContext.map((node) => node.id),
        },
        output: {
          thought: analysis.thought,
          placement: analysis.placement,
          connections: analysis.connections,
          signals: analysis.signals,
          recovery: analysis.recovery,
        },
        userAction: "awaiting_review",
      });
      setAnalysisReview({
        decisionId,
        mode: "analyzed",
        rawContent: content,
        thought: analysis.thought,
        connections: analysis.connections,
        signals: analysis.signals,
        embedding: newEmbedding,
        indexedThoughts,
        placement: analysis.placement,
        model: analysis.model,
      });
      setDraft("");
      setEngine(analysis.engine);
      observation = updateOperationObservation(observation, {
        operationId,
        stageKey: "thought-analysis",
        stageLabel: "смысловой разбор новой мысли",
        workKind: "local",
        runtimeState: "completed",
        stallAfterMs: 30_000,
        modelLabel: analysis.model,
        activity: "Предложение сохранено и ждёт ручного подтверждения.",
        completed: 2,
        total: 2,
      });
      setForegroundObservation(observation);
    } catch {
      await recordDecision({
        id: decisionId,
        eventType: "analysis_proposed",
        createdAt: new Date().toISOString(),
        engine: "offline",
        input: { rawContent: content },
        output: { error: "local_ai_unavailable" },
        userAction: "awaiting_review",
      });
      setAnalysisReview({
        decisionId,
        mode: "offline",
        rawContent: content,
        thought: {
          title: draftTitle(content),
          content,
          type: "Не разобрано",
          project: "Без проекта",
          tags: [],
        },
        connections: [],
        signals: [],
        embedding: newEmbedding,
        indexedThoughts,
        placement: { primaryPath: [], additionalPaths: [] },
      });
      setDraft("");
      setEngine("offline");
      observation = updateOperationObservation(observation, {
        operationId,
        stageKey: observation.stageKey,
        stageLabel: observation.stageLabel,
        workKind: "local",
        runtimeState: "stopped",
        stallAfterMs: 30_000,
        modelLabel: observation.modelLabel,
        activity: "AI-вызов остановлен без автоматического повтора; мысль сохранена для ручного разбора.",
        completed: observation.completed,
        total: 2,
      });
      setForegroundObservation(observation);
    } finally {
      setIsAnalyzing(false);
    }
  }

  async function runSyntheticTest(
    restart = false,
    restoredDecisions?: PersistedAiDecision[],
    forceNewSameOrder = false,
  ) {
    if ((!databaseReady && !restoredDecisions) || batchProgress.status === "running") return;
    batchStopRef.current = false;
    const sourceDecisions = restoredDecisions ?? decisions;
    const previousRuns = sourceDecisions.filter((decision) => decision.eventType === "batch_started").length;
    const variants = ["round_robin", "original", "reverse", "seeded"] as const;
    const completedRunIds = new Set(sourceDecisions.filter((decision) => decision.eventType === "batch_completed").map((decision) => decisionRunId(decision)).filter(Boolean));
    const lastStart = [...sourceDecisions].reverse().find((decision) => decision.eventType === "batch_started");
    const lastRunId = lastStart ? decisionRunId(lastStart) : undefined;
    const resume = !restart && !forceNewSameOrder && Boolean(lastRunId && !completedRunIds.has(lastRunId));
    const previousInput = lastStart?.input as { orderVariant?: BatchProgress["orderVariant"] } | undefined;
    const orderVariant = (resume || forceNewSameOrder) && previousInput?.orderVariant
      ? previousInput.orderVariant
      : variants[previousRuns % variants.length];
    const runId = resume && lastRunId ? lastRunId : `v06-run-${String(previousRuns + 1).padStart(2, "0")}-${Date.now()}`;
    let working: WorkingSnapshot = { thoughts: [], links: [], nodes: [], decisions: restart ? [] : sourceDecisions };
    const startedAt = new Date().toISOString();
    working = {
      ...working,
      decisions: [...working.decisions, {
        id: uid(),
        eventType: "batch_started",
        createdAt: startedAt,
        engine: "user",
        input: {
          testDataset: "approved-96-v1",
          total: SYNTHETIC_TEST_TOTAL,
          restart,
          resume,
          runId,
          orderVariant,
          pipelineVersion: SEMANTIC_PIPELINE_VERSION,
          architecture: "global_extract_cluster_hierarchy_relations",
        },
        userAction: resume ? "resumed_v0.6_semantic_run" : "started_v0.6_semantic_run",
      }],
    };
    await saveSnapshot(working);
    setThoughts(working.thoughts);
    setLinks(working.links);
    setNodes(working.nodes);
    setDecisions(working.decisions);

    const sourceItems = orderSyntheticItems(SYNTHETIC_TEST_THOUGHTS, orderVariant);
    const restoredExtractions = resume ? pipelineOutputs<SemanticExtraction[]>(working.decisions, runId, "pipeline_extract", "items").flat() : [];
    const extractionByThought = new Map(restoredExtractions.map((item) => [item.thoughtId, item]));
    let completed = extractionByThought.size;
    const extractions: SemanticExtraction[] = [...extractionByThought.values()];
    const embeddings: Record<string, number[]> = resume
      ? Object.assign({}, ...working.decisions
        .filter((decision) => decision.eventType === "pipeline_embeddings" && decisionRunId(decision) === runId)
        .map((decision) => {
          const output = decision.output as { embeddings?: Record<string, number[]> } | undefined;
          return output?.embeddings ?? {};
        }))
      : {};
    let model: string | undefined;
    let currentStage: BatchProgress["stage"] = "preflight";
    let activeObservation = batchProgress.observation;
    const publishStage = (
      stage: NonNullable<BatchProgress["stage"]>,
      options: {
        stageCompleted?: number;
        stageTotal?: number;
        workKind?: OperationWorkKind;
        runtimeState?: OperationRuntimeState;
        activity?: string;
        progressed?: boolean;
        modelLabel?: string;
        stallAfterMs?: number;
      } = {},
    ) => {
      currentStage = stage;
      const defaults = pipelineStageObservationDefaults(stage, model);
      activeObservation = updateOperationObservation(activeObservation, {
        operationId: runId,
        stageKey: stage,
        stageLabel: pipelineStageLabel(stage),
        workKind: options.workKind ?? defaults.workKind,
        runtimeState: options.runtimeState ?? defaults.runtimeState,
        stallAfterMs: options.stallAfterMs ?? defaults.stallAfterMs,
        modelLabel: options.modelLabel ?? defaults.modelLabel,
        activity: options.activity ?? defaults.activity,
        completed: options.stageCompleted,
        total: options.stageTotal,
        progressed: options.progressed,
      });
      setBatchProgress({
        status: stage === "complete" ? "completed" : "running",
        completed,
        total: SYNTHETIC_TEST_TOTAL,
        stage,
        stageCompleted: options.stageCompleted,
        stageTotal: options.stageTotal,
        runId,
        orderVariant,
        observation: activeObservation,
      });
    };
    async function requestStage<T>(payload: Record<string, unknown>) {
      const controller = new AbortController();
      activeBatchRequestRef.current = controller;
      const requestStageName = String(payload.stage ?? currentStage ?? "unknown");
      const plannedAt = new Date().toISOString();
      const callId = uid();
      working.decisions.push({
        id: callId,
        eventType: "pipeline_ai_call_planned",
        createdAt: plannedAt,
        engine: "offline",
        model,
        input: {
          runId,
          stage: currentStage,
          requestStage: requestStageName,
          attempt: 1,
          reason: "Выполнить текущий смысловой микроэтап.",
          expectedResult: `${requestStageName}_validated_output`,
          recoverableFromCheckpoint: true,
          payload: summarizeSemanticPayload(payload),
        },
        userAction: "explicit_pipeline_continue",
      });
      publishStage(currentStage ?? "preflight", {
        workKind: "storage",
        runtimeState: "saving",
        activity: `Сохраняю намерение AI-вызова ${requestStageName} до отправки запроса.`,
        progressed: false,
        modelLabel: model ?? "локальная модель (уточняется)",
      });
      await saveSnapshot(working);
      setDecisions([...working.decisions]);
      publishStage(currentStage ?? "preflight", {
        workKind: "ai",
        runtimeState: "waiting_ai",
        activity: `Запрос ${requestStageName} отправлен. Повторных автоматических попыток нет.`,
        modelLabel: model ?? "локальная модель (уточняется)",
      });
      try {
        const response = await requestSemanticStage<T>(payload, controller.signal);
        const responseModel = (response as { model?: unknown }).model;
        if (model && typeof responseModel === "string" && responseModel !== model) {
          throw new Error(`model_changed_during_run|${model}|${responseModel}`);
        }
        if (typeof responseModel === "string") model = responseModel;
        working.decisions.push({
          id: uid(),
          eventType: "pipeline_ai_call_completed",
          createdAt: new Date().toISOString(),
          engine: "ollama",
          model,
          input: {
            runId,
            stage: currentStage,
            requestStage: requestStageName,
            callId,
            attempt: 1,
          },
          output: {
            completed: true,
            durationMs: Date.now() - Date.parse(plannedAt),
          },
          userAction: "ai_call_returned_without_retry",
        });
        publishStage(currentStage ?? "preflight", {
          workKind: "storage",
          runtimeState: "saving",
          activity: `Ответ ${requestStageName} получен; сохраняю подтверждение вызова.`,
          modelLabel: model ?? "локальная модель",
        });
        await saveSnapshot(working);
        setDecisions([...working.decisions]);
        return response;
      } finally {
        if (activeBatchRequestRef.current === controller) activeBatchRequestRef.current = null;
      }
    }
    try {
      const restoredPreflight = resume
        ? latestPipelineOutput<{ ok?: boolean; model?: string }>(working.decisions, runId, "pipeline_preflight")
        : undefined;
      publishStage("preflight", {
        stageCompleted: restoredPreflight?.ok ? 1 : 0,
        stageTotal: 1,
        activity: restoredPreflight?.ok
          ? "Проверка модели восстановлена из checkpoint; новый AI-вызов не требуется."
          : "Готовлю проверку локальной модели и строгого JSON-режима.",
        modelLabel: restoredPreflight?.model ?? model ?? "локальная модель (уточняется)",
      });
      if (!restoredPreflight?.ok) {
        const response = await requestStage<{
          ok: boolean;
          model: string;
          rawResponse: string;
          generation?: unknown;
          parseRecovery?: unknown;
        }>({ stage: "preflight" });
        const previousRunModel = [...working.decisions].reverse().find((decision) =>
          decisionRunId(decision) === runId
          && decision.engine === "ollama"
          && typeof decision.model === "string"
          && decision.eventType !== "pipeline_preflight"
        )?.model;
        if (previousRunModel && previousRunModel !== response.model) {
          throw new Error(`model_changed_during_run|${previousRunModel}|${response.model}`);
        }
        model = response.model;
        working.decisions.push(pipelineDecision(
          runId,
          "pipeline_preflight",
          model,
          { requiredCapability: "ollama_json_schema" },
          {
            ok: response.ok,
            model: response.model,
            rawResponse: response.rawResponse,
            generation: response.generation,
            parseRecovery: response.parseRecovery,
          },
        ));
        await saveSnapshot(working);
        setDecisions([...working.decisions]);
      } else {
        model = restoredPreflight.model
          ?? [...working.decisions].reverse().find((decision) => decision.eventType === "pipeline_preflight" && decisionRunId(decision) === runId)?.model;
      }

      currentStage = "extract";
      publishStage("extract", { stageCompleted: completed, stageTotal: SYNTHETIC_TEST_TOTAL });
      const pendingExtraction = sourceItems.filter((item) => !extractionByThought.has(syntheticThoughtId(item.number)));
      for (let offset = 0; offset < pendingExtraction.length; offset += SEMANTIC_STAGE_LIMITS.extractionBatch) {
        if (batchStopRef.current) throw new Error("pipeline_paused");
        const chunk = pendingExtraction
          .slice(offset, offset + SEMANTIC_STAGE_LIMITS.extractionBatch)
          .map((item) => ({ id: syntheticThoughtId(item.number), content: item.content }));
        const response = await requestStage<{ items: SemanticExtraction[]; model: string; rawResponse: string; generation?: unknown; parseRecovery?: unknown }>({ stage: "extract", thoughts: chunk });
        model = response.model;
        extractions.push(...response.items);
        completed = Math.min(SYNTHETIC_TEST_TOTAL, completed + chunk.length);
        working.decisions.push(pipelineDecision(runId, "pipeline_extract", model, { thoughtIds: chunk.map((item) => item.id) }, {
          items: response.items,
          rawResponse: response.rawResponse,
          generation: response.generation,
          parseRecovery: response.parseRecovery,
        }));
        await saveSnapshot(working);
        setDecisions([...working.decisions]);
        publishStage("extract", {
          stageCompleted: completed,
          stageTotal: SYNTHETIC_TEST_TOTAL,
          activity: `Сохранено извлечение ${completed} из ${SYNTHETIC_TEST_TOTAL} мыслей.`,
        });
      }

      currentStage = "embeddings";
      let embeddedCount = Object.keys(embeddings).length;
      publishStage("embeddings", { stageCompleted: embeddedCount, stageTotal: SYNTHETIC_TEST_TOTAL });
      const pendingEmbeddings = sourceItems.filter((item) => !embeddings[syntheticThoughtId(item.number)]);
      for (let offset = 0; offset < pendingEmbeddings.length; offset += 48) {
        if (batchStopRef.current) throw new Error("pipeline_paused");
        const chunk = pendingEmbeddings.slice(offset, offset + 48);
        const embeddingCallId = uid();
        working.decisions.push({
          id: embeddingCallId,
          eventType: "pipeline_ai_call_planned",
          createdAt: new Date().toISOString(),
          engine: "offline",
          model: "embeddinggemma",
          input: {
            runId,
            stage: "embeddings",
            requestStage: "embeddings",
            attempt: 1,
            reason: "Создать численные представления текущей пачки мыслей.",
            expectedResult: "embedding_vectors",
            recoverableFromCheckpoint: true,
            thoughtIds: chunk.map((item) => syntheticThoughtId(item.number)),
          },
          userAction: "explicit_pipeline_continue",
        });
        publishStage("embeddings", {
          stageCompleted: embeddedCount,
          stageTotal: SYNTHETIC_TEST_TOTAL,
          workKind: "storage",
          runtimeState: "saving",
          modelLabel: "embeddinggemma",
          activity: "Сохраняю намерение вызова embeddinggemma до отправки.",
          progressed: false,
        });
        await saveSnapshot(working);
        setDecisions([...working.decisions]);
        publishStage("embeddings", {
          stageCompleted: embeddedCount,
          stageTotal: SYNTHETIC_TEST_TOTAL,
          workKind: "ai",
          runtimeState: "waiting_ai",
          modelLabel: "embeddinggemma",
          activity: "Ожидаю векторы текущей пачки. Автоматический повтор отключён.",
        });
        const response = await fetch("/api/embed", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ inputs: chunk.map((item) => item.content) }) });
        if (!response.ok) {
          const failure = await response.json().catch(() => ({})) as { error?: string };
          throw new Error(failure.error || `embedding_stage_failed_${response.status}`);
        }
        const embedded = await response.json() as EmbeddingResponse;
        working.decisions.push({
          id: uid(),
          eventType: "pipeline_ai_call_completed",
          createdAt: new Date().toISOString(),
          engine: "ollama",
          model: "embeddinggemma",
          input: {
            runId,
            stage: "embeddings",
            requestStage: "embeddings",
            attempt: 1,
            callId: embeddingCallId,
          },
          output: {
            completed: true,
            vectorCount: embedded.embeddings.length,
          },
          userAction: "ai_call_returned_without_retry",
        });
        if (embedded.embeddings.length !== chunk.length) throw new Error(`incomplete_embeddings_${embedded.embeddings.length}_of_${chunk.length}`);
        const savedChunk: Record<string, number[]> = {};
        chunk.forEach((item, index) => {
          const id = syntheticThoughtId(item.number);
          embeddings[id] = embedded.embeddings[index];
          savedChunk[id] = embedded.embeddings[index];
        });
        embeddedCount = Object.keys(embeddings).length;
        working.decisions.push(pipelineDecision(runId, "pipeline_embeddings", model, { thoughtIds: Object.keys(savedChunk), embeddingModel: "embeddinggemma" }, { embeddings: savedChunk, embeddedCount }));
        await saveSnapshot(working);
        setDecisions([...working.decisions]);
        publishStage("embeddings", {
          stageCompleted: embeddedCount,
          stageTotal: SYNTHETIC_TEST_TOTAL,
          activity: `Сохранено ${embeddedCount} из ${SYNTHETIC_TEST_TOTAL} векторов.`,
          modelLabel: "embeddinggemma",
        });
      }
      setEmbeddingEngine("ollama");

      currentStage = "cluster";
      const restoredPlan = resume
        ? latestPipelineOutput<{ clusters: SemanticClusterPlan[]; model?: string; rawResponse?: string; validation?: unknown; generation?: unknown; parseRecovery?: unknown }>(working.decisions, runId, "pipeline_cluster_plan")
        : undefined;
      let clusterPlanResponse = restoredPlan;
      const restoredAssignments = resume
        ? pipelineOutputs<SemanticClusterAssignment[]>(working.decisions, runId, "pipeline_cluster_assignment", "assignments").flat()
        : [];
      const assignmentByThought = new Map(restoredAssignments.map((assignment) => [assignment.thoughtId, assignment]));
      publishStage("cluster", { stageCompleted: assignmentByThought.size, stageTotal: SYNTHETIC_TEST_TOTAL });
      if (!clusterPlanResponse) {
        clusterPlanResponse = await requestStage<{ clusters: SemanticClusterPlan[]; model: string; rawResponse: string; validation: unknown; generation?: unknown; parseRecovery?: unknown }>({ stage: "cluster_plan", extractions });
        model = clusterPlanResponse.model;
        working.decisions.push(pipelineDecision(runId, "pipeline_cluster_plan", model, { extractionCount: extractions.length, processingOrderPreserved: true }, {
          clusters: clusterPlanResponse.clusters,
          rawResponse: clusterPlanResponse.rawResponse,
          validation: clusterPlanResponse.validation,
          generation: clusterPlanResponse.generation,
          parseRecovery: clusterPlanResponse.parseRecovery,
        }));
        await saveSnapshot(working);
        setDecisions([...working.decisions]);
      }
      const clusterAssignmentSource = [...extractions];
      const pendingAssignments = clusterAssignmentSource.filter((extraction) => !assignmentByThought.has(extraction.thoughtId));
      for (let offset = 0; offset < pendingAssignments.length; offset += SEMANTIC_STAGE_LIMITS.clusterAssignmentBatch) {
        if (batchStopRef.current) throw new Error("pipeline_paused");
        const chunk = pendingAssignments.slice(offset, offset + SEMANTIC_STAGE_LIMITS.clusterAssignmentBatch);
        const response = await requestStage<{ assignments: SemanticClusterAssignment[]; model: string; rawResponse: string; validation: unknown; generation?: unknown; parseRecovery?: unknown }>({ stage: "cluster_assign", clusters: clusterPlanResponse.clusters, extractions: chunk });
        model = response.model;
        response.assignments.forEach((assignment) => assignmentByThought.set(assignment.thoughtId, assignment));
        working.decisions.push(pipelineDecision(runId, "pipeline_cluster_assignment", model, { thoughtIds: chunk.map((item) => item.thoughtId), clusterIds: clusterPlanResponse.clusters.map((cluster) => cluster.id) }, {
          assignments: response.assignments,
          rawResponse: response.rawResponse,
          validation: response.validation,
          generation: response.generation,
          parseRecovery: response.parseRecovery,
        }));
        await saveSnapshot(working);
        setDecisions([...working.decisions]);
        publishStage("cluster", {
          stageCompleted: assignmentByThought.size,
          stageTotal: SYNTHETIC_TEST_TOTAL,
          activity: `Сохранено кластерное назначение ${assignmentByThought.size} из ${SYNTHETIC_TEST_TOTAL} мыслей.`,
        });
      }
      let clusterResponse = resume
        ? latestPipelineOutput<{ clusters: SemanticCluster[]; model?: string; rawResponse?: string; validation?: unknown }>(working.decisions, runId, "pipeline_cluster")
        : undefined;
      if (!clusterResponse) {
        const built = buildClustersFromAssignments(clusterPlanResponse.clusters, [...assignmentByThought.values()], extractions.map((item) => item.thoughtId));
        if (built.issues.length) throw new Error(`invalid_clusters:${built.issues.map((issue) => issue.code).join(",")}`);
        clusterResponse = { clusters: built.clusters, model, rawResponse: clusterPlanResponse.rawResponse, validation: { valid: true, issues: [] } };
      }
      model = clusterResponse.model;
      if (!latestPipelineOutput(working.decisions, runId, "pipeline_cluster")) {
        working.decisions.push(pipelineDecision(runId, "pipeline_cluster", model, { extractionCount: extractions.length, processingOrderPreserved: true }, { clusters: clusterResponse.clusters, rawResponse: clusterResponse.rawResponse, validation: clusterResponse.validation }));
      }
      await saveSnapshot(working);

      currentStage = "hierarchy";
      const restoredHierarchyPlan = resume
        ? latestPipelineOutput<{ nodes: StrictHierarchyNode[]; model?: string; rawResponse?: string; validation?: unknown; generation?: unknown; parseRecovery?: unknown }>(working.decisions, runId, "pipeline_hierarchy_plan")
        : undefined;
      let hierarchyPlanResponse = restoredHierarchyPlan;
      const restoredHierarchyAssignments = resume
        ? pipelineOutputs<SemanticHierarchyAssignment[]>(working.decisions, runId, "pipeline_hierarchy_assignment", "assignments").flat()
        : [];
      const restoredHierarchyRepairs = resume
        ? pipelineOutputs<SemanticHierarchyRepairCheckpoint[]>(working.decisions, runId, "pipeline_hierarchy_repair", "repairCheckpoints").flat()
        : [];
      const restoredHierarchy = restoredHierarchyPlan
        ? reconcileHierarchyCheckpoints(
            clusterResponse.clusters,
            restoredHierarchyPlan.nodes,
            restoredHierarchyAssignments,
            restoredHierarchyRepairs,
          )
        : undefined;
      if (restoredHierarchy?.nodes.length) {
        hierarchyPlanResponse = {
          ...(hierarchyPlanResponse ?? { rawResponse: "", validation: { valid: true, issues: [] } }),
          nodes: restoredHierarchy.nodes,
        };
      }
      const hierarchyAssignmentByCluster = new Map(
        (restoredHierarchy?.assignments ?? restoredHierarchyAssignments)
          .map((assignment) => [assignment.clusterId, assignment]),
      );
      publishStage("hierarchy", {
        stageCompleted: hierarchyAssignmentByCluster.size,
        stageTotal: clusterResponse.clusters.length,
      });
      let hierarchyResponse = resume
        ? latestPipelineOutput<{
            nodes: StrictHierarchyNode[];
            placements: SemanticPlacement[];
            clusterLeafById: Record<string, string>;
            unresolvedClusterIds?: string[];
            unresolvedThoughtIds?: string[];
            model?: string;
            rawResponse?: string;
            validation?: unknown;
          }>(working.decisions, runId, "pipeline_hierarchy")
        : undefined;
      if (!hierarchyResponse) {
        if (!hierarchyPlanResponse) {
          hierarchyPlanResponse = await requestStage<{ nodes: StrictHierarchyNode[]; model: string; rawResponse: string; validation: unknown; generation?: unknown; parseRecovery?: unknown }>({
            stage: "hierarchy_plan",
            clusters: clusterResponse.clusters,
            extractions,
          });
          model = hierarchyPlanResponse.model;
          working.decisions.push(pipelineDecision(runId, "pipeline_hierarchy_plan", model, { clusterIds: clusterResponse.clusters.map((cluster) => cluster.id) }, {
            nodes: hierarchyPlanResponse.nodes,
            rawResponse: hierarchyPlanResponse.rawResponse,
            validation: hierarchyPlanResponse.validation,
            generation: hierarchyPlanResponse.generation,
            parseRecovery: hierarchyPlanResponse.parseRecovery,
          }));
          await saveSnapshot(working);
          setDecisions([...working.decisions]);
        }
        const hierarchySource = [...clusterResponse.clusters];
        const pendingHierarchyAssignments = hierarchySource.filter((cluster) => !hierarchyAssignmentByCluster.has(cluster.id));
        for (let offset = 0; offset < pendingHierarchyAssignments.length; offset += SEMANTIC_STAGE_LIMITS.hierarchyAssignmentBatch) {
          if (batchStopRef.current) throw new Error("pipeline_paused");
          const chunk = pendingHierarchyAssignments.slice(offset, offset + SEMANTIC_STAGE_LIMITS.hierarchyAssignmentBatch);
          const response = await requestStage<{ assignments: SemanticHierarchyAssignment[]; model: string; rawResponse: string; validation: unknown; generation?: unknown; parseRecovery?: unknown }>({ stage: "hierarchy_assign", clusters: chunk, nodes: hierarchyPlanResponse.nodes });
          model = response.model;
          response.assignments.forEach((assignment) => hierarchyAssignmentByCluster.set(assignment.clusterId, assignment));
          working.decisions.push(pipelineDecision(runId, "pipeline_hierarchy_assignment", model, { clusterIds: chunk.map((cluster) => cluster.id), directionIds: hierarchyPlanResponse.nodes.filter((node) => node.kind === "direction").map((node) => node.id) }, {
            assignments: response.assignments,
            rawResponse: response.rawResponse,
            validation: response.validation,
            generation: response.generation,
            parseRecovery: response.parseRecovery,
          }));
          await saveSnapshot(working);
          setDecisions([...working.decisions]);
          publishStage("hierarchy", {
            stageCompleted: hierarchyAssignmentByCluster.size,
            stageTotal: clusterResponse.clusters.length,
            activity: `Сохранено размещение ${hierarchyAssignmentByCluster.size} из ${clusterResponse.clusters.length} кластеров.`,
          });
        }
        for (let repairRound = restoredHierarchyRepairs.length; repairRound < 2; repairRound += 1) {
          const validDirectionIds = new Set(
            hierarchyPlanResponse.nodes
              .filter((node) => node.kind === "direction")
              .map((node) => node.id),
          );
          const uncovered = clusterResponse.clusters.filter((cluster) => {
            const directionId = hierarchyAssignmentByCluster.get(cluster.id)?.directionId;
            return !directionId || !validDirectionIds.has(directionId);
          });
          if (!uncovered.length) break;
          const response = await requestStage<{
            repairs: SemanticHierarchyRepair[];
            nodes: StrictHierarchyNode[];
            assignments: SemanticHierarchyAssignment[];
            model: string;
            rawResponse: string;
            validation: unknown;
            generation?: unknown;
            parseRecovery?: unknown;
          }>({
            stage: "hierarchy_repair",
            clusters: uncovered,
            nodes: hierarchyPlanResponse.nodes,
            extractions,
          });
          model = response.model;
          hierarchyPlanResponse = { ...hierarchyPlanResponse, nodes: response.nodes };
          response.assignments.forEach((assignment) => hierarchyAssignmentByCluster.set(assignment.clusterId, assignment));
          working.decisions.push(pipelineDecision(
            runId,
            "pipeline_hierarchy_repair",
            model,
            {
              round: repairRound + 1,
              uncoveredClusterIds: uncovered.map((cluster) => cluster.id),
              previousDirectionIds: hierarchyPlanResponse.nodes.filter((node) => node.kind === "direction").map((node) => node.id),
            },
            {
              repairCheckpoints: [{
                nodes: response.nodes,
                assignments: response.assignments,
              }],
              repairs: response.repairs,
              rawResponse: response.rawResponse,
              validation: response.validation,
              generation: response.generation,
              parseRecovery: response.parseRecovery,
            },
          ));
          await saveSnapshot(working);
          setDecisions([...working.decisions]);
          publishStage("hierarchy", {
            stageCompleted: hierarchyAssignmentByCluster.size,
            stageTotal: clusterResponse.clusters.length,
            activity: `Сохранён раунд ремонта иерархии ${repairRound + 1}.`,
          });
        }
        const finalDirectionIds = new Set(
          hierarchyPlanResponse.nodes
            .filter((node) => node.kind === "direction")
            .map((node) => node.id),
        );
        const stillUncovered = clusterResponse.clusters.filter((cluster) => {
          const directionId = hierarchyAssignmentByCluster.get(cluster.id)?.directionId;
          return !directionId || !finalDirectionIds.has(directionId);
        });
        const builtHierarchy = buildHierarchyFromAssignments(
          clusterResponse.clusters,
          hierarchyPlanResponse.nodes,
          [...hierarchyAssignmentByCluster.values()],
          { unresolvedClusterIds: stillUncovered.map((cluster) => cluster.id) },
        );
        if (builtHierarchy.issues.length) throw new Error(`invalid_hierarchy:${builtHierarchy.issues.map((issue) => issue.code).join(",")}`);
        hierarchyResponse = {
          ...builtHierarchy,
          model,
          rawResponse: hierarchyPlanResponse.rawResponse,
          validation: {
            valid: true,
            issues: [],
            unresolvedClusterIds: builtHierarchy.unresolvedClusterIds,
            unresolvedThoughtIds: builtHierarchy.unresolvedThoughtIds,
          },
        };
      }
      model = hierarchyResponse.model;
      if (!latestPipelineOutput(working.decisions, runId, "pipeline_hierarchy")) {
        working.decisions.push(pipelineDecision(
          runId,
          "pipeline_hierarchy",
          model,
          { clusterIds: clusterResponse.clusters.map((cluster) => cluster.id) },
          {
            nodes: hierarchyResponse.nodes,
            placements: hierarchyResponse.placements,
            clusterLeafById: hierarchyResponse.clusterLeafById,
            unresolvedClusterIds: hierarchyResponse.unresolvedClusterIds ?? [],
            unresolvedThoughtIds: hierarchyResponse.unresolvedThoughtIds ?? [],
            rawResponse: hierarchyResponse.rawResponse,
            validation: hierarchyResponse.validation,
          },
        ));
      }

      if (hierarchyResponse.unresolvedThoughtIds?.length) {
        const unresolvedThoughtIds = new Set(hierarchyResponse.unresolvedThoughtIds);
        const extractionById = new Map(extractions.map((item) => [item.thoughtId, item]));
        const placementById = new Map(hierarchyResponse.placements.map((item) => [item.thoughtId, item]));
        const nodeById = new Map(hierarchyResponse.nodes.map((node) => [node.id, node]));
        const createdAt = new Date().toISOString();
        const previewNodes: KnowledgeNode[] = hierarchyResponse.nodes.map((node) => ({
          ...node,
          createdAt,
          source: "ai",
          status: "active",
          reason: `Глобальный пакетный конвейер ${SEMANTIC_PIPELINE_VERSION}.`,
        }));
        const previewThoughts: Thought[] = sourceItems.flatMap((item) => {
          const id = syntheticThoughtId(item.number);
          const extraction = extractionById.get(id);
          if (!extraction) return [];
          const placement = placementById.get(id);
          const leaf = placement ? nodeById.get(placement.primaryNodeId) : undefined;
          return [{
            id,
            title: extraction.title,
            content: item.content,
            originalContent: item.content,
            type: displayThoughtType(extraction.thoughtType),
            project: unresolvedThoughtIds.has(id)
              ? "Не определено"
              : leaf?.kind === "project"
                ? leaf.name
                : "Без проекта",
            tags: extraction.entities.slice(0, 4),
            summary: extraction.summary,
            nextStep: extraction.nextStep,
            createdAt,
            status: "inbox" as const,
            embedding: embeddings[id],
            primaryNodeId: placement?.primaryNodeId,
            additionalNodeIds: [],
          }];
        });
        const pausedDecision: PersistedAiDecision = {
          id: uid(),
          eventType: "batch_paused",
          createdAt,
          engine: "offline",
          input: {
            runId,
            orderVariant,
            completed: SYNTHETIC_TEST_TOTAL,
            stage: "hierarchy",
            zeroModelCallsAfterUnresolved: true,
          },
          output: {
            error: "hierarchy_review_ready_with_unresolved",
            unresolvedClusterIds: hierarchyResponse.unresolvedClusterIds ?? [],
            unresolvedThoughtIds: hierarchyResponse.unresolvedThoughtIds,
            message: "Иерархия сохранена с честно неразмещёнными мыслями. Этап связей не запускался.",
          },
          userAction: "offline_hierarchy_recovered_for_review",
        };
        working = {
          thoughts: previewThoughts,
          links: [],
          nodes: previewNodes,
          decisions: [...working.decisions, pausedDecision],
        };
        await saveSnapshot(working);
        setThoughts(previewThoughts);
        setLinks([]);
        setNodes(previewNodes);
        setDecisions(working.decisions);
        activeObservation = updateOperationObservation(activeObservation, {
          operationId: runId,
          stageKey: "hierarchy",
          stageLabel: pipelineStageLabel("hierarchy"),
          workKind: "local",
          runtimeState: "paused",
          stallAfterMs: 30_000,
          modelLabel: model ?? "без AI",
          activity: "Иерархия сохранена и ждёт ручной проверки. Численные кандидаты не запускались.",
          completed: clusterResponse.clusters.length,
          total: clusterResponse.clusters.length,
        });
        setBatchProgress({
          status: "paused",
          completed: SYNTHETIC_TEST_TOTAL,
          total: SYNTHETIC_TEST_TOTAL,
          stage: "hierarchy",
          stageCompleted: clusterResponse.clusters.length,
          stageTotal: clusterResponse.clusters.length,
          runId,
          orderVariant,
          awaitingConfirmation: true,
          observation: activeObservation,
          error: `${hierarchyResponse.unresolvedThoughtIds.length} мысль(и/ей) осталась во «Входящих» без искусственного размещения. Численные кандидаты и связи не запускались; AI больше не вызывался.`,
        });
        setTab("inbox");
        return;
      }

      currentStage = "candidates";
      const candidatePairTotal = (Object.keys(embeddings).length * (Object.keys(embeddings).length - 1)) / 2;
      publishStage("candidates", {
        stageCompleted: 0,
        stageTotal: candidatePairTotal,
        workKind: "local",
        runtimeState: "working",
        modelLabel: "без AI",
      });
      const restoredCandidates = resume
        ? latestPipelineOutput<{ candidates: SemanticCandidate[] }>(working.decisions, runId, "pipeline_candidates")?.candidates
        : undefined;
      const candidates = restoredCandidates ?? await selectSemanticCandidatesIncremental(
        embeddings,
        DEFAULT_SEMANTIC_THRESHOLDS,
        (processedPairs, totalPairs) => {
          publishStage("candidates", {
            stageCompleted: processedPairs,
            stageTotal: totalPairs,
            workKind: "local",
            runtimeState: "working",
            modelLabel: "без AI",
            activity: `Проверено ${processedPairs} из ${totalPairs} численных пар.`,
          });
        },
      );
      if (!restoredCandidates) {
        working.decisions.push(pipelineDecision(
          runId,
          "pipeline_candidates",
          undefined,
          {
            thresholds: DEFAULT_SEMANTIC_THRESHOLDS,
            embeddingModel: "embeddinggemma",
            zeroModelCalls: true,
          },
          { candidates, candidateCount: candidates.length },
          "offline",
        ));
      }
      await saveSnapshot(working);

      currentStage = "relations";
      const restoredRelationDecisions = working.decisions.filter((decision) => decision.eventType === "pipeline_relations" && decisionRunId(decision) === runId);
      const judgments: SemanticRelation[] = restoredRelationDecisions.flatMap((decision) => {
        const output = decision.output as { judgments?: SemanticRelation[] } | undefined;
        return Array.isArray(output?.judgments) ? output.judgments : [];
      });
      const processedRelations = new Set(restoredRelationDecisions.flatMap((decision) => {
        const input = decision.input as { mode?: string; candidates?: SemanticCandidate[] } | undefined;
        return (input?.candidates ?? []).map((candidate) => `${input?.mode}:${semanticPairKey(candidate.sourceId, candidate.targetId)}`);
      }));
      const relationWorkTotal = candidates.reduce(
        (total, candidate) => total + candidate.purposes.filter((purpose) =>
          purpose === "related" || purpose === "duplicate" || purpose === "contradiction"
        ).length,
        0,
      );
      publishStage("relations", {
        stageCompleted: processedRelations.size,
        stageTotal: relationWorkTotal,
      });
      for (const mode of ["related", "duplicate", "contradiction"] as const) {
        const relevant = candidates.filter((candidate) => candidate.purposes.includes(mode) && !processedRelations.has(`${mode}:${semanticPairKey(candidate.sourceId, candidate.targetId)}`));
        for (let offset = 0; offset < relevant.length; offset += SEMANTIC_STAGE_LIMITS.relationBatch) {
          if (batchStopRef.current) throw new Error("pipeline_paused");
          const candidateChunk = relevant.slice(offset, offset + SEMANTIC_STAGE_LIMITS.relationBatch);
          const response = await requestStage<{ judgments: SemanticRelation[]; model: string; rawResponse: string; skipped?: string; generation?: unknown; parseRecovery?: unknown }>({ stage: "relations", mode, candidates: candidateChunk, extractions });
          model = response.model;
          judgments.push(...response.judgments);
          working.decisions.push(pipelineDecision(runId, "pipeline_relations", model, { mode, candidates: candidateChunk }, {
            judgments: response.judgments,
            rawResponse: response.rawResponse,
            skipped: response.skipped,
            generation: response.generation,
            parseRecovery: response.parseRecovery,
          }));
          await saveSnapshot(working);
          candidateChunk.forEach((candidate) => {
            processedRelations.add(`${mode}:${semanticPairKey(candidate.sourceId, candidate.targetId)}`);
          });
          publishStage("relations", {
            stageCompleted: processedRelations.size,
            stageTotal: relationWorkTotal,
            activity: `Проверено ${processedRelations.size} из ${relationWorkTotal} смысловых пар.`,
          });
        }
      }

      const extractionById = new Map(extractions.map((item) => [item.thoughtId, item]));
      const placementById = new Map(hierarchyResponse.placements.map((item) => [item.thoughtId, item]));
      const nodeById = new Map(hierarchyResponse.nodes.map((node) => [node.id, node]));
      const confirmed = judgments.filter((judgment) => judgment.verdict === "confirmed");
      const signalsByThought = new Map<string, AnalysisSignal[]>();
      confirmed.filter((item) => item.kind === "duplicate" || item.kind === "contradiction").forEach((item) => {
        const signal: AnalysisSignal = { kind: item.kind, targetId: item.targetId, message: item.reason };
        signalsByThought.set(item.sourceId, [...(signalsByThought.get(item.sourceId) ?? []), signal]);
      });
      const createdAt = new Date().toISOString();
      const translatedNodes: KnowledgeNode[] = hierarchyResponse.nodes.map((node) => ({ ...node, createdAt, source: "ai", status: "active", reason: `Глобальный пакетный конвейер ${SEMANTIC_PIPELINE_VERSION}.` }));
      const translatedThoughts: Thought[] = sourceItems.map((item) => {
        const id = syntheticThoughtId(item.number);
        const extraction = extractionById.get(id)!;
        const placement = placementById.get(id);
        const leaf = placement ? nodeById.get(placement.primaryNodeId) : undefined;
        return {
          id,
          title: extraction.title,
          content: item.content,
          originalContent: item.content,
          type: displayThoughtType(extraction.thoughtType),
          project: leaf?.kind === "project" ? leaf.name : "Без проекта",
          tags: extraction.entities.slice(0, 4),
          summary: extraction.summary,
          nextStep: extraction.nextStep,
          createdAt,
          status: "inbox",
          embedding: embeddings[id],
          signals: signalsByThought.get(id),
          primaryNodeId: placement?.primaryNodeId,
          additionalNodeIds: [],
        };
      });
      const translatedLinks: ThoughtLink[] = confirmed.map((judgment) => ({
        id: uid(), source: judgment.sourceId, target: judgment.targetId, type: displayLinkType(judgment.kind), reason: judgment.reason, confidence: judgment.confidence, status: "pending",
      }));
      working = { thoughts: translatedThoughts, links: translatedLinks, nodes: translatedNodes, decisions: working.decisions };
      const semanticMetrics = evaluateSyntheticHierarchy(
        hierarchyResponse.nodes,
        hierarchyResponse.placements,
      );
      working.decisions.push(pipelineDecision(runId, "pipeline_validated", model, { thoughts: translatedThoughts.length }, {
        valid: translatedThoughts.length === SYNTHETIC_TEST_TOTAL
          && translatedNodes.every((node) => node.kind !== "area" || !node.parentId)
          && semanticMetrics.passed,
        metrics: {
          thoughts: translatedThoughts.length,
          nodes: translatedNodes.length,
          proposedLinks: translatedLinks.length,
          candidates: candidates.length,
          confirmedRelations: confirmed.length,
          zeroCandidatePairsAllowed: true,
          semantic: semanticMetrics,
        },
      }));
      setThoughts(translatedThoughts); setLinks(translatedLinks); setNodes(translatedNodes); setDecisions([...working.decisions]);
      await saveSnapshot(working);
      if (!semanticMetrics.passed) {
        throw new Error(`semantic_quality_failed:${semanticMetrics.precision}:${semanticMetrics.recall}:${semanticMetrics.f1}`);
      }
      setEngine("ollama");
    } catch (error) {
      const rawMessage = error instanceof Error ? error.message : "Неизвестная ошибка локального AI.";
      const message = batchStopRef.current ? "pipeline_paused" : semanticErrorMessage(rawMessage);
      const paused = message === "pipeline_paused";
      const diagnostic = error instanceof SemanticStageError ? error.diagnostic : undefined;
      working.decisions.push({ id: uid(), eventType: paused ? "batch_paused" : "batch_failed", createdAt: new Date().toISOString(), engine: paused ? "user" : "offline", input: { runId, orderVariant, completed, stage: currentStage }, output: { error: message, diagnostic }, userAction: paused ? "paused_between_pipeline_stages" : "pipeline_stopped_without_partial_map" });
      await saveSnapshot(working); setDecisions([...working.decisions]);
      const stoppedStage = currentStage ?? "preflight";
      const stoppedDefaults = pipelineStageObservationDefaults(stoppedStage, model);
      activeObservation = updateOperationObservation(activeObservation, {
        operationId: runId,
        stageKey: stoppedStage,
        stageLabel: pipelineStageLabel(stoppedStage),
        workKind: activeObservation?.workKind ?? stoppedDefaults.workKind,
        runtimeState: paused ? "paused" : "stopped",
        stallAfterMs: activeObservation?.stallAfterMs ?? stoppedDefaults.stallAfterMs,
        modelLabel: activeObservation?.modelLabel ?? stoppedDefaults.modelLabel,
        activity: paused
          ? "Этап безопасно приостановлен. Продолжение требует явного действия."
          : "Этап остановлен с сохранением завершённых checkpoint. Автоповтора не будет.",
        completed: activeObservation?.completed,
        total: activeObservation?.total,
      });
      setBatchProgress({
        status: paused ? "paused" : "failed",
        completed,
        total: SYNTHETIC_TEST_TOTAL,
        stage: stoppedStage,
        stageCompleted: activeObservation.completed,
        stageTotal: activeObservation.total,
        error: paused ? undefined : message,
        runId,
        orderVariant,
        awaitingConfirmation: true,
        observation: activeObservation,
      });
      return;
    }

    const stopped = false;
    working = {
      ...working,
      decisions: [...working.decisions, {
        id: uid(),
        eventType: stopped ? "batch_paused" : "batch_completed",
        createdAt: new Date().toISOString(),
        engine: "user",
        input: { completed, total: SYNTHETIC_TEST_TOTAL, runId, orderVariant, pipelineVersion: SEMANTIC_PIPELINE_VERSION },
        output: { semanticPipeline: true },
        userAction: stopped ? "paused_between_pipeline_stages" : "semantic_test_run_completed",
      }],
    };
    await saveSnapshot(working);
    setDecisions(working.decisions);
    activeObservation = updateOperationObservation(activeObservation, {
      operationId: runId,
      stageKey: "complete",
      stageLabel: pipelineStageLabel("complete"),
      workKind: "storage",
      runtimeState: "completed",
      stallAfterMs: 30_000,
      modelLabel: model ?? "без AI",
      activity: "Итоговое состояние и проверка сохранены.",
      completed: SYNTHETIC_TEST_TOTAL,
      total: SYNTHETIC_TEST_TOTAL,
    });
    setBatchProgress({
      status: stopped ? "paused" : "completed",
      completed,
      total: SYNTHETIC_TEST_TOTAL,
      stage: "complete",
      runId,
      orderVariant,
      observation: activeObservation,
    });
    if (!stopped) setTab("map");
  }

  async function recoverFailedHierarchyOffline() {
    if (!databaseReady || batchProgress.status === "running" || !batchProgress.runId) return;
    const runId = batchProgress.runId;
    const orderVariant = batchProgress.orderVariant ?? "original";
    let recoveryObservation = updateOperationObservation(batchProgress.observation, {
      operationId: runId,
      stageKey: "hierarchy",
      stageLabel: "офлайн-восстановление иерархии",
      workKind: "local",
      runtimeState: "working",
      stallAfterMs: 30_000,
      modelLabel: "без AI",
      activity: "Сверяю сохранённые кластеры, назначения и checkpoint ремонта.",
      completed: 0,
      total: 4,
    });
    setBatchProgress((current) => ({
      ...current,
      status: "running",
      stage: "hierarchy",
      stageCompleted: 0,
      stageTotal: 4,
      observation: recoveryObservation,
    }));
    const stopOfflineRecovery = async (
      message: string,
      output: Record<string, unknown> = {},
    ) => {
      const failedDecision: PersistedAiDecision = {
        id: uid(),
        eventType: "batch_failed",
        createdAt: new Date().toISOString(),
        engine: "offline",
        input: {
          runId,
          orderVariant,
          stage: "hierarchy",
          recoveryMode: "offline_checkpoint_reconciliation",
          zeroModelCalls: true,
        },
        output: { error: message, ...output },
        userAction: "offline_recovery_stopped_before_model_call",
      };
      const nextDecisions = [...decisions, failedDecision];
      await saveSnapshot({ thoughts, links, nodes, decisions: nextDecisions });
      setDecisions(nextDecisions);
      recoveryObservation = updateOperationObservation(recoveryObservation, {
        operationId: runId,
        stageKey: "hierarchy",
        stageLabel: "офлайн-восстановление иерархии",
        workKind: "local",
        runtimeState: "stopped",
        stallAfterMs: 30_000,
        modelLabel: "без AI",
        activity: "Офлайн-восстановление остановлено валидатором. AI не запускался.",
        completed: recoveryObservation?.completed,
        total: 4,
      });
      setBatchProgress((current) => ({
        ...current,
        status: "failed",
        error: message,
        awaitingConfirmation: true,
        observation: recoveryObservation,
      }));
    };
    const clusterResponse = latestPipelineOutput<{ clusters: SemanticCluster[] }>(
      decisions,
      runId,
      "pipeline_cluster",
    );
    const hierarchyPlan = latestPipelineOutput<{ nodes: StrictHierarchyNode[] }>(
      decisions,
      runId,
      "pipeline_hierarchy_plan",
    );
    if (!clusterResponse?.clusters.length || !hierarchyPlan?.nodes.length) {
      await stopOfflineRecovery(
        "Офлайн-восстановление невозможно: в журнале нет полного списка кластеров или исходного каркаса. AI не запускался.",
        {
          missingClusterSnapshot: !clusterResponse?.clusters.length,
          missingHierarchyPlan: !hierarchyPlan?.nodes.length,
        },
      );
      return;
    }

    const hierarchyAssignments = pipelineOutputs<SemanticHierarchyAssignment[]>(
      decisions,
      runId,
      "pipeline_hierarchy_assignment",
      "assignments",
    ).flat();
    const repairCheckpoints = pipelineOutputs<SemanticHierarchyRepairCheckpoint[]>(
      decisions,
      runId,
      "pipeline_hierarchy_repair",
      "repairCheckpoints",
    ).flat();
    const recovered = reconcileHierarchyCheckpoints(
      clusterResponse.clusters,
      hierarchyPlan.nodes,
      hierarchyAssignments,
      repairCheckpoints,
    );
    recoveryObservation = updateOperationObservation(recoveryObservation, {
      operationId: runId,
      stageKey: "hierarchy",
      stageLabel: "офлайн-восстановление иерархии",
      workKind: "local",
      runtimeState: "working",
      stallAfterMs: 30_000,
      modelLabel: "без AI",
      activity: "Checkpoint иерархии согласованы; проверяю ссылочную целостность.",
      completed: 1,
      total: 4,
    });
    setBatchProgress((current) => ({ ...current, stageCompleted: 1, stageTotal: 4, observation: recoveryObservation }));
    const structuralIssues = recovered.issues;
    const unresolvedProblems = recovered.problems.filter(
      (problem) => problem.reason === "unresolved_direction",
    );
    const blockingProblems = recovered.problems.filter(
      (problem) => problem.reason !== "unresolved_direction",
    );
    const built = blockingProblems.length || structuralIssues.length
      ? undefined
      : buildHierarchyFromAssignments(
          clusterResponse.clusters,
          recovered.nodes,
          recovered.assignments,
          { unresolvedClusterIds: unresolvedProblems.map((problem) => problem.clusterId) },
        );
    const buildIssues = built?.issues ?? [];
    if (!built || buildIssues.length) {
      const problems = blockingProblems.map((problem) => ({
        clusterId: problem.clusterId,
        directionId: problem.directionId,
        reason: problem.reason,
        affectedThoughtIds: problem.affectedThoughtIds,
      }));
      const problemSummary = problems.slice(0, 3).map((problem) =>
        `${problem.clusterId}: ${problem.reason}`
        + `${problem.directionId ? ` (${problem.directionId})` : ""}`
        + `, мыслей ${problem.affectedThoughtIds.length}`
      ).join("; ");
      const issueCodes = [...new Set(
        [...structuralIssues, ...buildIssues].map((issue) => issue.code),
      )];
      const message = problems.length
        ? `Офлайн-восстановление остановлено: не удалось однозначно собрать ${problems.length} кластер(а/ов). ${problemSummary}. AI не запускался.`
        : `Офлайн-восстановление остановлено валидатором: ${issueCodes.join(", ")}. AI не запускался.`;
      await stopOfflineRecovery(message, {
        problems,
        issues: [...structuralIssues, ...buildIssues],
      });
      return;
    }

    const extractionItems = pipelineOutputs<SemanticExtraction[]>(
      decisions,
      runId,
      "pipeline_extract",
      "items",
    ).flat();
    const extractionById = new Map(extractionItems.map((item) => [item.thoughtId, item]));
    const embeddings: Record<string, number[]> = Object.assign({}, ...decisions
      .filter((decision) => decision.eventType === "pipeline_embeddings" && decisionRunId(decision) === runId)
      .map((decision) => {
        const output = decision.output as { embeddings?: Record<string, number[]> } | undefined;
        return output?.embeddings ?? {};
      }));
    const placementById = new Map(built.placements.map((item) => [item.thoughtId, item]));
    const nodeById = new Map(built.nodes.map((node) => [node.id, node]));
    const createdAt = new Date().toISOString();
    const previewNodes: KnowledgeNode[] = built.nodes.map((node) => ({
      ...node,
      createdAt,
      source: "migration",
      status: "active",
      reason: "Офлайн-восстановление сохранённых checkpoint без обращения к модели.",
    }));
    const unresolvedThoughtIds = new Set(built.unresolvedThoughtIds);
    const previewThoughts: Thought[] = SYNTHETIC_TEST_THOUGHTS.flatMap((item) => {
      const id = syntheticThoughtId(item.number);
      const extraction = extractionById.get(id);
      const placement = placementById.get(id);
      const leaf = placement ? nodeById.get(placement.primaryNodeId) : undefined;
      if (!extraction) return [];
      return [{
        id,
        title: extraction.title,
        content: item.content,
        originalContent: item.content,
        type: displayThoughtType(extraction.thoughtType),
        project: unresolvedThoughtIds.has(id)
          ? "Не определено"
          : leaf?.kind === "project"
            ? leaf.name
            : "Без проекта",
        tags: extraction.entities.slice(0, 4),
        summary: extraction.summary,
        nextStep: extraction.nextStep,
        createdAt,
        status: "inbox" as const,
        embedding: embeddings[id],
        primaryNodeId: placement?.primaryNodeId,
        additionalNodeIds: [],
      }];
    });
    recoveryObservation = updateOperationObservation(recoveryObservation, {
      operationId: runId,
      stageKey: "hierarchy",
      stageLabel: "офлайн-восстановление иерархии",
      workKind: "local",
      runtimeState: "working",
      stallAfterMs: 30_000,
      modelLabel: "без AI",
      activity: `Собрано ${previewThoughts.length} из ${SYNTHETIC_TEST_TOTAL} мыслей; проверяю полноту.`,
      completed: 2,
      total: 4,
    });
    setBatchProgress((current) => ({ ...current, stageCompleted: 2, stageTotal: 4, observation: recoveryObservation }));
    if (previewThoughts.length !== SYNTHETIC_TEST_TOTAL) {
      await stopOfflineRecovery(
        `Офлайн-восстановление собрало ${previewThoughts.length} из ${SYNTHETIC_TEST_TOTAL} мыслей. AI не запускался.`,
        {
          restoredThoughts: previewThoughts.length,
          expectedThoughts: SYNTHETIC_TEST_TOTAL,
          missingThoughtIds: SYNTHETIC_TEST_THOUGHTS
            .map((item) => syntheticThoughtId(item.number))
            .filter((thoughtId) => !extractionById.has(thoughtId)),
        },
      );
      return;
    }

    const hierarchyDecision = pipelineDecision(
      runId,
      "pipeline_hierarchy",
      undefined,
      {
        clusterIds: clusterResponse.clusters.map((cluster) => cluster.id),
        recoveryMode: "offline_checkpoint_reconciliation",
        zeroModelCalls: true,
        sourceRepairCheckpoints: repairCheckpoints.length,
      },
      {
        nodes: built.nodes,
        placements: built.placements,
        clusterLeafById: built.clusterLeafById,
        unresolvedClusterIds: built.unresolvedClusterIds,
        unresolvedThoughtIds: built.unresolvedThoughtIds,
        validation: {
          valid: true,
          issues: [],
          unresolvedClusterIds: built.unresolvedClusterIds,
          unresolvedThoughtIds: built.unresolvedThoughtIds,
        },
        recovery: {
          zeroModelCalls: true,
          restoredNodes: recovered.nodes.length,
          restoredAssignments: recovered.assignments.length,
          unresolvedClusters: built.unresolvedClusterIds.length,
          unresolvedThoughts: built.unresolvedThoughtIds.length,
        },
      },
      "offline",
    );
    const pausedDecision: PersistedAiDecision = {
      id: uid(),
      eventType: "batch_paused",
      createdAt,
      engine: "offline",
      input: {
        runId,
        orderVariant,
        completed: SYNTHETIC_TEST_TOTAL,
        stage: "hierarchy",
        recoveryMode: "offline_checkpoint_reconciliation",
        zeroModelCalls: true,
      },
      output: {
        error: "hierarchy_review_ready",
        unresolvedClusterIds: built.unresolvedClusterIds,
        unresolvedThoughtIds: built.unresolvedThoughtIds,
        message: built.unresolvedThoughtIds.length
          ? "Иерархия восстановлена без AI; неразмещённые мысли оставлены во «Входящих». Этап связей ещё не запускался."
          : "Иерархия восстановлена из сохранённых данных без AI. Сначала проверьте карту; этап связей ещё не запускался.",
      },
      userAction: "offline_hierarchy_recovered_for_review",
    };
    const nextDecisions = [...decisions, hierarchyDecision, pausedDecision];
    const nextSnapshot: WorkingSnapshot = {
      thoughts: previewThoughts,
      links: [],
      nodes: previewNodes,
      decisions: nextDecisions,
    };
    recoveryObservation = updateOperationObservation(recoveryObservation, {
      operationId: runId,
      stageKey: "hierarchy",
      stageLabel: "офлайн-восстановление иерархии",
      workKind: "storage",
      runtimeState: "saving",
      stallAfterMs: 30_000,
      modelLabel: "без AI",
      activity: "Сохраняю восстановленную иерархию и контрольную точку ручной проверки.",
      completed: 3,
      total: 4,
    });
    setBatchProgress((current) => ({ ...current, stageCompleted: 3, stageTotal: 4, observation: recoveryObservation }));
    await saveSnapshot(nextSnapshot);
    setThoughts(previewThoughts);
    setLinks([]);
    setNodes(previewNodes);
    setDecisions(nextDecisions);
    recoveryObservation = updateOperationObservation(recoveryObservation, {
      operationId: runId,
      stageKey: "hierarchy",
      stageLabel: "офлайн-восстановление иерархии",
      workKind: "local",
      runtimeState: "paused",
      stallAfterMs: 30_000,
      modelLabel: "без AI",
      activity: "Иерархия восстановлена и ждёт ручной проверки. Численные кандидаты не запускались.",
      completed: 4,
      total: 4,
    });
    setBatchProgress({
      status: "paused",
      completed: SYNTHETIC_TEST_TOTAL,
      total: SYNTHETIC_TEST_TOTAL,
      stage: "hierarchy",
      stageCompleted: 4,
      stageTotal: 4,
      runId,
      orderVariant,
      awaitingConfirmation: true,
      observation: recoveryObservation,
      error: built.unresolvedThoughtIds.length
        ? `Иерархия восстановлена офлайн: ${built.unresolvedThoughtIds.length} мысль(и/ей) оставлена во «Входящих» без искусственного размещения. Численные кандидаты и связи не запускались; DeepSeek не вызывался.`
        : "Иерархия восстановлена офлайн, без обращения к DeepSeek. Численные кандидаты и связи ещё не запускались; сначала проверьте карту.",
    });
    setTab(built.unresolvedThoughtIds.length ? "inbox" : "map");
  }

  function pauseSyntheticTest() {
    batchStopRef.current = true;
    activeBatchRequestRef.current?.abort();
  }

  async function restartSyntheticTest() {
    if (!confirm("Удалить текущие результаты теста и заново прогнать все 96 мыслей?")) return;
    await runSyntheticTest(true);
  }

  async function startNewSelectedModelRun() {
    let configured: { model: string; engine: "ollama"; pipelineVersion: string };
    try {
      configured = await requestConfiguredSemanticModel();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Не удалось прочитать выбранную модель.";
      setBatchProgress((current) => ({
        ...current,
        status: "paused",
        awaitingConfirmation: true,
        continuationBlock: { code: "model_config_unavailable" },
        error: `${message} Новый run не начат; AI-вызов не выполнен.`,
      }));
      return;
    }
    const orderVariant = batchProgress.orderVariant ?? "original";
    const confirmed = confirm(`Начать отдельный чистый run на модели ${configured.model} в порядке ${orderVariant}? История прежнего run сохранится. После подтверждения начнётся новый AI-прогон.`);
    if (!confirmed) return;
    await runSyntheticTest(false, undefined, true);
  }

  async function calculateCandidatesWithoutAi() {
    if (!databaseReady || batchProgress.status === "running") return;
    const runId = batchProgress.runId;
    const assessment = assessOfflineCandidateCheckpoint(
      decisions,
      runId,
      SYNTHETIC_TEST_TOTAL,
    );
    if (!runId || !assessment.ready) {
      const reason = assessment.reason === "incomplete_embeddings"
        ? `Сохранено ${assessment.embeddingCount} из ${SYNTHETIC_TEST_TOTAL} векторов. Локальный расчёт не начат.`
        : "Подтверждённая офлайн-пауза иерархии не найдена. Локальный расчёт не начат.";
      setBatchProgress((current) => ({
        ...current,
        status: "failed",
        awaitingConfirmation: true,
        error: `${reason} AI не запускался.`,
      }));
      return;
    }

    const orderVariant = batchProgress.orderVariant ?? "original";
    const embeddings: Record<string, number[]> = Object.assign({}, ...decisions
      .filter((decision) => decision.eventType === "pipeline_embeddings" && decisionRunId(decision) === runId)
      .map((decision) => {
        const output = decision.output as { embeddings?: Record<string, number[]> } | undefined;
        return output?.embeddings ?? {};
      }));
    const candidatePairTotal = (assessment.embeddingCount * (assessment.embeddingCount - 1)) / 2;
    let observation = updateOperationObservation(batchProgress.observation, {
      operationId: runId,
      stageKey: "candidates",
      stageLabel: pipelineStageLabel("candidates"),
      workKind: "local",
      runtimeState: "working",
      stallAfterMs: 20_000,
      modelLabel: "без AI",
      activity: assessment.unresolvedThoughtCount
        ? `Иерархия уже подтверждена; ${assessment.unresolvedThoughtCount} мысль остаётся во «Входящих». Сравниваю сохранённые векторы.`
        : "Иерархия уже подтверждена. Сравниваю сохранённые векторы.",
      completed: 0,
      total: candidatePairTotal,
    });
    setBatchProgress({
      status: "running",
      completed: SYNTHETIC_TEST_TOTAL,
      total: SYNTHETIC_TEST_TOTAL,
      stage: "candidates",
      stageCompleted: 0,
      stageTotal: candidatePairTotal,
      runId,
      orderVariant,
      observation,
    });

    try {
      const restoredCandidates = latestPipelineOutput<{ candidates: SemanticCandidate[] }>(
        decisions,
        runId,
        "pipeline_candidates",
      )?.candidates;
      const candidates = restoredCandidates ?? await selectSemanticCandidatesIncremental(
        embeddings,
        DEFAULT_SEMANTIC_THRESHOLDS,
        (processedPairs, totalPairs) => {
          observation = updateOperationObservation(observation, {
            operationId: runId,
            stageKey: "candidates",
            stageLabel: pipelineStageLabel("candidates"),
            workKind: "local",
            runtimeState: "working",
            stallAfterMs: 20_000,
            modelLabel: "без AI",
            activity: `Проверено ${processedPairs} из ${totalPairs} численных пар.`,
            completed: processedPairs,
            total: totalPairs,
          });
          setBatchProgress((current) => ({
            ...current,
            stageCompleted: processedPairs,
            stageTotal: totalPairs,
            observation,
          }));
        },
      );
      const nextDecisions = [...decisions];
      if (!restoredCandidates) {
        nextDecisions.push(pipelineDecision(
          runId,
          "pipeline_candidates",
          undefined,
          {
            thresholds: DEFAULT_SEMANTIC_THRESHOLDS,
            embeddingModel: "embeddinggemma",
            sourceCheckpoint: "offline_hierarchy_recovered_for_review",
            unresolvedThoughtCount: assessment.unresolvedThoughtCount,
            zeroModelCalls: true,
          },
          { candidates, candidateCount: candidates.length },
          "offline",
        ));
      }
      nextDecisions.push({
        id: uid(),
        eventType: "batch_paused",
        createdAt: new Date().toISOString(),
        engine: "offline",
        input: {
          runId,
          orderVariant,
          completed: SYNTHETIC_TEST_TOTAL,
          stage: "candidates",
          zeroModelCalls: true,
        },
        output: {
          message: `Численные кандидаты рассчитаны локально: ${candidates.length}. Проверка связей через AI не запускалась.`,
          candidateCount: candidates.length,
          unresolvedThoughtCount: assessment.unresolvedThoughtCount,
        },
        userAction: "candidates_ready_for_review",
      });
      observation = updateOperationObservation(observation, {
        operationId: runId,
        stageKey: "candidates",
        stageLabel: pipelineStageLabel("candidates"),
        workKind: "local",
        runtimeState: "paused",
        stallAfterMs: 20_000,
        modelLabel: "без AI",
        activity: "Кандидаты рассчитаны и сохранены. AI-проверка связей не запускалась.",
        completed: candidatePairTotal,
        total: candidatePairTotal,
      });
      await saveSnapshot({ thoughts, links, nodes, decisions: nextDecisions });
      setDecisions(nextDecisions);
      setEngine("offline");
      setBatchProgress({
        status: "paused",
        completed: SYNTHETIC_TEST_TOTAL,
        total: SYNTHETIC_TEST_TOTAL,
        stage: "candidates",
        stageCompleted: candidatePairTotal,
        stageTotal: candidatePairTotal,
        runId,
        orderVariant,
        awaitingConfirmation: true,
        observation,
        error: `Найдено ${candidates.length} численных кандидатов. AI-проверка связей не запускалась.`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Локальный расчёт кандидатов остановлен.";
      const failedDecision: PersistedAiDecision = {
        id: uid(),
        eventType: "batch_failed",
        createdAt: new Date().toISOString(),
        engine: "offline",
        input: {
          runId,
          orderVariant,
          stage: "candidates",
          zeroModelCalls: true,
        },
        output: { error: message },
        userAction: "offline_candidates_stopped_without_model_call",
      };
      const nextDecisions = [...decisions, failedDecision];
      await saveSnapshot({ thoughts, links, nodes, decisions: nextDecisions });
      setDecisions(nextDecisions);
      observation = updateOperationObservation(observation, {
        operationId: runId,
        stageKey: "candidates",
        stageLabel: pipelineStageLabel("candidates"),
        workKind: "local",
        runtimeState: "stopped",
        stallAfterMs: 20_000,
        modelLabel: "без AI",
        activity: "Локальный расчёт остановлен. AI не запускался.",
        completed: observation.completed,
        total: observation.total,
      });
      setBatchProgress((current) => ({
        ...current,
        status: "failed",
        awaitingConfirmation: true,
        error: `${message} AI не запускался.`,
        observation,
      }));
    }
  }

  async function continueSyntheticTestWithConfirmation() {
    if (batchProgress.stage === "candidates") {
      let configured: { model: string; engine: "ollama"; pipelineVersion: string };
      try {
        configured = await requestConfiguredSemanticModel();
      } catch (error) {
        const message = error instanceof Error ? error.message : "Не удалось прочитать выбранную модель.";
        const blocked: PersistedAiDecision = {
          id: uid(),
          eventType: "batch_continuation_blocked",
          createdAt: new Date().toISOString(),
          engine: "offline",
          input: {
            runId: batchProgress.runId,
            stage: "candidates",
            code: "model_config_unavailable",
            zeroModelCalls: true,
          },
          output: { message: `${message} AI-вызов не выполнен.` },
          userAction: "blocked_before_model_call",
        };
        const nextDecisions = [...decisions, blocked];
        await saveSnapshot({ thoughts, links, nodes, decisions: nextDecisions });
        setDecisions(nextDecisions);
        setBatchProgress((current) => ({
          ...current,
          status: "paused",
          awaitingConfirmation: true,
          continuationBlock: { code: "model_config_unavailable" },
          error: `${message} AI-вызов не выполнен.`,
        }));
        return;
      }
      const runModel = latestRunModel(decisions, batchProgress.runId);
      if (runModel && configured.model !== runModel) {
        const message = `Этот сохранённый run принадлежит модели ${runModel}, а приложение запущено с ${configured.model}. AI-вызов не выполнен. Запустите прежнюю модель для продолжения или начните отдельный чистый run на выбранной модели.`;
        const blocked: PersistedAiDecision = {
          id: uid(),
          eventType: "batch_continuation_blocked",
          createdAt: new Date().toISOString(),
          engine: "offline",
          input: {
            runId: batchProgress.runId,
            stage: "candidates",
            code: "model_mismatch",
            savedRunModel: runModel,
            configuredModel: configured.model,
            zeroModelCalls: true,
          },
          output: { message },
          userAction: "blocked_before_model_call",
        };
        const nextDecisions = [...decisions, blocked];
        await saveSnapshot({ thoughts, links, nodes, decisions: nextDecisions });
        setDecisions(nextDecisions);
        setBatchProgress((current) => ({
          ...current,
          status: "paused",
          awaitingConfirmation: true,
          continuationBlock: {
            code: "model_mismatch",
            runModel,
            configuredModel: configured.model,
          },
          error: message,
        }));
        return;
      }
      const confirmed = confirm(`Следующий этап отправит сохранённые пары модели ${configured.model} для проверки связей, дублей и противоречий. Продолжить?`);
      if (!confirmed) return;
    }
    await runSyntheticTest(false);
  }

  function saveAnalysisReview(
    thought: AnalysisResponse["thought"],
    selectedConnections: AnalysisResponse["connections"],
    placement: ProposedPlacement,
  ) {
    if (!analysisReview) return;
    const id = uid();
    const placed = materializePlacement(placement, nodes, uid);
    const newThought: Thought = {
      ...thought,
      content: analysisReview.rawContent,
      originalContent: analysisReview.rawContent,
      signals: analysisReview.signals,
      id,
      createdAt: new Date().toISOString(),
      status: analysisReview.mode === "analyzed" ? "active" : "inbox",
      embedding: analysisReview.embedding,
      primaryNodeId: placed.primaryNodeId,
      additionalNodeIds: placed.additionalNodeIds,
    };
    const newLinks: ThoughtLink[] = selectedConnections.map((connection) => ({
      id: uid(),
      source: id,
      target: connection.targetId,
      type: connection.type,
      reason: connection.reason,
      confidence: connection.confidence,
      status: "approved",
    }));
    setThoughts([newThought, ...analysisReview.indexedThoughts]);
    setNodes(placed.nodes);
    setLinks((current) => [...newLinks, ...current]);
    const savedAt = new Date().toISOString();
    setDecisions((current) => [
      ...current.map((decision) => decision.id === analysisReview.decisionId
        ? { ...decision, thoughtId: id, userAction: "accepted_after_review" }
        : decision),
      {
        id: uid(),
        thoughtId: id,
        eventType: "analysis_saved",
        createdAt: savedAt,
        engine: analysisReview.mode === "analyzed" ? "ollama" : "offline",
        model: analysisReview.model,
        input: { decisionId: analysisReview.decisionId },
        output: {
          thought: diagnosticThought(newThought),
          placement,
          createdNodeIds: placed.nodes
            .filter((node) => !nodes.some((currentNode) => currentNode.id === node.id))
            .map((node) => node.id),
          links: newLinks,
        },
        userAction: "saved",
      },
    ]);
    setAnalysisReview(null);
    setTab(analysisReview.mode === "analyzed" ? "today" : "inbox");
  }

  function cancelAnalysisReview() {
    if (analysisReview) {
      setDraft(analysisReview.rawContent);
      setDecisions((current) => [
        ...current.map((decision) => decision.id === analysisReview.decisionId
          ? { ...decision, userAction: "cancelled_after_review" }
          : decision),
        {
          id: uid(),
          eventType: "analysis_cancelled",
          createdAt: new Date().toISOString(),
          engine: analysisReview.mode === "analyzed" ? "ollama" : "offline",
          model: analysisReview.model,
          input: { decisionId: analysisReview.decisionId, rawContent: analysisReview.rawContent },
          userAction: "returned_to_text",
        },
      ]);
    }
    setAnalysisReview(null);
  }

  function toggleVoice() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Голосовой ввод не поддерживается этим браузером.");
      return;
    }
    if (isListening) {
      recognitionRef.current?.stop();
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = "ru-RU";
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.onresult = (event: SpeechResultEvent) => {
      let transcript = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        transcript += event.results[i][0].transcript;
      }
      setDraft((current) => `${current}${current ? " " : ""}${transcript}`);
    };
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);
    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }

  function updateLink(id: string, status: ThoughtLink["status"]) {
    const link = links.find((item) => item.id === id);
    setLinks((current) =>
      current.map((link) => (link.id === id ? { ...link, status } : link)),
    );
    if (link) setDecisions((current) => [...current, {
      id: uid(),
      thoughtId: link.source,
      eventType: "link_reviewed",
      createdAt: new Date().toISOString(),
      engine: "user",
      input: { link },
      userAction: status,
    }]);
  }

  function acceptThought(id: string) {
    setThoughts((current) =>
      current.map((thought) =>
        thought.id === id ? { ...thought, status: "active" } : thought,
      ),
    );
    setDecisions((current) => [...current, {
      id: uid(),
      thoughtId: id,
      eventType: "thought_accepted",
      createdAt: new Date().toISOString(),
      engine: "user",
      userAction: "accepted_from_inbox",
    }]);
  }

  function saveThought(updated: Thought) {
    const previous = thoughts.find((thought) => thought.id === updated.id);
    setThoughts((current) =>
      current.map((thought) =>
        thought.id === updated.id
          ? (() => {
              const meaningChanged =
                thought.title !== updated.title ||
                thought.content !== updated.content ||
                thought.project !== updated.project ||
                thought.primaryNodeId !== updated.primaryNodeId ||
                JSON.stringify(thought.additionalNodeIds ?? []) !== JSON.stringify(updated.additionalNodeIds ?? []);
              return {
                ...updated,
                embedding: meaningChanged ? undefined : thought.embedding,
                summary: meaningChanged ? undefined : thought.summary,
                signals: meaningChanged ? undefined : thought.signals,
              };
            })()
          : thought,
      ),
    );
    if (previous) setDecisions((current) => [...current, {
      id: uid(),
      thoughtId: updated.id,
      eventType: "thought_edited",
      createdAt: new Date().toISOString(),
      engine: "user",
      input: { before: diagnosticThought(previous) },
      output: { after: diagnosticThought(updated) },
      userAction: "saved_manual_edit",
    }]);
    setEditingThought(null);
  }

  function deleteThought(id: string) {
    const thought = thoughts.find((item) => item.id === id);
    if (!thought) return;
    if (!confirm(`Удалить мысль «${thought.title}» и все её связи?`)) return;
    setThoughts((current) => current.filter((item) => item.id !== id));
    setLinks((current) =>
      current.filter((link) => link.source !== id && link.target !== id),
    );
    setDecisions((current) => [...current, {
      id: uid(),
      thoughtId: id,
      eventType: "thought_deleted",
      createdAt: new Date().toISOString(),
      engine: "user",
      input: { deletedThought: diagnosticThought(thought) },
      userAction: "confirmed_delete",
    }]);
    setEditingThought(null);
  }

  async function downloadBackup() {
    const bytes = await exportDatabase();
    const blob = new Blob([bytes.slice().buffer], { type: "application/vnd.sqlite3" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `mindmap-${new Date().toISOString().slice(0, 10)}.sqlite`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function downloadDiagnostics() {
    const payload = {
      format: "mindmap-diagnostics",
      schemaVersion: 3,
      appVersion: "0.6.0-alpha.19",
      semanticPipelineVersion: SEMANTIC_PIPELINE_VERSION,
      sourceControl: BUILD_METADATA,
      exportedAt: new Date().toISOString(),
      notice: "Файл содержит тексты мыслей и историю решений AI. Передавайте его только тому, кому доверяете.",
      summary: {
        thoughts: thoughts.length,
        knowledgeNodes: nodes.length,
        links: links.length,
        aiDecisions: decisions.length,
        syntheticTestCompleted: thoughts.filter((thought) => thought.id.startsWith("synthetic-")).length,
      },
      syntheticTest: {
        dataset: "approved-96-v1",
        total: SYNTHETIC_TEST_TOTAL,
        processingOrder: batchProgress.orderVariant,
        runId: batchProgress.runId,
        completedRuns: decisions.filter((decision) => decision.eventType === "batch_completed").length,
        stability: semanticStability(decisions),
        invariant: "area -> direction -> optional project -> thought",
        thresholds: DEFAULT_SEMANTIC_THRESHOLDS,
        progress: batchProgress,
      },
      knowledgeNodes: nodes,
      thoughts: thoughts.map(diagnosticThought),
      links,
      aiDecisions: decisions,
    };
    downloadJson(payload, `mindmap-diagnostics-${new Date().toISOString().slice(0, 10)}.json`);
  }

  async function restoreBackup(file: File) {
    if (!confirm("Заменить текущую локальную базу данными из резервной копии?")) return;
    const operationId = `backup-restore-${Date.now()}`;
    let observation = updateOperationObservation(undefined, {
      operationId,
      stageKey: "backup-restore",
      stageLabel: "восстановление резервной копии",
      workKind: "storage",
      runtimeState: "working",
      stallAfterMs: 30_000,
      modelLabel: "без AI",
      activity: "Проверяю и импортирую локальную резервную копию.",
      completed: 0,
      total: 2,
    });
    setForegroundObservation(observation);
    try {
      setStorage("loading");
      await importDatabase(new Uint8Array(await file.arrayBuffer()));
      observation = updateOperationObservation(observation, {
        operationId,
        stageKey: "backup-restore",
        stageLabel: "восстановление резервной копии",
        workKind: "storage",
        runtimeState: "working",
        stallAfterMs: 30_000,
        modelLabel: "без AI",
        activity: "Копия импортирована; читаю и проверяю восстановленное состояние.",
        completed: 1,
        total: 2,
      });
      setForegroundObservation(observation);
      const snapshot = await loadSnapshot({
        thoughts: INITIAL_THOUGHTS,
        links: INITIAL_LINKS,
        nodes: INITIAL_NODES,
        decisions: INITIAL_DECISIONS,
      });
      setThoughts(snapshot.thoughts as Thought[]);
      setLinks(snapshot.links as ThoughtLink[]);
      setNodes(snapshot.nodes as KnowledgeNode[]);
      setDecisions(snapshot.decisions);
      setStorage("ready");
      observation = updateOperationObservation(observation, {
        operationId,
        stageKey: "backup-restore",
        stageLabel: "восстановление резервной копии",
        workKind: "storage",
        runtimeState: "completed",
        stallAfterMs: 30_000,
        modelLabel: "без AI",
        activity: "Резервная копия восстановлена и проверена.",
        completed: 2,
        total: 2,
      });
      setForegroundObservation(observation);
    } catch {
      setStorage("error");
      observation = updateOperationObservation(observation, {
        operationId,
        stageKey: "backup-restore",
        stageLabel: "восстановление резервной копии",
        workKind: "storage",
        runtimeState: "stopped",
        stallAfterMs: 30_000,
        modelLabel: "без AI",
        activity: "Восстановление резервной копии остановлено с ошибкой. AI не запускался.",
        completed: observation.completed,
        total: 2,
      });
      setForegroundObservation(observation);
      alert("Не удалось открыть резервную копию MindMap.");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  const shownThoughts = useMemo(() => {
    const needle = search.toLocaleLowerCase("ru");
    const allowedNodes = descendantNodeIds(nodes, activeScopeId);
    return thoughts.filter((thought) => {
      const nodeIds = [thought.primaryNodeId, ...(thought.additionalNodeIds ?? [])].filter(Boolean) as string[];
      const inScope = !activeScopeId || nodeIds.some((nodeId) => allowedNodes.has(nodeId));
      if (!inScope) return false;
      if (!needle) return true;
      const nodeNames = nodeIds
        .map((nodeId) => nodes.find((node) => node.id === nodeId)?.name ?? "")
        .filter(Boolean);
      return [thought.title, thought.content, thought.project, ...thought.tags, ...nodeNames]
        .join(" ")
        .toLocaleLowerCase("ru")
        .includes(needle);
    });
  }, [thoughts, nodes, activeScopeId, search]);

  return (
    <main className="app-shell" data-theme={theme}>
      <NeuralBackground theme={theme} />
      <aside className="sidebar">
        <button className="brand" onClick={() => { setActiveScopeId(undefined); setTab("map"); }}>
          <span className="brand-mark"><i /><i /><i /></span>
          <span>MindMap</span>
          <small>v0.6 alpha.19</small>
        </button>

        <nav className="main-nav" aria-label="Основная навигация">
          {NAV.map((item) => (
            <button
              key={item.id}
              className={tab === item.id ? "active" : ""}
              onClick={() => setTab(item.id)}
            >
              <span className="nav-glyph">{item.glyph}</span>
              {item.label}
              {item.id === "inbox" && (inboxCount > 0 || pendingCount > 0) && (
                <b>{inboxCount + pendingCount}</b>
              )}
            </button>
          ))}
        </nav>

        <div className="projects-nav">
          <p>Рабочие среды</p>
          {(nodes.some((node) => node.kind === "area" && node.status === "active")
            ? nodes.filter((node) => node.kind === "area" && node.status === "active")
            : nodes.filter((node) => !node.parentId && node.status === "active"))
            .sort((left, right) => left.name.localeCompare(right.name, "ru"))
            .slice(0, 6)
            .map((node, index) => (
            <button
              key={node.id}
              className={activeScopeId === node.id ? "active" : ""}
              onClick={() => { setActiveScopeId(node.id); setSearch(""); setTab("map"); }}
            >
              <span className={`project-dot dot-${index + 1}`} />
              {node.name}
            </button>
          ))}
        </div>

        <div className="local-status">
          <span className={`status-dot ${storage === "ready" ? "online" : ""}`} />
          <div>
            <strong>
              {storage === "error"
                ? "Ошибка базы"
                : engine === "ollama"
                  ? "Локальный AI активен"
                  : engine === "offline"
                    ? "AI не подключён"
                    : "SQLite активна"}
            </strong>
            <small>
              {storage === "saving"
                ? "Сохраняю изменения…"
                : engine === "offline"
                  ? "Доступно честное сохранение без разбора"
                  : embeddingEngine === "ollama"
                    ? "Контекст и смысловой поиск активны"
                    : engine === "ollama"
                      ? "Контекстный разбор активен"
                      : "Данные остаются на устройстве"}
            </small>
          </div>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <label className="search-field">
            <span>⌕</span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Найти мысль, проект или связь"
            />
            <kbd>⌘ K</kbd>
          </label>
          <div className="map-stats" aria-label="Сводка карты">
            <span>⌁ {links.filter((link) => link.status === "approved").length} связей</span>
            <span>▣ {nodes.filter((node) => node.status === "active").length} ветвей</span>
            <span>✣ {engine === "ollama" ? "AI включён" : "Локальный режим"}</span>
          </div>
          <div className="top-actions">
            <button
              type="button"
              className="theme-toggle"
              onClick={() => setTheme((current) => {
                const nextTheme = current === "dark" ? "light" : "dark";
                localStorage.setItem("mindmap.theme", nextTheme);
                return nextTheme;
              })}
              aria-label={theme === "dark" ? "Включить светлую тему" : "Включить тёмную тему"}
              title={theme === "dark" ? "Светлая тема" : "Тёмная тема"}
            >
              {theme === "dark" ? "☼" : "☾"}
            </button>
            <details className="data-menu">
              <summary title="Данные и резервные копии">•••</summary>
              <div>
                <strong>Тест AI на 96 мыслях</strong>
                <small>v0.6: общий смысл → глобальные кластеры → строгая иерархия → отдельная проверка связей.</small>
                {batchProgress.status === "running" ? (
                  <button type="button" onClick={pauseSyntheticTest}>Остановить после текущего этапа</button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      if (batchProgress.completed === SYNTHETIC_TEST_TOTAL) void runSyntheticTest(false);
                      else void runSyntheticTest(false);
                    }}
                    disabled={!databaseReady}
                  >
                    {batchProgress.completed > 0 && batchProgress.completed < SYNTHETIC_TEST_TOTAL
                      ? `Продолжить тест с ${batchProgress.completed + 1}-й записи`
                      : batchProgress.completed === SYNTHETIC_TEST_TOTAL
                        ? "Запустить следующий контрольный прогон"
                        : "Запустить чистый тест"}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => void restartSyntheticTest()}
                  disabled={!databaseReady || batchProgress.status === "running"}
                >
                  Удалить историю прогонов и начать заново
                </button>
                <strong>Локальная база</strong>
                <small>SQLite (база в одном переносимом файле)</small>
                <button type="button" onClick={downloadBackup}>Скачать резервную копию</button>
                <button type="button" onClick={downloadDiagnostics}>Скачать диагностику для анализа</button>
                <small>Диагностика содержит тексты мыслей и историю решений AI.</small>
                <button type="button" onClick={() => fileInputRef.current?.click()}>Восстановить из копии</button>
              </div>
            </details>
            <input
              ref={fileInputRef}
              className="visually-hidden"
              type="file"
              accept=".sqlite,.sqlite3,.db,application/vnd.sqlite3"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void restoreBackup(file);
              }}
            />
            <span className="avatar">А</span>
          </div>
        </header>

        <div className={`content ${tab === "map" ? "map-content" : ""}`}>
          {tab === "today" && (
            <TodayView
              thoughts={shownThoughts}
              links={links}
              draft={draft}
              setDraft={setDraft}
              captureThought={captureThought}
              isAnalyzing={isAnalyzing}
              isListening={isListening}
              toggleVoice={toggleVoice}
              setTab={setTab}
              editThought={setEditingThought}
            />
          )}
          {tab === "inbox" && (
            <InboxView
              thoughts={shownThoughts}
              links={links}
              updateLink={updateLink}
              acceptThought={acceptThought}
              editThought={setEditingThought}
            />
          )}
          {tab === "thoughts" && (
            <ThoughtsView thoughts={shownThoughts} editThought={setEditingThought} />
          )}
          {tab === "map" && (
            <MapView
              thoughts={shownThoughts}
              links={links}
              nodes={nodes}
              activeScopeId={activeScopeId}
              setActiveScopeId={setActiveScopeId}
              editThought={setEditingThought}
              downloadDiagnostics={downloadDiagnostics}
            />
          )}
        </div>
        {(storage === "loading" || batchProgress.status !== "idle" || foregroundVisible) && (
          <section className={`batch-test-panel ${batchProgress.status}`} aria-live="polite">
            <div className="batch-test-copy">
              <strong>
                {storage === "loading"
                  ? "Восстанавливаю состояние теста"
                  : foregroundVisible
                    ? foregroundObservation?.runtimeState === "stopped"
                      ? "Локальная операция остановлена"
                      : foregroundObservation?.stageLabel
                  : offlineHierarchyReviewReady
                  ? "Иерархия восстановлена офлайн"
                  : batchProgress.status === "completed"
                  ? "Тест AI завершён"
                  : batchProgress.status === "failed"
                    ? "Тест остановлен из-за ошибки"
                    : batchProgress.status === "paused"
                      ? "Тест AI приостановлен"
                      : "AI строит карту"}
              </strong>
              {storage === "loading" ? (
                <small>Читаю последнюю сохранённую контрольную точку…</small>
              ) : foregroundVisible ? (
                <small>{foregroundObservation?.activity}</small>
              ) : (
                <small>
                  {batchProgress.completed} из {batchProgress.total} мыслей извлечено
                  {batchProgress.currentNumber ? ` · сейчас исходная мысль №${batchProgress.currentNumber}` : ""}
                  {batchProgress.stage ? ` · этап: ${pipelineStageLabel(batchProgress.stage)}` : ""}
                  {batchProgress.stage !== "extract" && batchProgress.stageCompleted !== undefined && batchProgress.stageTotal
                    ? ` (${batchProgress.stageCompleted} из ${batchProgress.stageTotal})`
                    : ""}
                  {batchProgress.orderVariant ? ` · порядок: ${batchProgress.orderVariant}` : ""}
                </small>
              )}
              {batchProgress.status === "running" && batchProgress.stage && pipelineStageHint(batchProgress.stage) && (
                <p>{pipelineStageHint(batchProgress.stage)}</p>
              )}
              {displayedObservation && (
                <OperationObservability observation={displayedObservation} />
              )}
              {batchProgress.currentContent && batchProgress.status === "running" && (
                <p>{batchProgress.currentContent}</p>
              )}
              {batchProgress.interruptedByReload && batchProgress.status === "paused" && (
                <p>Страница была перезагружена. Сохранённый этап восстановлен, но автоматически не продолжится: возможный AI-вызов требует вашего явного действия.</p>
              )}
              {batchProgress.error && <p>{batchProgress.error}</p>}
            </div>
            <div className="batch-test-progress" aria-hidden="true">
              <i style={{ width: `${pipelineProgressPercent(batchProgress)}%` }} />
            </div>
            {offlineHierarchyReviewReady
              && batchProgress.status === "paused"
              && batchProgress.stage === "hierarchy" && (
              <small className="batch-test-progress-caption">
                82% — иерархия завершена. Это намеренная пауза перед локальным расчётом кандидатов, а не зависание.
              </small>
            )}
            {storage !== "loading" && <div className="batch-test-actions">
              {foregroundVisible ? (
                <button type="button" onClick={downloadDiagnostics}>Скачать диагностику</button>
              ) : batchProgress.status === "running" ? (
                <>
                  <button type="button" onClick={pauseSyntheticTest}>Безопасно остановить</button>
                  <button type="button" onClick={downloadDiagnostics}>Скачать диагностику</button>
                </>
              ) : offlineHierarchyReviewReady ? (
                <>
                  <button type="button" onClick={() => setTab("map")}>Открыть карту</button>
                  <button type="button" onClick={() => void calculateCandidatesWithoutAi()}>
                    Рассчитать кандидатов без AI
                  </button>
                  <button type="button" onClick={downloadDiagnostics}>Скачать диагностику</button>
                </>
              ) : batchProgress.status !== "completed" ? (
                batchProgress.status === "failed" && batchProgress.stage === "hierarchy" ? (
                  <>
                    <button type="button" onClick={() => void recoverFailedHierarchyOffline()}>
                      Восстановить без AI
                    </button>
                    <button type="button" onClick={downloadDiagnostics}>
                      Скачать диагностику
                    </button>
                  </>
                ) : batchProgress.stage === "candidates" && batchProgress.continuationBlock ? (
                  <>
                    <button type="button" disabled aria-disabled="true">
                      Продолжение заблокировано
                    </button>
                    {batchProgress.continuationBlock.code === "model_mismatch" && (
                      <button type="button" onClick={() => void startNewSelectedModelRun()}>
                        Новый чистый run на {batchProgress.continuationBlock.configuredModel ?? "выбранной модели"} в том же порядке
                      </button>
                    )}
                    <button type="button" onClick={downloadDiagnostics}>
                      Скачать диагностику
                    </button>
                  </>
                ) : (
                  <>
                    <button type="button" onClick={() => void continueSyntheticTestWithConfirmation()}>
                      {batchProgress.stage === "candidates" ? "Продолжить к AI-проверке связей" : "Продолжить"}
                    </button>
                    {batchProgress.status === "failed" && (
                    <button type="button" onClick={() => void startNewSelectedModelRun()}>
                      Новый прогон на выбранной модели в том же порядке
                    </button>
                    )}
                  </>
                )
              ) : (
                <><button type="button" onClick={() => setTab("map")}>Открыть карту</button><button type="button" onClick={() => void runSyntheticTest(false)}>Следующий прогон</button></>
              )}
            </div>}
          </section>
        )}
        {tab === "map" && (
          <form className={`quick-capture-dock ${isListening ? "listening" : ""} ${batchProgress.status === "running" ? "batch-running" : ""}`} onSubmit={captureThought}>
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Что занимает внимание?"
              rows={1}
              aria-label="Быстро добавить мысль"
              disabled={batchProgress.status === "running"}
            />
            <button
              type="button"
              className={`dock-voice ${isListening ? "active" : ""}`}
              onClick={toggleVoice}
              aria-label="Голосовой ввод"
            >
              {isListening ? "■" : "♩"}
            </button>
            <button className="dock-submit" disabled={!draft.trim() || isAnalyzing || batchProgress.status === "running"} aria-label="Добавить мысль">
              {isAnalyzing ? "…" : "➤"}
            </button>
          </form>
        )}
      </section>
      {analysisReview && (
        <AnalysisReviewDialog
          review={analysisReview}
          thoughts={thoughts}
          nodes={nodes}
          onCancel={cancelAnalysisReview}
          onSave={saveAnalysisReview}
        />
      )}
      {editingThought && (
        <ThoughtEditor
          thought={editingThought}
          nodes={nodes}
          onClose={() => setEditingThought(null)}
          onSave={saveThought}
          onDelete={deleteThought}
        />
      )}
    </main>
  );
}

function TodayView({
  thoughts,
  links,
  draft,
  setDraft,
  captureThought,
  isAnalyzing,
  isListening,
  toggleVoice,
  setTab,
  editThought,
}: {
  thoughts: Thought[];
  links: ThoughtLink[];
  draft: string;
  setDraft: (value: string) => void;
  captureThought: (event?: FormEvent) => Promise<void>;
  isAnalyzing: boolean;
  isListening: boolean;
  toggleVoice: () => void;
  setTab: (tab: Tab) => void;
  editThought: (thought: Thought) => void;
}) {
  const actionable = thoughts.filter((thought) => thought.nextStep).slice(0, 3);

  return (
    <>
      <section className="page-heading">
        <div>
          <p className="eyebrow">{formatToday()}</p>
          <h1>Что занимает внимание?</h1>
          <p>Выгрузите мысль как есть. Система разберётся со структурой.</p>
        </div>
        <button className="map-shortcut" onClick={() => setTab("map")}>
          <span>◌</span> Открыть карту
        </button>
      </section>

      <form className={`capture-card ${isListening ? "listening" : ""}`} onSubmit={captureThought}>
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Например: кажется, я снова начинаю с выбора инструментов, хотя ещё не определил аудиторию продукта…"
          rows={3}
          autoFocus
        />
        <div className="capture-footer">
          <span className="privacy-note">◇ Сохраняется локально</span>
          <div>
            <button
              type="button"
              className={`voice-button ${isListening ? "active" : ""}`}
              onClick={toggleVoice}
              aria-label="Голосовой ввод"
              title="Голосовой ввод"
            >
              {isListening ? "■" : "◉"}
            </button>
            <button className="primary-button" disabled={!draft.trim() || isAnalyzing}>
              {isAnalyzing ? <><span className="spinner" /> Анализирую</> : "Добавить мысль →"}
            </button>
          </div>
        </div>
      </form>

      <section className="today-grid">
        <div className="attention-panel">
          <div className="section-title">
            <div>
              <h2>Требует внимания</h2>
              <p>Система выбрала на сегодня</p>
            </div>
            <span>{actionable.length}</span>
          </div>
          <div className="attention-list">
            {actionable.map((thought, index) => (
              <article
                key={thought.id}
                className="attention-item interactive-card"
                role="button"
                tabIndex={0}
                onClick={() => editThought(thought)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") editThought(thought);
                }}
                aria-label={`Открыть и изменить: ${thought.title}`}
              >
                <div className={`type-icon ${TYPE_CLASS[thought.type]}`}>{index + 1}</div>
                <div>
                  <span className={`type-label ${TYPE_CLASS[thought.type]}`}>{thought.type}</span>
                  <h3>{thought.title}</h3>
                  <p>{thought.nextStep}</p>
                </div>
                <span className="card-open-affordance" aria-hidden="true">›</span>
              </article>
            ))}
          </div>
        </div>

        <aside className="pulse-panel">
          <div className="section-title">
            <div>
              <h2>Пульс системы</h2>
              <p>Последние 7 дней</p>
            </div>
          </div>
          <div className="metric-row">
            <span><strong>{thoughts.length}</strong> мыслей</span>
            <span><strong>{links.filter((link) => link.status === "approved").length}</strong> связей</span>
          </div>
          <MiniGraph thoughts={thoughts} links={links} />
          <button className="text-button" onClick={() => setTab("map")}>Посмотреть всю карту →</button>
        </aside>
      </section>
    </>
  );
}

function InboxView({
  thoughts,
  links,
  updateLink,
  acceptThought,
  editThought,
}: {
  thoughts: Thought[];
  links: ThoughtLink[];
  updateLink: (id: string, status: ThoughtLink["status"]) => void;
  acceptThought: (id: string) => void;
  editThought: (thought: Thought) => void;
}) {
  const inbox = thoughts.filter((thought) => thought.status === "inbox");
  const pending = links.filter((link) => link.status === "pending");

  return (
    <>
      <section className="page-heading compact">
        <div>
          <p className="eyebrow">РАЗБОР</p>
          <h1>Входящие</h1>
          <p>Проверьте новые записи и незавершённые предложения системы.</p>
        </div>
      </section>
      {inbox.length === 0 && pending.length === 0 ? (
        <EmptyState title="Входящие разобраны" body="Новые мысли и предложенные связи появятся здесь." />
      ) : (
        <div className="review-stack">
          {inbox.map((thought) => (
            <article
              className="review-card interactive-card"
              key={thought.id}
              role="button"
              tabIndex={0}
              onClick={() => editThought(thought)}
              onKeyDown={(event) => {
                if (
                  event.target === event.currentTarget &&
                  (event.key === "Enter" || event.key === " ")
                ) editThought(thought);
              }}
              aria-label={`Открыть и изменить: ${thought.title}`}
            >
              <div className="review-main">
                <span className={`type-label ${TYPE_CLASS[thought.type]}`}>{thought.type}</span>
                <h2>{thought.title}</h2>
                <p>{thought.content}</p>
                <div className="chip-row">
                  <span className="chip">{thought.project}</span>
                  {thought.tags.map((tag) => <span className="chip muted" key={tag}>#{tag}</span>)}
                </div>
              </div>
              <div className="review-actions">
                <button
                  className="reject"
                  onClick={(event) => {
                    event.stopPropagation();
                    editThought(thought);
                  }}
                >
                  Изменить
                </button>
                <button
                  className="approve-button"
                  onClick={(event) => {
                    event.stopPropagation();
                    acceptThought(thought.id);
                  }}
                >
                  {thought.type === "Не разобрано" ? "Принять без разбора" : "Подтвердить разбор"}
                </button>
              </div>
            </article>
          ))}
          {pending.map((link) => {
            const source = thoughts.find((thought) => thought.id === link.source);
            const target = thoughts.find((thought) => thought.id === link.target);
            if (!source || !target) return null;
            return (
              <article className="connection-card" key={link.id}>
                <div className="connection-visual">
                  <span className={`node-dot ${TYPE_CLASS[source.type]}`} />
                  <i />
                  <span className={`node-dot ${TYPE_CLASS[target.type]}`} />
                </div>
                <div className="connection-copy">
                  <span className="suggestion-label">ПРЕДЛОЖЕННАЯ СВЯЗЬ · {Math.round(link.confidence * 100)}%</span>
                  <h3>{source.title} <em>{link.type.toLowerCase()}</em> {target.title}</h3>
                  <p>{link.reason}</p>
                </div>
                <div className="review-actions">
                  <button className="reject" onClick={() => updateLink(link.id, "rejected")}>Отклонить</button>
                  <button className="approve-button" onClick={() => updateLink(link.id, "approved")}>Связать</button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}

function ThoughtsView({
  thoughts,
  editThought,
}: {
  thoughts: Thought[];
  editThought: (thought: Thought) => void;
}) {
  return (
    <>
      <section className="page-heading compact">
        <div>
          <p className="eyebrow">БАЗА</p>
          <h1>Все мысли</h1>
          <p>{thoughts.length} объектов в текущем представлении.</p>
        </div>
      </section>
      <div className="thought-list">
        {thoughts.map((thought) => (
          <article
            className="thought-row"
            key={thought.id}
            role="button"
            tabIndex={0}
            onClick={() => editThought(thought)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") editThought(thought);
            }}
            aria-label={`Открыть и изменить: ${thought.title}`}
          >
            <div className={`thought-symbol ${TYPE_CLASS[thought.type]}`} />
            <div className="thought-copy">
              <div><span>{thought.project}</span><time>{formatDate(thought.createdAt)}</time></div>
              <h2>{thought.title}</h2>
              <p>{thought.content}</p>
            </div>
            <span className={`type-label ${TYPE_CLASS[thought.type]}`}>{thought.type}</span>
          </article>
        ))}
      </div>
    </>
  );
}

function MapView({
  thoughts,
  links,
  nodes,
  activeScopeId,
  setActiveScopeId,
  editThought,
  downloadDiagnostics,
}: {
  thoughts: Thought[];
  links: ThoughtLink[];
  nodes: KnowledgeNode[];
  activeScopeId?: string;
  setActiveScopeId: (id?: string) => void;
  editThought: (thought: Thought) => void;
  downloadDiagnostics: () => void;
}) {
  const [typeFilter, setTypeFilter] = useState<ThoughtType | "Все">("Все");
  const [projectFilter, setProjectFilter] = useState("Все проекты");
  const [zoom, setZoom] = useState(1);
  const [positions, setPositions] = useState<Record<string, { x: number; y: number }>>({});
  const [viewport, setViewport] = useState({ width: 1440, height: 900 });
  const [viewCenter, setViewCenter] = useState({ x: 0, y: 0 });
  const [selectedThoughtId, setSelectedThoughtId] = useState<string | undefined>();
  const [exportObservation, setExportObservation] = useState<OperationObservation>();
  const dragging = useRef<string | null>(null);
  const dragGesture = useRef<{ startX: number; startY: number; moved: boolean } | null>(null);
  const panGesture = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    centerX: number;
    centerY: number;
  } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const operationId = exportObservation?.operationId;
    if (!operationId || exportObservation.runtimeState !== "working") return;
    const timer = window.setInterval(() => {
      setExportObservation((current) => heartbeatOperation(current, operationId));
    }, 2_000);
    return () => window.clearInterval(timer);
  }, [exportObservation?.operationId, exportObservation?.runtimeState]);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const updateViewport = () => {
      const rect = svg.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setViewport({ width: rect.width, height: rect.height });
      }
    };
    updateViewport();
    const observer = new ResizeObserver(updateViewport);
    observer.observe(svg);
    return () => observer.disconnect();
  }, []);

  const projects = useMemo(
    () => ["Все проекты", ...Array.from(new Set(thoughts.map((thought) => thought.project)))],
    [thoughts],
  );
  const scopeOptions = useMemo(
    () => nodes
      .filter((node) => node.status === "active")
      .map((node) => ({
        ...node,
        label: knowledgePath(nodes, node.id).map((item) => item.name).join(" → "),
      }))
      .sort((left, right) => left.label.localeCompare(right.label, "ru")),
    [nodes],
  );
  const visible = useMemo(
    () => thoughts.filter((thought) =>
      (typeFilter === "Все" || thought.type === typeFilter) &&
      (projectFilter === "Все проекты" || thought.project === projectFilter),
    ),
    [thoughts, typeFilter, projectFilter],
  );
  const visibleHierarchyNodes = useMemo(() => {
    if (!visible.length) return nodes;
    const byId = new Map(nodes.map((node) => [node.id, node]));
    const included = new Set<string>();
    visible.forEach((thought) => {
      let current = thought.primaryNodeId ? byId.get(thought.primaryNodeId) : undefined;
      while (current && !included.has(current.id)) {
        included.add(current.id);
        current = current.parentId ? byId.get(current.parentId) : undefined;
      }
    });
    return nodes.filter((node) => included.has(node.id));
  }, [nodes, visible]);
  const graph = useMemo(
    () => buildMapGraph(visible, visibleHierarchyNodes, links, positions),
    [visible, visibleHierarchyNodes, links, positions],
  );
  const visibleLinks = links.filter((link) =>
    link.status !== "rejected"
    && visible.some((thought) => thought.id === link.source)
    && visible.some((thought) => thought.id === link.target),
  );
  const featuredThought = visible.find((thought) => thought.id === selectedThoughtId)
    ?? visible.find((thought) => thought.id === "mindmap")
    ?? visible[0];
  const featuredConnections = featuredThought
    ? visibleLinks.filter((link) => link.source === featuredThought.id || link.target === featuredThought.id)
    : [];

  const resolvedPositions = graph.positions;

  const viewWidth = viewport.width / zoom;
  const viewHeight = viewport.height / zoom;

  function peripheralStyle(position: { x: number; y: number }, kind: "node" | "link") {
    const screenX = viewport.width / 2 + (position.x - viewCenter.x) * zoom;
    const screenY = viewport.height / 2 + (position.y - viewCenter.y) * zoom;
    const focusRadiusX = Math.max(viewport.width * 0.48, 1);
    const focusRadiusY = Math.max(viewport.height * 0.46, 1);
    const ellipticalDistance = Math.hypot(
      (screenX - viewport.width / 2) / focusRadiusX,
      (screenY - viewport.height / 2) / focusRadiusY,
    );

    // The center stays fully readable inside one large, predictable ellipse.
    // A smoothstep curve avoids the visible corners and abrupt blur bands that
    // appeared when horizontal and vertical distance were evaluated separately.
    const fadeStart = 0.78;
    const fadeEnd = 1.18;
    const progress = Math.max(0, Math.min(1, (ellipticalDistance - fadeStart) / (fadeEnd - fadeStart)));
    const fade = progress * progress * (3 - 2 * progress);
    const blur = fade * (kind === "node" ? 6.5 : 4.2);
    const opacity = 1 - fade * (kind === "node" ? 0.6 : 0.72);
    return {
      opacity,
      filter: kind === "node"
        ? `drop-shadow(0 5px 7px rgba(0, 6, 17, .13)) blur(${blur.toFixed(2)}px)`
        : `blur(${blur.toFixed(2)}px)`,
    };
  }

  function moveNode(event: React.PointerEvent<SVGSVGElement>) {
    if (panGesture.current) {
      setViewCenter({
        x: panGesture.current.centerX - (event.clientX - panGesture.current.startX) / zoom,
        y: panGesture.current.centerY - (event.clientY - panGesture.current.startY) / zoom,
      });
      return;
    }
    if (!dragging.current || !dragGesture.current || !svgRef.current) return;
    const distance = Math.hypot(
      event.clientX - dragGesture.current.startX,
      event.clientY - dragGesture.current.startY,
    );
    if (distance < 5 && !dragGesture.current.moved) return;
    dragGesture.current.moved = true;
    const rect = svgRef.current.getBoundingClientRect();
    const x = viewCenter.x - viewWidth / 2 + ((event.clientX - rect.left) / rect.width) * viewWidth;
    const y = viewCenter.y - viewHeight / 2 + ((event.clientY - rect.top) / rect.height) * viewHeight;
    setPositions((current) => ({ ...current, [dragging.current!]: { x, y } }));
  }

  function finishNodeGesture() {
    if (panGesture.current) {
      panGesture.current = null;
      return;
    }
    const graphNodeId = dragging.current;
    const wasMoved = dragGesture.current?.moved ?? false;
    dragging.current = null;
    dragGesture.current = null;
    if (!graphNodeId || wasMoved) return;
    const thought = thoughts.find((item) => item.id === graphNodeId);
    if (thought) setSelectedThoughtId(thought.id);
    else if (nodes.some((node) => node.id === graphNodeId)) setActiveScopeId(graphNodeId);
  }

  function zoomAtPoint(event: React.WheelEvent<SVGSVGElement>) {
    event.preventDefault();
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const pointerX = viewCenter.x - viewWidth / 2 + ((event.clientX - rect.left) / rect.width) * viewWidth;
    const pointerY = viewCenter.y - viewHeight / 2 + ((event.clientY - rect.top) / rect.height) * viewHeight;
    const nextZoom = Math.max(0.18, Math.min(2.2, zoom * (event.deltaY > 0 ? 0.9 : 1.1)));
    const nextViewWidth = viewport.width / nextZoom;
    const nextViewHeight = viewport.height / nextZoom;
    const ratioX = (event.clientX - rect.left) / rect.width;
    const ratioY = (event.clientY - rect.top) / rect.height;
    setViewCenter({
      x: pointerX - (ratioX - 0.5) * nextViewWidth,
      y: pointerY - (ratioY - 0.5) * nextViewHeight,
    });
    setZoom(nextZoom);
  }

  function fitGraph() {
    const graphPositions = Object.values(resolvedPositions);
    if (!graphPositions.length) return;
    const minX = Math.min(...graphPositions.map((position) => position.x)) - 150;
    const maxX = Math.max(...graphPositions.map((position) => position.x)) + 150;
    const minY = Math.min(...graphPositions.map((position) => position.y)) - 90;
    const maxY = Math.max(...graphPositions.map((position) => position.y)) + 90;
    const contentWidth = Math.max(1, maxX - minX);
    const contentHeight = Math.max(1, maxY - minY);
    setViewCenter({ x: (minX + maxX) / 2, y: (minY + maxY) / 2 });
    setZoom(Math.max(.18, Math.min(2.2, Math.min(viewport.width / contentWidth, viewport.height / contentHeight) * .92)));
  }

  async function exportFullMap(format: "svg" | "png") {
    const operationId = `map-export-${format}-${Date.now()}`;
    let observation = updateOperationObservation(undefined, {
      operationId,
      stageKey: `map-export-${format}`,
      stageLabel: `экспорт карты ${format.toUpperCase()}`,
      workKind: "local",
      runtimeState: "working",
      stallAfterMs: 30_000,
      modelLabel: "без AI",
      activity: "Собираю полный граф вне границ текущего экрана.",
      completed: 0,
      total: format === "svg" ? 1 : 3,
    });
    setExportObservation(observation);
    const svg = buildMapExportSvg(graph, {
      title: `MindMap ${SEMANTIC_PIPELINE_VERSION}`,
    });
    if (format === "svg") {
      downloadBlob(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }), `mindmap-${SEMANTIC_PIPELINE_VERSION}.svg`);
      observation = updateOperationObservation(observation, {
        operationId,
        stageKey: `map-export-${format}`,
        stageLabel: `экспорт карты ${format.toUpperCase()}`,
        workKind: "local",
        runtimeState: "completed",
        stallAfterMs: 30_000,
        modelLabel: "без AI",
        activity: "Полная SVG-карта подготовлена и передана браузеру.",
        completed: 1,
        total: 1,
      });
      setExportObservation(observation);
      return;
    }
    const dimensions = svg.match(/width="(\d+)" height="(\d+)"/);
    const sourceWidth = Number(dimensions?.[1] ?? 1600);
    const sourceHeight = Number(dimensions?.[2] ?? 1200);
    const scale = Math.min(1, 6144 / Math.max(sourceWidth, sourceHeight));
    const image = new Image();
    const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
    try {
      observation = updateOperationObservation(observation, {
        operationId,
        stageKey: `map-export-${format}`,
        stageLabel: `экспорт карты ${format.toUpperCase()}`,
        workKind: "local",
        runtimeState: "working",
        stallAfterMs: 30_000,
        modelLabel: "без AI",
        activity: "Растеризую SVG в изображение.",
        completed: 1,
        total: 3,
      });
      setExportObservation(observation);
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error("map_export_image_failed"));
        image.src = url;
      });
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(sourceWidth * scale));
      canvas.height = Math.max(1, Math.round(sourceHeight * scale));
      const context = canvas.getContext("2d");
      if (!context) throw new Error("map_export_canvas_unavailable");
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      observation = updateOperationObservation(observation, {
        operationId,
        stageKey: `map-export-${format}`,
        stageLabel: `экспорт карты ${format.toUpperCase()}`,
        workKind: "local",
        runtimeState: "working",
        stallAfterMs: 30_000,
        modelLabel: "без AI",
        activity: "Кодирую итоговый PNG.",
        completed: 2,
        total: 3,
      });
      setExportObservation(observation);
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((value) => value ? resolve(value) : reject(new Error("map_export_png_failed")), "image/png");
      });
      downloadBlob(blob, `mindmap-${SEMANTIC_PIPELINE_VERSION}.png`);
      observation = updateOperationObservation(observation, {
        operationId,
        stageKey: `map-export-${format}`,
        stageLabel: `экспорт карты ${format.toUpperCase()}`,
        workKind: "local",
        runtimeState: "completed",
        stallAfterMs: 30_000,
        modelLabel: "без AI",
        activity: "Полная PNG-карта подготовлена и передана браузеру.",
        completed: 3,
        total: 3,
      });
      setExportObservation(observation);
    } catch (error) {
      observation = updateOperationObservation(observation, {
        operationId,
        stageKey: `map-export-${format}`,
        stageLabel: `экспорт карты ${format.toUpperCase()}`,
        workKind: "local",
        runtimeState: "stopped",
        stallAfterMs: 30_000,
        modelLabel: "без AI",
        activity: error instanceof Error ? `Экспорт остановлен: ${error.message}.` : "Экспорт остановлен.",
        completed: observation.completed,
        total: observation.total,
      });
      setExportObservation(observation);
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  return (
    <div className="map-page">
      <section className="map-toolbar">
        <div>
          <p className="eyebrow">СВЯЗИ</p>
          <h1>Карта мыслей</h1>
        </div>
        <div className="map-filters">
          <details className="map-export-menu">
            <summary>Экспорт карты</summary>
            <div>
              <button type="button" onClick={() => void exportFullMap("svg")}>SVG · вся карта</button>
              <button type="button" onClick={() => void exportFullMap("png")}>PNG · до 6144 px</button>
            </div>
          </details>
          <select
            value={activeScopeId ?? ""}
            onChange={(event) => setActiveScopeId(event.target.value || undefined)}
            aria-label="Рабочая область"
          >
            <option value="">Вся карта</option>
            {scopeOptions.map((node) => (
              <option key={node.id} value={node.id}>{hierarchyLabel(node.kind)} · {node.label}</option>
            ))}
          </select>
          <select value={projectFilter} onChange={(event) => setProjectFilter(event.target.value)}>
            {projects.map((project) => <option key={project}>{project}</option>)}
          </select>
          <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as ThoughtType | "Все")}>
            <option>Все</option>
            {Object.keys(TYPE_CLASS).map((type) => <option key={type}>{type}</option>)}
          </select>
        </div>
      </section>
      {exportObservation && (
        <section className="map-export-observation" aria-live="polite">
          <OperationObservability observation={exportObservation} />
          <button type="button" onClick={downloadDiagnostics}>Скачать диагностику</button>
        </section>
      )}

      <div className="map-stage">
      <section className="graph-card" aria-label="Бесконечная карта мыслей">
        <div className="graph-meta">
          <span>{visible.length} мыслей</span>
          <span>{visibleHierarchyNodes.length} ветвей</span>
          <span>{graph.edges.filter((edge) => edge.kind === "structure").length} структурных</span>
          <span>{visibleLinks.length} смысловых</span>
          <span className="drag-hint">Нажмите — изменить · потяните — переместить</span>
        </div>
        <svg
          ref={svgRef}
          className="mind-graph"
          viewBox={`${viewCenter.x - viewWidth / 2} ${viewCenter.y - viewHeight / 2} ${viewWidth} ${viewHeight}`}
          onPointerDown={(event) => {
            if ((event.target as Element).closest(".graph-node")) return;
            event.currentTarget.setPointerCapture(event.pointerId);
            panGesture.current = {
              pointerId: event.pointerId,
              startX: event.clientX,
              startY: event.clientY,
              centerX: viewCenter.x,
              centerY: viewCenter.y,
            };
          }}
          onPointerMove={moveNode}
          onPointerUp={finishNodeGesture}
          onPointerCancel={() => {
            dragging.current = null;
            dragGesture.current = null;
            panGesture.current = null;
          }}
          onWheel={zoomAtPoint}
        >
          <defs>
            <filter id="nodeShadow" x="-30%" y="-30%" width="160%" height="160%">
              <feDropShadow dx="0" dy="5" stdDeviation="7" floodOpacity="0.13" />
            </filter>
          </defs>
          {graph.edges.map((edge) => {
            const from = resolvedPositions[edge.source];
            const to = resolvedPositions[edge.target];
            if (!from || !to) return null;
            const midpoint = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
            return (
              <g key={edge.id} style={peripheralStyle(midpoint, "link")}>
                <line
                  x1={from.x}
                  y1={from.y}
                  x2={to.x}
                  y2={to.y}
                  className={`graph-link ${edge.kind}`}
                />
                {edge.label && (
                  <text x={(from.x + to.x) / 2} y={(from.y + to.y) / 2 - 8} className="link-label">
                    {edge.label}
                  </text>
                )}
              </g>
            );
          })}
          {graph.nodes.map((graphNode) => {
            const position = resolvedPositions[graphNode.id];
            if (!position) return null;
            const size = nodeSize(graphNode.kind);
            const thought = graphNode.kind === "thought"
              ? visible.find((item) => item.id === graphNode.id)
              : undefined;
            return (
              <g
                key={graphNode.id}
                className={`graph-node graph-${graphNode.kind} ${selectedThoughtId === graphNode.id ? "selected-node" : ""}`}
                transform={`translate(${position.x} ${position.y})`}
                role="button"
                tabIndex={0}
                aria-label={thought ? `Выбрать мысль: ${thought.title}` : `Открыть ветвь: ${graphNode.label}`}
                onPointerDown={(event) => {
                  event.currentTarget.setPointerCapture(event.pointerId);
                  dragging.current = graphNode.id;
                  dragGesture.current = {
                    startX: event.clientX,
                    startY: event.clientY,
                    moved: false,
                  };
                }}
                onKeyDown={(event) => {
                  if (event.key !== "Enter" && event.key !== " ") return;
                  if (thought) setSelectedThoughtId(thought.id);
                  else setActiveScopeId(graphNode.id);
                }}
                style={peripheralStyle(position, "node")}
              >
                <rect
                  x={-size.width / 2}
                  y={-size.height / 2}
                  width={size.width}
                  height={size.height}
                  rx={graphNode.kind === "area" ? 28 : 18}
                  className={`node-card ${thought ? TYPE_CLASS[thought.type] : ""}`}
                />
                <circle cx={-size.width / 2 + 24} cy="-13" r="6" className={`node-accent ${thought ? TYPE_CLASS[thought.type] : ""}`} />
                <text x={-size.width / 2 + 37} y="-8" className="node-type">{graphNode.meta}</text>
                <text x={-size.width / 2 + 24} y="15" className="node-title">
                  {truncate(graphNode.label, graphNode.kind === "thought" ? 25 : 29)}
                </text>
              </g>
            );
          })}
        </svg>
        <div className="zoom-controls">
          <button onClick={() => setZoom((value) => Math.min(2.2, value + 0.15))}>+</button>
          <button onClick={fitGraph}>⌖</button>
          <button onClick={() => setZoom((value) => Math.max(0.18, value - 0.15))}>−</button>
        </div>
        <div className="map-legend">
          {(Object.keys(TYPE_CLASS) as ThoughtType[]).slice(0, 4).map((type) => (
            <span key={type}><i className={TYPE_CLASS[type]} />{type}</span>
          ))}
        </div>
      </section>
      {featuredThought && (
        <aside className="map-inspector" aria-label="Контекст выбранной мысли">
          <div className="inspector-actions"><button aria-label="Закрепить">☆</button><button aria-label="Ещё">•••</button></div>
          <p className={`inspector-type ${TYPE_CLASS[featuredThought.type]}`}>● {featuredThought.type}</p>
          <h2>{featuredThought.title}</h2>
          <dl>
            <div><dt>◫</dt><dd>{formatDate(featuredThought.createdAt)}</dd></div>
            <div><dt>◇</dt><dd>{featuredThought.tags.join(", ") || "Без тегов"}</dd></div>
            <div><dt>⌁</dt><dd>{featuredConnections.length} связей</dd></div>
            <div>
              <dt>▣</dt>
              <dd>
                {featuredThought.primaryNodeId
                  ? knowledgePath(nodes, featuredThought.primaryNodeId).map((node) => node.name).join(" → ")
                  : "Без основной ветви"}
              </dd>
            </div>
          </dl>
          <div className="inspector-notes">
            <span>ЗАМЕТКА</span>
            <p>{featuredThought.content}</p>
          </div>
          <button className="inspector-edit" onClick={() => editThought(featuredThought)}>Открыть карточку</button>
        </aside>
      )}
      </div>
    </div>
  );
}

function AnalysisReviewDialog({
  review,
  thoughts,
  nodes,
  onCancel,
  onSave,
}: {
  review: AnalysisReview;
  thoughts: Thought[];
  nodes: KnowledgeNode[];
  onCancel: () => void;
  onSave: (
    thought: AnalysisResponse["thought"],
    connections: AnalysisResponse["connections"],
    placement: ProposedPlacement,
  ) => void;
}) {
  const [form, setForm] = useState({
    ...review.thought,
    tagsText: review.thought.tags.join(", "),
  });
  const [connections, setConnections] = useState(review.connections);
  const [placement, setPlacement] = useState(review.placement);
  const [selected, setSelected] = useState(() => new Set(review.connections.map((_, index) => index)));

  function submit(event: FormEvent) {
    event.preventDefault();
    const title = form.title.trim();
    if (!title) return;
    onSave(
      {
        ...review.thought,
        title,
        content: review.rawContent,
        type: form.type,
        project: form.project.trim() || "Без проекта",
        tags: form.tagsText
          .split(",")
          .map((tag) => tag.trim().replace(/^#/, ""))
          .filter(Boolean)
          .slice(0, 4),
        summary: form.summary?.trim() || undefined,
        nextStep: form.nextStep?.trim() || undefined,
      },
      connections.filter((_, index) => selected.has(index)),
      placement,
    );
  }

  function toggleConnection(index: number) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  return (
    <div className="editor-backdrop analysis-backdrop" role="presentation">
      <section className="analysis-review" role="dialog" aria-modal="true" aria-labelledby="analysis-review-title">
        <form onSubmit={submit}>
          <header className="analysis-header">
            <div>
              <p className="eyebrow">{review.mode === "analyzed" ? "AI-РАЗБОР · НИЧЕГО ЕЩЁ НЕ СОХРАНЕНО" : "AI НЕДОСТУПЕН"}</p>
              <h2 id="analysis-review-title">
                {review.mode === "analyzed" ? "Проверьте, правильно ли понята мысль" : "Сохранить без автоматического разбора?"}
              </h2>
              <p>
                {review.mode === "analyzed"
                  ? "Вы управляете памятью: исправьте выводы и отключите лишние связи перед сохранением."
                  : "MindMap не будет изображать интеллект. Исходная запись сохранится во «Входящих» с пометкой «Не разобрано»."}
              </p>
            </div>
            <button type="button" className="close-detail" onClick={onCancel} aria-label="Вернуться к записи">×</button>
          </header>

          <section className="analysis-section raw-thought">
            <div className="analysis-section-title">
              <span>01</span>
              <div><strong>Исходная мысль</strong><small>Всегда хранится без изменений</small></div>
            </div>
            <blockquote>{review.rawContent}</blockquote>
          </section>

          {review.mode === "analyzed" && (
            <>
              <section className="analysis-section">
                <div className="analysis-section-title">
                  <span>02</span>
                  <div><strong>Как система поняла запись</strong><small>Все поля можно исправить</small></div>
                </div>
                <div className="analysis-form-grid">
                  <label className="wide-field">
                    <span>Короткий заголовок</span>
                    <input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} autoFocus />
                  </label>
                  <label className="wide-field">
                    <span>Суть</span>
                    <textarea rows={2} value={form.summary ?? ""} onChange={(event) => setForm({ ...form, summary: event.target.value })} />
                  </label>
                  <label>
                    <span>Тип</span>
                    <select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value as ThoughtType })}>
                      {(Object.keys(TYPE_CLASS) as ThoughtType[])
                        .filter((type) => type !== "Не разобрано")
                        .map((type) => <option key={type}>{type}</option>)}
                    </select>
                  </label>
                  <label>
                    <span>Проект</span>
                    <input value={form.project} onChange={(event) => setForm({ ...form, project: event.target.value })} />
                  </label>
                  <label className="wide-field">
                    <span>Теги</span>
                    <input value={form.tagsText} onChange={(event) => setForm({ ...form, tagsText: event.target.value })} placeholder="До четырёх тегов через запятую" />
                  </label>
                </div>
              </section>

              <section className="analysis-section">
                <div className="analysis-section-title">
                  <span>03</span>
                  <div><strong>Куда относится мысль</strong><small>Область → направление → проект</small></div>
                </div>
                {placement.primaryPath.length > 0 ? (
                  <div className="hierarchy-editor">
                    {placement.primaryPath.map((node, index) => (
                      <div className="hierarchy-segment" key={`${index}-${node.existingNodeId ?? node.name}`}>
                        <select
                          value={node.kind}
                          onChange={(event) => setPlacement((current) => ({
                            ...current,
                            primaryPath: current.primaryPath.map((item, itemIndex) => itemIndex === index
                              ? { ...item, kind: event.target.value as KnowledgeNode["kind"], existingNodeId: undefined }
                              : item),
                          }))}
                        >
                          <option value="area">Область</option>
                          <option value="direction">Направление</option>
                          <option value="project">Проект</option>
                        </select>
                        <input
                          value={node.name}
                          onChange={(event) => setPlacement((current) => ({
                            ...current,
                            primaryPath: current.primaryPath.map((item, itemIndex) => itemIndex === index
                              ? { ...item, name: event.target.value, existingNodeId: nodes.find((known) => known.id === item.existingNodeId)?.name === event.target.value ? item.existingNodeId : undefined }
                              : item),
                          }))}
                        />
                        <small>{Math.round(node.confidence * 100)}% · {node.reason}</small>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="analysis-empty">AI не создал ветвь. Мысль сохранится без области и останется доступна в общей карте.</p>
                )}
              </section>

              <section className="analysis-section">
                <div className="analysis-section-title">
                  <span>04</span>
                  <div><strong>Что замечено в контексте</strong><small>Повторы, противоречия и незакрытые вопросы</small></div>
                </div>
                {review.signals.length > 0 ? (
                  <div className="signal-list">
                    {review.signals.map((signal, index) => {
                      const target = thoughts.find((thought) => thought.id === signal.targetId);
                      return (
                        <article className={`signal-card signal-${signal.kind}`} key={`${signal.kind}-${index}`}>
                          <span>{signalLabel(signal.kind)}</span>
                          <p>{signal.message}</p>
                          {target && <small>Связано с: {target.title}</small>}
                        </article>
                      );
                    })}
                  </div>
                ) : (
                  <p className="analysis-empty">AI не обнаружил подтверждённых повторов или противоречий в доступном контексте.</p>
                )}
              </section>

              <section className="analysis-section">
                <div className="analysis-section-title">
                  <span>05</span>
                  <div><strong>Предлагаемые связи</strong><small>Сохранены будут только отмеченные</small></div>
                </div>
                {connections.length > 0 ? (
                  <div className="analysis-links">
                    {connections.map((connection, index) => {
                      const target = thoughts.find((thought) => thought.id === connection.targetId);
                      return (
                        <article className={selected.has(index) ? "selected" : ""} key={`${connection.targetId}-${index}`}>
                          <button type="button" className="connection-check" onClick={() => toggleConnection(index)} aria-pressed={selected.has(index)}>
                            {selected.has(index) ? "✓" : ""}
                          </button>
                          <div>
                            <strong>{target?.title ?? "Связанная мысль"}</strong>
                            <textarea
                              rows={2}
                              value={connection.reason}
                              onChange={(event) => setConnections((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, reason: event.target.value } : item))}
                            />
                          </div>
                          <select
                            value={connection.type}
                            onChange={(event) => setConnections((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, type: event.target.value as LinkType } : item))}
                          >
                            {(["Связано", "Продолжает", "Противоречит", "Зависит от", "Альтернатива"] as LinkType[]).map((type) => <option key={type}>{type}</option>)}
                          </select>
                        </article>
                      );
                    })}
                  </div>
                ) : (
                  <p className="analysis-empty">Убедительных связей с сохранёнными мыслями не найдено. Карточка не будет искусственно привязана к карте.</p>
                )}
              </section>

              <section className="analysis-section next-step-section">
                <div className="analysis-section-title">
                  <span>06</span>
                  <div><strong>Следующий шаг</strong><small>Не каждая мысль обязана становиться задачей</small></div>
                </div>
                <div className="next-step-input">
                  <input value={form.nextStep ?? ""} onChange={(event) => setForm({ ...form, nextStep: event.target.value })} placeholder="Действие не требуется" />
                  {form.nextStep && <button type="button" onClick={() => setForm({ ...form, nextStep: "" })}>Действие не требуется</button>}
                </div>
              </section>
            </>
          )}

          <footer className="analysis-actions">
            <button type="button" className="reject" onClick={onCancel}>Вернуться к тексту</button>
            <button className="approve-button" disabled={!form.title.trim()}>
              {review.mode === "analyzed" ? `Сохранить разбор${selected.size ? ` и ${selected.size} ${pluralConnections(selected.size)}` : ""}` : "Сохранить без разбора"}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}

function ThoughtEditor({
  thought,
  nodes,
  onClose,
  onSave,
  onDelete,
}: {
  thought: Thought;
  nodes: KnowledgeNode[];
  onClose: () => void;
  onSave: (thought: Thought) => void;
  onDelete: (id: string) => void;
}) {
  const [form, setForm] = useState({
    ...thought,
    tagsText: thought.tags.join(", "),
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    const title = form.title.trim();
    const content = form.content.trim();
    if (!title || !content) return;
    onSave({
      ...thought,
      title,
      content,
      type: form.type,
      project: form.project.trim() || "Без проекта",
      tags: form.tagsText
        .split(",")
        .map((tag) => tag.trim().replace(/^#/, ""))
        .filter(Boolean),
      nextStep: form.nextStep?.trim() || undefined,
    });
  }

  return (
    <div className="editor-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section className="thought-editor" role="dialog" aria-modal="true" aria-labelledby="thought-editor-title">
        <div className="editor-heading">
          <div>
            <p className="eyebrow">КАРТОЧКА МЫСЛИ</p>
            <h2 id="thought-editor-title">Редактирование</h2>
          </div>
          <button type="button" className="close-detail" onClick={onClose} aria-label="Закрыть">×</button>
        </div>
        <form onSubmit={submit}>
          <label>
            <span>Заголовок</span>
            <input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} autoFocus />
          </label>
          <label>
            <span>Содержание</span>
            <textarea rows={5} value={form.content} onChange={(event) => setForm({ ...form, content: event.target.value })} />
          </label>
          <div className="editor-grid">
            <label>
              <span>Тип</span>
              <select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value as ThoughtType })}>
                {(Object.keys(TYPE_CLASS) as ThoughtType[]).map((type) => <option key={type}>{type}</option>)}
              </select>
            </label>
            <label>
              <span>Проект</span>
              <input value={form.project} onChange={(event) => setForm({ ...form, project: event.target.value })} />
            </label>
          </div>
          <label>
            <span>Основная ветвь карты</span>
            <select
              value={form.primaryNodeId ?? ""}
              onChange={(event) => setForm({ ...form, primaryNodeId: event.target.value || undefined })}
            >
              <option value="">Без области</option>
              {nodes
                .filter((node) => node.status === "active")
                .map((node) => (
                  <option key={node.id} value={node.id}>
                    {hierarchyLabel(node.kind)} · {knowledgePath(nodes, node.id).map((item) => item.name).join(" → ")}
                  </option>
                ))}
            </select>
          </label>
          <label>
            <span>Теги через запятую</span>
            <input value={form.tagsText} onChange={(event) => setForm({ ...form, tagsText: event.target.value })} placeholder="AI, продукт, исследование" />
          </label>
          <label>
            <span>Следующий шаг</span>
            <input value={form.nextStep ?? ""} onChange={(event) => setForm({ ...form, nextStep: event.target.value })} placeholder="Что конкретно сделать дальше" />
          </label>
          <div className="editor-actions">
            <button type="button" className="danger-button" onClick={() => onDelete(thought.id)}>Удалить</button>
            <div>
              <button type="button" className="reject" onClick={onClose}>Отмена</button>
              <button className="approve-button" disabled={!form.title.trim() || !form.content.trim()}>Сохранить</button>
            </div>
          </div>
        </form>
      </section>
    </div>
  );
}

function MiniGraph({ thoughts, links }: { thoughts: Thought[]; links: ThoughtLink[] }) {
  const nodes = thoughts.slice(0, 6);
  const positions = [
    [116, 68], [48, 36], [184, 28], [55, 110], [178, 105], [116, 132],
  ];
  return (
    <svg className="mini-graph" viewBox="0 0 232 158" aria-label="Миниатюра карты мыслей">
      {links.filter((link) => link.status === "approved").map((link) => {
        const source = nodes.findIndex((thought) => thought.id === link.source);
        const target = nodes.findIndex((thought) => thought.id === link.target);
        if (source < 0 || target < 0) return null;
        return <line key={link.id} x1={positions[source][0]} y1={positions[source][1]} x2={positions[target][0]} y2={positions[target][1]} />;
      })}
      {nodes.map((thought, index) => (
        <circle key={thought.id} cx={positions[index][0]} cy={positions[index][1]} r={index === 0 ? 12 : 8} className={TYPE_CLASS[thought.type]} />
      ))}
    </svg>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return <div className="empty-state"><span>✓</span><h2>{title}</h2><p>{body}</p></div>;
}

function truncate(value: string, length: number) {
  return value.length > length ? `${value.slice(0, length - 1)}…` : value;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ru", { day: "numeric", month: "short" }).format(new Date(value));
}

function formatToday() {
  return new Intl.DateTimeFormat("ru", {
    weekday: "long",
    day: "numeric",
    month: "long",
  })
    .format(new Date())
    .toLocaleUpperCase("ru");
}

type AnalysisRequestPayload = {
  content: string;
  knowledgeNodes: Array<{
    id: string;
    name: string;
    kind: KnowledgeNode["kind"];
    parentId?: string;
  }>;
  thoughts: Array<{
    id: string;
    title: string;
    content: string;
    project: string;
    type: ThoughtType;
    tags?: string[];
    nextStep?: string;
    createdAt?: string;
  }>;
};

async function requestAnalysis(payload: AnalysisRequestPayload) {
  try {
    const response = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (response.ok) return (await response.json()) as AnalysisResponse;

    const errorBody = await response.json().catch(() => ({})) as {
      message?: string;
      reason?: string;
    };
    let message = errorBody.message || `Локальный AI не ответил (код ${response.status}).`;
    if (errorBody.reason) message = `${message} Причина: ${errorBody.reason}.`;
    throw new Error(message);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Локальный AI не ответил.";
    throw new Error(`${message} Автоматический повтор отключён.`);
  }
}

async function requestConfiguredSemanticModel() {
  const response = await fetch("/api/semantic-pipeline", { method: "GET" });
  if (!response.ok) throw new Error(`semantic_model_info_${response.status}`);
  return await response.json() as { model: string; engine: "ollama"; pipelineVersion: string };
}

async function requestSemanticStage<T>(payload: Record<string, unknown>, signal?: AbortSignal) {
  const response = await fetch("/api/semantic-pipeline", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal,
  });
  if (response.ok) return await response.json() as T;
  const error = await response.json().catch(() => ({})) as { reason?: string; diagnostic?: unknown };
  throw new SemanticStageError(error.reason || `semantic_pipeline_${response.status}`, error.diagnostic);
}

class SemanticStageError extends Error {
  constructor(message: string, readonly diagnostic?: unknown) {
    super(message);
    this.name = "SemanticStageError";
  }
}

function formatElapsed(seconds: number) {
  if (seconds < 60) return `${seconds} сек`;
  return `${Math.floor(seconds / 60)} мин ${seconds % 60} сек`;
}

function semanticErrorMessage(value: string) {
  if (value === "ollama_structured_outputs_required") {
    return "Ollama не приняла строгую JSON-схему. Обновите Ollama; тест остановлен до обработки 96 мыслей.";
  }
  if (value === "model_output_truncated") {
    return "Модель остановила ответ по лимиту длины. Контрольная точка сохранена; повторять весь прогон не требуется.";
  }
  if (value === "invalid_model_json") {
    return "Модель вернула ответ, не соответствующий строгому формату. Контрольная точка и диагностика сохранены.";
  }
  if (value.startsWith("model_changed_during_run|")) {
    const [, previousModel, selectedModel] = value.split("|");
    return `Нельзя менять модель внутри одного контрольного прогона (${previousModel} → ${selectedModel}). Завершите его прежней моделью или начните новый чистый прогон.`;
  }
  if (value.startsWith("hierarchy_coverage_repair_failed:")) {
    return "Каркас всё ещё не покрывает часть кластеров после двух точечных расширений. Сохранённые этапы не потеряны; повторять извлечение мыслей и кластеры не требуется.";
  }
  if (value.startsWith("semantic_quality_failed:")) {
    const [, precision, recall, f1] = value.split(":");
    return `Карта построена и сохранена, но независимая смысловая проверка не засчитана: точность ${precision}, полнота ${recall}, F1 ${f1}.`;
  }
  return value;
}

function pipelineDecision(
  runId: string,
  eventType: PersistedAiDecision["eventType"],
  model: string | undefined,
  input: unknown,
  output: unknown,
  engine: PersistedAiDecision["engine"] = "ollama",
): PersistedAiDecision {
  return {
    id: uid(),
    eventType,
    createdAt: new Date().toISOString(),
    engine,
    model: engine === "ollama" ? model : undefined,
    input: { runId, promptVersion: SEMANTIC_PIPELINE_VERSION, ...input as object },
    output,
    userAction: engine === "offline"
      ? "computed_offline_without_model"
      : "accepted_by_deterministic_pipeline_validator",
  };
}

function decisionRunId(decision: PersistedAiDecision) {
  const input = decision.input as { runId?: unknown } | undefined;
  return typeof input?.runId === "string" ? input.runId : undefined;
}

function latestPipelineOutput<T>(
  decisionLog: PersistedAiDecision[],
  runId: string,
  eventType: PersistedAiDecision["eventType"],
) {
  const decision = [...decisionLog].reverse().find((item) => item.eventType === eventType && decisionRunId(item) === runId);
  return decision?.output as T | undefined;
}

function pipelineOutputs<T>(
  decisionLog: PersistedAiDecision[],
  runId: string,
  eventType: PersistedAiDecision["eventType"],
  key: string,
) {
  return decisionLog
    .filter((decision) => decision.eventType === eventType && decisionRunId(decision) === runId)
    .flatMap((decision) => {
      const output = decision.output as Record<string, unknown> | undefined;
      return Array.isArray(output?.[key]) ? [output[key] as T] : [];
    });
}

function semanticPairKey(left: string, right: string) {
  return left < right ? `${left}::${right}` : `${right}::${left}`;
}

function orderSyntheticItems<T extends { number: number }>(
  items: readonly T[],
  variant: "round_robin" | "original" | "reverse" | "seeded",
) {
  if (variant === "round_robin") return [...items];
  if (variant === "original") return [...items].sort((left, right) => left.number - right.number);
  if (variant === "reverse") return [...items].sort((left, right) => right.number - left.number);
  return [...items].sort((left, right) => seededRank(left.number) - seededRank(right.number));
}

function seededRank(number: number) {
  let value = (number ^ 0x9e3779b9) >>> 0;
  value = Math.imul(value ^ (value >>> 16), 0x21f0aaad);
  value = Math.imul(value ^ (value >>> 15), 0x735a2d97);
  return (value ^ (value >>> 15)) >>> 0;
}

function displayThoughtType(type: SemanticExtraction["thoughtType"]): ThoughtType {
  const labels: Record<SemanticExtraction["thoughtType"], ThoughtType> = {
    idea: "Идея",
    question: "Вопрос",
    observation: "Наблюдение",
    decision: "Решение",
    goal: "Действие",
    project: "Проект",
    material: "Наблюдение",
    person: "Наблюдение",
    area: "Наблюдение",
    action: "Действие",
  };
  return labels[type];
}

function displayLinkType(kind: SemanticRelation["kind"]): LinkType {
  const labels: Record<SemanticRelation["kind"], LinkType> = {
    related: "Связано",
    continues: "Продолжает",
    depends_on: "Зависит от",
    alternative: "Альтернатива",
    duplicate: "Связано",
    contradiction: "Противоречит",
  };
  return labels[kind];
}

function pipelineStageLabel(stage: NonNullable<BatchProgress["stage"]>) {
  const labels: Record<NonNullable<BatchProgress["stage"]>, string> = {
    preflight: "проверка локальной модели",
    extract: "извлечение смысла",
    embeddings: "векторизация мыслей",
    cluster: "глобальные кластеры",
    hierarchy: "строгая иерархия",
    candidates: "численные кандидаты",
    relations: "проверка связей",
    complete: "проверка завершена",
  };
  return labels[stage];
}

function pipelineStageHint(stage: NonNullable<BatchProgress["stage"]>) {
  const hints: Partial<Record<NonNullable<BatchProgress["stage"]>, string>> = {
    preflight: "Коротко проверяю модель, строгий JSON-режим и совместимость Ollama до начала дорогого прогона.",
    embeddings: "Создаю численные представления мыслей. Контрольная точка сохраняется после каждой пачки.",
    cluster: "Сначала создаю общий тематический план, затем распределяю мысли пачками по 12. Каждая готовая пачка сохраняется и не повторяется после перезагрузки.",
    hierarchy: "Сначала строю компактный каркас областей и направлений, затем размещаю кластеры пачками по 4. Каждая пачка сохраняется и восстанавливается после перезагрузки.",
    relations: "Отдельно проверяю обычные связи, дубли и противоречия. Ноль найденных связей допустим.",
  };
  return hints[stage] ?? "";
}

function pipelineStageObservationDefaults(
  stage: NonNullable<BatchProgress["stage"]>,
  model?: string,
): {
  workKind: OperationWorkKind;
  runtimeState: OperationRuntimeState;
  stallAfterMs: number;
  modelLabel: string;
  activity: string;
} {
  const localModel = model ?? "локальная модель (уточняется)";
  const defaults: Record<NonNullable<BatchProgress["stage"]>, {
    workKind: OperationWorkKind;
    runtimeState: OperationRuntimeState;
    stallAfterMs: number;
    modelLabel: string;
    activity: string;
  }> = {
    preflight: {
      workKind: "ai",
      runtimeState: "working",
      stallAfterMs: 40_000,
      modelLabel: localModel,
      activity: "Проверяю доступность модели и строгого JSON-режима.",
    },
    extract: {
      workKind: "ai",
      runtimeState: "working",
      stallAfterMs: 110_000,
      modelLabel: localModel,
      activity: "Извлекаю смысл и тип очередной пачки мыслей.",
    },
    embeddings: {
      workKind: "ai",
      runtimeState: "waiting_ai",
      stallAfterMs: 75_000,
      modelLabel: "embeddinggemma",
      activity: "Ожидаю локальные векторные представления текущей пачки.",
    },
    cluster: {
      workKind: "ai",
      runtimeState: "working",
      stallAfterMs: 140_000,
      modelLabel: localModel,
      activity: "Строю глобальные кластеры и сохраняю назначения пачками.",
    },
    hierarchy: {
      workKind: "ai",
      runtimeState: "working",
      stallAfterMs: 140_000,
      modelLabel: localModel,
      activity: "Строю и проверяю иерархию областей, направлений и проектов.",
    },
    candidates: {
      workKind: "local",
      runtimeState: "working",
      stallAfterMs: 20_000,
      modelLabel: "без AI",
      activity: "Локально сравниваю векторы и отбираю численные пары-кандидаты.",
    },
    relations: {
      workKind: "ai",
      runtimeState: "working",
      stallAfterMs: 110_000,
      modelLabel: localModel,
      activity: "Проверяю связи, дубли и противоречия отдельными AI-запросами.",
    },
    complete: {
      workKind: "storage",
      runtimeState: "completed",
      stallAfterMs: 30_000,
      modelLabel: model ?? "без AI",
      activity: "Итоговый checkpoint сохранён.",
    },
  };
  return defaults[stage];
}

function createStartupObservation() {
  return updateOperationObservation(undefined, {
    operationId: `startup-recovery-${Date.now()}`,
    stageKey: "startup-recovery",
    stageLabel: "восстановление локального состояния",
    workKind: "storage",
    runtimeState: "working",
    stallAfterMs: 30_000,
    modelLabel: "без AI",
    activity: "Читаю локальную базу, схему и журнал checkpoint.",
  });
}

function summarizeSemanticPayload(payload: Record<string, unknown>) {
  const summary: Record<string, unknown> = { stage: payload.stage };
  for (const key of ["thoughts", "extractions", "clusters", "nodes", "candidates"]) {
    const value = payload[key];
    if (Array.isArray(value)) summary[`${key}Count`] = value.length;
  }
  if (typeof payload.mode === "string") summary.mode = payload.mode;
  return summary;
}

function latestRunModel(decisionLog: PersistedAiDecision[], runId?: string) {
  if (!runId) return undefined;
  return [...decisionLog].reverse().find((decision) =>
    decisionRunId(decision) === runId
    && decision.engine === "ollama"
    && typeof decision.model === "string"
  )?.model;
}

function semanticStability(decisionLog: PersistedAiDecision[]) {
  const runs = decisionLog
    .filter((decision) => decision.eventType === "pipeline_cluster")
    .flatMap((decision) => {
      const input = decision.input as { runId?: string; promptVersion?: string } | undefined;
      const output = decision.output as { clusters?: SemanticCluster[] } | undefined;
      return input?.runId && Array.isArray(output?.clusters)
        ? [{
            runId: input.runId,
            clusters: output.clusters,
            model: decision.model ?? "unknown",
            pipelineVersion: input.promptVersion ?? "unknown",
          }]
        : [];
    });
  const thoughtIds = SYNTHETIC_TEST_THOUGHTS.map((item) => syntheticThoughtId(item.number));
  const series = new Map<string, typeof runs>();
  for (const run of runs) {
    const key = `${run.model}|${run.pipelineVersion}`;
    series.set(key, [...(series.get(key) ?? []), run]);
  }
  const comparisons = [...series.values()].flatMap((group) => group.slice(1).map((run, index) => ({
    leftRunId: group[index].runId,
    rightRunId: run.runId,
    model: run.model,
    pipelineVersion: run.pipelineVersion,
    pairAgreement: compareClusterings(group[index].clusters, run.clusters, thoughtIds),
  })));
  return {
    runsWithClusters: runs.length,
    comparableSeries: [...series.entries()].map(([key, group]) => ({
      key,
      model: group[0]?.model,
      pipelineVersion: group[0]?.pipelineVersion,
      runIds: group.map((run) => run.runId),
    })),
    comparisons,
    minimumPairAgreement: comparisons.length
      ? Math.min(...comparisons.map((comparison) => comparison.pairAgreement))
      : undefined,
  };
}

function rankCandidates(embedding: number[], thoughts: Thought[]) {
  return [...thoughts]
    .map((thought) => {
      const semantic = thought.embedding
        ? cosineSimilarity(embedding, thought.embedding)
        : 0;
      return { thought, score: semantic };
    })
    .sort((left, right) => right.score - left.score)
    .map(({ thought }) => thought);
}

function cosineSimilarity(left: number[], right: number[]) {
  if (left.length === 0 || left.length !== right.length) return 0;
  let dot = 0;
  let leftMagnitude = 0;
  let rightMagnitude = 0;
  for (let index = 0; index < left.length; index += 1) {
    dot += left[index] * right[index];
    leftMagnitude += left[index] * left[index];
    rightMagnitude += right[index] * right[index];
  }
  const denominator = Math.sqrt(leftMagnitude) * Math.sqrt(rightMagnitude);
  return denominator ? dot / denominator : 0;
}

function draftTitle(content: string) {
  const firstSentence = content.split(/[.!?\n]/)[0]?.trim() || "Новая мысль";
  return firstSentence.length > 70 ? `${firstSentence.slice(0, 69)}…` : firstSentence;
}

function signalLabel(kind: SignalKind) {
  const labels: Record<SignalKind, string> = {
    duplicate: "Возможный повтор",
    contradiction: "Противоречие",
    pattern: "Повторяющаяся тема",
    open_question: "Открытый вопрос",
    risk: "Риск",
    opportunity: "Возможность",
  };
  return labels[kind];
}

function pluralConnections(value: number) {
  if (value % 10 === 1 && value % 100 !== 11) return "связь";
  if ([2, 3, 4].includes(value % 10) && ![12, 13, 14].includes(value % 100)) return "связи";
  return "связей";
}

function diagnosticThought(thought: Thought) {
  const diagnostic: Partial<Thought> = { ...thought };
  delete diagnostic.embedding;
  return diagnostic;
}

function downloadJson(value: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: "application/json;charset=utf-8" });
  downloadBlob(blob, filename);
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
