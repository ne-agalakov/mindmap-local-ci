export const SEMANTIC_PIPELINE_VERSION = "0.6.0-alpha.19";
export const LEGACY_UNMATCHED_DIRECTION_ID = "__unmatched__";

export const SEMANTIC_STAGE_LIMITS = {
  extractionBatch: 8,
  clusterAssignmentBatch: 12,
  hierarchyAssignmentBatch: 4,
  relationBatch: 8,
  outputTokens: {
    preflight: 32,
    extract: 3200,
    clusterPlan: 4096,
    clusterAssign: 1400,
    hierarchyPlan: 2048,
    hierarchyAssign: 1400,
    hierarchyRepair: 1800,
    relations: 2400,
  },
} as const;

export type SemanticThoughtType =
  | "idea"
  | "question"
  | "observation"
  | "decision"
  | "goal"
  | "project"
  | "material"
  | "person"
  | "area"
  | "action";

export type SemanticExtraction = {
  thoughtId: string;
  sourceText: string;
  title: string;
  summary: string;
  thoughtType: SemanticThoughtType;
  subject: string;
  intent: string;
  entities: string[];
  desiredOutcome?: string;
  timeHorizon?: "now" | "soon" | "later" | "ongoing" | "unknown";
  actionability: "none" | "possible" | "explicit";
  nextStep?: string;
  confidence: number;
};

export type SemanticCluster = {
  id: string;
  name: string;
  description: string;
  memberThoughtIds: string[];
  confidence: number;
};

export type SemanticClusterPlan = Omit<SemanticCluster, "memberThoughtIds">;

export type SemanticClusterAssignment = {
  thoughtId: string;
  clusterId: string;
  confidence: number;
};

export type SemanticHierarchyAssignment = {
  clusterId: string;
  directionId?: string;
  projectName?: string;
  boundedOutcome?: string;
  confidence: number;
};

export type SemanticHierarchyRepair = {
  clusterId: string;
  areaName: string;
  directionName: string;
  confidence: number;
};

export type SemanticHierarchyRepairCheckpoint = {
  nodes: StrictHierarchyNode[];
  assignments: SemanticHierarchyAssignment[];
};

export type HierarchyRecoveryProblem = {
  clusterId: string;
  directionId?: string;
  reason: "missing_assignment" | "unresolved_direction" | "unknown_direction";
  affectedThoughtIds: string[];
};

export type StrictNodeKind = "area" | "direction" | "project";

export type StrictHierarchyNode = {
  id: string;
  name: string;
  kind: StrictNodeKind;
  parentId?: string;
  description: string;
  boundedOutcome?: string;
  sourceClusterIds: string[];
  confidence: number;
};

export type SemanticPlacement = {
  thoughtId: string;
  primaryNodeId: string;
  clusterId: string;
  confidence: number;
  reason: string;
  status: "proposed";
};

export type CandidatePurpose = "related" | "duplicate" | "contradiction";

export type SemanticCandidate = {
  sourceId: string;
  targetId: string;
  similarity: number;
  purposes: CandidatePurpose[];
};

export type SemanticRelation = {
  sourceId: string;
  targetId: string;
  kind: "related" | "continues" | "depends_on" | "alternative" | "duplicate" | "contradiction";
  verdict: "confirmed" | "rejected" | "uncertain";
  confidence: number;
  reason: string;
  similarity: number;
  status: "proposed";
};

export type PipelineTrace = {
  id: string;
  runId: string;
  stage: "preflight" | "extract" | "cluster_plan" | "cluster_assign" | "cluster" | "hierarchy_plan" | "hierarchy_assign" | "hierarchy_repair" | "hierarchy" | "candidates" | "relations" | "validate";
  createdAt: string;
  model?: string;
  promptVersion: string;
  input: unknown;
  rawResponse?: string;
  output?: unknown;
  accepted: boolean;
  reason: string;
};

export type ValidationIssue = {
  code:
    | "duplicate_id"
    | "duplicate_path"
    | "missing_parent"
    | "invalid_parent_kind"
    | "root_not_area"
    | "cycle"
    | "empty_cluster"
    | "unknown_cluster"
    | "unknown_thought"
    | "thought_placed_multiple_times"
    | "missing_placement"
    | "invalid_placement_leaf"
    | "project_repeats_direction";
  message: string;
  ids: string[];
};

