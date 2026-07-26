import assert from "node:assert/strict";
import test from "node:test";
import { parseModelJson, POST } from "../app/api/analyze/route.ts";

test("parseModelJson accepts a normal structured response", () => {
  const parsed = parseModelJson('{"thought":{"title":"Тест"},"placement":{"primaryPath":[]}}');
  assert.equal(parsed.value.thought.title, "Тест");
  assert.equal(parsed.repaired, false);
});

test("parseModelJson repairs a response truncated inside a string", () => {
  const parsed = parseModelJson(
    '{"thought":{"title":"Автономное электричество"},"placement":{"primaryPath":[{"name":"Дом","kind":"area","confidence":0.9,"reason":"Связано с автономностью дома',
  );
  assert.equal(parsed.value.thought.title, "Автономное электричество");
  assert.equal(parsed.value.placement.primaryPath[0].reason, "Связано с автономностью дома");
  assert.equal(parsed.repaired, true);
});

test("parseModelJson rejects text that cannot contain JSON", () => {
  assert.throws(() => parseModelJson("ответ модели оборван до начала объекта"), /invalid_model_json/);
});

test("analysis endpoint requests a schema and keeps a locally repaired answer", async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  let requestBody;
  globalThis.fetch = async (_url, init) => {
    requestBody = JSON.parse(String(init.body));
    return Response.json({
      message: {
        content: '{"thought":{"title":"Автономность дома","type":"Идея","project":"Дом","tags":["энергия"],"summary":"Дом должен быть автономнее.","nextStep":null},"placement":{"primaryPath":[{"name":"Дом","kind":"area","confidence":0.91,"reason":"Постоянная область"},{"name":"Автономное энергоснабжение","kind":"direction","confidence":0.9,"reason":"Направление улучшений дома',
      },
    });
  };

  const response = await POST(new Request("http://mindmap.local/api/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content: "Развивать автономное электричество дома." }),
  }));
  const result = await response.json();

  assert.equal(response.status, 200);
  assert.equal(typeof requestBody.format, "object");
  assert.equal(requestBody.options.num_predict, 1500);
  assert.equal(result.recovery.mode, "local_json_repair");
  assert.equal(result.placement.primaryPath[0].name, "Дом");
  assert.equal(result.placement.primaryPath[1].kind, "direction");
});

test("analysis endpoint performs compact reanalysis after an unusable answer", async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    if (calls === 1) return Response.json({ message: { content: "ответ оборвался до JSON" } });
    return Response.json({
      message: {
        content: JSON.stringify({
          thought: {
            title: "Автономность дома",
            type: "Идея",
            project: "Дом",
            tags: ["энергия"],
            summary: "Автономные системы могут стать направлением развития дома.",
            nextStep: null,
          },
          placement: {
            primaryPath: [{
              name: "Дом",
              kind: "area",
              confidence: 0.91,
              reason: "Относится к автономности частного дома.",
            }, {
              name: "Автономное энергоснабжение",
              kind: "direction",
              confidence: 0.9,
              reason: "Постоянное направление улучшения дома.",
            }],
            additionalPaths: [],
          },
        }),
      },
    });
  };

  const response = await POST(new Request("http://mindmap.local/api/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content: "Развивать автономное электричество дома." }),
  }));
  const result = await response.json();

  assert.equal(response.status, 200);
  assert.equal(calls, 2);
  assert.equal(result.recovery.mode, "compact_reanalysis");
  assert.equal(result.recovery.omittedConnections, true);
  assert.deepEqual(result.connections, []);
  assert.equal(result.placement.primaryPath[0].name, "Дом");
});
