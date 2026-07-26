import type { WorkspaceKind } from "../domain/run.ts";

export const MINDMAP_GRAPH_NAMESPACE = "mindmap-graph-v1" as const;

export type ThoughtSemanticType =
  | "idea"
  | "question"
  | "observation"
  | "decision"
  | "goal"
  | "project"
  | "material"
  | "person"
  | "area"
  | "action"
  | "note"
  | "unknown";

export type ThoughtLifecycleStatus = "inbox" | "active" | "archived";
export type HierarchyLevel = "area" | "direction" | "project";
export type ProjectState = "planned" | "active" | "paused" | "done" | "cancelled";
export type ProposalStatus = "proposed" | "confirmed" | "rejected";

export type PayloadKind =
  | "thought-text"
  | "node-title"
  | "embedding-f32"
  | "artifact-json"
  | "artifact-binary";

export type PayloadEncoding = "utf8" | "base64" | "canonical-json" | "float32-le-base64";

export interface ContentAddressedPayloadRecord {
  readonly namespace: typeof MINDMAP_GRAPH_NAMESPACE;
  readonly workspace: WorkspaceKind;
  readonly contentHash: string;
  readonly kind: PayloadKind;
  readonly mediaType: string;
  readonly encoding: PayloadEncoding;
  readonly byteLength: number;
  readonly data: string;
}

