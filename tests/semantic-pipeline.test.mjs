import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  buildPlacements,
  buildClustersFromAssignments,
  buildHierarchyFromAssignments,
  compareClusterings,
  mergeHierarchyRepairs,
  reconcileHierarchyCheckpoints,
  selectSemanticCandidates,
  selectSemanticCandidatesIncremental,
  validateClusters,
  validatePlacements,
  validateStrictHierarchy,
} from "../app/lib/semantic-pipeline.ts";

const nodes = [
  { id: "area-home", name: "Дом", kind: "area", description: "Постоянная область дома", sourceClusterIds: [], confidence: .95 },
  { id: "dir-smart-home", name: "Умный дом", kind: "direction", parentId: "area-home", description: "Локальная автоматизация", sourceClusterIds: ["smart"], confidence: .91 },
  { id: "project-panel", name: "Панель управления домом", kind: "project", parentId: "dir-smart-home", description: "Рабочий MVP панели", boundedOutcome: "Локальная панель испытана в собственном доме", sourceClusterIds: ["panel"], confidence: .88 },
];

test("strict hierarchy accepts only area -> direction -> optional project", () => {
  assert.deepEqual(validateStrictHierarchy(nodes), []);
  const invalid = [...nodes, { id: "nested-area", name: "AI", kind: "area", parentId: "area-home", description: "bad", sourceClusterIds: [], confidence: 1 }];
  assert.ok(validateStrictHierarchy(invalid).some((issue) => issue.code === "invalid_parent_kind"));
});

test("strict hierarchy rejects root projects, missing parents, cycles and duplicate paths", () => {
  const broken = [
    { id: "p", name: "Проект", kind: "project", description: "root", boundedOutcome: "done", sourceClusterIds: [], confidence: 1 },
    { id: "a", name: "Дом", kind: "area", parentId: "d", description: "cycle", sourceClusterIds: [], confidence: 1 },
    { id: "d", name: "Умный дом", kind: "direction", parentId: "a", description: "cycle", sourceClusterIds: [], confidence: 1 },
    { id: "orphan", name: "Сирота", kind: "direction", parentId: "missing", description: "orphan", sourceClusterIds: [], confidence: 1 },
  ];
  const codes = new Set(validateStrictHierarchy(broken).map((issue) => issue.code));
  assert.ok(codes.has("root_not_area"));
  assert.ok(codes.has("cycle"));
  assert.ok(codes.has("missing_parent"));
});

test("global clusters require exactly one cluster per thought", () => {
  const clusters = [
    { id: "home", name: "Дом", description: "", memberThoughtIds: ["t1", "t2"], confidence: .9 },
    { id: "ai", name: "AI", description: "", memberThoughtIds: ["t2"], confidence: .9 },
  ];
  const codes = validateClusters(clusters, ["t1", "t2", "t3"]).map((issue) => issue.code);
  assert.ok(codes.includes("thought_placed_multiple_times"));
  assert.ok(codes.includes("missing_placement"));
});

test("checkpointed assignments materialize one valid global cluster per thought", () => {
  const plan = [
    { id: "home", name: "Дом", description: "", confidence: .9 },
    { id: "ai", name: "AI", description: "", confidence: .88 },
    { id: "unused", name: "Неиспользованный", description: "", confidence: .5 },
  ];
  const result = buildClustersFromAssignments(plan, [
    { thoughtId: "t1", clusterId: "home", confidence: .9 },
    { thoughtId: "t2", clusterId: "home", confidence: .9 },
    { thoughtId: "t3", clusterId: "ai", confidence: .9 },
  ], ["t1", "t2", "t3"]);
  assert.deepEqual(result.issues, []);
  assert.equal(result.clusters.length, 2);
  assert.deepEqual(result.clusters[0].memberThoughtIds, ["t1", "t2"]);
});

