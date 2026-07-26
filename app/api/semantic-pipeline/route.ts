import { CONFIGURED_SEMANTIC_MODEL } from "../../lib/runtime-config.ts";
import {
  SEMANTIC_PIPELINE_VERSION,
  SEMANTIC_STAGE_LIMITS,
  mergeHierarchyRepairs,
  validateStrictHierarchy,
  type CandidatePurpose,
  type SemanticCandidate,
  type SemanticCluster,
  type SemanticClusterAssignment,
  type SemanticClusterPlan,
  type SemanticExtraction,
  type SemanticHierarchyAssignment,
  type SemanticHierarchyRepair,
  type SemanticRelation,
  type StrictHierarchyNode,
} from "../../lib/semantic-pipeline.ts";

type RawThought = { id: string; content: string };
type Stage = "preflight" | "extract" | "cluster_plan" | "cluster_assign" | "hierarchy_plan" | "hierarchy_assign" | "hierarchy_repair" | "relations";

type JsonRecoveryMode = "direct" | "markdown" | "embedded" | "trailing_commas" | "control_characters";
type GenerationDiagnostic = {
  done?: boolean;
  doneReason?: string;
  promptTokens?: number;
  outputTokens?: number;
  totalDurationMs?: number;
  responseLength?: number;
  responsePreview?: string;
  likelyTruncated?: boolean;
};

class SemanticJsonParseError extends Error {
  diagnostic: GenerationDiagnostic;

  constructor(value: string, generation?: GenerationDiagnostic) {
    super("invalid_model_json");
    this.name = "SemanticJsonParseError";
    const trimmed = value.trim();
    this.diagnostic = {
      ...generation,
      responseLength: value.length,
      responsePreview: trimmed.slice(0, 6000),
      likelyTruncated: trimmed.includes("{") && !findBalancedObject(trimmed),
    };
  }
}

class SemanticGenerationError extends Error {
  diagnostic: GenerationDiagnostic;

  constructor(message: string, diagnostic: GenerationDiagnostic) {
    super(message);
    this.name = "SemanticGenerationError";
    this.diagnostic = diagnostic;
  }
}

const THOUGHT_TYPES = ["idea", "question", "observation", "decision", "goal", "project", "material", "person", "area", "action"] as const;
const RELATION_KINDS = ["related", "continues", "depends_on", "alternative"] as const;

const extractionItemSchema = {
  type: "object",
  additionalProperties: false,
  required: ["thoughtId", "title", "summary", "thoughtType", "subject", "intent", "entities", "desiredOutcome", "timeHorizon", "actionability", "nextStep", "confidence"],
  properties: {
    thoughtId: { type: "string" },
    title: { type: "string", maxLength: 60 },
    summary: { type: "string", maxLength: 160 },
    thoughtType: { type: "string", enum: THOUGHT_TYPES },
    subject: { type: "string", maxLength: 80 },
    intent: { type: "string", maxLength: 100 },
    entities: { type: "array", maxItems: 5, items: { type: "string", maxLength: 40 } },
    desiredOutcome: { type: ["string", "null"], maxLength: 120 },
    timeHorizon: { type: "string", enum: ["now", "soon", "later", "ongoing", "unknown"] },
    actionability: { type: "string", enum: ["none", "possible", "explicit"] },
    nextStep: { type: ["string", "null"], maxLength: 140 },
    confidence: { type: "number", minimum: 0, maximum: 1 },
  },
} as const;

