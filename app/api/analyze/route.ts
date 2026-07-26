import { CONFIGURED_SEMANTIC_MODEL } from "../../lib/runtime-config.ts";
import { strictProposedPath } from "../../lib/knowledge.ts";

type InputThought = {
  id: string;
  title: string;
  content: string;
  project: string;
  type: string;
  tags?: string[];
  nextStep?: string;
  createdAt?: string;
};

type InputKnowledgeNode = {
  id: string;
  name: string;
  kind: "area" | "direction" | "project";
  parentId?: string;
};

type LinkType = "Связано" | "Продолжает" | "Противоречит" | "Зависит от" | "Альтернатива";
type SignalKind = "duplicate" | "contradiction" | "pattern" | "open_question" | "risk" | "opportunity";

type ParsedConnection = {
  targetId?: unknown;
  type?: unknown;
  reason?: unknown;
  confidence?: unknown;
};

type ParsedSignal = {
  kind?: unknown;
  targetId?: unknown;
  message?: unknown;
};

type ParsedAnalysis = {
  thought?: {
    title?: unknown;
    type?: unknown;
    project?: unknown;
    tags?: unknown;
    summary?: unknown;
    nextStep?: unknown;
  };
  connections?: ParsedConnection[];
  signals?: ParsedSignal[];
  placement?: {
    primaryPath?: ParsedHierarchyNode[];
    additionalPaths?: ParsedHierarchyNode[][];
  };
};

type ParsedHierarchyNode = {
  existingNodeId?: unknown;
  name?: unknown;
  kind?: unknown;
  confidence?: unknown;
  reason?: unknown;
};

const ALLOWED_TYPES = new Set(["Идея", "Вопрос", "Решение", "Действие", "Наблюдение", "Проект"]);
const ALLOWED_LINKS = new Set(["Связано", "Продолжает", "Противоречит", "Зависит от", "Альтернатива"]);
const ALLOWED_SIGNALS = new Set(["duplicate", "contradiction", "pattern", "open_question", "risk", "opportunity"]);
const ALLOWED_NODE_KINDS = new Set(["area", "direction", "project"]);

const HIERARCHY_NODE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["name", "kind", "confidence", "reason"],
  properties: {
    existingNodeId: { type: ["string", "null"] },
    name: { type: "string", maxLength: 60 },
    kind: { type: "string", enum: ["area", "direction", "project"] },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    reason: { type: "string", maxLength: 140 },
  },
} as const;

const THOUGHT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["title", "type", "project", "tags", "summary", "nextStep"],
  properties: {
    title: { type: "string", maxLength: 70 },
    type: {
      type: "string",
      enum: ["Идея", "Вопрос", "Решение", "Действие", "Наблюдение", "Проект"],
    },
    project: { type: "string", maxLength: 45 },
    tags: { type: "array", maxItems: 4, items: { type: "string", maxLength: 24 } },
    summary: { type: "string", maxLength: 240 },
    nextStep: { type: ["string", "null"], maxLength: 180 },
  },
} as const;

const PLACEMENT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["primaryPath", "additionalPaths"],
  properties: {
    primaryPath: {
      type: "array",
      minItems: 1,
      maxItems: 3,
      items: HIERARCHY_NODE_SCHEMA,
    },
    additionalPaths: {
      type: "array",
      maxItems: 2,
      items: {
        type: "array",
        minItems: 1,
        maxItems: 3,
        items: HIERARCHY_NODE_SCHEMA,
      },
    },
  },
} as const;

const ANALYSIS_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["thought", "placement", "connections", "signals"],
  properties: {
    thought: THOUGHT_SCHEMA,
    placement: PLACEMENT_SCHEMA,
    connections: {
      type: "array",
      maxItems: 4,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["targetId", "type", "reason", "confidence"],
        properties: {
          targetId: { type: "string" },
          type: {
            type: "string",
            enum: ["Связано", "Продолжает", "Противоречит", "Зависит от", "Альтернатива"],
          },
          reason: { type: "string", maxLength: 180 },
          confidence: { type: "number", minimum: 0, maximum: 1 },
        },
      },
    },
    signals: {
      type: "array",
      maxItems: 4,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["kind", "targetId", "message"],
        properties: {
          kind: {
            type: "string",
            enum: ["duplicate", "contradiction", "pattern", "open_question", "risk", "opportunity"],
          },
          targetId: { type: ["string", "null"] },
          message: { type: "string", maxLength: 180 },
        },
      },
    },
  },
} as const;

const RECOVERY_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["thought", "placement"],
  properties: {
    thought: THOUGHT_SCHEMA,
    placement: PLACEMENT_SCHEMA,
  },
} as const;

