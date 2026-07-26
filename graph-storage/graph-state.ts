import { canonicalClone, canonicalJson } from "../storage/canonical-json.ts";
import {
  MINDMAP_GRAPH_NAMESPACE,
  type ContentAddressedPayloadRecord,
  type DamagedReferenceRecord,
  type EmbeddingRecord,
  type GraphEntityRef,
  type GraphEvent,
  type GraphLinkRecord,
  type GraphStorageRejectionCode,
  type HierarchyNodeRecord,
  type MindMapGraphState,
  type ThoughtPlacementRecord,
  type ThoughtRecord,
} from "./contracts.ts";

export class GraphInvariantError extends Error {
  readonly code: GraphStorageRejectionCode;
  readonly details?: Readonly<Record<string, string | number | boolean | null>>;

  constructor(
    code: GraphStorageRejectionCode,
    message: string,
    details?: Readonly<Record<string, string | number | boolean | null>>,
  ) {
    super(message);
    this.name = "GraphInvariantError";
    this.code = code;
    this.details = details;
  }
}

export function emptyGraphState(workspace: MindMapGraphState["workspace"]): MindMapGraphState {
  return Object.freeze({
    namespace: MINDMAP_GRAPH_NAMESPACE,
    workspace,
    revision: 0,
    payloads: Object.freeze([]),
    thoughts: Object.freeze([]),
    nodes: Object.freeze([]),
    placements: Object.freeze([]),
    links: Object.freeze([]),
    embeddings: Object.freeze([]),
    damagedReferences: Object.freeze([]),
  });
}

function fail(
  code: GraphStorageRejectionCode,
  message: string,
  details?: Readonly<Record<string, string | number | boolean | null>>,
): never {
  throw new GraphInvariantError(code, message, details);
}

function requireNonEmpty(value: string, field: string): void {
  if (!value.trim()) fail("invalid_transaction", `${field} must be non-empty.`, { field });
}

function requirePositiveRevision(revision: number, field: string): void {
  if (!Number.isInteger(revision) || revision < 1) {
    fail("entity_revision_conflict", `${field} revision must be a positive integer.`, { revision });
  }
}

function ensureNamespaceWorkspace(
  state: MindMapGraphState,
  record: Readonly<{ namespace: string; workspace: MindMapGraphState["workspace"] }>,
): void {
  if (record.namespace !== MINDMAP_GRAPH_NAMESPACE) {
    fail("invalid_namespace", "Record namespace is not the accepted graph namespace.");
  }
  if (record.workspace !== state.workspace) {
    fail("workspace_mismatch", "Record workspace differs from transaction workspace.");
  }
}

function replaceVersioned<T extends Readonly<{ revision: number }>>(
  records: readonly T[],
  identity: (record: T) => string,
  next: T,
  entityName: string,
): readonly T[] {
  requirePositiveRevision(next.revision, entityName);
  const nextId = identity(next);
  const existingIndex = records.findIndex((record) => identity(record) === nextId);
  if (existingIndex === -1) {
    if (next.revision !== 1) {
      fail("entity_revision_conflict", `${entityName} must start at revision 1.`, {
        id: nextId,
        actualRevision: next.revision,
      });
    }
    return [...records, canonicalClone(next)];
  }
  const existing = records[existingIndex];
  if (next.revision !== existing.revision + 1) {
    fail("entity_revision_conflict", `${entityName} revision is not contiguous.`, {
      id: nextId,
      currentRevision: existing.revision,
      actualRevision: next.revision,
    });
  }
  const updated = [...records];
  updated[existingIndex] = canonicalClone(next);
  return updated;
}

function payloadByHash(state: MindMapGraphState, hash: string): ContentAddressedPayloadRecord | undefined {
  return state.payloads.find((payload) => payload.contentHash === hash);
}

function thoughtById(state: MindMapGraphState, thoughtId: string): ThoughtRecord | undefined {
  return state.thoughts.find((thought) => thought.thoughtId === thoughtId);
}

function nodeById(state: MindMapGraphState, nodeId: string): HierarchyNodeRecord | undefined {
  return state.nodes.find((node) => node.nodeId === nodeId);
}

function entityExists(state: MindMapGraphState, ref: GraphEntityRef): boolean {
  return ref.kind === "thought"
    ? Boolean(thoughtById(state, ref.id))
    : Boolean(nodeById(state, ref.id));
}

