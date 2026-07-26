import assert from "node:assert/strict";
import test from "node:test";
import { GET, parseSemanticJson, POST } from "../app/api/semantic-pipeline/route.ts";
import { CONFIGURED_SEMANTIC_MODEL } from "../app/lib/runtime-config.ts";

function request(body) {
  return new Request("http://mindmap.local/api/semantic-pipeline", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function mockOllama(t, value) {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async () => Response.json({ message: { content: JSON.stringify(value) } });
}

function mockOllamaRaw(t, content) {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async () => Response.json({ message: { content } });
}

const extraction = (thoughtId, subject = "Дом") => ({
  thoughtId,
  sourceText: `source ${thoughtId}`,
  title: `title ${thoughtId}`,
  summary: `summary ${thoughtId}`,
  thoughtType: "idea",
  subject,
  intent: "исследовать",
  entities: [subject],
  timeHorizon: "later",
  actionability: "possible",
  confidence: .9,
});

test("semantic JSON parser extracts JSON from thinking text and Markdown", () => {
  const parsed = parseSemanticJson('<think>Служебное рассуждение</think>\n```json\n{"clusters":[]}\n```');
  assert.deepEqual(parsed.value, { clusters: [] });
  assert.equal(parsed.recovery.repaired, true);
});

test("semantic JSON parser removes trailing commas without inventing fields", () => {
  const parsed = parseSemanticJson('Ответ модели: {"clusters":[{"id":"home",}],} конец');
  assert.deepEqual(parsed.value, { clusters: [{ id: "home" }] });
  assert.equal(parsed.recovery.mode, "trailing_commas");
});

test("semantic JSON parser escapes raw line breaks inside strings", () => {
  const parsed = parseSemanticJson('{"description":"первая строка\nвторая строка"}');
  assert.equal(parsed.value.description, "первая строка\nвторая строка");
  assert.equal(parsed.recovery.mode, "control_characters");
});

test("semantic endpoint preserves a malformed response preview for diagnostics", async (t) => {
  mockOllamaRaw(t, '{"clusters":[{"id":"home","name":"Дом"}');
  const response = await POST(request({ stage: "cluster_plan", extractions: [extraction("t1"), extraction("t2")] }));
  const result = await response.json();
  assert.equal(response.status, 503);
  assert.equal(result.reason, "invalid_model_json");
  assert.equal(result.diagnostic.likelyTruncated, true);
  assert.match(result.diagnostic.responsePreview, /clusters/);
});

test("preflight verifies strict structured output before the expensive pipeline", async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  let requestBody;
  globalThis.fetch = async (_url, init) => {
    requestBody = JSON.parse(String(init.body));
    return Response.json({
      message: { content: '{"ok":true}' },
      done: true,
      done_reason: "stop",
      prompt_eval_count: 24,
      eval_count: 5,
      total_duration: 12_000_000,
    });
  };

  const response = await POST(request({ stage: "preflight" }));
  const result = await response.json();

  assert.equal(response.status, 200);
  assert.equal(result.ok, true);
  assert.equal(requestBody.options.num_predict, 32);
  assert.equal(requestBody.think, false);
  assert.equal(typeof requestBody.format, "object");
  assert.equal(result.generation.doneReason, "stop");
  assert.equal(result.generation.outputTokens, 5);
});

test("schema rejection stops immediately instead of silently retrying in loose JSON mode", async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return new Response('{"error":"invalid format"}', { status: 400 });
  };

  const response = await POST(request({ stage: "preflight" }));
  const result = await response.json();

  assert.equal(calls, 1);
  assert.equal(response.status, 503);
  assert.equal(result.reason, "ollama_structured_outputs_required");
  assert.equal(result.diagnostic.doneReason, "schema_rejected");
});