export async function POST(request: Request) {
  const body = (await request.json()) as {
    content?: string;
    thoughts?: InputThought[];
    knowledgeNodes?: InputKnowledgeNode[];
  };
  const content = body.content?.trim();
  const thoughts = Array.isArray(body.thoughts) ? body.thoughts.slice(0, 16) : [];
  const knowledgeNodes = Array.isArray(body.knowledgeNodes) ? body.knowledgeNodes.slice(0, 72) : [];
  if (!content) return Response.json({ error: "empty_content" }, { status: 400 });

  try {
    const model = CONFIGURED_SEMANTIC_MODEL;
    const host = process.env.OLLAMA_HOST || "http://127.0.0.1:11434";
    const contextMessage = `НОВАЯ ЗАПИСЬ:\n${content}\n\nИЕРАРХИЯ ОБЛАСТЕЙ:\n${JSON.stringify(knowledgeNodes)}\n\nСВЯЗАННЫЕ МЫСЛИ:\n${JSON.stringify(thoughts)}`;
    let parsed: ParsedAnalysis;
    let recovery: {
      used: true;
      mode: "local_json_repair" | "compact_reanalysis";
      reason: string;
      omittedConnections: boolean;
    } | undefined;

    try {
      const raw = await requestOllama({
        host,
        model,
        format: ANALYSIS_JSON_SCHEMA,
        numPredict: 1500,
        system: `Ты — аналитический модуль персональной системы мышления. Разбери новую запись в контексте существующей базы. Верни только JSON следующей формы:
{"thought":{"title":"...","type":"...","project":"...","tags":["..."],"summary":"...","nextStep":null},"placement":{"primaryPath":[{"existingNodeId":"...","name":"...","kind":"area","confidence":0.0,"reason":"..."}],"additionalPaths":[]},"connections":[{"targetId":"...","type":"...","reason":"...","confidence":0.0}],"signals":[{"kind":"...","targetId":"...","message":"..."}]}.

Правила:
- Исходную запись не переписывай и не исправляй.
- type мысли: Идея, Вопрос, Решение, Действие, Наблюдение или Проект.
- Иерархия отделена от типа мысли. kind узла: area, direction или project.
- area — широкая долговременная рабочая среда; direction — тематическая ветвь внутри области; project — конечная работа с ожидаемым результатом.
- Допустима только иерархия area → direction → необязательный project. Область всегда корневая, направления внутри направлений и области внутри областей запрещены.
- Project создавай только для ограниченной работы с проверяемым результатом. Постоянная сфера, тема, навык и исследовательское направление проектом не являются.
- Строй primaryPath максимум из 3 уровней. Минимальный корректный путь — area → direction.
- Переиспользуй существующий узел через existingNodeId, когда смысл совпадает. Не выдумывай ID. Для нового узла не указывай existingNodeId.
- Не создавай отдельный узел ради каждого существительного. Новый узел оправдан, только если сможет объединять несколько мыслей или обозначает реальный проект.
- additionalPaths добавляй только при уверенной принадлежности записи ещё к одной ветви, максимум 2 пути.
- confidence и reason обязательны для каждого сегмента пути. Если подходящей ветви нет, создай минимально необходимый путь.
- type связи: Связано, Продолжает, Противоречит, Зависит от или Альтернатива.
- kind сигнала: duplicate, contradiction, pattern, open_question, risk или opportunity.
- title до 70 символов; summary — одно конкретное предложение о сути записи; tags — максимум 4 коротких тега.
- project — совместимое короткое имя ближайшего project-узла. Если проект не нужен, верни имя самого конкретного направления или "Без проекта".
- nextStep предложи только когда действие действительно следует из записи и контекста. Иначе верни null. Не превращай каждую мысль в задачу.
- Выбери максимум 4 полезные связи. Для каждой объясни конкретно, почему она важна. Не связывай записи только из-за общего слова.
- Сигналы добавляй лишь при наличии основания в данных. Для duplicate и contradiction обязательно укажи targetId.
- Все reason и message формулируй одним коротким предложением, без повторения исходной записи.
- Не выдумывай targetId, факты, намерения и прошлые решения. Если связи или сигналы не подтверждаются, верни пустые массивы.`,
        user: contextMessage,
      });
      const parsedResult = parseModelJson(raw);
      parsed = parsedResult.value as ParsedAnalysis;
      assertMinimumAnalysis(parsed);
      if (parsedResult.repaired) {
        recovery = {
          used: true,
          mode: "local_json_repair",
          reason: "truncated_model_json",
          omittedConnections: false,
        };
      }
    } catch (error) {
      if (!isRecoverableOutputError(error)) throw error;
      const compactRaw = await requestOllama({
        host,
        model,
        format: RECOVERY_JSON_SCHEMA,
        numPredict: 800,
        system: `Выполни короткий восстановительный разбор записи. Верни только JSON с объектами thought и placement.
- thought: title, type, project, tags, summary, nextStep.
- placement: primaryPath и additionalPaths.
- Переиспользуй только существующие ID из контекста. Если ветви нет, создай минимальный путь.
- primaryPath обязателен: area → direction → необязательный project, максимум 3 уровня. additionalPaths — максимум 2.
- reason — одна короткая фраза. Не добавляй связи и сигналы.`,
        user: contextMessage,
      });
      const compact = parseModelJson(compactRaw).value as ParsedAnalysis;
      assertMinimumAnalysis(compact);
      parsed = { ...compact, connections: [], signals: [] };
      recovery = {
        used: true,
        mode: "compact_reanalysis",
        reason: failureReason(error),
        omittedConnections: true,
      };
    }

    const validIds = new Set(thoughts.map((thought) => thought.id));
    const validNodeIds = new Set(knowledgeNodes.map((node) => node.id));
    const parsedType = normalizeThoughtType(parsed.thought?.type, content);

    const connections = Array.isArray(parsed.connections)
      ? parsed.connections
          .filter((connection) => validIds.has(String(connection.targetId || "")))
          .slice(0, 4)
          .map((connection) => ({
            targetId: String(connection.targetId),
            type: (ALLOWED_LINKS.has(String(connection.type)) ? String(connection.type) : "Связано") as LinkType,
            reason: cleanText(connection.reason, 220) || "Связь требует проверки пользователем.",
            confidence: Math.max(0, Math.min(1, Number(connection.confidence) || 0.65)),
          }))
      : [];

    const signals = Array.isArray(parsed.signals)
      ? parsed.signals
          .filter((signal) => ALLOWED_SIGNALS.has(String(signal.kind)))
          .filter((signal) => !signal.targetId || validIds.has(String(signal.targetId)))
          .slice(0, 4)
          .map((signal) => ({
            kind: String(signal.kind) as SignalKind,
            targetId: signal.targetId ? String(signal.targetId) : undefined,
            message: cleanText(signal.message, 220),
          }))
          .filter((signal) => signal.message)
      : [];

    const primaryPath = sanitizePath(parsed.placement?.primaryPath, validNodeIds);
    const additionalPaths = Array.isArray(parsed.placement?.additionalPaths)
      ? parsed.placement.additionalPaths
          .map((path) => sanitizePath(path, validNodeIds))
          .filter((path) => path.length > 0)
          .slice(0, 2)
      : [];

    return Response.json({
      thought: {
        title: cleanText(parsed.thought?.title, 70) || "Новая мысль",
        content,
        type: parsedType,
        project: cleanText(parsed.thought?.project, 45) || "Без проекта",
        tags: Array.isArray(parsed.thought?.tags)
          ? parsed.thought.tags.map((tag) => cleanText(tag, 24)).filter(Boolean).slice(0, 4)
          : [],
        summary: cleanText(parsed.thought?.summary, 240),
        nextStep: cleanText(parsed.thought?.nextStep, 180) || undefined,
      },
      connections,
      signals,
      placement: { primaryPath, additionalPaths },
      engine: "ollama",
      model,
      recovery,
    });
  } catch (error) {
    const reason = failureReason(error);
    console.error("MindMap analyze failed:", reason);
    return Response.json(
      {
        error: "local_ai_unavailable",
        message: failureMessage(reason),
        reason,
      },
      { status: 503 },
    );
  }
}