function validatePayloadStructure(record: ContentAddressedPayloadRecord): void {
  requireNonEmpty(record.contentHash, "payload.contentHash");
  requireNonEmpty(record.mediaType, "payload.mediaType");
  if (!Number.isInteger(record.byteLength) || record.byteLength < 0) {
    fail("payload_hash_mismatch", "Payload byte length must be a non-negative integer.", {
      byteLength: record.byteLength,
    });
  }
  if (record.encoding === "base64" || record.encoding === "float32-le-base64") {
    if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(record.data)) {
      fail("payload_hash_mismatch", "Payload data is not canonical base64.");
    }
    const padding = record.data.endsWith("==") ? 2 : record.data.endsWith("=") ? 1 : 0;
    const decodedLength = record.data.length === 0 ? 0 : (record.data.length / 4) * 3 - padding;
    if (decodedLength !== record.byteLength) {
      fail("payload_hash_mismatch", "Payload byte length does not match base64 content.", {
        declared: record.byteLength,
        actual: decodedLength,
      });
    }
    return;
  }
  const actualLength = new TextEncoder().encode(record.data).byteLength;
  if (actualLength !== record.byteLength) {
    fail("payload_hash_mismatch", "Payload byte length does not match text content.", {
      declared: record.byteLength,
      actual: actualLength,
    });
  }
}

function validateThought(state: MindMapGraphState, record: ThoughtRecord): void {
  requireNonEmpty(record.thoughtId, "thought.thoughtId");
  requireNonEmpty(record.textPayloadHash, "thought.textPayloadHash");
  requireNonEmpty(record.createdAt, "thought.createdAt");
  requireNonEmpty(record.updatedAt, "thought.updatedAt");
  const payload = payloadByHash(state, record.textPayloadHash);
  if (!payload || payload.kind !== "thought-text") {
    fail("payload_missing", "Thought text payload is missing or has the wrong kind.", {
      thoughtId: record.thoughtId,
      payloadHash: record.textPayloadHash,
    });
  }
  const existing = thoughtById(state, record.thoughtId);
  if (existing && existing.createdAt !== record.createdAt) {
    fail("duplicate_identity", "Thought immutable creation identity changed.", {
      thoughtId: record.thoughtId,
    });
  }
}

function validateNode(state: MindMapGraphState, record: HierarchyNodeRecord): void {
  requireNonEmpty(record.nodeId, "node.nodeId");
  requireNonEmpty(record.titlePayloadHash, "node.titlePayloadHash");
  requireNonEmpty(record.createdAt, "node.createdAt");
  requireNonEmpty(record.updatedAt, "node.updatedAt");
  const titlePayload = payloadByHash(state, record.titlePayloadHash);
  if (!titlePayload || titlePayload.kind !== "node-title") {
    fail("payload_missing", "Node title payload is missing or has the wrong kind.", {
      nodeId: record.nodeId,
      payloadHash: record.titlePayloadHash,
    });
  }
  if (record.level === "area") {
    if (record.parentNodeId !== undefined || record.projectState !== undefined) {
      fail("invalid_hierarchy", "Area must be a root and cannot have project state.", {
        nodeId: record.nodeId,
      });
    }
  } else {
    if (!record.parentNodeId) {
      fail("invalid_hierarchy", `${record.level} must have a parent.`, { nodeId: record.nodeId });
    }
    const parent = nodeById(state, record.parentNodeId);
    if (!parent) {
      fail("invalid_hierarchy", "Hierarchy parent does not exist.", {
        nodeId: record.nodeId,
        parentNodeId: record.parentNodeId,
      });
    }
    const expectedParentLevel = record.level === "direction" ? "area" : "direction";
    if (parent.level !== expectedParentLevel) {
      fail("invalid_hierarchy", `${record.level} has an invalid parent level.`, {
        nodeId: record.nodeId,
        parentLevel: parent.level,
      });
    }
    if (record.level === "project" && record.projectState === undefined) {
      fail("invalid_hierarchy", "Project must have an explicit project state.", {
        nodeId: record.nodeId,
      });
    }
    if (record.level === "direction" && record.projectState !== undefined) {
      fail("invalid_hierarchy", "Direction cannot have project state.", {
        nodeId: record.nodeId,
      });
    }
  }
  const existing = nodeById(state, record.nodeId);
  if (existing && existing.createdAt !== record.createdAt) {
    fail("duplicate_identity", "Node immutable creation identity changed.", { nodeId: record.nodeId });
  }
}