const schemas = {
  preflight: {
    type: "object", additionalProperties: false, required: ["ok"],
    properties: { ok: { type: "boolean" } },
  },
  extract: {
    type: "object", additionalProperties: false, required: ["items"],
    properties: { items: { type: "array", minItems: 1, maxItems: SEMANTIC_STAGE_LIMITS.extractionBatch, items: extractionItemSchema } },
  },
  cluster_plan: {
    type: "object", additionalProperties: false, required: ["clusters"],
    properties: {
      clusters: {
        type: "array", minItems: 2, maxItems: 18,
        items: {
          type: "object", additionalProperties: false,
            required: ["id", "name", "description", "confidence"],
          properties: {
            id: { type: "string", maxLength: 32 },
            name: { type: "string", maxLength: 48 },
            description: { type: "string", maxLength: 120 },
              confidence: { type: "number", minimum: 0, maximum: 1 },
          },
        },
      },
    },
  },
  cluster_assign: {
    type: "object", additionalProperties: false, required: ["assignments"],
    properties: {
      assignments: {
        type: "array", minItems: 1, maxItems: SEMANTIC_STAGE_LIMITS.clusterAssignmentBatch,
        items: {
          type: "object", additionalProperties: false,
          required: ["thoughtId", "clusterId", "confidence"],
          properties: {
            thoughtId: { type: "string" },
            clusterId: { type: "string" },
            confidence: { type: "number", minimum: 0, maximum: 1 },
          },
        },
      },
    },
  },
  hierarchy_plan: {
    type: "object", additionalProperties: false, required: ["areas"],
    properties: {
      areas: {
        type: "array", minItems: 1, maxItems: 8,
        items: {
          type: "object", additionalProperties: false,
          required: ["name", "directions"],
          properties: {
            name: { type: "string", maxLength: 48 },
            directions: {
              type: "array", minItems: 1, maxItems: 6,
              items: { type: "string", maxLength: 48 },
            },
          },
        },
      },
    },
  },
  hierarchy_assign: {
    type: "object", additionalProperties: false, required: ["assignments"],
    properties: {
      assignments: {
        type: "array", minItems: 1, maxItems: SEMANTIC_STAGE_LIMITS.hierarchyAssignmentBatch,
        items: {
          type: "object", additionalProperties: false,
          required: ["clusterId", "directionId", "projectName", "boundedOutcome", "confidence"],
          properties: {
            clusterId: { type: "string", maxLength: 40 },
            directionId: { type: ["string", "null"], maxLength: 100 },
            projectName: { type: ["string", "null"], maxLength: 60 },
            boundedOutcome: { type: ["string", "null"], maxLength: 180 },
            confidence: { type: "number", minimum: 0, maximum: 1 },
          },
        },
      },
    },
  },
  hierarchy_repair: {
    type: "object", additionalProperties: false, required: ["repairs"],
    properties: {
      repairs: {
        type: "array", minItems: 1, maxItems: 8,
        items: {
          type: "object", additionalProperties: false,
          required: ["clusterId", "areaName", "directionName", "confidence"],
          properties: {
            clusterId: { type: "string", maxLength: 40 },
            areaName: { type: "string", maxLength: 48 },
            directionName: { type: "string", maxLength: 48 },
            confidence: { type: "number", minimum: 0, maximum: 1 },
          },
        },
      },
    },
  },
  relations: {
    type: "object", additionalProperties: false, required: ["judgments"],
    properties: {
      judgments: {
        type: "array", maxItems: SEMANTIC_STAGE_LIMITS.relationBatch,
        items: {
          type: "object", additionalProperties: false,
          required: ["sourceId", "targetId", "verdict", "kind", "confidence", "reason"],
          properties: {
            sourceId: { type: "string" },
            targetId: { type: "string" },
            verdict: { type: "string", enum: ["confirmed", "rejected", "uncertain"] },
            kind: { type: "string", enum: [...RELATION_KINDS, "duplicate", "contradiction"] },
            confidence: { type: "number", minimum: 0, maximum: 1 },
            reason: { type: "string", maxLength: 220 },
          },
        },
      },
    },
  },
} as const;

export function GET() {
  const model = CONFIGURED_SEMANTIC_MODEL;
  return Response.json({ engine: "ollama", model, pipelineVersion: SEMANTIC_PIPELINE_VERSION });
}

export async function POST(request: Request) {
  const body = await request.json() as Record<string, unknown>;
  const stage = String(body.stage ?? "") as Stage;
  if (!Object.hasOwn(schemas, stage)) return Response.json({ error: "invalid_stage" }, { status: 400 });

  try {
    const model = CONFIGURED_SEMANTIC_MODEL;
    let result: unknown;
    if (stage === "preflight") result = await preflight(model, request.signal);
    else if (stage === "extract") result = await extract(body, model, request.signal);
    else if (stage === "cluster_plan") result = await clusterPlan(body, model, request.signal);
    else if (stage === "cluster_assign") result = await clusterAssign(body, model, request.signal);
    else if (stage === "hierarchy_plan") result = await hierarchyPlan(body, model, request.signal);
    else if (stage === "hierarchy_assign") result = await hierarchyAssign(body, model, request.signal);
    else if (stage === "hierarchy_repair") result = await hierarchyRepair(body, model, request.signal);
    else result = await relations(body, model, request.signal);
    return Response.json({ ...result as object, engine: "ollama", model, pipelineVersion: SEMANTIC_PIPELINE_VERSION });
  } catch (error) {
    const rawReason = error instanceof Error ? error.message : String(error);
    const reason = /timeout|timed out/i.test(rawReason)
      ? "Локальная модель превысила лимит ожидания. Завершённые контрольные точки сохранены."
      : rawReason;
    console.error(`MindMap semantic pipeline failed:`, reason);
    const diagnostic = error instanceof SemanticJsonParseError || error instanceof SemanticGenerationError
      ? error.diagnostic
      : undefined;
    return Response.json({ error: "semantic_pipeline_failed", stage, reason, diagnostic }, { status: 503 });
  }
}

