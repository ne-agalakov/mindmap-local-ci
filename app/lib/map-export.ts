export type MapGraphPosition = { x: number; y: number };

export type MapGraphNode = {
  id: string;
  label: string;
  kind: "area" | "direction" | "project" | "thought";
  meta?: string;
};

export type MapGraphEdge = {
  id: string;
  source: string;
  target: string;
  kind: "structure" | "semantic-proposed" | "semantic-approved" | "semantic-conflict";
  label?: string;
};

type LayoutThought = {
  id: string;
  title: string;
  type: string;
  primaryNodeId?: string;
};

type LayoutHierarchyNode = {
  id: string;
  name: string;
  kind: "area" | "direction" | "project";
  parentId?: string;
};

type LayoutLink = {
  id: string;
  source: string;
  target: string;
  type: string;
  status: "pending" | "approved" | "rejected";
};

export function buildMapGraph(
  thoughts: LayoutThought[],
  hierarchyNodes: LayoutHierarchyNode[],
  links: LayoutLink[],
  manualPositions: Record<string, MapGraphPosition> = {},
) {
  const activeNodeIds = new Set(hierarchyNodes.map((node) => node.id));
  const visibleThoughtIds = new Set(thoughts.map((thought) => thought.id));
  const nodes: MapGraphNode[] = [
    ...hierarchyNodes.map((node) => ({
      id: node.id,
      label: node.name,
      kind: node.kind,
      meta: node.kind === "area" ? "ОБЛАСТЬ" : node.kind === "direction" ? "НАПРАВЛЕНИЕ" : "ПРОЕКТ",
    } satisfies MapGraphNode)),
    ...thoughts.map((thought) => ({
      id: thought.id,
      label: thought.title,
      kind: "thought" as const,
      meta: thought.type.toUpperCase(),
    })),
  ];
  const edges: MapGraphEdge[] = [];
  for (const node of hierarchyNodes) {
    if (node.parentId && activeNodeIds.has(node.parentId)) {
      edges.push({
        id: `structure:${node.parentId}:${node.id}`,
        source: node.parentId,
        target: node.id,
        kind: "structure",
      });
    }
  }
  for (const thought of thoughts) {
    if (thought.primaryNodeId && activeNodeIds.has(thought.primaryNodeId)) {
      edges.push({
        id: `placement:${thought.primaryNodeId}:${thought.id}`,
        source: thought.primaryNodeId,
        target: thought.id,
        kind: "structure",
      });
    }
  }
  for (const link of links) {
    if (link.status === "rejected" || !visibleThoughtIds.has(link.source) || !visibleThoughtIds.has(link.target)) continue;
    edges.push({
      id: `semantic:${link.id}`,
      source: link.source,
      target: link.target,
      kind: link.type === "Противоречит"
        ? "semantic-conflict"
        : link.status === "pending"
          ? "semantic-proposed"
          : "semantic-approved",
      label: link.type,
    });
  }

  const positions = radialPositions(thoughts, hierarchyNodes);
  Object.entries(manualPositions).forEach(([id, position]) => {
    if (nodes.some((node) => node.id === id)) positions[id] = position;
  });
  return { nodes, edges, positions };
}