test("placements are derived from global clusters and never attach to an area", () => {
  const clusters = [{ id: "smart", name: "Умный дом", description: "", memberThoughtIds: ["t1", "t2"], confidence: .92 }];
  const placements = buildPlacements(clusters, nodes, { smart: "dir-smart-home" });
  assert.equal(placements.length, 2);
  assert.ok(placements.every((placement) => placement.status === "proposed"));
  assert.deepEqual(validatePlacements(placements, ["t1", "t2"], nodes), []);
  assert.ok(validatePlacements(buildPlacements(clusters, nodes, { smart: "area-home" }), ["t1", "t2"], nodes).length > 0);
});

test("checkpointed hierarchy assignments create optional projects deterministically", () => {
  const clusters = [
    { id: "smart", name: "Умный дом", description: "", memberThoughtIds: ["t1"], confidence: .92 },
    { id: "energy", name: "Энергия", description: "", memberThoughtIds: ["t2"], confidence: .9 },
  ];
  const baseNodes = nodes.filter((node) => node.kind !== "project").map((node) => ({ ...node, sourceClusterIds: [] }));
  const result = buildHierarchyFromAssignments(clusters, baseNodes, [
    { clusterId: "smart", directionId: "dir-smart-home", confidence: .9 },
    { clusterId: "energy", directionId: "dir-smart-home", projectName: "Резервное питание", boundedOutcome: "Первая очередь испытана", confidence: .88 },
  ]);
  assert.deepEqual(result.issues, []);
  assert.equal(result.placements.length, 2);
  assert.equal(result.nodes.filter((node) => node.kind === "project").length, 1);
  assert.ok(result.placements.every((placement) => placement.status === "proposed"));
});

test("hierarchy repair reuses a natural area and adds only the missing direction", () => {
  const baseNodes = [
    { id: "area-home", name: "Дом", kind: "area", description: "", sourceClusterIds: [], confidence: .9 },
    { id: "dir-energy", name: "Энергоснабжение", kind: "direction", parentId: "area-home", description: "", sourceClusterIds: [], confidence: .9 },
  ];
  const result = mergeHierarchyRepairs(baseNodes, [{
    clusterId: "smart-home",
    areaName: "Дом",
    directionName: "Умный дом",
    confidence: .91,
  }]);
  assert.deepEqual(result.issues, []);
  assert.equal(result.nodes.filter((node) => node.kind === "area").length, 1);
  assert.equal(result.nodes.filter((node) => node.kind === "direction").length, 2);
  assert.equal(result.assignments[0].clusterId, "smart-home");
  assert.ok(result.assignments[0].directionId);
});

test("hierarchy repair creates a missing area without changing the existing skeleton", () => {
  const baseNodes = [
    { id: "area-work", name: "Работа", kind: "area", description: "", sourceClusterIds: [], confidence: .9 },
    { id: "dir-video", name: "Видеография", kind: "direction", parentId: "area-work", description: "", sourceClusterIds: [], confidence: .9 },
  ];
  const result = mergeHierarchyRepairs(baseNodes, [{
    clusterId: "home",
    areaName: "Дом",
    directionName: "Устройство дома",
    confidence: .88,
  }]);
  assert.deepEqual(result.issues, []);
  assert.equal(result.nodes.filter((node) => node.kind === "area").length, 2);
  assert.equal(result.nodes.find((node) => node.name === "Устройство дома")?.parentId, result.nodes.find((node) => node.name === "Дом")?.id);
});