async function preflight(model: string, signal?: AbortSignal) {
  const generated = await requestOllama(
    model,
    schemas.preflight,
    SEMANTIC_STAGE_LIMITS.outputTokens.preflight,
    "Это техническая проверка строгого структурированного ответа. Верни только требуемый объект.",
    "Подтверди готовность.",
    60_000,
    signal,
  );
  const parsed = parseSemanticJson(generated.content, generated.diagnostic) as {
    value: { ok?: unknown };
    recovery: { mode: JsonRecoveryMode; repaired: boolean };
  };
  if (parsed.value.ok !== true) throw new Error("ollama_structured_output_preflight_failed");
  return {
    stage: "preflight",
    ok: true,
    rawResponse: generated.content,
    generation: generated.diagnostic,
    parseRecovery: parsed.recovery,
  };
}

async function extract(body: Record<string, unknown>, model: string, signal?: AbortSignal) {
  const thoughts = sanitizeThoughts(body.thoughts).slice(0, SEMANTIC_STAGE_LIMITS.extractionBatch);
  if (!thoughts.length) throw new Error("empty_thoughts");
  const generated = await requestOllama(model, schemas.extract, SEMANTIC_STAGE_LIMITS.outputTokens.extract,
    `Ты выполняешь только первый этап смыслового конвейера: извлечение смысла каждой записи независимо от будущей карты.
Верни по одному элементу для каждого входного thoughtId, сохрани ID точно.
thoughtType выбирай по функции записи, а не по грамматике. Проект — только ограниченная работа с проверяемым результатом; постоянная сфера жизни — area.
nextStep заполняй только для явного или действительно следующего действия. Наблюдение, вопрос и идея не обязаны становиться задачей.
Не кластеризуй записи, не создавай связи, не ищи дубли и противоречия.`,
    JSON.stringify(thoughts), 180_000, signal);
  const parsedResult = parseSemanticJson(generated.content, generated.diagnostic);
  const parsed = parsedResult.value as { items?: Array<Record<string, unknown>> };
  const sourceById = new Map(thoughts.map((thought) => [thought.id, thought.content]));
  const seen = new Set<string>();
  const items = (Array.isArray(parsed.items) ? parsed.items : []).flatMap((item) => {
    const thoughtId = clean(item.thoughtId, 80);
    const sourceText = sourceById.get(thoughtId);
    if (!sourceText || seen.has(thoughtId)) return [];
    seen.add(thoughtId);
    return [{
      thoughtId,
      sourceText,
      title: clean(item.title, 70) || shortTitle(sourceText),
      summary: clean(item.summary, 240) || sourceText,
      thoughtType: THOUGHT_TYPES.includes(item.thoughtType as typeof THOUGHT_TYPES[number]) ? item.thoughtType : "observation",
      subject: clean(item.subject, 100),
      intent: clean(item.intent, 140),
      entities: strings(item.entities, 8, 50),
      desiredOutcome: optional(item.desiredOutcome, 160),
      timeHorizon: ["now", "soon", "later", "ongoing", "unknown"].includes(String(item.timeHorizon)) ? item.timeHorizon : "unknown",
      actionability: ["none", "possible", "explicit"].includes(String(item.actionability)) ? item.actionability : "none",
      nextStep: optional(item.nextStep, 180),
      confidence: score(item.confidence),
    } satisfies SemanticExtraction];
  });
  if (items.length !== thoughts.length) throw new Error(`incomplete_extraction_${items.length}_of_${thoughts.length}`);
  return { stage: "extract", items, rawResponse: generated.content, generation: generated.diagnostic, parseRecovery: parsedResult.recovery };
}

async function clusterPlan(body: Record<string, unknown>, model: string, signal?: AbortSignal) {
  const extractions = sanitizeExtractions(body.extractions).slice(0, 96);
  if (extractions.length < 2) throw new Error("insufficient_extractions");
  const compact = extractions.map(({ thoughtId, title, subject }) => ({ i: thoughtId, t: title, s: subject }));
  const generated = await requestOllama(model, schemas.cluster_plan, SEMANTIC_STAGE_LIMITS.outputTokens.clusterPlan,
    `Ты создаёшь только глобальный план тематических кластеров для всего набора мыслей.
Верни от 2 до 18 устойчивых смысловых кластеров, но пока не назначай в них отдельные thoughtId.
Не объединяй темы только из-за общих слов AI, бизнес, система или продукт.
Разделяй, например, профессиональную видеографию, AI-видеографию, развитие AI-навыков, автоматизацию бизнеса, дом, умный дом и DIY-устройства, если данные подтверждают различие.
Не строй иерархию, проекты, связи, дубли или противоречия.
Ответ должен содержать только один короткий JSON-объект без рассуждений, Markdown и пояснений.`, JSON.stringify(compact), 180_000, signal);
  const parsedResult = parseSemanticJson(generated.content, generated.diagnostic);
  const parsed = parsedResult.value as { clusters?: Array<Record<string, unknown>> };
  const usedClusterIds = new Set<string>();
  const clusters: SemanticClusterPlan[] = (Array.isArray(parsed.clusters) ? parsed.clusters : []).map((item, index) => {
    const base = slug(clean(item.id, 40) || clean(item.name, 60) || `cluster-${index + 1}`);
    let id = base || `cluster-${index + 1}`;
    let suffix = 2;
    while (usedClusterIds.has(id)) id = `${base}-${suffix++}`;
    usedClusterIds.add(id);
    return {
      id,
      name: clean(item.name, 60) || `Кластер ${index + 1}`,
      description: clean(item.description, 200),
      confidence: score(item.confidence),
    };
  });
  if (clusters.length < 2) throw new Error("insufficient_cluster_plan");
  return { stage: "cluster_plan", clusters, validation: { valid: true, issues: [] }, rawResponse: generated.content, generation: generated.diagnostic, parseRecovery: parsedResult.recovery };
}