export interface ThoughtRecord {
  readonly namespace: typeof MINDMAP_GRAPH_NAMESPACE;
  readonly workspace: WorkspaceKind;
  readonly thoughtId: string;
  readonly revision: number;
  readonly textPayloadHash: string;
  readonly semanticType: ThoughtSemanticType;
  readonly status: ThoughtLifecycleStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface HierarchyNodeRecord {
  readonly namespace: typeof MINDMAP_GRAPH_NAMESPACE;
  readonly workspace: WorkspaceKind;
  readonly nodeId: string;
  readonly revision: number;
  readonly level: HierarchyLevel;
  readonly parentNodeId?: string;
  readonly titlePayloadHash: string;
  readonly projectState?: ProjectState;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export type PlacementReason =
  | "no_suitable_parent"
  | "ambiguous"
  | "awaiting_review"
  | "legacy_reference_damaged";

export type ThoughtPlacementRecord =
  | Readonly<{
      namespace: typeof MINDMAP_GRAPH_NAMESPACE;
      workspace: WorkspaceKind;
      thoughtId: string;
      revision: number;
      kind: "placed";
      parentNodeId: string;
      status: Exclude<ProposalStatus, "rejected">;
      updatedAt: string;
    }>
  | Readonly<{
      namespace: typeof MINDMAP_GRAPH_NAMESPACE;
      workspace: WorkspaceKind;
      thoughtId: string;
      revision: number;
      kind: "unresolved";
      reason: PlacementReason;
      updatedAt: string;
    }>;

export type GraphEntityKind = "thought" | "node";

export interface GraphEntityRef {
  readonly kind: GraphEntityKind;
  readonly id: string;
}

export type GraphLinkKind =
  | "related"
  | "supports"
  | "depends_on"
  | "contradicts"
  | "duplicate_candidate";

export interface GraphLinkRecord {
  readonly namespace: typeof MINDMAP_GRAPH_NAMESPACE;
  readonly workspace: WorkspaceKind;
  readonly linkId: string;
  readonly revision: number;
  readonly source: GraphEntityRef;
  readonly target: GraphEntityRef;
  readonly kind: GraphLinkKind;
  readonly status: ProposalStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface EmbeddingRecord {
  readonly namespace: typeof MINDMAP_GRAPH_NAMESPACE;
  readonly workspace: WorkspaceKind;
  readonly embeddingId: string;
  readonly thoughtId: string;
  readonly revision: number;
  readonly model: string;
  readonly dimensions: number;
  readonly sourceTextContentHash: string;
  readonly vectorPayloadHash: string;
  readonly createdAt: string;
}

export type DamagedReferenceReason =
  | "missing_target"
  | "stale_target"
  | "invalid_level"
  | "invalid_entity_kind"
  | "legacy_reference_corrupt";

export interface DamagedReferenceRecord {
  readonly namespace: typeof MINDMAP_GRAPH_NAMESPACE;
  readonly workspace: WorkspaceKind;
  readonly damagedReferenceId: string;
  readonly source: GraphEntityRef;
  readonly field: string;
  readonly target: GraphEntityRef;
  readonly reason: DamagedReferenceReason;
  readonly detectedAt: string;
}

export interface MindMapGraphState {
  readonly namespace: typeof MINDMAP_GRAPH_NAMESPACE;
  readonly workspace: WorkspaceKind;
  readonly revision: number;
  readonly payloads: readonly ContentAddressedPayloadRecord[];
  readonly thoughts: readonly ThoughtRecord[];
  readonly nodes: readonly HierarchyNodeRecord[];
  readonly placements: readonly ThoughtPlacementRecord[];
  readonly links: readonly GraphLinkRecord[];
  readonly embeddings: readonly EmbeddingRecord[];
  readonly damagedReferences: readonly DamagedReferenceRecord[];
}

export type GraphEventPayload =
  | Readonly<{ type: "payload_put"; record: ContentAddressedPayloadRecord }>
  | Readonly<{ type: "thought_put"; record: ThoughtRecord }>
  | Readonly<{ type: "node_put"; record: HierarchyNodeRecord }>
  | Readonly<{ type: "placement_put"; record: ThoughtPlacementRecord }>
  | Readonly<{ type: "link_put"; record: GraphLinkRecord }>
  | Readonly<{ type: "embedding_put"; record: EmbeddingRecord }>
  | Readonly<{ type: "damaged_reference_put"; record: DamagedReferenceRecord }>;

export interface GraphEvent {
  readonly namespace: typeof MINDMAP_GRAPH_NAMESPACE;
  readonly workspace: WorkspaceKind;
  readonly sequence: number;
  readonly eventId: string;
  readonly occurredAt: string;
  readonly payload: GraphEventPayload;
}

export interface GraphCommitRequest {
  readonly namespace: typeof MINDMAP_GRAPH_NAMESPACE;
  readonly transactionId: string;
  readonly idempotencyKey: string;
  readonly workspace: WorkspaceKind;
  readonly expectedRevision: number;
  readonly events: readonly GraphEvent[];
}

export interface GraphCommitReceipt {
  readonly transactionId: string;
  readonly idempotencyKey: string;
  readonly workspace: WorkspaceKind;
  readonly revision: number;
  readonly firstSequence: number;
  readonly lastSequence: number;
  readonly stateContentHash: string;
  readonly idempotent: boolean;
}

export type GraphStorageRejectionCode =
  | "invalid_namespace"
  | "invalid_transaction"
  | "empty_event_batch"
  | "non_contiguous_event_sequence"
  | "stale_revision"
  | "idempotency_conflict"
  | "workspace_mismatch"
  | "duplicate_identity"
  | "entity_revision_conflict"
  | "payload_hash_mismatch"
  | "payload_conflict"
  | "payload_missing"
  | "invalid_hierarchy"
  | "cycle_detected"
  | "duplicate_path"
  | "invalid_placement"
  | "invalid_link"
  | "invalid_embedding"
  | "invalid_damaged_reference"
  | "integrity_mismatch"
  | "transaction_aborted";

export interface GraphStorageRejection {
  readonly code: GraphStorageRejectionCode;
  readonly message: string;
  readonly details?: Readonly<Record<string, string | number | boolean | null>>;
}

export type GraphCommitResult =
  | Readonly<{ ok: true; receipt: GraphCommitReceipt }>
  | Readonly<{ ok: false; rejection: GraphStorageRejection }>;

export interface GraphStorageSnapshot extends MindMapGraphState {
  readonly contentHash: string;
}

export type GraphContentHasher = (canonicalContent: string) => string | Promise<string>;

export interface TransactionalGraphStorage {
  commit(request: GraphCommitRequest): Promise<GraphCommitResult>;
  load(workspace: WorkspaceKind): Promise<MindMapGraphState>;
  exportSnapshot(workspace: WorkspaceKind): Promise<GraphStorageSnapshot>;
}