test("alpha.12 to alpha.13 recovery keeps plan nodes omitted by a later repair snapshot", () => {
  const clusters = [
    { id: "home", name: "Дом", description: "", memberThoughtIds: ["t1", "t2"], confidence: .9 },
    { id: "video", name: "Видеография", description: "", memberThoughtIds: ["t3"], confidence: .9 },
  ];
  const planNodes = [
    { id: "area-home", name: "Дом", kind: "area", description: "", sourceClusterIds: [], confidence: .9 },
    { id: "direction-home", name: "Устройство дома", kind: "direction", parentId: "area-home", description: "", sourceClusterIds: [], confidence: .9 },
    { id: "area-work", name: "Работа", kind: "area", description: "", sourceClusterIds: [], confidence: .9 },
    { id: "direction-video", name: "Видеография", kind: "direction", parentId: "area-work", description: "", sourceClusterIds: [], confidence: .9 },
  ];
  const assignments = [
    { clusterId: "home", directionId: "direction-home", confidence: .9 },
    { clusterId: "video", directionId: "direction-video", confidence: .9 },
  ];
  const repairCheckpoint = {
    // Реальный класс сбоя alpha.13: новый snapshot является неполным относительно
    // сохранённых назначений alpha.12.
    nodes: [
      planNodes[2],
      planNodes[3],
      { id: "direction-ai", name: "AI-инструменты", kind: "direction", parentId: "area-work", description: "", sourceClusterIds: [], confidence: .8 },
    ],
    assignments: [],
  };

  const broken = buildHierarchyFromAssignments(clusters, repairCheckpoint.nodes, assignments);
  assert.ok(broken.issues.some((issue) => issue.code === "invalid_placement_leaf"));
  assert.equal(broken.placements.length, 1);

  const recovered = reconcileHierarchyCheckpoints(clusters, planNodes, assignments, [repairCheckpoint]);
  assert.deepEqual(recovered.issues, []);
  assert.deepEqual(recovered.problems, []);
  const rebuilt = buildHierarchyFromAssignments(clusters, recovered.nodes, recovered.assignments);
  assert.deepEqual(rebuilt.issues, []);
  assert.equal(rebuilt.placements.length, 3);
});

test("hierarchy recovery applies every persisted repair delta in chronological order", async () => {
  const fixture = JSON.parse(await readFile(
    new URL("./fixtures/alpha13-hierarchy-checkpoint-mismatch.json", import.meta.url),
    "utf8",
  ));
  assert.equal(fixture.fixtureKind, "reconstructed_persisted_shape");
  const recovered = reconcileHierarchyCheckpoints(
    fixture.clusters,
    fixture.hierarchyPlanNodes,
    fixture.hierarchyAssignments,
    fixture.repairCheckpoints,
  );
  assert.deepEqual(recovered.issues, []);
  assert.deepEqual(recovered.problems, []);
  const rebuilt = buildHierarchyFromAssignments(
    fixture.clusters,
    recovered.nodes,
    recovered.assignments,
  );
  assert.deepEqual(rebuilt.issues, []);
  assert.equal(rebuilt.placements.length, 3);
});

test("hierarchy recovery reports an unresolved stale reference without inventing a placement", () => {
  const clusters = [{ id: "home", name: "Дом", description: "", memberThoughtIds: ["t1"], confidence: .9 }];
  const recovered = reconcileHierarchyCheckpoints(
    clusters,
    [
      { id: "area-home", name: "Дом", kind: "area", description: "", sourceClusterIds: [], confidence: .9 },
      { id: "direction-home", name: "Устройство дома", kind: "direction", parentId: "area-home", description: "", sourceClusterIds: [], confidence: .9 },
    ],
    [{ clusterId: "home", directionId: "direction-does-not-exist", confidence: .9 }],
    [],
  );
  assert.equal(recovered.problems.length, 1);
  assert.equal(recovered.problems[0].reason, "unknown_direction");
  assert.deepEqual(recovered.problems[0].affectedThoughtIds, ["t1"]);
});