async function clusterAssign(body: Record<string, unknown>, model: string, signal?: AbortSignal) {
  const extractions = sanitizeExtractions(body.extractions).slice(0, SEMANTIC_STAGE_LIMITS.clusterAssignmentBatch);
  const clusters = sanitizeClusterPlan(body.clusters).slice(0, 18);
  if (!extractions.length || clusters.length < 2) throw new Error("invalid_cluster_assignment_input");
  const compactThoughts = extractions.map(({ thoughtId, title, summary, thoughtType, subject, intent }) => ({ thoughtId, title, summary, thoughtType, subject, intent }));
  const generated = await requestOllama(model, schemas.cluster_assign, SEMANTIC_STAGE_LIMITS.outputTokens.clusterAssign,
    `Назначь каждую входную мысль ровно в один кластер из предоставленного плана.
Верни ровно одно назначение для каждого thoughtId. Используй clusterId без изменений. Не создавай новые кластеры и не пропускай мысли.
Сходство по одному общему слову недостаточно: выбирай кластер по предмету и намерению мысли.`,
    JSON.stringify({ clusters, thoughts: compactThoughts }), 90_000, signal);
  const parsedResult = parseSemanticJson(generated.content, generated.diagnostic);
  const parsed = parsedResult.value as { assignments?: Array<Record<string, unknown>> };
  const validThoughts = new Set(extractions.map((item) => item.thoughtId));
  const validClusters = new Set(clusters.map((cluster) => cluster.id));
  const seen = new Set<string>();
  const assignments: SemanticClusterAssignment[] = (Array.isArray(parsed.assignments) ? parsed.assignments : []).flatMap((item) => {
    const thoughtId = clean(item.thoughtId, 80);
    const clusterId = clean(item.clusterId, 40);
    if (!validThoughts.has(thoughtId) || !validClusters.has(clusterId) || seen.has(thoughtId)) return [];
    seen.add(thoughtId);
    return [{ thoughtId, clusterId, confidence: score(item.confidence) }];
  });
  if (assignments.length !== extractions.length) throw new Error(`incomplete_cluster_assignment_${assignments.length}_of_${extractions.length}`);
  return { stage: "cluster_assign", assignments, validation: { valid: true, issues: [] }, rawResponse: generated.content, generation: generated.diagnostic, parseRecovery: parsedResult.recovery };
}