test("Ollama length stop is diagnosed before JSON parsing", async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async () => Response.json({
    message: { content: '{"areas":[{"name":"Дом","directions":["Умный' },
    done: true,
    done_reason: "length",
    prompt_eval_count: 940,
    eval_count: 2048,
    total_duration: 91_000_000_000,
  });

  const response = await POST(request({
    stage: "hierarchy_plan",
    clusters: [
      { id: "smart", name: "Умный дом", description: "", memberThoughtIds: ["t1"], confidence: .9 },
      { id: "energy", name: "Энергоснабжение", description: "", memberThoughtIds: ["t2"], confidence: .9 },
    ],
  }));
  const result = await response.json();

  assert.equal(response.status, 503);
  assert.equal(result.reason, "model_output_truncated");
  assert.equal(result.diagnostic.doneReason, "length");
  assert.equal(result.diagnostic.outputTokens, 2048);
  assert.equal(result.diagnostic.likelyTruncated, true);
});

test("extract stage preserves every input ID exactly once", async (t) => {
  mockOllama(t, { items: [
    { ...extraction("t1"), desiredOutcome: null, nextStep: null },
    { ...extraction("t2"), desiredOutcome: null, nextStep: null },
  ] });
  const response = await POST(request({ stage: "extract", thoughts: [{ id: "t2", content: "Вторая" }, { id: "t1", content: "Первая" }] }));
  const result = await response.json();
  assert.equal(response.status, 200);
  assert.deepEqual(result.items.map((item) => item.thoughtId).sort(), ["t1", "t2"]);
  assert.equal(result.pipelineVersion, "0.6.0-alpha.19");
});

test("cluster plan creates definitions without forcing all memberships into one response", async (t) => {
  mockOllama(t, { clusters: [
    { id: "home", name: "Дом", description: "Дом и быт", confidence: .9 },
    { id: "ai", name: "AI", description: "AI-навыки", confidence: .9 },
  ] });
  const response = await POST(request({ stage: "cluster_plan", extractions: [extraction("t1"), extraction("t2")] }));
  const result = await response.json();
  assert.equal(response.status, 200);
  assert.equal(result.clusters.length, 2);
  assert.equal(Object.hasOwn(result.clusters[0], "memberThoughtIds"), false);
});

test("cluster plan preserves the selected processing order instead of sorting IDs", async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  let requestBody;
  globalThis.fetch = async (_url, init) => {
    requestBody = JSON.parse(String(init.body));
    return Response.json({ message: { content: JSON.stringify({ clusters: [
      { id: "home", name: "Дом", description: "Дом", confidence: .9 },
      { id: "work", name: "Работа", description: "Работа", confidence: .9 },
    ] }) } });
  };
  const response = await POST(request({
    stage: "cluster_plan",
    extractions: [extraction("t3"), extraction("t1"), extraction("t2")],
  }));
  assert.equal(response.status, 200);
  const globalInput = JSON.parse(requestBody.messages[1].content);
  assert.deepEqual(globalInput.map((item) => item.i), ["t3", "t1", "t2"]);
});

test("cluster plan compacts 96 extractions before the only global model request", async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  let requestBody;
  globalThis.fetch = async (_url, init) => {
    requestBody = JSON.parse(String(init.body));
    return Response.json({ message: { content: JSON.stringify({ clusters: [
      { id: "home", name: "Дом", description: "Дом и быт", confidence: .9 },
      { id: "work", name: "Работа", description: "Профессиональная деятельность", confidence: .9 },
    ] }) } });
  };
  const extractions = Array.from({ length: 96 }, (_, index) => ({
    ...extraction(`t${index + 1}`, index % 2 ? "Дом" : "Работа"),
    title: `Заголовок ${index + 1} ${"я".repeat(40)}`,
    summary: "Эта длинная сводка не должна попадать в глобальный запрос.".repeat(8),
    intent: "Это длинное намерение также не должно дублироваться в глобальном запросе.".repeat(4),
  }));

  const response = await POST(request({ stage: "cluster_plan", extractions }));
  assert.equal(response.status, 200);
  const globalInput = JSON.parse(requestBody.messages[1].content);
  assert.equal(globalInput.length, 96);
  assert.deepEqual(Object.keys(globalInput[0]).sort(), ["i", "s", "t"]);
  assert.ok(requestBody.messages[1].content.length < 24_000);
  assert.equal(requestBody.format.properties.clusters.maxItems, 18);
  assert.equal(requestBody.options.num_predict, 4096);
});