export type SemanticThresholds = {
  related: number;
  duplicate: number;
  contradiction: number;
  maxCandidatesPerThought: number;
};

export const DEFAULT_SEMANTIC_THRESHOLDS: SemanticThresholds = {
  related: 0.72,
  duplicate: 0.9,
  contradiction: 0.78,
  maxCandidatesPerThought: 6,
};

export function isExplicitUnmatchedDirectionId(value?: string) {
  return value?.trim().toLocaleLowerCase("en-US") === LEGACY_UNMATCHED_DIRECTION_ID;
}

const EXPECTED_PARENT: Record<Exclude<StrictNodeKind, "area">, StrictNodeKind> = {
  direction: "area",
  project: "direction",
};

export function validateStrictHierarchy(nodes: StrictHierarchyNode[]) {
  const issues: ValidationIssue[] = [];
  const byId = new Map<string, StrictHierarchyNode>();

  for (const node of nodes) {
    if (byId.has(node.id)) {
      issues.push({ code: "duplicate_id", message: `Повторяется ID узла ${node.id}.`, ids: [node.id] });
    } else {
      byId.set(node.id, node);
    }
  }

  for (const node of nodes) {
    if (!node.parentId) {
      if (node.kind !== "area") {
        issues.push({ code: "root_not_area", message: `Корневой узел ${node.name} не является областью.`, ids: [node.id] });
      }
      continue;
    }
    const parent = byId.get(node.parentId);
    if (!parent) {
      issues.push({ code: "missing_parent", message: `У узла ${node.name} отсутствует родитель.`, ids: [node.id, node.parentId] });
      continue;
    }
    if (node.kind === "area" || parent.kind !== EXPECTED_PARENT[node.kind]) {
      issues.push({
        code: "invalid_parent_kind",
        message: `Недопустимое вложение ${parent.kind} → ${node.kind}.`,
        ids: [parent.id, node.id],
      });
    }
  }

  const state = new Map<string, "visiting" | "visited">();
  const visit = (id: string, path: string[]) => {
    if (state.get(id) === "visited") return;
    if (state.get(id) === "visiting") {
      const start = path.indexOf(id);
      issues.push({ code: "cycle", message: "В иерархии обнаружен цикл.", ids: path.slice(Math.max(0, start)).concat(id) });
      return;
    }
    state.set(id, "visiting");
    const parentId = byId.get(id)?.parentId;
    if (parentId && byId.has(parentId)) visit(parentId, [...path, id]);
    state.set(id, "visited");
  };
  nodes.forEach((node) => visit(node.id, []));

  const pathKeys = new Map<string, string>();
  for (const node of nodes) {
    const path = strictNodePath(nodes, node.id);
    if (path.length === 0) continue;
    const key = path.map((item) => `${item.kind}:${normalize(item.name)}`).join("/");
    const existing = pathKeys.get(key);
    if (existing && existing !== node.id) {
      issues.push({ code: "duplicate_path", message: `Повторяется путь ${path.map((item) => item.name).join(" → ")}.`, ids: [existing, node.id] });
    } else {
      pathKeys.set(key, node.id);
    }
  }
  return issues;
}

export function validateClusters(clusters: SemanticCluster[], thoughtIds: string[]) {
  const issues: ValidationIssue[] = [];
  const validThoughts = new Set(thoughtIds);
  const seen = new Map<string, string>();
  for (const cluster of clusters) {
    if (cluster.memberThoughtIds.length === 0) {
      issues.push({ code: "empty_cluster", message: `Кластер ${cluster.name} пуст.`, ids: [cluster.id] });
    }
    for (const thoughtId of cluster.memberThoughtIds) {
      if (!validThoughts.has(thoughtId)) {
        issues.push({ code: "unknown_thought", message: `Кластер ссылается на неизвестную мысль ${thoughtId}.`, ids: [cluster.id, thoughtId] });
      }
      const previous = seen.get(thoughtId);
      if (previous) {
        issues.push({ code: "thought_placed_multiple_times", message: `Мысль ${thoughtId} попала в несколько глобальных кластеров.`, ids: [previous, cluster.id, thoughtId] });
      } else {
        seen.set(thoughtId, cluster.id);
      }
    }
  }
  for (const thoughtId of thoughtIds) {
    if (!seen.has(thoughtId)) issues.push({ code: "missing_placement", message: `Мысль ${thoughtId} не попала ни в один кластер.`, ids: [thoughtId] });
  }
  return issues;
}