async function hierarchyPlan(body: Record<string, unknown>, model: string, signal?: AbortSignal) {
  const clusters = sanitizeClusters(body.clusters);
  const extractions = sanitizeExtractions(body.extractions);
  if (clusters.length < 2) throw new Error("insufficient_clusters");
  const extractionById = new Map(extractions.map((item) => [item.thoughtId, item]));
  const compact = clusters.map(({ id, name, description, memberThoughtIds }) => ({
    id,
    name,
    description,
    examples: memberThoughtIds
      .slice(0, 4)
      .flatMap((thoughtId) => {
        const extraction = extractionById.get(thoughtId);
        return extraction ? [{ title: extraction.title, summary: extraction.summary }] : [];
      }),
  }));
  const generated = await requestOllama(model, schemas.hierarchy_plan, SEMANTIC_STAGE_LIMITS.outputTokens.hierarchyPlan,
    `Создай только компактный словарь областей и направлений для готовых тематических кластеров.
Область — постоянная крупная сфера жизни или деятельности. Направление — устойчивая тема внутри области.
Не создавай проекты, описания, ID, связи и назначения кластеров. Не повторяй одинаковые или синонимические названия.
Каждый кластер должен иметь хотя бы одно естественно подходящее направление. Примеры мыслей важнее слишком общего названия кластера.
Обычно достаточно 3–8 областей и 1–5 направлений в каждой. Названия должны быть короткими и понятными без контекста.`,
    JSON.stringify(compact),
    120_000,
    signal,
  );
  const parsedResult = parseSemanticJson(generated.content, generated.diagnostic);
  const parsed = parsedResult.value as { areas?: Array<Record<string, unknown>> };
  const rawAreas = Array.isArray(parsed.areas) ? parsed.areas : [];
  const usedIds = new Set<string>();
  const nodes: StrictHierarchyNode[] = [];

  const uniqueId = (baseValue: string) => {
    const base = slug(baseValue) || "node";
    let id = base;
    let suffix = 2;
    while (usedIds.has(id)) id = `${base}-${suffix++}`;
    usedIds.add(id);
    return id;
  };

  for (const rawArea of rawAreas) {
    const areaName = clean(rawArea.name, 48);
    if (!areaName) continue;
    const directionNames = [...new Set(strings(rawArea.directions, 6, 48).map((name) => normalizeLabel(name)))];
    if (!directionNames.length) continue;
    const areaId = uniqueId(`area-${areaName}`);
    nodes.push({
      id: areaId,
      name: areaName,
      kind: "area",
      description: "",
      sourceClusterIds: [],
      confidence: 0.5,
    });
    for (const normalizedDirection of directionNames) {
      const directionName = strings(rawArea.directions, 6, 48)
        .find((name) => normalizeLabel(name) === normalizedDirection);
      if (!directionName) continue;
      nodes.push({
        id: uniqueId(`direction-${areaName}-${directionName}`),
        name: directionName,
        kind: "direction",
        parentId: areaId,
        description: "",
        sourceClusterIds: [],
        confidence: 0.5,
      });
    }
  }
  const issues = validateStrictHierarchy(nodes);
  if (!nodes.some((node) => node.kind === "area") || !nodes.some((node) => node.kind === "direction")) {
    issues.push({ code: "invalid_placement_leaf", message: "Каркас должен содержать области и направления.", ids: nodes.map((node) => node.id) });
  }
  if (issues.length) throw new Error(`invalid_hierarchy:${issues.map((issue) => issue.code).join(",")}`);
  return {
    stage: "hierarchy_plan",
    nodes,
    validation: { valid: true, issues: [] },
    rawResponse: generated.content,
    generation: generated.diagnostic,
    parseRecovery: parsedResult.recovery,
  };
}

async function hierarchyAssign(body: Record<string, unknown>, model: string, signal?: AbortSignal) {
  const clusters = sanitizeClusters(body.clusters).slice(0, SEMANTIC_STAGE_LIMITS.hierarchyAssignmentBatch);
  const nodes = sanitizeHierarchyNodes(body.nodes);
  const directions = nodes.filter((node) => node.kind === "direction");
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  if (!clusters.length || !directions.length) throw new Error("invalid_hierarchy_assignment_input");
  const generated = await requestOllama(model, schemas.hierarchy_assign, SEMANTIC_STAGE_LIMITS.outputTokens.hierarchyAssign,
    `Проверь, существует ли для каждого входного кластера естественно подходящее направление directionId.
Верни ровно одно назначение для каждого clusterId. Используй directionId без изменений или null, если подходящего направления действительно нет.
Если кластер описывает ограниченную работу с проверяемым конечным результатом, укажи короткое projectName и конкретный boundedOutcome. Иначе оба поля верни null.
Постоянная сфера, навык, канал работы, исследовательское направление или общая тема не являются проектом.
projectName не может повторять название направления.
Не создавай области, направления, связи или дополнительные кластеры.`, JSON.stringify({
      directions: directions.map(({ id, name, parentId }) => ({
        id,
        name,
        areaName: parentId ? nodeById.get(parentId)?.name : undefined,
      })),
      clusters: clusters.map(({ id, name, description }) => ({ id, name, description })),
    }), 75_000, signal);
  const parsedResult = parseSemanticJson(generated.content, generated.diagnostic);
  const parsed = parsedResult.value as { assignments?: Array<Record<string, unknown>> };
  const validClusters = new Set(clusters.map((cluster) => cluster.id));
  const validDirections = new Set(directions.map((node) => node.id));
  const seen = new Set<string>();
  const assignments: SemanticHierarchyAssignment[] = (Array.isArray(parsed.assignments) ? parsed.assignments : []).flatMap((item) => {
    const clusterId = clean(item.clusterId, 40);
    const directionId = optional(item.directionId, 100);
    if (!validClusters.has(clusterId) || (directionId && !validDirections.has(directionId)) || seen.has(clusterId)) return [];
    seen.add(clusterId);
    const projectName = optional(item.projectName, 60);
    const boundedOutcome = optional(item.boundedOutcome, 180);
    return [{
      clusterId,
      directionId: directionId || undefined,
      projectName: projectName && boundedOutcome ? projectName : undefined,
      boundedOutcome: projectName && boundedOutcome ? boundedOutcome : undefined,
      confidence: score(item.confidence),
    }];
  });
  if (assignments.length !== clusters.length) throw new Error(`incomplete_hierarchy_assignment_${assignments.length}_of_${clusters.length}`);
  return { stage: "hierarchy_assign", assignments, validation: { valid: true, issues: [] }, rawResponse: generated.content, generation: generated.diagnostic, parseRecovery: parsedResult.recovery };
}