async function requestOllama({
  host,
  model,
  format,
  numPredict,
  system,
  user,
}: {
  host: string;
  model: string;
  format: Record<string, unknown>;
  numPredict: number;
  system: string;
  user: string;
}) {
  const send = (selectedFormat: Record<string, unknown> | "json") => fetch(`${host}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      stream: false,
      think: false,
      format: selectedFormat,
      options: { temperature: 0, num_ctx: 8192, num_predict: numPredict },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
    signal: AbortSignal.timeout(180_000),
  });

  let response = await send(format);
  // Older local Ollama builds understand JSON mode but not a schema object.
  if (response.status === 400) response = await send("json");
  if (!response.ok) throw new Error(`ollama_${response.status}`);

  const data = (await response.json()) as { message?: { content?: string } };
  const result = data.message?.content?.trim();
  if (!result) throw new Error("invalid_model_response");
  return result;
}

function sanitizePath(path: ParsedHierarchyNode[] | undefined, validNodeIds: Set<string>) {
  if (!Array.isArray(path)) return [];
  const sanitized = path
    .filter((node) => ALLOWED_NODE_KINDS.has(String(node.kind)))
    .map((node) => {
      const existingNodeId = validNodeIds.has(String(node.existingNodeId || ""))
        ? String(node.existingNodeId)
        : undefined;
      return {
        existingNodeId,
        name: cleanText(node.name, 60),
        kind: String(node.kind) as "area" | "direction" | "project",
        confidence: Math.max(0, Math.min(1, Number(node.confidence) || 0.65)),
        reason: cleanText(node.reason, 180) || "Размещение требует проверки на реальных данных.",
      };
    })
    .filter((node) => node.name)
    .slice(0, 3);
  return strictProposedPath(sanitized);
}

function cleanText(value: unknown, maxLength: number) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

export function parseModelJson(value: string) {
  const trimmed = value.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try {
    return { value: JSON.parse(trimmed || "{}"), repaired: false };
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) {
      const extracted = trimmed.slice(start, end + 1).replace(/,\s*([}\]])/g, "$1");
      try {
        return { value: JSON.parse(extracted), repaired: extracted !== trimmed };
      } catch {
        // Continue with conservative truncation repair below.
      }
    }

    const repaired = repairTruncatedJson(trimmed);
    if (repaired) {
      try {
        return { value: JSON.parse(repaired), repaired: true };
      } catch {
        // A second model pass is safer than inventing missing semantic fields.
      }
    }
    throw new Error("invalid_model_json");
  }
}

function repairTruncatedJson(value: string) {
  const start = value.indexOf("{");
  if (start < 0) return undefined;

  let candidate = value.slice(start).trimEnd();
  const stack: string[] = [];
  let inString = false;
  let escaped = false;

  for (const character of candidate) {
    if (inString) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === '"') inString = false;
      continue;
    }
    if (character === '"') inString = true;
    else if (character === "{") stack.push("}");
    else if (character === "[") stack.push("]");
    else if ((character === "}" || character === "]") && stack.at(-1) === character) stack.pop();
  }

  if (inString) candidate += '"';
  candidate = candidate.replace(/,\s*$/, "");
  if (/\:\s*$/.test(candidate)) candidate += "null";
  if (/-?\d+\.$/.test(candidate)) candidate += "0";
  candidate += stack.reverse().join("");
  return candidate.replace(/,\s*([}\]])/g, "$1");
}

function assertMinimumAnalysis(parsed: ParsedAnalysis) {
  if (!parsed || typeof parsed !== "object") throw new Error("invalid_model_response");
  if (!cleanText(parsed.thought?.title, 70)) throw new Error("invalid_model_response");
  if (!Array.isArray(parsed.placement?.primaryPath) || parsed.placement.primaryPath.length === 0) {
    throw new Error("invalid_model_response");
  }
}

function isRecoverableOutputError(error: unknown) {
  const reason = failureReason(error);
  return reason === "invalid_model_json" || reason === "invalid_model_response";
}

function normalizeThoughtType(value: unknown, content: string) {
  const exact = cleanText(value, 24);
  if (ALLOWED_TYPES.has(exact)) return exact;

  const lower = exact.toLocaleLowerCase("ru");
  if (lower.includes("вопрос")) return "Вопрос";
  if (lower.includes("решен")) return "Решение";
  if (lower.includes("действ") || lower.includes("задач")) return "Действие";
  if (lower.includes("наблюд")) return "Наблюдение";
  if (lower.includes("проект")) return "Проект";
  if (lower.includes("иде")) return "Идея";

  const source = content.toLocaleLowerCase("ru");
  if (content.includes("?") || /^(как|почему|зачем|стоит ли|можно ли)\b/u.test(source)) return "Вопрос";
  if (/\b(решил|фиксирую|принято|не будем)\b/u.test(source)) return "Решение";
  if (/\b(сделать|проверить|рассчитать|создать|проанализировать)\b/u.test(source)) return "Действие";
  return "Идея";
}

function failureReason(error: unknown) {
  if (error instanceof DOMException && error.name === "TimeoutError") return "timeout";
  const message = error instanceof Error ? error.message : String(error);
  if (message === "invalid_model_json" || message === "invalid_model_response") return message;
  if (message.startsWith("ollama_")) return message;
  if (/fetch failed|ECONNREFUSED|connection/i.test(message)) return "ollama_connection";
  return "invalid_model_response";
}

function failureMessage(reason: string) {
  if (reason === "timeout") return "Локальная модель не успела ответить.";
  if (reason === "ollama_connection") return "Ollama не запущена или ещё запускается.";
  if (reason === "invalid_model_json" || reason === "invalid_model_response") {
    return "Локальная модель вернула неполный ответ. MindMap повторит попытку автоматически.";
  }
  if (reason.startsWith("ollama_")) return "Ollama вернула внутреннюю ошибку.";
  return "Локальный AI временно недоступен.";
}