test("cluster assignment requires exactly one valid assignment per input thought", async (t) => {
  mockOllama(t, { assignments: [
    { thoughtId: "t1", clusterId: "home", confidence: .91 },
    { thoughtId: "t2", clusterId: "ai", confidence: .88 },
  ] });
  const response = await POST(request({
    stage: "cluster_assign",
    clusters: [
      { id: "home", name: "Дом", description: "Дом и быт", confidence: .9 },
      { id: "ai", name: "AI", description: "AI-навыки", confidence: .9 },
    ],
    extractions: [extraction("t1"), extraction("t2", "AI")],
  }));
  const result = await response.json();
  assert.equal(response.status, 200);
  assert.deepEqual(result.assignments.map((item) => item.thoughtId).sort(), ["t1", "t2"]);
});

test("hierarchy plan creates only a compact area -> direction skeleton", async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  let requestBody;
  globalThis.fetch = async (_url, init) => {
    requestBody = JSON.parse(String(init.body));
    return Response.json({ message: { content: JSON.stringify({
      areas: [
        { name: "Дом", directions: ["Умный дом", "Энергоснабжение"] },
      ],
    }) } });
  };
  const response = await POST(request({ stage: "hierarchy_plan", clusters: [
    { id: "smart", name: "Умный дом", description: "", memberThoughtIds: ["t1"], confidence: .9 },
    { id: "energy", name: "Энергоснабжение", description: "", memberThoughtIds: ["t2"], confidence: .9 },
  ] }));
  const result = await response.json();
  assert.equal(response.status, 200);
  assert.equal(result.nodes[0].kind, "area");
  assert.equal(result.nodes[1].parentId, result.nodes[0].id);
  assert.ok(result.nodes.every((item) => item.kind !== "project"));
  assert.deepEqual(result.nodes.map((item) => item.name), ["Дом", "Умный дом", "Энергоснабжение"]);
  assert.deepEqual(requestBody.format.required, ["areas"]);
  assert.equal(Object.hasOwn(requestBody.format.properties, "nodes"), false);
  assert.equal(requestBody.options.num_predict, 2048);
});

test("hierarchy assignment handles a small cluster batch and only references existing directions", async (t) => {
  mockOllama(t, { assignments: [
    { clusterId: "smart", directionId: "direction-smart-home", projectName: null, boundedOutcome: null, confidence: .91 },
    { clusterId: "energy", directionId: "direction-energy", projectName: "Резервное питание", boundedOutcome: "Собрана рабочая первая очередь", confidence: .88 },
  ] });
  const response = await POST(request({
    stage: "hierarchy_assign",
    clusters: [
      { id: "smart", name: "Умный дом", description: "", memberThoughtIds: ["t1"], confidence: .9 },
      { id: "energy", name: "Энергоснабжение", description: "", memberThoughtIds: ["t2"], confidence: .9 },
    ],
    nodes: [
      { id: "area-home", name: "Дом", kind: "area", description: "", sourceClusterIds: [], confidence: .9 },
      { id: "direction-smart-home", name: "Умный дом", kind: "direction", parentId: "area-home", description: "", sourceClusterIds: [], confidence: .9 },
      { id: "direction-energy", name: "Энергоснабжение", kind: "direction", parentId: "area-home", description: "", sourceClusterIds: [], confidence: .9 },
    ],
  }));
  const result = await response.json();
  assert.equal(response.status, 200);
  assert.equal(result.assignments.length, 2);
  assert.equal(result.assignments[1].projectName, "Резервное питание");
});