async function hierarchyRepair(body: Record<string, unknown>, model: string, signal?: AbortSignal) {
  const clusters = sanitizeClusters(body.clusters).slice(0, 8);
  const nodes = sanitizeHierarchyNodes(body.nodes);
  const extractions = sanitizeExtractions(body.extractions);
  if (!clusters.length || !nodes.length) throw new Error("invalid_hierarchy_repair_input");
  const extractionById = new Map(extractions.map((item) => [item.thoughtId, item]));
  const compactClusters = clusters.map(({ id, name, description, memberThoughtIds }) => ({
    id,
    name,
    description,
    examples: memberThoughtIds
      .slice(0, 4)
      .flatMap((thoughtId) => {
        const extraction = extractionById.get(thoughtId);
        return extraction ? [{ title: extraction.title, summary: extraction.summary }] : [];
      }),
  }));
  const existing = nodes.map((node) => ({
    name: node.name,
    kind: node.kind,
    parentName: node.parentId
      ? nodes.find((candidate) => candidate.id === node.parentId)?.name
      : undefined,
  }));
  const generated = await requestOllama(
    model,
    schemas.hierarchy_repair,
    SEMANTIC_STAGE_LIMITS.outputTokens.hierarchyRepair,
    `Каркас областей и направлений не покрывает перечисленные кластеры без смысловой натяжки.
Для каждого clusterId предложи ровно одну естественную пару areaName и directionName.
Переиспользуй название существующей области, если она действительно подходит; иначе создай новую область.
Не повторяй существующее направление синонимом и не превращай проект или отдельную задачу в постоянную область.
Ответ должен покрывать каждый clusterId ровно один раз.`,
    JSON.stringify({ existing, uncoveredClusters: compactClusters }),
    120_000,
    signal,
  );
  const parsedResult = parseSemanticJson(generated.content, generated.diagnostic);
  const parsed = parsedResult.value as { repairs?: Array<Record<string, unknown>> };
  const validClusters = new Set(clusters.map((cluster) => cluster.id));
  const seen = new Set<string>();
  const repairs: SemanticHierarchyRepair[] = (Array.isArray(parsed.repairs) ? parsed.repairs : []).flatMap((item) => {
    const clusterId = clean(item.clusterId, 40);
    const areaName = clean(item.areaName, 48);
    const directionName = clean(item.directionName, 48);
    if (!validClusters.has(clusterId) || seen.has(clusterId) || !areaName || !directionName) return [];
    seen.add(clusterId);
    return [{ clusterId, areaName, directionName, confidence: score(item.confidence) }];
  });
  if (repairs.length !== clusters.length) {
    throw new Error(`incomplete_hierarchy_repair_${repairs.length}_of_${clusters.length}`);
  }
  const merged = mergeHierarchyRepairs(nodes, repairs);
  if (merged.issues.length) {
    throw new Error(`invalid_hierarchy_repair:${merged.issues.map((issue) => issue.code).join(",")}`);
  }
  return {
    stage: "hierarchy_repair",
    repairs,
    nodes: merged.nodes,
    assignments: merged.assignments,
    validation: { valid: true, issues: [] },
    rawResponse: generated.content,
    generation: generated.diagnostic,
    parseRecovery: parsedResult.recovery,
  };
}