export function buildClustersFromAssignments(
  plan: SemanticClusterPlan[],
  assignments: SemanticClusterAssignment[],
  thoughtIds: string[],
) {
  const validThoughts = new Set(thoughtIds);
  const planned = new Map(plan.map((cluster) => [cluster.id, cluster]));
  const members = new Map<string, string[]>();
  const seen = new Set<string>();
  const issues: ValidationIssue[] = [];

  for (const assignment of assignments) {
    if (!validThoughts.has(assignment.thoughtId)) {
      issues.push({ code: "unknown_thought", message: `Назначение ссылается на неизвестную мысль ${assignment.thoughtId}.`, ids: [assignment.thoughtId] });
      continue;
    }
    if (!planned.has(assignment.clusterId)) {
      issues.push({ code: "unknown_cluster", message: `Назначение ссылается на неизвестный кластер ${assignment.clusterId}.`, ids: [assignment.clusterId, assignment.thoughtId] });
      continue;
    }
    if (seen.has(assignment.thoughtId)) {
      issues.push({ code: "thought_placed_multiple_times", message: `Мысль ${assignment.thoughtId} получила несколько кластеров.`, ids: [assignment.thoughtId] });
      continue;
    }
    seen.add(assignment.thoughtId);
    members.set(assignment.clusterId, [...(members.get(assignment.clusterId) ?? []), assignment.thoughtId]);
  }

  for (const thoughtId of thoughtIds) {
    if (!seen.has(thoughtId)) issues.push({ code: "missing_placement", message: `Мысль ${thoughtId} не получила кластер.`, ids: [thoughtId] });
  }

  const clusters: SemanticCluster[] = plan.flatMap((cluster) => {
    const memberThoughtIds = members.get(cluster.id) ?? [];
    return memberThoughtIds.length ? [{ ...cluster, memberThoughtIds }] : [];
  });
  if (clusters.length < 2) {
    issues.push({ code: "empty_cluster", message: "После назначения осталось меньше двух непустых кластеров.", ids: clusters.map((cluster) => cluster.id) });
  }
  issues.push(...validateClusters(clusters, thoughtIds));
  return { clusters, issues };
}

export function buildPlacements(
  clusters: SemanticCluster[],
  nodes: StrictHierarchyNode[],
  clusterLeafById: Record<string, string>,
): SemanticPlacement[] {
  const byNodeId = new Map(nodes.map((node) => [node.id, node]));
  const placements: SemanticPlacement[] = [];
  for (const cluster of clusters) {
    const nodeId = clusterLeafById[cluster.id];
    const node = byNodeId.get(nodeId);
    if (!node || (node.kind !== "direction" && node.kind !== "project")) continue;
    for (const thoughtId of cluster.memberThoughtIds) {
      placements.push({
        thoughtId,
        primaryNodeId: nodeId,
        clusterId: cluster.id,
        confidence: Math.min(cluster.confidence, node.confidence),
        reason: `Размещено через глобальный кластер «${cluster.name}».`,
        status: "proposed",
      });
    }
  }
  return placements;
}