test("hierarchy assignment may explicitly refuse an artificial direction", async (t) => {
  mockOllama(t, { assignments: [
    { clusterId: "home", directionId: null, projectName: null, boundedOutcome: null, confidence: .94 },
  ] });
  const response = await POST(request({
    stage: "hierarchy_assign",
    clusters: [{ id: "home", name: "Дом", description: "", memberThoughtIds: ["t1"], confidence: .9 }],
    nodes: [
      { id: "area-work", name: "Работа", kind: "area", description: "", sourceClusterIds: [], confidence: .9 },
      { id: "direction-video", name: "Видеография", kind: "direction", parentId: "area-work", description: "", sourceClusterIds: [], confidence: .9 },
    ],
  }));
  const result = await response.json();
  assert.equal(response.status, 200);
  assert.equal(result.assignments.length, 1);
  assert.equal(result.assignments[0].directionId, undefined);
});

test("hierarchy plan receives representative thought examples for every cluster", async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  let requestBody;
  globalThis.fetch = async (_url, init) => {
    requestBody = JSON.parse(String(init.body));
    return Response.json({ message: { content: JSON.stringify({
      areas: [{ name: "Дом", directions: ["Умный дом", "Энергоснабжение"] }],
    }) } });
  };
  const response = await POST(request({
    stage: "hierarchy_plan",
    clusters: [
      { id: "smart", name: "Системы", description: "Локальные системы", memberThoughtIds: ["t2", "t1"], confidence: .9 },
      { id: "energy", name: "Энергия", description: "", memberThoughtIds: ["t3"], confidence: .9 },
    ],
    extractions: [extraction("t2", "Умный дом"), extraction("t1", "Дом"), extraction("t3", "Энергия")],
  }));
  assert.equal(response.status, 200);
  const globalInput = JSON.parse(requestBody.messages[1].content);
  assert.deepEqual(globalInput[0].examples.map((item) => item.title), ["title t2", "title t1"]);
});

test("hierarchy repair expands only uncovered clusters and returns deterministic assignments", async (t) => {
  mockOllama(t, { repairs: [
    { clusterId: "home", areaName: "Дом", directionName: "Устройство дома", confidence: .93 },
  ] });
  const response = await POST(request({
    stage: "hierarchy_repair",
    clusters: [{ id: "home", name: "Дом", description: "", memberThoughtIds: ["t1"], confidence: .9 }],
    nodes: [
      { id: "area-work", name: "Работа", kind: "area", description: "", sourceClusterIds: [], confidence: .9 },
      { id: "direction-video", name: "Видеография", kind: "direction", parentId: "area-work", description: "", sourceClusterIds: [], confidence: .9 },
    ],
    extractions: [extraction("t1", "Дом")],
  }));
  const result = await response.json();
  assert.equal(response.status, 200);
  assert.equal(result.nodes.filter((node) => node.kind === "area").length, 2);
  assert.equal(result.assignments[0].clusterId, "home");
  assert.ok(result.assignments[0].directionId);
});

test("contradiction stage keeps rejected verdict in diagnostics and creates no approved state", async (t) => {
  mockOllama(t, { judgments: [{ sourceId: "t1", targetId: "t2", verdict: "rejected", kind: "contradiction", confidence: .97, reason: "Это разные аспекты, а не несовместимые утверждения." }] });
  const candidate = { sourceId: "t1", targetId: "t2", similarity: .82, purposes: ["related", "contradiction"] };
  const response = await POST(request({ stage: "relations", mode: "contradiction", candidates: [candidate], extractions: [extraction("t1"), extraction("t2")] }));
  const result = await response.json();
  assert.equal(response.status, 200);
  assert.equal(result.judgments[0].verdict, "rejected");
  assert.equal(result.judgments[0].status, "proposed");
  assert.equal(result.judgments[0].similarity, .82);
});


test("GET reports the launcher-generated semantic model without invoking Ollama", async () => {
  const response = GET();
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    engine: "ollama",
    model: CONFIGURED_SEMANTIC_MODEL,
    pipelineVersion: "0.6.0-alpha.19",
  });
});
