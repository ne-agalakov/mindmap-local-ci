import assert from "node:assert/strict";
import test from "node:test";
import { buildMapExportSvg, buildMapGraph } from "../app/lib/map-export.ts";
import { evaluateSyntheticHierarchy } from "../app/lib/synthetic-semantic-benchmark.ts";

test("independent semantic benchmark accepts a perfectly separated ten-area hierarchy", () => {
  const ranges = [[1, 12], [13, 21], [22, 28], [29, 38], [39, 47], [48, 57], [58, 66], [67, 73], [74, 83], [84, 96]];
  const nodes = ranges.flatMap((_, index) => [
    { id: `area-${index}`, name: `Область ${index}`, kind: "area", description: "", sourceClusterIds: [], confidence: 1 },
    { id: `direction-${index}`, name: `Направление ${index}`, kind: "direction", parentId: `area-${index}`, description: "", sourceClusterIds: [], confidence: 1 },
  ]);
  const placements = ranges.flatMap(([start, end], index) =>
    Array.from({ length: end - start + 1 }, (_, offset) => ({
      thoughtId: `synthetic-${String(start + offset).padStart(3, "0")}`,
      primaryNodeId: `direction-${index}`,
      clusterId: `cluster-${index}`,
      confidence: 1,
      reason: "",
      status: "proposed",
    })));
  const result = evaluateSyntheticHierarchy(nodes, placements);
  assert.equal(result.precision, 1);
  assert.equal(result.recall, 1);
  assert.equal(result.f1, 1);
  assert.equal(result.passed, true);
});

test("independent semantic benchmark rejects a technically valid collapsed hierarchy", () => {
  const nodes = [
    { id: "area-all", name: "Всё", kind: "area", description: "", sourceClusterIds: [], confidence: 1 },
    { id: "direction-all", name: "Общее", kind: "direction", parentId: "area-all", description: "", sourceClusterIds: [], confidence: 1 },
  ];
  const placements = Array.from({ length: 96 }, (_, index) => ({
    thoughtId: `synthetic-${String(index + 1).padStart(3, "0")}`,
    primaryNodeId: "direction-all",
    clusterId: "all",
    confidence: 1,
    reason: "",
    status: "proposed",
  }));
  const result = evaluateSyntheticHierarchy(nodes, placements);
  assert.equal(result.recall, 1);
  assert.ok(result.precision < .2);
  assert.equal(result.passed, false);
});

test("map graph includes hierarchy edges, placements and proposed semantic links", () => {
  const nodes = [
    { id: "area-home", name: "Дом", kind: "area" },
    { id: "dir-smart", name: "Умный дом", kind: "direction", parentId: "area-home" },
  ];
  const thoughts = [
    { id: "t1", title: "Локальная система", type: "Идея", primaryNodeId: "dir-smart" },
    { id: "t2", title: "Ручное управление", type: "Решение", primaryNodeId: "dir-smart" },
  ];
  const graph = buildMapGraph(thoughts, nodes, [{
    id: "l1",
    source: "t1",
    target: "t2",
    type: "Связано",
    status: "pending",
  }]);
  assert.equal(graph.nodes.length, 4);
  assert.equal(graph.edges.filter((edge) => edge.kind === "structure").length, 3);
  assert.equal(graph.edges.filter((edge) => edge.kind === "semantic-proposed").length, 1);
});

test("full SVG export contains every graph node and escapes user text", () => {
  const graph = buildMapGraph(
    [{ id: "t1", title: "Свет & розетки", type: "Идея", primaryNodeId: "dir" }],
    [
      { id: "area", name: "Дом", kind: "area" },
      { id: "dir", name: "Умный <дом>", kind: "direction", parentId: "area" },
    ],
    [],
  );
  const svg = buildMapExportSvg(graph);
  assert.match(svg, /Свет &amp; розетки/);
  assert.match(svg, /Умный &lt;дом&gt;/);
  assert.equal((svg.match(/<rect /g) ?? []).length, 4);
});