export function buildHierarchyFromAssignments(
  clusters: SemanticCluster[],
  baseNodes: StrictHierarchyNode[],
  assignments: SemanticHierarchyAssignment[],
  options: { unresolvedClusterIds?: Iterable<string> } = {},
) {
  const issues = validateStrictHierarchy(baseNodes);
  const clusterById = new Map(clusters.map((cluster) => [cluster.id, cluster]));
  const directionById = new Map(baseNodes.filter((node) => node.kind === "direction").map((node) => [node.id, node]));
  const assignmentByCluster = new Map<string, SemanticHierarchyAssignment>();
  const unresolvedClusterIds = new Set(options.unresolvedClusterIds ?? []);

  for (const assignment of assignments) {
    if (!clusterById.has(assignment.clusterId)) {
      issues.push({ code: "unknown_cluster", message: `Иерархия ссылается на неизвестный кластер ${assignment.clusterId}.`, ids: [assignment.clusterId] });
      continue;
    }
    if (!assignment.directionId) {
      continue;
    }
    if (!directionById.has(assignment.directionId)) {
      issues.push({ code: "invalid_placement_leaf", message: `Кластер ${assignment.clusterId} ссылается на неизвестное направление.`, ids: [assignment.clusterId, assignment.directionId] });
      continue;
    }
    if (assignmentByCluster.has(assignment.clusterId)) {
      issues.push({ code: "thought_placed_multiple_times", message: `Кластер ${assignment.clusterId} получил несколько размещений.`, ids: [assignment.clusterId] });
      continue;
    }
    assignmentByCluster.set(assignment.clusterId, assignment);
  }

  for (const cluster of clusters) {
    if (!assignmentByCluster.has(cluster.id) && !unresolvedClusterIds.has(cluster.id)) {
      issues.push({ code: "missing_placement", message: `Кластер ${cluster.name} не получил размещение.`, ids: [cluster.id] });
    }
  }

  const nodes = baseNodes.map((node) => ({ ...node, sourceClusterIds: [...node.sourceClusterIds] }));
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const clusterLeafById: Record<string, string> = {};
  const sortedAssignments = [...assignmentByCluster.values()].sort((left, right) => left.clusterId.localeCompare(right.clusterId, "en"));

  for (const assignment of sortedAssignments) {
    const direction = directionById.get(assignment.directionId);
    if (!direction) continue;
    let leafId = direction.id;
    const repeatsDirection = assignment.projectName
      && normalize(assignment.projectName) === normalize(direction.name);
    if (repeatsDirection) {
      issues.push({
        code: "project_repeats_direction",
        message: `Проект «${assignment.projectName}» повторяет родительское направление.`,
        ids: [assignment.clusterId, direction.id],
      });
    }
    if (assignment.projectName && assignment.boundedOutcome && !repeatsDirection) {
      const projectId = slugId(`project-${direction.id}-${assignment.projectName}`);
      const existing = nodeById.get(projectId);
      if (existing && existing.kind !== "project") {
        issues.push({ code: "duplicate_id", message: `ID проекта ${projectId} уже занят другим узлом.`, ids: [projectId] });
        continue;
      }
      if (existing) {
        existing.sourceClusterIds = [...new Set([...existing.sourceClusterIds, assignment.clusterId])];
      } else {
        const project: StrictHierarchyNode = {
          id: projectId,
          name: assignment.projectName,
          kind: "project",
          parentId: direction.id,
          description: assignment.boundedOutcome,
          boundedOutcome: assignment.boundedOutcome,
          sourceClusterIds: [assignment.clusterId],
          confidence: assignment.confidence,
        };
        nodes.push(project);
        nodeById.set(project.id, project);
      }
      leafId = projectId;
    } else {
      const target = nodeById.get(direction.id);
      if (target) target.sourceClusterIds = [...new Set([...target.sourceClusterIds, assignment.clusterId])];
    }
    clusterLeafById[assignment.clusterId] = leafId;
  }

  issues.push(...validateStrictHierarchy(nodes));
  const placements = buildPlacements(clusters, nodes, clusterLeafById);
  const unresolvedThoughtIds = clusters
    .filter((cluster) => unresolvedClusterIds.has(cluster.id))
    .flatMap((cluster) => cluster.memberThoughtIds);
  issues.push(...validatePlacements(
    placements,
    clusters.flatMap((cluster) => cluster.memberThoughtIds),
    nodes,
    unresolvedThoughtIds,
  ));
  return {
    nodes,
    clusterLeafById,
    placements,
    unresolvedClusterIds: [...unresolvedClusterIds],
    unresolvedThoughtIds,
    issues,
  };
}