async function relations(body: Record<string, unknown>, model: string, signal?: AbortSignal) {
  const mode = String(body.mode ?? "") as CandidatePurpose;
  if (!["related", "duplicate", "contradiction"].includes(mode)) throw new Error("invalid_relation_mode");
  const extractions = sanitizeExtractions(body.extractions);
  const byId = new Map(extractions.map((item) => [item.thoughtId, item]));
  const candidates = sanitizeCandidates(body.candidates).filter((candidate) => candidate.purposes.includes(mode)).slice(0, SEMANTIC_STAGE_LIMITS.relationBatch);
  if (!candidates.length) return { stage: "relations", mode, judgments: [], rawResponse: "", skipped: "no_candidates_above_threshold" };
  const input = candidates.map((candidate) => ({
    source: byId.get(candidate.sourceId), target: byId.get(candidate.targetId), similarity: candidate.similarity,
  })).filter((pair) => pair.source && pair.target);
  const modeRules: Record<CandidatePurpose, string> = {
    related: `Проверяй только полезную смысловую связь. Общее слово или принадлежность широкой теме недостаточны. kind выбирай related, continues, depends_on или alternative.`,
    duplicate: `Проверяй только строгий смысловой дубль: две записи утверждают или спрашивают практически одно и то же. Близкая тема, развитие идеи или частичное пересечение — rejected. kind всегда duplicate.`,
    contradiction: `Проверяй только логическое противоречие: утверждения не могут быть истинны одновременно в одном контексте и времени. Конкурирующие приоритеты, риск, альтернатива, сомнение или разные аспекты — не противоречие. kind всегда contradiction.`,
  };
  const generated = await requestOllama(model, schemas.relations, SEMANTIC_STAGE_LIMITS.outputTokens.relations,
    `Ты выполняешь отдельную строгую проверку кандидатов режима ${mode}. ${modeRules[mode]}
Численное similarity — только причина показать пару, а не доказательство. Для каждой входной пары верни ровно один verdict. Если данных недостаточно — uncertain. Не создавай новых пар и не меняй ID.`, JSON.stringify(input), 90_000, signal);
  const parsedResult = parseSemanticJson(generated.content, generated.diagnostic);
  const parsed = parsedResult.value as { judgments?: Array<Record<string, unknown>> };
  const candidateByKey = new Map(candidates.map((candidate) => [pairKey(candidate.sourceId, candidate.targetId), candidate]));
  const judgments: SemanticRelation[] = (Array.isArray(parsed.judgments) ? parsed.judgments : []).flatMap((item) => {
    const sourceId = clean(item.sourceId, 80);
    const targetId = clean(item.targetId, 80);
    const candidate = candidateByKey.get(pairKey(sourceId, targetId));
    if (!candidate) return [];
    const verdict = ["confirmed", "rejected", "uncertain"].includes(String(item.verdict)) ? item.verdict as SemanticRelation["verdict"] : "uncertain";
    const requestedKind = clean(item.kind, 30) as SemanticRelation["kind"];
    const kind = mode === "duplicate" ? "duplicate" : mode === "contradiction" ? "contradiction" : RELATION_KINDS.includes(requestedKind as typeof RELATION_KINDS[number]) ? requestedKind : "related";
    return [{ sourceId: candidate.sourceId, targetId: candidate.targetId, kind, verdict, confidence: score(item.confidence), reason: clean(item.reason, 220), similarity: candidate.similarity, status: "proposed" as const }];
  });
  return { stage: "relations", mode, judgments, rawResponse: generated.content, generation: generated.diagnostic, parseRecovery: parsedResult.recovery };
}

async function requestOllama(model: string, format: Record<string, unknown>, numPredict: number, system: string, user: string, timeoutMs = 180_000, signal?: AbortSignal) {
  const host = process.env.OLLAMA_HOST || "http://127.0.0.1:11434";
  const timeoutSignal = AbortSignal.timeout(timeoutMs);
  const requestSignal = signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal;
  const response = await fetch(`${host}/api/chat`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      stream: false,
      think: false,
      format,
      options: {
        temperature: 0,
        seed: 42,
        num_ctx: 16384,
        num_predict: numPredict,
      },
      messages: [{ role: "system", content: system }, { role: "user", content: user }],
    }),
    signal: requestSignal,
  });
  if (response.status === 400) {
    throw new SemanticGenerationError("ollama_structured_outputs_required", {
      done: false,
      doneReason: "schema_rejected",
    });
  }
  if (!response.ok) throw new Error(`ollama_${response.status}`);
  const data = await response.json() as {
    message?: { content?: string };
    done?: boolean;
    done_reason?: string;
    prompt_eval_count?: number;
    eval_count?: number;
    total_duration?: number;
  };
  const content = data.message?.content?.trim();
  if (!content) throw new Error("empty_model_response");
  const diagnostic: GenerationDiagnostic = {
    done: data.done,
    doneReason: data.done_reason,
    promptTokens: data.prompt_eval_count,
    outputTokens: data.eval_count,
    totalDurationMs: typeof data.total_duration === "number"
      ? Math.round(data.total_duration / 1_000_000)
      : undefined,
    responseLength: content.length,
    responsePreview: content.slice(0, 6000),
  };
  if (data.done === false || data.done_reason === "length") {
    throw new SemanticGenerationError("model_output_truncated", {
      ...diagnostic,
      likelyTruncated: true,
    });
  }
  return { content, diagnostic };
}

function sanitizeThoughts(value: unknown): RawThought[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const record = item as Record<string, unknown>;
    const id = clean(record.id, 80); const content = clean(record.content, 2000);
    return id && content ? [{ id, content }] : [];
  });
}

function sanitizeExtractions(value: unknown): SemanticExtraction[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is SemanticExtraction => Boolean(item && typeof item === "object" && clean((item as SemanticExtraction).thoughtId, 80)));
}

function sanitizeClusters(value: unknown): SemanticCluster[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is SemanticCluster => Boolean(item && typeof item === "object" && clean((item as SemanticCluster).id, 40)));
}

