export type KnowledgeNodeKind = "area" | "direction" | "project";

export type KnowledgeNode = {
  id: string;
  name: string;
  kind: KnowledgeNodeKind;
  parentId?: string;
  createdAt: string;
  source: "ai" | "user" | "migration";
  confidence?: number;
  reason?: string;
  description?: string;
  status: "active" | "archived";
};

export type ProposedHierarchyNode = {
  existingNodeId?: string;
  name: string;
  kind: KnowledgeNodeKind;
  confidence: number;
  reason: string;
};

export type ProposedPlacement = {
  primaryPath: ProposedHierarchyNode[];
  additionalPaths: ProposedHierarchyNode[][];
};

type ThoughtPlacement = {
  primaryNodeId?: string;
  additionalNodeIds?: string[];
};

/**
 * Keeps the hierarchy prompt bounded as the map grows. Relevant thought paths
 * are preferred, while root areas and lexical matches preserve enough global
 * context for the model to reuse existing branches instead of duplicating them.
 */
export function selectKnowledgeContext(
  nodes: KnowledgeNode[],
  candidateThoughts: ThoughtPlacement[],
  content: string,
  limit = 72,
) {
  const activeNodes = nodes.filter((node) => node.status === "active");
  if (activeNodes.length <= limit) return activeNodes;

  const byId = new Map(activeNodes.map((node) => [node.id, node]));
  const selectedIds: string[] = [];
  const seen = new Set<string>();
  const add = (id?: string) => {
    if (!id || seen.has(id) || !byId.has(id) || selectedIds.length >= limit) return;
    seen.add(id);
    selectedIds.push(id);
  };
  const addPath = (leafId?: string) => {
    const path: KnowledgeNode[] = [];
    const pathSeen = new Set<string>();
    let current = leafId ? byId.get(leafId) : undefined;
    while (current && !pathSeen.has(current.id)) {
      path.unshift(current);
      pathSeen.add(current.id);
      current = current.parentId ? byId.get(current.parentId) : undefined;
    }
    path.forEach((node) => add(node.id));
  };

  activeNodes
    .filter((node) => !node.parentId && node.kind === "area")
    .slice(0, 24)
    .forEach((node) => add(node.id));

  for (const thought of candidateThoughts) {
    addPath(thought.primaryNodeId);
    thought.additionalNodeIds?.forEach(addPath);
  }

  const queryTokens = tokens(content);
  activeNodes
    .map((node) => ({
      node,
      score: [...tokens(node.name)].filter((token) => queryTokens.has(token)).length,
    }))
    .filter(({ score }) => score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, 18)
    .forEach(({ node }) => addPath(node.id));

  const selectedSnapshot = [...selectedIds];
  for (const parentId of selectedSnapshot) {
    activeNodes
      .filter((node) => node.parentId === parentId)
      .forEach((node) => add(node.id));
  }

  return selectedIds.map((id) => byId.get(id)).filter((node): node is KnowledgeNode => Boolean(node));
}

export function materializePlacement(
  placement: ProposedPlacement,
  currentNodes: KnowledgeNode[],
  createId: () => string,
  createdAt = new Date().toISOString(),
) {
  const nodes = [...currentNodes];

  const materializePath = (rawPath: ProposedHierarchyNode[]) => {
    const path = strictProposedPath(rawPath);
    if (path.length < 2) return undefined;
    let parentId: string | undefined;
    let leafId: string | undefined;
    for (const proposed of path) {
      const byId = proposed.existingNodeId
        ? nodes.find((node) =>
            node.id === proposed.existingNodeId &&
            node.status === "active" &&
            node.kind === proposed.kind &&
            (node.parentId ?? undefined) === parentId,
          )
        : undefined;
      const byNameAndParent = nodes.find(
        (node) =>
          node.status === "active" &&
          normalize(node.name) === normalize(proposed.name) &&
          node.kind === proposed.kind &&
          (node.parentId ?? undefined) === parentId,
      );
      let resolved = byId ?? byNameAndParent;
      if (!resolved) {
        resolved = {
          id: createId(),
          name: proposed.name.trim(),
          kind: proposed.kind,
          parentId,
          createdAt,
          source: "ai",
          confidence: proposed.confidence,
          reason: proposed.reason,
          status: "active",
        };
        nodes.push(resolved);
      }
      parentId = resolved.id;
      leafId = resolved.id;
    }
    return leafId;
  };

  const primaryNodeId = materializePath(placement.primaryPath);
  const additionalNodeIds = placement.additionalPaths
    .map(materializePath)
    .filter((id): id is string => Boolean(id) && id !== primaryNodeId);

  return {
    nodes,
    primaryNodeId,
    additionalNodeIds: Array.from(new Set(additionalNodeIds)),
  };
}

/**
 * v0.6 invariant: an AI proposal can only describe an area -> direction ->
 * optional project path. Invalid paths are rejected instead of being silently
 * materialized into a malformed map.
 */
export function strictProposedPath(path: ProposedHierarchyNode[]) {
  if (!Array.isArray(path)) return [];
  const compact = path.slice(0, 3);
  if (compact[0]?.kind !== "area" || compact[1]?.kind !== "direction") return [];
  if (compact[2] && compact[2].kind !== "project") return [];
  if (compact.some((node) => !node.name.trim())) return [];
  return compact;
}

export function descendantNodeIds(nodes: KnowledgeNode[], rootId?: string) {
  if (!rootId) return new Set(nodes.map((node) => node.id));
  const result = new Set<string>([rootId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const node of nodes) {
      if (node.parentId && result.has(node.parentId) && !result.has(node.id)) {
        result.add(node.id);
        changed = true;
      }
    }
  }
  return result;
}

export function knowledgePath(nodes: KnowledgeNode[], nodeId?: string) {
  if (!nodeId) return [];
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const result: KnowledgeNode[] = [];
  const seen = new Set<string>();
  let current = byId.get(nodeId);
  while (current && !seen.has(current.id)) {
    result.unshift(current);
    seen.add(current.id);
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }
  return result;
}

export function hierarchyLabel(kind: KnowledgeNodeKind) {
  if (kind === "area") return "Область";
  if (kind === "direction") return "Направление";
  return "Проект";
}

function normalize(value: string) {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("ru");
}

function tokens(value: string) {
  return new Set(
    normalize(value)
      .replace(/[^a-zа-яё0-9\s-]/gi, " ")
      .split(/\s+/)
      .filter((token) => token.length > 3),
  );
}