export function buildMapExportSvg(
  graph: ReturnType<typeof buildMapGraph>,
  options: { title?: string; padding?: number } = {},
) {
  const padding = options.padding ?? 160;
  const box = graphBounds(graph, padding);
  const width = Math.max(800, Math.ceil(box.width));
  const height = Math.max(600, Math.ceil(box.height));
  const lines = graph.edges.flatMap((edge) => {
    const from = graph.positions[edge.source];
    const to = graph.positions[edge.target];
    if (!from || !to) return [];
    const stroke = edge.kind === "structure"
      ? "#37536f"
      : edge.kind === "semantic-conflict"
        ? "#d77a7a"
        : "#64aef7";
    const dash = edge.kind === "semantic-proposed" ? ' stroke-dasharray="10 8"' : "";
    const widthValue = edge.kind === "structure" ? 2 : 2.5;
    return [`<line x1="${n(from.x - box.x)}" y1="${n(from.y - box.y)}" x2="${n(to.x - box.x)}" y2="${n(to.y - box.y)}" stroke="${stroke}" stroke-width="${widthValue}" opacity="${edge.kind === "structure" ? ".72" : ".9"}"${dash}/>`];
  }).join("");
  const cards = graph.nodes.flatMap((node) => {
    const position = graph.positions[node.id];
    if (!position) return [];
    const x = position.x - box.x;
    const y = position.y - box.y;
    const size = nodeSize(node.kind);
    const palette = nodePalette(node.kind);
    return [`
      <g transform="translate(${n(x)} ${n(y)})">
        <rect x="${-size.width / 2}" y="${-size.height / 2}" width="${size.width}" height="${size.height}" rx="${node.kind === "area" ? 28 : 18}" fill="${palette.fill}" stroke="${palette.stroke}" stroke-width="${node.kind === "area" ? 3 : 1.5}"/>
        <text x="${-size.width / 2 + 18}" y="-7" fill="${palette.meta}" font-family="Inter,Arial,sans-serif" font-size="${node.kind === "area" ? 12 : 10}" font-weight="700" letter-spacing="1.4">${escapeXml(node.meta ?? node.kind.toUpperCase())}</text>
        <text x="${-size.width / 2 + 18}" y="17" fill="#edf5ff" font-family="Inter,Arial,sans-serif" font-size="${node.kind === "area" ? 18 : 14}" font-weight="${node.kind === "thought" ? 500 : 650}">${escapeXml(truncate(node.label, node.kind === "thought" ? 34 : 30))}</text>
      </g>`];
  }).join("");
  const title = escapeXml(options.title ?? "MindMap — полная карта");
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <title>${title}</title>
  <rect width="100%" height="100%" fill="#07111d"/>
  <g>${lines}</g>
  <g>${cards}</g>
</svg>`;
}

function radialPositions(
  thoughts: LayoutThought[],
  nodes: LayoutHierarchyNode[],
) {
  const positions: Record<string, MapGraphPosition> = {};
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const areas = nodes.filter((node) => node.kind === "area");
  const directions = nodes.filter((node) => node.kind === "direction");
  const projects = nodes.filter((node) => node.kind === "project");
  const areaAngle = new Map<string, number>();
  const directionAngle = new Map<string, number>();
  const projectAngle = new Map<string, number>();
  const areaSector = (Math.PI * 2) / Math.max(areas.length, 1);

  areas.forEach((area, index) => {
    const angle = -Math.PI / 2 + index * areaSector;
    areaAngle.set(area.id, angle);
    positions[area.id] = polar(angle, areas.length === 1 ? 0 : 135);
    const children = directions.filter((direction) => direction.parentId === area.id);
    const spread = Math.min(areaSector * .72, .9);
    children.forEach((direction, childIndex) => {
      const childAngle = angle + spreadOffset(childIndex, children.length, spread);
      directionAngle.set(direction.id, childAngle);
      positions[direction.id] = polar(childAngle, 350);
      const projectChildren = projects.filter((project) => project.parentId === direction.id);
      projectChildren.forEach((project, projectIndex) => {
        const projectSpread = Math.min(spread / Math.max(children.length, 1), .34);
        const projectChildAngle = childAngle + spreadOffset(projectIndex, projectChildren.length, projectSpread);
        projectAngle.set(project.id, projectChildAngle);
        positions[project.id] = polar(projectChildAngle, 535);
      });
    });
  });

  const thoughtsByLeaf = new Map<string, LayoutThought[]>();
  const orphans: LayoutThought[] = [];
  thoughts.forEach((thought) => {
    if (!thought.primaryNodeId || !byId.has(thought.primaryNodeId)) {
      orphans.push(thought);
      return;
    }
    thoughtsByLeaf.set(thought.primaryNodeId, [...(thoughtsByLeaf.get(thought.primaryNodeId) ?? []), thought]);
  });
  thoughtsByLeaf.forEach((items, leafId) => {
    const leaf = byId.get(leafId);
    const baseAngle = projectAngle.get(leafId)
      ?? directionAngle.get(leafId)
      ?? (leaf?.parentId ? directionAngle.get(leaf.parentId) : undefined)
      ?? 0;
    const radius = leaf?.kind === "project" ? 735 : 620;
    const spread = Math.min(.52, Math.max(.12, items.length * .055));
    items.forEach((thought, index) => {
      const ring = Math.floor(index / 7);
      const slot = index % 7;
      const ringCount = Math.min(7, items.length - ring * 7);
      const angle = baseAngle + spreadOffset(slot, ringCount, spread);
      positions[thought.id] = polar(angle, radius + ring * 125);
    });
  });
  orphans.forEach((thought, index) => {
    const angle = index * 2.3999632297;
    positions[thought.id] = polar(angle, 820 + Math.sqrt(index) * 90);
  });
  return positions;
}

function spreadOffset(index: number, count: number, spread: number) {
  if (count <= 1) return 0;
  return -spread / 2 + (spread * index) / (count - 1);
}

function polar(angle: number, radius: number) {
  return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
}

function graphBounds(
  graph: ReturnType<typeof buildMapGraph>,
  padding: number,
) {
  const boxes = graph.nodes.flatMap((node) => {
    const position = graph.positions[node.id];
    if (!position) return [];
    const size = nodeSize(node.kind);
    return [{
      left: position.x - size.width / 2,
      right: position.x + size.width / 2,
      top: position.y - size.height / 2,
      bottom: position.y + size.height / 2,
    }];
  });
  const left = Math.min(...boxes.map((box) => box.left), 0) - padding;
  const right = Math.max(...boxes.map((box) => box.right), 0) + padding;
  const top = Math.min(...boxes.map((box) => box.top), 0) - padding;
  const bottom = Math.max(...boxes.map((box) => box.bottom), 0) + padding;
  return { x: left, y: top, width: right - left, height: bottom - top };
}

export function nodeSize(kind: MapGraphNode["kind"]) {
  if (kind === "area") return { width: 230, height: 88 };
  if (kind === "direction") return { width: 212, height: 76 };
  if (kind === "project") return { width: 200, height: 72 };
  return { width: 184, height: 66 };
}

function nodePalette(kind: MapGraphNode["kind"]) {
  if (kind === "area") return { fill: "#126fc9", stroke: "#94ceff", meta: "#d5edff" };
  if (kind === "direction") return { fill: "#153d63", stroke: "#609ed6", meta: "#83bff2" };
  if (kind === "project") return { fill: "#273456", stroke: "#7e8fc5", meta: "#aab9ec" };
  return { fill: "#172535", stroke: "#4c6b88", meta: "#8faac2" };
}

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function truncate(value: string, length: number) {
  return value.length > length ? `${value.slice(0, length - 1)}…` : value;
}

function n(value: number) {
  return Math.round(value * 10) / 10;
}