export function mergeHierarchyRepairs(
  baseNodes: StrictHierarchyNode[],
  repairs: SemanticHierarchyRepair[],
) {
  const nodes = baseNodes.map((node) => ({
    ...node,
    sourceClusterIds: [...node.sourceClusterIds],
  }));
  const issues: ValidationIssue[] = [];
  const usedIds = new Set(nodes.map((node) => node.id));
  const areaByName = new Map(
    nodes
      .filter((node) => node.kind === "area")
      .map((node) => [normalize(node.name), node]),
  );
  const directionByPath = new Map(
    nodes
      .filter((node) => node.kind === "direction" && node.parentId)
      .map((node) => [`${node.parentId}/${normalize(node.name)}`, node]),
  );
  const assignments: SemanticHierarchyAssignment[] = [];

  const uniqueId = (baseValue: string) => {
    const base = slugId(baseValue);
    let id = base;
    let suffix = 2;
    while (usedIds.has(id)) id = `${base}-${suffix++}`;
    usedIds.add(id);
    return id;
  };

  for (const repair of repairs) {
    const areaName = repair.areaName.trim().replace(/\s+/g, " ");
    const directionName = repair.directionName.trim().replace(/\s+/g, " ");
    if (!repair.clusterId || !areaName || !directionName) continue;
    let area = areaByName.get(normalize(areaName));
    if (!area) {
      area = {
        id: uniqueId(`area-${areaName}`),
        name: areaName,
        kind: "area",
        description: "",
        sourceClusterIds: [],
        confidence: repair.confidence,
      };
      nodes.push(area);
      areaByName.set(normalize(areaName), area);
    }
    const directionKey = `${area.id}/${normalize(directionName)}`;
    let direction = directionByPath.get(directionKey);
    if (!direction) {
      direction = {
        id: uniqueId(`direction-${areaName}-${directionName}`),
        name: directionName,
        kind: "direction",
        parentId: area.id,
        description: "",
        sourceClusterIds: [],
        confidence: repair.confidence,
      };
      nodes.push(direction);
      directionByPath.set(directionKey, direction);
    }
    assignments.push({
      clusterId: repair.clusterId,
      directionId: direction.id,
      confidence: repair.confidence,
    });
  }

  issues.push(...validateStrictHierarchy(nodes));
  return { nodes, assignments, issues };
}