function nodePathKey(state: MindMapGraphState, node: HierarchyNodeRecord): string {
  const parts = [`${node.level}:${node.titlePayloadHash}`];
  let cursor = node.parentNodeId ? nodeById(state, node.parentNodeId) : undefined;
  const seen = new Set([node.nodeId]);
  while (cursor) {
    if (seen.has(cursor.nodeId)) fail("cycle_detected", "Hierarchy contains a cycle.");
    seen.add(cursor.nodeId);
    parts.unshift(`${cursor.level}:${cursor.titlePayloadHash}`);
    cursor = cursor.parentNodeId ? nodeById(state, cursor.parentNodeId) : undefined;
  }
  return parts.join("/");
}

function validateAllHierarchy(state: MindMapGraphState): void {
  const pathOwners = new Map<string, string>();
  for (const node of state.nodes) {
    const path = nodePathKey(state, node);
    const prior = pathOwners.get(path);
    if (prior && prior !== node.nodeId) {
      fail("duplicate_path", "Two hierarchy nodes resolve to the same typed path.", {
        nodeId: node.nodeId,
        existingNodeId: prior,
      });
    }
    pathOwners.set(path, node.nodeId);
  }
}

function validatePlacement(state: MindMapGraphState, record: ThoughtPlacementRecord): void {
  requireNonEmpty(record.thoughtId, "placement.thoughtId");
  if (!thoughtById(state, record.thoughtId)) {
    fail("invalid_placement", "Placement thought does not exist.", { thoughtId: record.thoughtId });
  }
  if (record.kind === "placed") {
    const parent = nodeById(state, record.parentNodeId);
    if (!parent || (parent.level !== "direction" && parent.level !== "project")) {
      fail("invalid_placement", "Thought may be placed only under a direction or project.", {
        thoughtId: record.thoughtId,
        parentNodeId: record.parentNodeId,
      });
    }
  }
}

function validateLink(state: MindMapGraphState, record: GraphLinkRecord): void {
  requireNonEmpty(record.linkId, "link.linkId");
  if (!entityExists(state, record.source) || !entityExists(state, record.target)) {
    fail("invalid_link", "Link endpoint does not exist.", { linkId: record.linkId });
  }
  if (record.source.kind === record.target.kind && record.source.id === record.target.id) {
    fail("invalid_link", "Self-links are not allowed.", { linkId: record.linkId });
  }
  const existing = state.links.find((link) => link.linkId === record.linkId);
  if (!existing) {
    if (record.status !== "proposed") {
      fail("invalid_link", "A new graph link must start as proposed.", {
        linkId: record.linkId,
        status: record.status,
      });
    }
    return;
  }
  if (
    canonicalJson(existing.source) !== canonicalJson(record.source)
    || canonicalJson(existing.target) !== canonicalJson(record.target)
    || existing.kind !== record.kind
    || existing.createdAt !== record.createdAt
  ) {
    fail("duplicate_identity", "Link immutable identity changed.", { linkId: record.linkId });
  }
  if (existing.status !== "proposed" || record.status === "proposed") {
    fail("invalid_link", "Link status may transition only once from proposed to confirmed or rejected.", {
      linkId: record.linkId,
      currentStatus: existing.status,
      nextStatus: record.status,
    });
  }
}

function validateEmbedding(state: MindMapGraphState, record: EmbeddingRecord): void {
  requireNonEmpty(record.embeddingId, "embedding.embeddingId");
  requireNonEmpty(record.model, "embedding.model");
  if (!Number.isInteger(record.dimensions) || record.dimensions < 1) {
    fail("invalid_embedding", "Embedding dimensions must be a positive integer.", {
      embeddingId: record.embeddingId,
      dimensions: record.dimensions,
    });
  }
  const thought = thoughtById(state, record.thoughtId);
  if (!thought || thought.textPayloadHash !== record.sourceTextContentHash) {
    fail("invalid_embedding", "Embedding is not bound to the current thought text.", {
      embeddingId: record.embeddingId,
      thoughtId: record.thoughtId,
    });
  }
  const vectorPayload = payloadByHash(state, record.vectorPayloadHash);
  if (
    !vectorPayload
    || vectorPayload.kind !== "embedding-f32"
    || vectorPayload.encoding !== "float32-le-base64"
    || vectorPayload.byteLength !== record.dimensions * 4
  ) {
    fail("invalid_embedding", "Embedding vector payload is missing or has invalid dimensions.", {
      embeddingId: record.embeddingId,
    });
  }
  if (state.embeddings.some((embedding) => embedding.embeddingId === record.embeddingId)) {
    fail("duplicate_identity", "Embedding records are immutable and IDs cannot be reused.", {
      embeddingId: record.embeddingId,
    });
  }
}

