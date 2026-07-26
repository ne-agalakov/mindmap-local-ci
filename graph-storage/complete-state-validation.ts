import { canonicalJson } from "../storage/canonical-json.ts";
import type {
  GraphEntityRef,
  GraphStorageRejectionCode,
  HierarchyNodeRecord,
  MindMapGraphState,
} from "./contracts.ts";
import { GraphInvariantError } from "./graph-state.ts";

function fail(
  code: GraphStorageRejectionCode,
  message: string,
  details?: Readonly<Record<string, string | number | boolean | null>>,
): never {
  throw new GraphInvariantError(code, message, details);
}

function nodeById(state: MindMapGraphState, nodeId: string): HierarchyNodeRecord | undefined {
  return state.nodes.find((node) => node.nodeId === nodeId);
}

function entityExists(state: MindMapGraphState, ref: GraphEntityRef): boolean {
  return ref.kind === "thought"
    ? state.thoughts.some((thought) => thought.thoughtId === ref.id)
    : state.nodes.some((node) => node.nodeId === ref.id);
}

function validateHierarchy(state: MindMapGraphState): void {
  const paths = new Map<string, string>();
  for (const node of state.nodes) {
    if (node.level === "area") {
      if (node.parentNodeId !== undefined || node.projectState !== undefined) {
        fail("invalid_hierarchy", "Area must remain a root.", { nodeId: node.nodeId });
      }
    } else {
      const parent = node.parentNodeId ? nodeById(state, node.parentNodeId) : undefined;
      const expectedParent = node.level === "direction" ? "area" : "direction";
      if (!parent || parent.level !== expectedParent) {
        fail("invalid_hierarchy", "Node parent level is invalid in the completed graph.", {
          nodeId: node.nodeId,
        });
      }
      if (node.level === "project" && node.projectState === undefined) {
        fail("invalid_hierarchy", "Project state is required.", { nodeId: node.nodeId });
      }
      if (node.level === "direction" && node.projectState !== undefined) {
        fail("invalid_hierarchy", "Direction cannot have project state.", { nodeId: node.nodeId });
      }
    }

    const segments: string[] = [];
    const seen = new Set<string>();
    let cursor: HierarchyNodeRecord | undefined = node;
    while (cursor) {
      if (seen.has(cursor.nodeId)) {
        fail("cycle_detected", "Hierarchy cycle detected.", { nodeId: node.nodeId });
      }
      seen.add(cursor.nodeId);
      segments.unshift(`${cursor.level}:${cursor.titlePayloadHash}`);
      cursor = cursor.parentNodeId ? nodeById(state, cursor.parentNodeId) : undefined;
    }
    const path = segments.join("/");
    const prior = paths.get(path);
    if (prior && prior !== node.nodeId) {
      fail("duplicate_path", "Duplicate typed hierarchy path detected.", {
        nodeId: node.nodeId,
        existingNodeId: prior,
      });
    }
    paths.set(path, node.nodeId);
  }
}

export function validateCompleteGraphState(state: MindMapGraphState): void {
  const payloads = new Map(state.payloads.map((payload) => [payload.contentHash, payload]));
  if (payloads.size !== state.payloads.length) {
    fail("payload_conflict", "Graph contains duplicate payload hashes.");
  }

  const thoughts = new Map(state.thoughts.map((thought) => [thought.thoughtId, thought]));
  if (thoughts.size !== state.thoughts.length) fail("duplicate_identity", "Duplicate thought IDs detected.");
  for (const thought of state.thoughts) {
    const payload = payloads.get(thought.textPayloadHash);
    if (!payload || payload.kind !== "thought-text" || payload.workspace !== state.workspace) {
      fail("payload_missing", "Thought payload is missing in completed graph.", {
        thoughtId: thought.thoughtId,
      });
    }
  }

  const nodes = new Map(state.nodes.map((node) => [node.nodeId, node]));
  if (nodes.size !== state.nodes.length) fail("duplicate_identity", "Duplicate node IDs detected.");
  for (const node of state.nodes) {
    const payload = payloads.get(node.titlePayloadHash);
    if (!payload || payload.kind !== "node-title" || payload.workspace !== state.workspace) {
      fail("payload_missing", "Node title payload is missing in completed graph.", { nodeId: node.nodeId });
    }
  }
  validateHierarchy(state);

  const placements = new Map(state.placements.map((placement) => [placement.thoughtId, placement]));
  if (placements.size !== state.placements.length) {
    fail("invalid_placement", "A thought has more than one current placement record.");
  }
  if (placements.size !== thoughts.size) {
    fail("invalid_placement", "Every thought must have exactly one placement or unresolved record.", {
      thoughtCount: thoughts.size,
      placementCount: placements.size,
    });
  }
  for (const thoughtId of thoughts.keys()) {
    const placement = placements.get(thoughtId);
    if (!placement) fail("invalid_placement", "Thought placement is missing.", { thoughtId });
    if (placement.kind === "placed") {
      const parent = nodes.get(placement.parentNodeId);
      if (!parent || (parent.level !== "direction" && parent.level !== "project")) {
        fail("invalid_placement", "Placed thought has an invalid parent.", { thoughtId });
      }
    }
  }

  const linkIds = new Set<string>();
  for (const link of state.links) {
    if (linkIds.has(link.linkId)) fail("duplicate_identity", "Duplicate link ID detected.");
    linkIds.add(link.linkId);
    if (!entityExists(state, link.source) || !entityExists(state, link.target)) {
      fail("invalid_link", "Link endpoint is missing in completed graph.", { linkId: link.linkId });
    }
    if (canonicalJson(link.source) === canonicalJson(link.target)) {
      fail("invalid_link", "Self-link detected in completed graph.", { linkId: link.linkId });
    }
  }

  const embeddingIds = new Set<string>();
  for (const embedding of state.embeddings) {
    if (embeddingIds.has(embedding.embeddingId)) {
      fail("duplicate_identity", "Duplicate embedding ID detected.", {
        embeddingId: embedding.embeddingId,
      });
    }
    embeddingIds.add(embedding.embeddingId);
    const thought = thoughts.get(embedding.thoughtId);
    const sourceTextPayload = payloads.get(embedding.sourceTextContentHash);
    const vectorPayload = payloads.get(embedding.vectorPayloadHash);
    if (
      !thought
      || !sourceTextPayload
      || sourceTextPayload.kind !== "thought-text"
      || !vectorPayload
      || vectorPayload.kind !== "embedding-f32"
      || vectorPayload.encoding !== "float32-le-base64"
      || vectorPayload.byteLength !== embedding.dimensions * 4
    ) {
      fail("invalid_embedding", "Embedding is invalid in completed graph.", {
        embeddingId: embedding.embeddingId,
      });
    }
  }

  const damageIds = new Set<string>();
  for (const damaged of state.damagedReferences) {
    if (damageIds.has(damaged.damagedReferenceId)) {
      fail("duplicate_identity", "Duplicate damaged reference ID detected.");
    }
    damageIds.add(damaged.damagedReferenceId);
    if (!entityExists(state, damaged.source)) {
      fail("invalid_damaged_reference", "Damaged reference source is missing.", {
        damagedReferenceId: damaged.damagedReferenceId,
      });
    }
    if (damaged.reason === "missing_target" && entityExists(state, damaged.target)) {
      fail("invalid_damaged_reference", "Missing-target record points to an existing target.", {
        damagedReferenceId: damaged.damagedReferenceId,
      });
    }
  }
}