export function reconcileHierarchyCheckpoints(
  clusters: SemanticCluster[],
  hierarchyPlanNodes: StrictHierarchyNode[],
  hierarchyAssignments: SemanticHierarchyAssignment[],
  repairCheckpoints: SemanticHierarchyRepairCheckpoint[],
) {
  const nodes: StrictHierarchyNode[] = [];
  const nodeById = new Map<string, StrictHierarchyNode>();
  const usedIds = new Set<string>();
  const areaByName = new Map<string, StrictHierarchyNode>();
  const directionByPath = new Map<string, StrictHierarchyNode>();
  const projectByPath = new Map<string, StrictHierarchyNode>();
  const globalAliases = new Map<string, string>();

  const uniqueId = (preferred: string) => {
    const base = slugId(preferred);
    let id = base;
    let suffix = 2;
    while (usedIds.has(id)) id = `${base}-${suffix++}`;
    usedIds.add(id);
    return id;
  };

  const mergeMetadata = (target: StrictHierarchyNode, source: StrictHierarchyNode) => {
    target.sourceClusterIds = [...new Set([...target.sourceClusterIds, ...source.sourceClusterIds])];
    target.confidence = Math.max(target.confidence, source.confidence);
    if (!target.description && source.description) target.description = source.description;
    if (!target.boundedOutcome && source.boundedOutcome) target.boundedOutcome = source.boundedOutcome;
  };

  const addSnapshot = (snapshot: StrictHierarchyNode[]) => {
    const aliases = new Map<string, string>();
    const remember = (source: StrictHierarchyNode, target: StrictHierarchyNode) => {
      aliases.set(source.id, target.id);
      globalAliases.set(source.id, target.id);
      mergeMetadata(target, source);
      return target;
    };

    for (const source of snapshot.filter((node) => node.kind === "area")) {
      const key = normalize(source.name);
      const existing = areaByName.get(key);
      if (existing) {
        remember(source, existing);
        continue;
      }
      const id = usedIds.has(source.id) ? uniqueId(`area-${source.name}`) : source.id;
      usedIds.add(id);
      const area: StrictHierarchyNode = {
        ...source,
        id,
        parentId: undefined,
        sourceClusterIds: [...source.sourceClusterIds],
      };
      nodes.push(area);
      nodeById.set(area.id, area);
      areaByName.set(key, area);
      aliases.set(source.id, area.id);
      globalAliases.set(source.id, area.id);
    }

    for (const kind of ["direction", "project"] as const) {
      for (const source of snapshot.filter((node) => node.kind === kind)) {
        const parentId = source.parentId
          ? aliases.get(source.parentId)
            ?? globalAliases.get(source.parentId)
            ?? (nodeById.has(source.parentId) ? source.parentId : undefined)
          : undefined;
        const parent = parentId ? nodeById.get(parentId) : undefined;
        const expectedParent = kind === "direction" ? "area" : "direction";
        if (!parent || parent.kind !== expectedParent) continue;
        const pathKey = `${parent.id}/${normalize(source.name)}`;
        const byPath = kind === "direction" ? directionByPath : projectByPath;
        const existing = byPath.get(pathKey);
        if (existing) {
          remember(source, existing);
          continue;
        }
        const id = usedIds.has(source.id)
          ? uniqueId(`${kind}-${parent.name}-${source.name}`)
          : source.id;
        usedIds.add(id);
        const node: StrictHierarchyNode = {
          ...source,
          id,
          parentId: parent.id,
          sourceClusterIds: [...source.sourceClusterIds],
        };
        nodes.push(node);
        nodeById.set(node.id, node);
        byPath.set(pathKey, node);
        aliases.set(source.id, node.id);
        globalAliases.set(source.id, node.id);
      }
    }
    return aliases;
  };

  const assignmentByCluster = new Map<string, SemanticHierarchyAssignment>();
  const rawDirectionByCluster = new Map<string, string>();
  const planAliases = addSnapshot(hierarchyPlanNodes);
  const applyAssignments = (
    assignments: SemanticHierarchyAssignment[],
    aliases: Map<string, string>,
  ) => {
    for (const assignment of assignments) {
      if (assignment.directionId) rawDirectionByCluster.set(assignment.clusterId, assignment.directionId);
      const explicitUnmatched = isExplicitUnmatchedDirectionId(assignment.directionId);
      const directionId = assignment.directionId && !explicitUnmatched
        ? aliases.get(assignment.directionId)
          ?? globalAliases.get(assignment.directionId)
          ?? (nodeById.get(assignment.directionId)?.kind === "direction" ? assignment.directionId : undefined)
        : undefined;
      assignmentByCluster.set(assignment.clusterId, {
        ...assignment,
        directionId: explicitUnmatched
          ? undefined
          : directionId ?? assignment.directionId,
      });
    }
  };

  applyAssignments(hierarchyAssignments, planAliases);
  for (const checkpoint of repairCheckpoints) {
    const aliases = addSnapshot(checkpoint.nodes);
    applyAssignments(checkpoint.assignments, aliases);
  }

  for (const [clusterId, assignment] of assignmentByCluster) {
    if (!assignment.directionId) continue;
    const canonicalDirectionId = globalAliases.get(assignment.directionId) ?? assignment.directionId;
    assignmentByCluster.set(clusterId, {
      ...assignment,
      directionId: canonicalDirectionId,
    });
  }

  const problems: HierarchyRecoveryProblem[] = clusters.flatMap((cluster) => {
    const assignment = assignmentByCluster.get(cluster.id);
    if (!assignment) {
      return [{
        clusterId: cluster.id,
        reason: "missing_assignment" as const,
        affectedThoughtIds: [...cluster.memberThoughtIds],
      }];
    }
    if (!assignment.directionId) {
      const rawDirectionId = rawDirectionByCluster.get(cluster.id);
      return [{
        clusterId: cluster.id,
        reason: isExplicitUnmatchedDirectionId(rawDirectionId)
          ? "unresolved_direction" as const
          : rawDirectionId
            ? "unknown_direction" as const
            : "unresolved_direction" as const,
        directionId: rawDirectionId,
        affectedThoughtIds: [...cluster.memberThoughtIds],
      }];
    }
    const direction = nodeById.get(assignment.directionId);
    if (!direction || direction.kind !== "direction") {
      return [{
        clusterId: cluster.id,
        directionId: assignment.directionId,
        reason: "unknown_direction" as const,
        affectedThoughtIds: [...cluster.memberThoughtIds],
      }];
    }
    return [];
  });

  return {
    nodes,
    assignments: [...assignmentByCluster.values()],
    problems,
    issues: validateStrictHierarchy(nodes),
  };
}