function validateDamagedReference(state: MindMapGraphState, record: DamagedReferenceRecord): void {
  requireNonEmpty(record.damagedReferenceId, "damagedReference.damagedReferenceId");
  requireNonEmpty(record.field, "damagedReference.field");
  if (!entityExists(state, record.source)) {
    fail("invalid_damaged_reference", "Damaged reference source does not exist.", {
      damagedReferenceId: record.damagedReferenceId,
    });
  }
  if (record.reason === "missing_target" && entityExists(state, record.target)) {
    fail("invalid_damaged_reference", "Missing-target damage cannot point to an existing target.", {
      damagedReferenceId: record.damagedReferenceId,
    });
  }
  if (state.damagedReferences.some((item) => item.damagedReferenceId === record.damagedReferenceId)) {
    fail("duplicate_identity", "Damaged reference ID cannot be reused.", {
      damagedReferenceId: record.damagedReferenceId,
    });
  }
}

export function applyGraphEvent(state: MindMapGraphState, event: GraphEvent): MindMapGraphState {
  ensureNamespaceWorkspace(state, event);
  if (event.sequence !== state.revision + 1) {
    fail("non_contiguous_event_sequence", "Graph event sequence is not contiguous.", {
      currentRevision: state.revision,
      actualSequence: event.sequence,
    });
  }
  requireNonEmpty(event.eventId, "event.eventId");
  requireNonEmpty(event.occurredAt, "event.occurredAt");

  let next: MindMapGraphState;
  const record = event.payload.record;
  ensureNamespaceWorkspace(state, record);

  switch (event.payload.type) {
    case "payload_put": {
      validatePayloadStructure(record);
      const existing = state.payloads.find((payload) => payload.contentHash === record.contentHash);
      if (existing) {
        fail(
          canonicalJson(existing) === canonicalJson(record) ? "duplicate_identity" : "payload_conflict",
          "Content-addressed payload hash is already present.",
          { contentHash: record.contentHash },
        );
      }
      next = { ...state, revision: event.sequence, payloads: [...state.payloads, canonicalClone(record)] };
      break;
    }
    case "thought_put": {
      validateThought(state, record);
      const thoughts = replaceVersioned(state.thoughts, (thought) => thought.thoughtId, record, "thought");
      next = { ...state, revision: event.sequence, thoughts };
      break;
    }
    case "node_put": {
      validateNode(state, record);
      const nodes = replaceVersioned(state.nodes, (node) => node.nodeId, record, "node");
      next = { ...state, revision: event.sequence, nodes };
      validateAllHierarchy(next);
      break;
    }
    case "placement_put": {
      validatePlacement(state, record);
      const placements = replaceVersioned(
        state.placements,
        (placement) => placement.thoughtId,
        record,
        "placement",
      );
      next = { ...state, revision: event.sequence, placements };
      break;
    }
    case "link_put": {
      validateLink(state, record);
      const links = replaceVersioned(state.links, (link) => link.linkId, record, "link");
      next = { ...state, revision: event.sequence, links };
      break;
    }
    case "embedding_put": {
      validateEmbedding(state, record);
      next = { ...state, revision: event.sequence, embeddings: [...state.embeddings, canonicalClone(record)] };
      break;
    }
    case "damaged_reference_put": {
      validateDamagedReference(state, record);
      next = {
        ...state,
        revision: event.sequence,
        damagedReferences: [...state.damagedReferences, canonicalClone(record)],
      };
      break;
    }
  }

  return canonicalClone(next);
}

function sortBy<T>(records: readonly T[], key: (record: T) => string): readonly T[] {
  return [...records].sort((left, right) => key(left).localeCompare(key(right)));
}

export function canonicalGraphState(state: MindMapGraphState): MindMapGraphState {
  return canonicalClone({
    ...state,
    payloads: sortBy(state.payloads, (record) => record.contentHash),
    thoughts: sortBy(state.thoughts, (record) => record.thoughtId),
    nodes: sortBy(state.nodes, (record) => record.nodeId),
    placements: sortBy(state.placements, (record) => record.thoughtId),
    links: sortBy(state.links, (record) => record.linkId),
    embeddings: sortBy(state.embeddings, (record) => record.embeddingId),
    damagedReferences: sortBy(state.damagedReferences, (record) => record.damagedReferenceId),
  });
}

export function replayGraphEvents(
  workspace: MindMapGraphState["workspace"],
  events: readonly GraphEvent[],
): MindMapGraphState {
  return events.reduce(applyGraphEvent, emptyGraphState(workspace));
}
