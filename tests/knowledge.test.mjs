import assert from "node:assert/strict";
import test from "node:test";
import {
  descendantNodeIds,
  knowledgePath,
  materializePlacement,
  selectKnowledgeContext,
} from "../app/lib/knowledge.ts";

const seed = [
  { id: "work", name: "Работа", kind: "area", createdAt: "2026-01-01T00:00:00.000Z", source: "user", status: "active" },
  { id: "ai", name: "AI", kind: "direction", parentId: "work", createdAt: "2026-01-01T00:00:00.000Z", source: "user", status: "active" },
];

test("materializePlacement reuses existing hierarchy and creates only missing nodes", () => {
  let sequence = 0;
  const result = materializePlacement({
    primaryPath: [
      { existingNodeId: "work", name: "Работа", kind: "area", confidence: 1, reason: "existing" },
      { existingNodeId: "ai", name: "AI", kind: "direction", confidence: 1, reason: "existing" },
      { name: "Instagram", kind: "project", confidence: .91, reason: "new project" },
    ],
    additionalPaths: [],
  }, seed, () => `new-${++sequence}`);

  assert.equal(result.nodes.length, 3);
  assert.equal(result.primaryNodeId, "new-1");
  assert.equal(result.nodes[2].parentId, "ai");
});

test("descendantNodeIds and knowledgePath preserve a nested workspace", () => {
  const nodes = [...seed, {
    id: "instagram",
    name: "Instagram",
    kind: "direction",
    parentId: "ai",
    createdAt: "2026-01-01T00:00:00.000Z",
    source: "ai",
    status: "active",
  }];

  assert.deepEqual([...descendantNodeIds(nodes, "ai")], ["ai", "instagram"]);
  assert.deepEqual(knowledgePath(nodes, "instagram").map((node) => node.name), ["Работа", "AI", "Instagram"]);
});

test("selectKnowledgeContext bounds a large map and keeps relevant paths", () => {
  const nodes = [
    ...seed,
    ...Array.from({ length: 90 }, (_, index) => ({
      id: `branch-${index}`,
      name: index === 89 ? "Автономное электричество" : `Ветка ${index}`,
      kind: "direction",
      parentId: "ai",
      createdAt: "2026-01-01T00:00:00.000Z",
      source: "ai",
      status: "active",
    })),
  ];

  const selected = selectKnowledgeContext(
    nodes,
    [{ primaryNodeId: "branch-89" }],
    "Автономное электричество для дома",
    24,
  );

  assert.ok(selected.length <= 24);
  assert.ok(selected.some((node) => node.id === "work"));
  assert.ok(selected.some((node) => node.id === "ai"));
  assert.ok(selected.some((node) => node.id === "branch-89"));
});