function slugId(value: string) {
  return value
    .toLocaleLowerCase("ru-RU")
    .replace(/[^a-zа-яё0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96) || "node";
}

export function validatePlacements(
  placements: SemanticPlacement[],
  thoughtIds: string[],
  nodes: StrictHierarchyNode[],
  unresolvedThoughtIds: Iterable<string> = [],
) {
  const issues: ValidationIssue[] = [];
  const byNode = new Map(nodes.map((node) => [node.id, node]));
  const counts = new Map<string, number>();
  const unresolved = new Set(unresolvedThoughtIds);
  for (const placement of placements) {
    counts.set(placement.thoughtId, (counts.get(placement.thoughtId) ?? 0) + 1);
    const leaf = byNode.get(placement.primaryNodeId);
    if (!leaf || (leaf.kind !== "direction" && leaf.kind !== "project")) {
      issues.push({ code: "invalid_placement_leaf", message: `Мысль ${placement.thoughtId} размещена не в направлении и не в проекте.`, ids: [placement.thoughtId, placement.primaryNodeId] });
    }
  }
  for (const thoughtId of thoughtIds) {
    const count = counts.get(thoughtId) ?? 0;
    if (count === 0 && !unresolved.has(thoughtId)) {
      issues.push({ code: "missing_placement", message: `У мысли ${thoughtId} нет основного размещения.`, ids: [thoughtId] });
    }
    if (count > 1) issues.push({ code: "thought_placed_multiple_times", message: `У мысли ${thoughtId} несколько основных размещений.`, ids: [thoughtId] });
  }
  return issues;
}

export function selectSemanticCandidates(
  embeddings: Record<string, number[]>,
  thresholds: SemanticThresholds = DEFAULT_SEMANTIC_THRESHOLDS,
) {
  const ids = Object.keys(embeddings).sort();
  const perThought = new Map<string, SemanticCandidate[]>();
  for (let leftIndex = 0; leftIndex < ids.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < ids.length; rightIndex += 1) {
      const sourceId = ids[leftIndex];
      const targetId = ids[rightIndex];
      const similarity = cosineSimilarity(embeddings[sourceId], embeddings[targetId]);
      const purposes: CandidatePurpose[] = [];
      if (similarity >= thresholds.related) purposes.push("related");
      if (similarity >= thresholds.duplicate) purposes.push("duplicate");
      if (similarity >= thresholds.contradiction) purposes.push("contradiction");
      if (purposes.length === 0) continue;
      const candidate = { sourceId, targetId, similarity: round(similarity), purposes };
      perThought.set(sourceId, [...(perThought.get(sourceId) ?? []), candidate]);
      perThought.set(targetId, [...(perThought.get(targetId) ?? []), candidate]);
    }
  }

  const allowed = new Set<string>();
  for (const candidates of perThought.values()) {
    candidates
      .sort((left, right) => right.similarity - left.similarity)
      .slice(0, thresholds.maxCandidatesPerThought)
      .forEach((candidate) => allowed.add(pairKey(candidate.sourceId, candidate.targetId)));
  }
  return [...perThought.values()]
    .flat()
    .filter((candidate, index, all) => all.findIndex((item) => pairKey(item.sourceId, item.targetId) === pairKey(candidate.sourceId, candidate.targetId)) === index)
    .filter((candidate) => allowed.has(pairKey(candidate.sourceId, candidate.targetId)))
    .sort((left, right) => right.similarity - left.similarity);
}