test("legacy __unmatched__ is a valid unresolved state, not a broken direction reference", () => {
  const resolvedThoughtIds = Array.from({ length: 95 }, (_, index) => `t${index + 1}`);
  const clusters = [
    { id: "resolved", name: "Однозначные мысли", description: "", memberThoughtIds: resolvedThoughtIds, confidence: .9 },
    { id: "015", name: "Одиночная мысль", description: "", memberThoughtIds: ["t96"], confidence: .4 },
  ];
  const baseNodes = [
    { id: "area-home", name: "Дом", kind: "area", description: "", sourceClusterIds: [], confidence: .9 },
    { id: "direction-home", name: "Устройство дома", kind: "direction", parentId: "area-home", description: "", sourceClusterIds: [], confidence: .9 },
  ];
  const recovered = reconcileHierarchyCheckpoints(
    clusters,
    baseNodes,
    [
      { clusterId: "resolved", directionId: "direction-home", confidence: .9 },
      { clusterId: "015", directionId: "__unmatched__", confidence: .4 },
    ],
    [],
  );
  assert.equal(recovered.problems.length, 1);
  assert.equal(recovered.problems[0].reason, "unresolved_direction");
  assert.equal(recovered.problems[0].directionId, "__unmatched__");
  assert.deepEqual(recovered.problems[0].affectedThoughtIds, ["t96"]);

  const built = buildHierarchyFromAssignments(
    clusters,
    recovered.nodes,
    recovered.assignments,
    { unresolvedClusterIds: ["015"] },
  );
  assert.deepEqual(built.issues, []);
  assert.equal(built.placements.length, 95);
  assert.deepEqual(built.unresolvedClusterIds, ["015"]);
  assert.deepEqual(built.unresolvedThoughtIds, ["t96"]);
  assert.equal(new Set([
    ...built.placements.map((placement) => placement.thoughtId),
    ...built.unresolvedThoughtIds,
  ]).size, 96);
});

test("project cannot silently repeat its parent direction", () => {
  const clusters = [{ id: "smart", name: "Умный дом", description: "", memberThoughtIds: ["t1"], confidence: .9 }];
  const baseNodes = [
    { id: "area-home", name: "Дом", kind: "area", description: "", sourceClusterIds: [], confidence: .9 },
    { id: "dir-smart", name: "Умный дом", kind: "direction", parentId: "area-home", description: "", sourceClusterIds: [], confidence: .9 },
  ];
  const result = buildHierarchyFromAssignments(clusters, baseNodes, [{
    clusterId: "smart",
    directionId: "dir-smart",
    projectName: "Умный дом",
    boundedOutcome: "Готово",
    confidence: .9,
  }]);
  assert.ok(result.issues.some((issue) => issue.code === "project_repeats_direction"));
  assert.equal(result.nodes.filter((node) => node.kind === "project").length, 0);
});

test("candidate search is allowed to return zero pairs", () => {
  const result = selectSemanticCandidates({ t1: [1, 0], t2: [0, 1], t3: [-1, 0] });
  assert.deepEqual(result, []);
});

test("candidate search saves numeric similarity and purpose-specific thresholds", () => {
  const result = selectSemanticCandidates({
    t1: [1, 0],
    t2: [.995, .01],
    t3: [.8, .6],
  });
  const duplicate = result.find((candidate) => candidate.sourceId === "t1" && candidate.targetId === "t2");
  assert.ok(duplicate);
  assert.ok(duplicate.purposes.includes("duplicate"));
  assert.equal(typeof duplicate.similarity, "number");
  assert.ok(result.some((candidate) => candidate.purposes.includes("related")));
});

test("incremental candidate search reports real pair progress and matches the synchronous result", async () => {
  const embeddings = Object.fromEntries(
    Array.from({ length: 24 }, (_, index) => [`t${index + 1}`, [1, index / 100, (index % 3) / 100]]),
  );
  const progress = [];
  const incremental = await selectSemanticCandidatesIncremental(
    embeddings,
    undefined,
    (completed, total) => progress.push({ completed, total }),
  );
  assert.deepEqual(incremental, selectSemanticCandidates(embeddings));
  assert.equal(progress.at(-1).completed, 276);
  assert.equal(progress.at(-1).total, 276);
  assert.ok(progress.length >= 2);
});

test("clustering comparison ignores cluster names and measures pair agreement", () => {
  const left = [
    { id: "a", name: "A", description: "", memberThoughtIds: ["1", "2"], confidence: 1 },
    { id: "b", name: "B", description: "", memberThoughtIds: ["3"], confidence: 1 },
  ];
  const renamed = [
    { id: "x", name: "X", description: "", memberThoughtIds: ["1", "2"], confidence: 1 },
    { id: "y", name: "Y", description: "", memberThoughtIds: ["3"], confidence: 1 },
  ];
  assert.equal(compareClusterings(left, renamed, ["1", "2", "3"]), 1);
});