function sanitizeHierarchyNodes(value: unknown): StrictHierarchyNode[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const record = item as Record<string, unknown>;
    const id = clean(record.id, 100);
    const kind = String(record.kind);
    if (!id || !["area", "direction"].includes(kind)) return [];
    return [{
      id,
      name: clean(record.name, 60),
      kind: kind as StrictHierarchyNode["kind"],
      parentId: optional(record.parentId, 100),
      description: clean(record.description, 200),
      sourceClusterIds: strings(record.sourceClusterIds, 24, 40),
      confidence: score(record.confidence),
    }];
  });
}

function sanitizeClusterPlan(value: unknown): SemanticClusterPlan[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const record = item as Record<string, unknown>;
    const id = clean(record.id, 40);
    if (!id) return [];
    return [{ id, name: clean(record.name, 60), description: clean(record.description, 200), confidence: score(record.confidence) }];
  });
}

function sanitizeCandidates(value: unknown): SemanticCandidate[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is SemanticCandidate => Boolean(item && typeof item === "object" && Array.isArray((item as SemanticCandidate).purposes)));
}

export function parseSemanticJson(
  value: string,
  generation?: GenerationDiagnostic,
): { value: unknown; recovery: { mode: JsonRecoveryMode; repaired: boolean } } {
  const direct = tryParse(value.trim());
  if (direct.ok) return { value: direct.value, recovery: { mode: "direct", repaired: false } };

  const withoutThinking = value.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
  const withoutMarkdown = withoutThinking.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
  const markdown = tryParse(withoutMarkdown);
  if (markdown.ok) return { value: markdown.value, recovery: { mode: "markdown", repaired: true } };

  const embeddedObject = findBalancedObject(withoutMarkdown);
  if (embeddedObject) {
    const embedded = tryParse(embeddedObject);
    if (embedded.ok) return { value: embedded.value, recovery: { mode: "embedded", repaired: true } };

    const withoutTrailingCommas = embeddedObject.replace(/,\s*([}\]])/g, "$1");
    const trailingCommas = tryParse(withoutTrailingCommas);
    if (trailingCommas.ok) return { value: trailingCommas.value, recovery: { mode: "trailing_commas", repaired: true } };

    const escapedControls = escapeControlCharactersInStrings(withoutTrailingCommas);
    const controlCharacters = tryParse(escapedControls);
    if (controlCharacters.ok) return { value: controlCharacters.value, recovery: { mode: "control_characters", repaired: true } };
  }

  throw new SemanticJsonParseError(value, generation);
}

function tryParse(value: string): { ok: true; value: unknown } | { ok: false } {
  if (!value) return { ok: false };
  try { return { ok: true, value: JSON.parse(value) }; } catch { return { ok: false }; }
}

function findBalancedObject(value: string) {
  const start = value.indexOf("{");
  if (start < 0) return undefined;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < value.length; index += 1) {
    const character = value[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === '"') inString = false;
      continue;
    }
    if (character === '"') inString = true;
    else if (character === "{") depth += 1;
    else if (character === "}" && --depth === 0) return value.slice(start, index + 1);
  }
  return undefined;
}

function escapeControlCharactersInStrings(value: string) {
  let result = "";
  let inString = false;
  let escaped = false;
  for (const character of value) {
    if (inString) {
      if (escaped) {
        escaped = false;
        result += character;
        continue;
      }
      if (character === "\\") {
        escaped = true;
        result += character;
        continue;
      }
      if (character === '"') inString = false;
      if (character === "\n") { result += "\\n"; continue; }
      if (character === "\r") { result += "\\r"; continue; }
      if (character === "\t") { result += "\\t"; continue; }
    } else if (character === '"') inString = true;
    result += character;
  }
  return result;
}

function clean(value: unknown, max: number) { return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max); }
function optional(value: unknown, max: number) { const result = clean(value, max); return result || undefined; }
function strings(value: unknown, count: number, max: number) { return Array.isArray(value) ? value.map((item) => clean(item, max)).filter(Boolean).slice(0, count) : []; }
function score(value: unknown) { const number = Number(value); return Number.isFinite(number) ? Math.max(0, Math.min(1, number)) : 0; }
function shortTitle(value: string) { const sentence = value.split(/[.!?\n]/)[0].trim(); return sentence.length > 70 ? `${sentence.slice(0, 69)}…` : sentence; }
function slug(value: string) { return value.toLocaleLowerCase("ru").replace(/[^a-zа-яё0-9]+/gi, "-").replace(/^-|-$/g, "").slice(0, 70); }
function normalizeLabel(value: string) { return value.toLocaleLowerCase("ru-RU").replace(/ё/g, "е").replace(/\s+/g, " ").trim(); }
function pairKey(left: string, right: string) { return left < right ? `${left}::${right}` : `${right}::${left}`; }