export async function selectSemanticCandidatesIncremental(
  embeddings: Record<string, number[]>,
  thresholds: SemanticThresholds = DEFAULT_SEMANTIC_THRESHOLDS,
  onProgress?: (processedPairs: number, totalPairs: number) => void,
) {
  const ids = Object.keys(embeddings).sort();
  const totalPairs = (ids.length * (ids.length - 1)) / 2;
  const perThought = new Map<string, SemanticCandidate[]>();
  let processedPairs = 0;
  for (let leftIndex = 0; leftIndex < ids.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < ids.length; rightIndex += 1) {
      const sourceId = ids[leftIndex];
      const targetId = ids[rightIndex];
      const similarity = cosineSimilarity(embeddings[sourceId], embeddings[targetId]);
      const purposes: CandidatePurpose[] = [];
      if (similarity >= thresholds.related) purposes.push("related");
      if (similarity >= thresholds.duplicate) purposes.push("duplicate");
      if (similarity >= thresholds.contradiction) purposes.push("contradiction");
      if (purposes.length > 0) {
        const candidate = { sourceId, targetId, similarity: round(similarity), purposes };
        perThought.set(sourceId, [...(perThought.get(sourceId) ?? []), candidate]);
        perThought.set(targetId, [...(perThought.get(targetId) ?? []), candidate]);
      }
      processedPairs += 1;
      if (processedPairs % 192 === 0) {
        onProgress?.(processedPairs, totalPairs);
        await new Promise<void>((resolve) => setTimeout(resolve, 0));
      }
    }
  }
  onProgress?.(processedPairs, totalPairs);

  const allowed = new Set<string>();
  for (const candidates of perThought.values()) {
    candidates
      .sort((left, right) => right.similarity - left.similarity)
      .slice(0, thresholds.maxCandidatesPerThought)
      .forEach((candidate) => allowed.add(pairKey(candidate.sourceId, candidate.targetId)));
  }
  return [...perThought.values()]
    .flat()
    .filter((candidate, index, all) => all.findIndex((item) => pairKey(item.sourceId, item.targetId) === pairKey(candidate.sourceId, candidate.targetId)) === index)
    .filter((candidate) => allowed.has(pairKey(candidate.sourceId, candidate.targetId)))
    .sort((left, right) => right.similarity - left.similarity);
}

export function strictNodePath(nodes: StrictHierarchyNode[], nodeId: string) {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const path: StrictHierarchyNode[] = [];
  const seen = new Set<string>();
  let current = byId.get(nodeId);
  while (current && !seen.has(current.id)) {
    path.unshift(current);
    seen.add(current.id);
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }
  return path;
}

export function compareClusterings(left: SemanticCluster[], right: SemanticCluster[], thoughtIds: string[]) {
  const leftByThought = membership(left);
  const rightByThought = membership(right);
  let agreements = 0;
  let pairs = 0;
  for (let i = 0; i < thoughtIds.length; i += 1) {
    for (let j = i + 1; j < thoughtIds.length; j += 1) {
      const a = thoughtIds[i];
      const b = thoughtIds[j];
      const sameLeft = leftByThought.get(a) === leftByThought.get(b);
      const sameRight = rightByThought.get(a) === rightByThought.get(b);
      if (sameLeft === sameRight) agreements += 1;
      pairs += 1;
    }
  }
  return pairs ? round(agreements / pairs) : 1;
}

export function deterministicOrder<T extends { number: number }>(items: T[], variant: "original" | "round_robin" | "reverse" | "seeded") {
  if (variant === "original") return [...items].sort((a, b) => a.number - b.number);
  if (variant === "reverse") return [...items].sort((a, b) => b.number - a.number);
  if (variant === "round_robin") return [...items];
  return [...items].sort((a, b) => stableHash(String(a.number)) - stableHash(String(b.number)));
}

function membership(clusters: SemanticCluster[]) {
  const result = new Map<string, string>();
  clusters.forEach((cluster) => cluster.memberThoughtIds.forEach((id) => result.set(id, cluster.id)));
  return result;
}

function pairKey(left: string, right: string) {
  return left < right ? `${left}::${right}` : `${right}::${left}`;
}

function cosineSimilarity(left: number[], right: number[]) {
  if (!left.length || left.length !== right.length) return 0;
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

function normalize(value: string) {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("ru");
}

function stableHash(value: string) {
  let hash = 2166136261;
  for (const character of value) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function round(value: number) {
  return Math.round(value * 10000) / 10000;
}
