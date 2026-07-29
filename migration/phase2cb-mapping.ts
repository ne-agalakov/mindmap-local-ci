import type { PipelineStage, RunIdentity } from "../domain/run.ts";
import { MINDMAP_GRAPH_NAMESPACE, type ContentAddressedPayloadRecord, type GraphEvent, type GraphLinkRecord, type HierarchyNodeRecord, type MindMapGraphState, type ThoughtPlacementRecord, type ThoughtRecord, type EmbeddingRecord, type DamagedReferenceRecord } from "../graph-storage/contracts.ts";
import { validateCompleteGraphState } from "../graph-storage/complete-state-validation.ts";
import { GraphInvariantError, canonicalGraphState, replayGraphEvents } from "../graph-storage/graph-state.ts";
import { replayRunEvents, type RunEvent } from "../state-core/run-state-core.ts";
import { canonicalJson } from "../storage/canonical-json.ts";
import { STATE_STORAGE_NAMESPACE, type StorageCommitRequest, type StoredArtifactRecord } from "../storage/contracts.ts";
import { ACCEPTED_LEGACY_DATABASE_SHA256, ACCEPTED_LEGACY_DATABASE_SIZE_BYTES } from "../storage/migration-plan.ts";
import {
  PHASE2CB_MAPPING_VERSION,
  PHASE2CB_TEMP_DATABASE_PREFIX,
  type Phase2CbLegacyLink,
  type Phase2CbLegacyNode,
  type Phase2CbLegacyRun,
  type Phase2CbLegacyThought,
  type Phase2CbMappingCandidate,
  type Phase2CbMappingDiagnostics,
  type Phase2CbMappingOptions,
  type Phase2CbMappingResult,
  type Phase2CbStopCode,
} from "./phase2cb-contracts.ts";

const MIGRATION_EVENT_TIME = "1970-01-01T00:00:00.000Z";
const HEX_64 = /^[a-f0-9]{64}$/;
const TEMP_DATABASE_NAME = /^mindmap-state-core-v1-phase2cb-dry-run-[A-Za-z0-9._-]+$/;

const THOUGHT_TYPE_MAP = new Map<string, ThoughtRecord["semanticType"]>([
  ["Идея", "idea"], ["idea", "idea"],
  ["Вопрос", "question"], ["question", "question"],
  ["Наблюдение", "observation"], ["observation", "observation"],
  ["Решение", "decision"], ["decision", "decision"],
  ["Цель", "goal"], ["goal", "goal"],
  ["Проект", "project"], ["project", "project"],
  ["Материал", "material"], ["material", "material"],
  ["Человек", "person"], ["person", "person"],
  ["Область", "area"], ["area", "area"],
  ["Действие", "action"], ["action", "action"],
  ["Заметка", "note"], ["note", "note"],
  ["Не разобрано", "unknown"], ["unknown", "unknown"],
]);
const THOUGHT_STATUS_MAP = new Map<string, ThoughtRecord["status"]>([
  ["inbox", "inbox"], ["active", "active"], ["archived", "archived"],
]);
const PROJECT_STATE_MAP = new Map<string, NonNullable<HierarchyNodeRecord["projectState"]>>([
  ["planned", "planned"], ["active", "active"], ["paused", "paused"],
  ["done", "done"], ["completed", "done"], ["cancelled", "cancelled"],
]);
const LINK_KIND_MAP = new Map<string, GraphLinkRecord["kind"]>([
  ["Связано", "related"], ["related", "related"],
  ["Поддерживает", "supports"], ["supports", "supports"],
  ["Зависит от", "depends_on"], ["depends_on", "depends_on"],
  ["Противоречит", "contradicts"], ["contradicts", "contradicts"],
  ["Кандидат в дубликаты", "duplicate_candidate"], ["duplicate_candidate", "duplicate_candidate"],
]);
const LINK_STATUS_MAP = new Map<string, GraphLinkRecord["status"]>([
  ["pending", "proposed"], ["proposed", "proposed"],
  ["confirmed", "confirmed"], ["accepted", "confirmed"],
  ["rejected", "rejected"],
]);

function stop(
  code: Phase2CbStopCode,
  message: string,
  details?: Readonly<Record<string, string | number | boolean | null>>,
): Phase2CbMappingResult {
  return {
    ok: false,
    stop: { code, message, details },
    sourceWriteAllowed: false,
    targetWritePerformed: false,
    networkCallAllowed: false,
    aiCallAllowed: false,
    actualMigrationAllowed: false,
  };
}

function nonEmpty(value: string): boolean {
  return value.trim().length > 0;
}

function validIso(value: string): boolean {
  if (!nonEmpty(value)) return false;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString() === value;
}

function base64(bytes: Uint8Array): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let output = "";
  for (let index = 0; index < bytes.length; index += 3) {
    const first = bytes[index] ?? 0;
    const second = bytes[index + 1] ?? 0;
    const third = bytes[index + 2] ?? 0;
    const value = (first << 16) | (second << 8) | third;
    output += alphabet[(value >> 18) & 63];
    output += alphabet[(value >> 12) & 63];
    output += index + 1 < bytes.length ? alphabet[(value >> 6) & 63] : "=";
    output += index + 2 < bytes.length ? alphabet[value & 63] : "=";
  }
  return output;
}

function float32Bytes(values: readonly number[]): Uint8Array {
  const buffer = new ArrayBuffer(values.length * 4);
  const view = new DataView(buffer);
  values.forEach((value, index) => view.setFloat32(index * 4, value, true));
  return new Uint8Array(buffer);
}

function detailsFor(error: unknown): Readonly<Record<string, string | number | boolean | null>> | undefined {
  if (error instanceof GraphInvariantError) return error.details;
  return undefined;
}

function graphErrorCode(error: GraphInvariantError): Phase2CbStopCode {
  switch (error.code) {
    case "payload_conflict": return "payload_conflict";
    case "duplicate_identity": return "duplicate_identity";
    case "invalid_hierarchy":
    case "cycle_detected":
    case "duplicate_path": return "invalid_hierarchy";
    case "invalid_embedding": return "invalid_embedding";
    case "invalid_placement":
    case "invalid_link":
    case "invalid_damaged_reference": return "invalid_reference";
    default: return "mapping_integrity_failed";
  }
}

function runStage(run: Phase2CbLegacyRun): PipelineStage {
  return run.initialStage;
}

function sortText(left: string, right: string): number {
  return left.localeCompare(right, "en");
}

export async function planPhase2CbMapping(
  candidate: Phase2CbMappingCandidate,
  options: Phase2CbMappingOptions,
): Promise<Phase2CbMappingResult> {
  const source = candidate.source;
  if (source.databaseSha256 !== ACCEPTED_LEGACY_DATABASE_SHA256) {
    return stop("source_hash_mismatch", "Source hash is not the accepted Phase 0 SQLite source.", {
      expected: ACCEPTED_LEGACY_DATABASE_SHA256,
      actual: source.databaseSha256,
    });
  }
  if (source.sizeBytes !== ACCEPTED_LEGACY_DATABASE_SIZE_BYTES) {
    return stop("source_size_mismatch", "Source size is not the accepted Phase 0 SQLite source size.", {
      expected: ACCEPTED_LEGACY_DATABASE_SIZE_BYTES,
      actual: source.sizeBytes,
    });
  }
  if (!source.sqliteHeaderValid) {
    return stop("source_schema_mismatch", "Source does not have a valid SQLite header.");
  }
  if (source.quickCheck !== "ok" || source.integrityCheck !== "ok") {
    return stop("source_integrity_failed", "Source SQLite integrity checks did not pass.", {
      quickCheck: source.quickCheck,
      integrityCheck: source.integrityCheck,
    });
  }
  if (source.workspace !== "synthetic" || candidate.target.workspace !== "synthetic") {
    return stop("workspace_mismatch", "Phase 2C-B may map only the accepted synthetic workspace.");
  }
  if (source.personalThoughtCount !== 0) {
    return stop("personal_data_present", "Source contains personal thoughts and requires a separate review.", {
      personalThoughtCount: source.personalThoughtCount,
    });
  }
  if (
    candidate.target.mode !== "isolated-temporary"
    || candidate.target.isTargetMacProduction
    || !candidate.target.databaseName.startsWith(PHASE2CB_TEMP_DATABASE_PREFIX)
    || !TEMP_DATABASE_NAME.test(candidate.target.databaseName)
    || candidate.target.databaseName === STATE_STORAGE_NAMESPACE
  ) {
    return stop("target_namespace_forbidden", "Target must be a new isolated Phase 2C-B temporary database.", {
      databaseName: candidate.target.databaseName,
    });
  }
  if (!candidate.target.isEmpty) {
    return stop("target_not_empty", "Phase 2C-B target must be empty before any mutation.");
  }

  const embeddingCount = candidate.thoughts.filter((thought) => Array.isArray(thought.embedding)).length;
  const unresolvedCount = candidate.thoughts.filter((thought) => thought.unresolved !== undefined).length;
  const damagedCount = candidate.thoughts.reduce((sum, thought) => sum + (thought.damagedReferences?.length ?? 0), 0);
  const sourceEventCount = candidate.runs.reduce((sum, run) => sum + run.sourceEventCount, 0);
  const countPairs: readonly [string, number, number][] = [
    ["thoughts", source.thoughtCount, candidate.thoughts.length],
    ["nodes", source.nodeCount, candidate.nodes.length],
    ["links", source.linkCount, candidate.links.length],
    ["embeddings", source.embeddingCount, embeddingCount],
    ["unresolved", source.unresolvedThoughtCount, unresolvedCount],
    ["damagedReferences", source.damagedReferenceCount, damagedCount],
    ["events", source.eventCount, sourceEventCount],
    ["runs", source.runCount, candidate.runs.length],
  ];
  for (const [kind, expected, actual] of countPairs) {
    if (expected !== actual) return stop("count_mismatch", `Source ${kind} count does not match mapping input.`, { kind, expected, actual });
  }
  if (source.embeddingCount !== source.thoughtCount) {
    return stop("count_mismatch", "Every accepted source thought must have exactly one embedding.", {
      thoughtCount: source.thoughtCount,
      embeddingCount: source.embeddingCount,
    });
  }

  const nodeIds = new Set<string>();
  for (const node of candidate.nodes) {
    if (!nonEmpty(node.id) || nodeIds.has(node.id)) return stop("duplicate_identity", "Node identity is empty or duplicated.", { nodeId: node.id });
    nodeIds.add(node.id);
    if (!validIso(node.createdAt) || (node.updatedAt !== undefined && !validIso(node.updatedAt))) {
      return stop("invalid_timestamp", "Node timestamp is not canonical ISO-8601.", { nodeId: node.id });
    }
  }
  const thoughtIds = new Set<string>();
  for (const thought of candidate.thoughts) {
    if (!nonEmpty(thought.id) || thoughtIds.has(thought.id)) return stop("duplicate_identity", "Thought identity is empty or duplicated.", { thoughtId: thought.id });
    thoughtIds.add(thought.id);
    if (!validIso(thought.createdAt) || (thought.updatedAt !== undefined && !validIso(thought.updatedAt))) {
      return stop("invalid_timestamp", "Thought timestamp is not canonical ISO-8601.", { thoughtId: thought.id });
    }
  }

  const nodeSource = new Map(candidate.nodes.map((node) => [node.id, node]));
  for (const node of candidate.nodes) {
    if (node.kind === "area") {
      if (node.parentId !== undefined) return stop("invalid_hierarchy", "Legacy area must be a root.", { nodeId: node.id });
    } else if (node.kind === "direction") {
      const parent = node.parentId ? nodeSource.get(node.parentId) : undefined;
      if (!parent || parent.kind !== "area") return stop("invalid_hierarchy", "Legacy direction must have an area parent.", { nodeId: node.id });
    } else if (node.kind === "project") {
      const parent = node.parentId ? nodeSource.get(node.parentId) : undefined;
      if (!parent || parent.kind !== "direction") return stop("invalid_hierarchy", "Legacy project must have a direction parent.", { nodeId: node.id });
      if (!PROJECT_STATE_MAP.has(node.status)) return stop("ambiguous_mapping", "Legacy project status has no deterministic target mapping.", { nodeId: node.id, status: node.status });
    } else {
      return stop("ambiguous_mapping", "Legacy node kind has no deterministic target level.", { nodeId: node.id, kind: node.kind });
    }
  }

  const payloads = new Map<string, ContentAddressedPayloadRecord>();
  const addPayload = (payload: ContentAddressedPayloadRecord): Phase2CbMappingResult | undefined => {
    if (!HEX_64.test(payload.contentHash)) return stop("mapping_integrity_failed", "Payload hasher did not return a lowercase SHA-256 digest.", { kind: payload.kind });
    const existing = payloads.get(payload.contentHash);
    if (!existing) {
      payloads.set(payload.contentHash, payload);
      return undefined;
    }
    return canonicalJson(existing) === canonicalJson(payload)
      ? undefined
      : stop("payload_conflict", "Identical source bytes require incompatible payload records.", {
          contentHash: payload.contentHash,
          existingKind: existing.kind,
          nextKind: payload.kind,
        });
  };
  const textPayload = async (workspace: "synthetic", kind: "thought-text" | "node-title" | "artifact-json", data: string): Promise<ContentAddressedPayloadRecord> => {
    const bytes = new TextEncoder().encode(data);
    return {
      namespace: MINDMAP_GRAPH_NAMESPACE,
      workspace,
      contentHash: await options.hashBytes(bytes),
      kind,
      mediaType: kind === "artifact-json" ? "application/json; charset=utf-8" : "text/plain; charset=utf-8",
      encoding: kind === "artifact-json" ? "canonical-json" : "utf8",
      byteLength: bytes.byteLength,
      data,
    };
  };
  let legacyMetadataArtifactCount = 0;
  const preserveMetadata = async (entityKind: "thought" | "node" | "link", entityId: string, metadata: unknown): Promise<Phase2CbMappingResult | undefined> => {
    let data: string;
    try {
      data = canonicalJson({
        format: "mindmap-legacy-entity-metadata",
        schemaVersion: 1,
        mappingVersion: PHASE2CB_MAPPING_VERSION,
        entityKind,
        entityId,
        metadata,
      });
    } catch (error) {
      return stop("ambiguous_mapping", "Legacy entity metadata is not canonical JSON.", { entityKind, entityId, error: error instanceof Error ? error.message : String(error) });
    }
    const payload = await textPayload("synthetic", "artifact-json", data);
    const conflict = addPayload(payload);
    if (conflict) return conflict;
    legacyMetadataArtifactCount += 1;
    return undefined;
  };

  const mappedNodes: HierarchyNodeRecord[] = [];
  for (const node of [...candidate.nodes].sort((left, right) => {
    const rank = (kind: string) => kind === "area" ? 0 : kind === "direction" ? 1 : 2;
    return rank(left.kind) - rank(right.kind) || sortText(left.id, right.id);
  })) {
    if (!nonEmpty(node.name)) return stop("ambiguous_mapping", "Legacy node title is empty.", { nodeId: node.id });
    const title = await textPayload("synthetic", "node-title", node.name);
    const conflict = addPayload(title);
    if (conflict) return conflict;
    if (node.legacyMetadata !== undefined) {
      const metadataConflict = await preserveMetadata("node", node.id, node.legacyMetadata);
      if (metadataConflict) return metadataConflict;
    }
    mappedNodes.push({
      namespace: MINDMAP_GRAPH_NAMESPACE,
      workspace: "synthetic",
      nodeId: node.id,
      revision: 1,
      level: node.kind as HierarchyNodeRecord["level"],
      ...(node.parentId ? { parentNodeId: node.parentId } : {}),
      titlePayloadHash: title.contentHash,
      ...(node.kind === "project" ? { projectState: PROJECT_STATE_MAP.get(node.status)! } : {}),
      createdAt: node.createdAt,
      updatedAt: node.updatedAt ?? node.createdAt,
    });
  }

  const mappedThoughts: ThoughtRecord[] = [];
  const placements: ThoughtPlacementRecord[] = [];
  const embeddings: EmbeddingRecord[] = [];
  const damagedReferences: DamagedReferenceRecord[] = [];
  const generatedLinks: GraphLinkRecord[] = [];

  for (const thought of [...candidate.thoughts].sort((left, right) => sortText(left.id, right.id))) {
    if (!nonEmpty(thought.originalContent)) return stop("ambiguous_mapping", "Thought original content is empty.", { thoughtId: thought.id });
    const semanticType = THOUGHT_TYPE_MAP.get(thought.type);
    if (!semanticType) return stop("ambiguous_mapping", "Legacy thought type has no deterministic target mapping.", { thoughtId: thought.id, type: thought.type });
    const status = THOUGHT_STATUS_MAP.get(thought.status);
    if (!status) return stop("ambiguous_mapping", "Legacy thought status has no deterministic target mapping.", { thoughtId: thought.id, status: thought.status });
    const text = await textPayload("synthetic", "thought-text", thought.originalContent);
    const textConflict = addPayload(text);
    if (textConflict) return textConflict;
    if (thought.legacyMetadata !== undefined) {
      const metadataConflict = await preserveMetadata("thought", thought.id, thought.legacyMetadata);
      if (metadataConflict) return metadataConflict;
    }
    const updatedAt = thought.updatedAt ?? thought.createdAt;
    mappedThoughts.push({
      namespace: MINDMAP_GRAPH_NAMESPACE,
      workspace: "synthetic",
      thoughtId: thought.id,
      revision: 1,
      textPayloadHash: text.contentHash,
      semanticType,
      status,
      createdAt: thought.createdAt,
      updatedAt,
    });

    if (thought.primaryNodeId && thought.unresolved) {
      return stop("ambiguous_mapping", "Thought cannot be both placed and unresolved.", { thoughtId: thought.id });
    }
    if (thought.primaryNodeId) {
      const parent = nodeSource.get(thought.primaryNodeId);
      if (!parent || (parent.kind !== "direction" && parent.kind !== "project")) {
        return stop("invalid_reference", "Primary placement target is missing or not a direction/project.", { thoughtId: thought.id, parentNodeId: thought.primaryNodeId });
      }
      placements.push({
        namespace: MINDMAP_GRAPH_NAMESPACE,
        workspace: "synthetic",
        thoughtId: thought.id,
        revision: 1,
        kind: "placed",
        parentNodeId: thought.primaryNodeId,
        status: "proposed",
        updatedAt,
      });
    } else if (thought.unresolved) {
      placements.push({
        namespace: MINDMAP_GRAPH_NAMESPACE,
        workspace: "synthetic",
        thoughtId: thought.id,
        revision: 1,
        kind: "unresolved",
        reason: thought.unresolved.reason,
        updatedAt,
      });
    } else {
      return stop("ambiguous_mapping", "Thought has neither a primary placement nor explicit unresolved state.", { thoughtId: thought.id });
    }

    for (const additionalNodeId of [...new Set(thought.additionalNodeIds ?? [])].sort(sortText)) {
      if (additionalNodeId === thought.primaryNodeId) continue;
      const target = nodeSource.get(additionalNodeId);
      if (!target || (target.kind !== "direction" && target.kind !== "project")) return stop("invalid_reference", "Additional placement target is missing or not a direction/project.", { thoughtId: thought.id, nodeId: additionalNodeId });
      generatedLinks.push({
        namespace: MINDMAP_GRAPH_NAMESPACE,
        workspace: "synthetic",
        linkId: `legacy-additional-placement:${thought.id}:${additionalNodeId}`,
        revision: 1,
        source: { kind: "thought", id: thought.id },
        target: { kind: "node", id: additionalNodeId },
        kind: "related",
        status: "proposed",
        createdAt: updatedAt,
        updatedAt,
      });
    }

    if (!nonEmpty(thought.embeddingModel)) return stop("invalid_embedding", "Embedding model is missing.", { thoughtId: thought.id });
    if (thought.embedding.length < 1 || thought.embedding.some((value) => typeof value !== "number" || !Number.isFinite(value))) {
      return stop("invalid_embedding", "Embedding contains invalid values.", { thoughtId: thought.id, dimensions: thought.embedding.length });
    }
    const vectorBytes = float32Bytes(thought.embedding);
    const vector: ContentAddressedPayloadRecord = {
      namespace: MINDMAP_GRAPH_NAMESPACE,
      workspace: "synthetic",
      contentHash: await options.hashBytes(vectorBytes),
      kind: "embedding-f32",
      mediaType: "application/vnd.mindmap.embedding.f32-le",
      encoding: "float32-le-base64",
      byteLength: vectorBytes.byteLength,
      data: base64(vectorBytes),
    };
    const vectorConflict = addPayload(vector);
    if (vectorConflict) return vectorConflict;
    embeddings.push({
      namespace: MINDMAP_GRAPH_NAMESPACE,
      workspace: "synthetic",
      embeddingId: `legacy-embedding:${thought.id}`,
      thoughtId: thought.id,
      revision: 1,
      model: thought.embeddingModel,
      dimensions: thought.embedding.length,
      sourceTextContentHash: text.contentHash,
      vectorPayloadHash: vector.contentHash,
      createdAt: thought.createdAt,
    });

    for (const [index, damaged] of (thought.damagedReferences ?? []).entries()) {
      if (!nonEmpty(damaged.field) || !nonEmpty(damaged.targetId) || !validIso(damaged.detectedAt)) {
        return stop("invalid_reference", "Damaged reference metadata is incomplete.", { thoughtId: thought.id, damagedIndex: index });
      }
      damagedReferences.push({
        namespace: MINDMAP_GRAPH_NAMESPACE,
        workspace: "synthetic",
        damagedReferenceId: `legacy-damaged:${thought.id}:${index + 1}`,
        source: { kind: "thought", id: thought.id },
        field: damaged.field,
        target: { kind: damaged.targetKind, id: damaged.targetId },
        reason: damaged.reason,
        detectedAt: damaged.detectedAt,
      });
    }
  }

  const linkIds = new Set(generatedLinks.map((link) => link.linkId));
  const mappedLegacyLinks: GraphLinkRecord[] = [];
  for (const link of [...candidate.links].sort((left, right) => sortText(left.id, right.id))) {
    if (!nonEmpty(link.id) || linkIds.has(link.id)) return stop("duplicate_identity", "Link identity is empty or duplicated.", { linkId: link.id });
    linkIds.add(link.id);
    if (!thoughtIds.has(link.sourceId) || !thoughtIds.has(link.targetId) || link.sourceId === link.targetId) {
      return stop("invalid_reference", "Legacy link endpoints are invalid.", { linkId: link.id });
    }
    if (!validIso(link.createdAt) || (link.updatedAt !== undefined && !validIso(link.updatedAt))) {
      return stop("invalid_timestamp", "Legacy link timestamp is not canonical ISO-8601.", { linkId: link.id });
    }
    const kind = LINK_KIND_MAP.get(link.type);
    const finalStatus = LINK_STATUS_MAP.get(link.status);
    if (!kind || !finalStatus) return stop("ambiguous_mapping", "Legacy link type/status has no deterministic target mapping.", { linkId: link.id, type: link.type, status: link.status });
    if (link.legacyMetadata !== undefined) {
      const metadataConflict = await preserveMetadata("link", link.id, link.legacyMetadata);
      if (metadataConflict) return metadataConflict;
    }
    const updatedAt = link.updatedAt ?? link.createdAt;
    mappedLegacyLinks.push({
      namespace: MINDMAP_GRAPH_NAMESPACE,
      workspace: "synthetic",
      linkId: link.id,
      revision: 1,
      source: { kind: "thought", id: link.sourceId },
      target: { kind: "thought", id: link.targetId },
      kind,
      status: "proposed",
      createdAt: link.createdAt,
      updatedAt: finalStatus === "proposed" ? updatedAt : link.createdAt,
    });
    if (finalStatus !== "proposed") {
      mappedLegacyLinks.push({
        namespace: MINDMAP_GRAPH_NAMESPACE,
        workspace: "synthetic",
        linkId: link.id,
        revision: 2,
        source: { kind: "thought", id: link.sourceId },
        target: { kind: "thought", id: link.targetId },
        kind,
        status: finalStatus,
        createdAt: link.createdAt,
        updatedAt,
      });
    }
  }

  const runIds = new Set<string>();
  const runCommits: StorageCommitRequest[] = [];
  for (const run of [...candidate.runs].sort((left, right) => sortText(left.runId, right.runId))) {
    if (!nonEmpty(run.runId) || runIds.has(run.runId)) return stop("duplicate_identity", "Run identity is empty or duplicated.", { runId: run.runId });
    runIds.add(run.runId);
    if (!Number.isInteger(run.sourceEventCount) || run.sourceEventCount < 1) return stop("ambiguous_mapping", "Run source event count is invalid.", { runId: run.runId, sourceEventCount: run.sourceEventCount });
    if ((run.ambiguityCodes?.length ?? 0) > 0) return stop("ambiguous_mapping", "Run history has unresolved mapping ambiguities.", { runId: run.runId, ambiguityCount: run.ambiguityCodes?.length ?? 0 });
    if ((run.invalidReferenceCount ?? 0) > 0) return stop("invalid_reference", "Run history contains invalid references.", { runId: run.runId, invalidReferenceCount: run.invalidReferenceCount ?? 0 });
    if (!validIso(run.historyCreatedAt)) return stop("invalid_timestamp", "Run history timestamp is not canonical ISO-8601.", { runId: run.runId });
    let historyData: string;
    try {
      historyData = canonicalJson({
        format: "mindmap-legacy-run-history",
        schemaVersion: 1,
        mappingVersion: PHASE2CB_MAPPING_VERSION,
        sourceRunId: run.runId,
        sourceEventCount: run.sourceEventCount,
        history: run.history,
      });
    } catch (error) {
      return stop("ambiguous_mapping", "Run history is not canonical JSON.", { runId: run.runId, error: error instanceof Error ? error.message : String(error) });
    }
    const historyPayload = await textPayload("synthetic", "artifact-json", historyData);
    const historyConflict = addPayload(historyPayload);
    if (historyConflict) return historyConflict;
    const identity: RunIdentity = {
      runId: run.runId,
      workspace: "synthetic",
      datasetId: run.datasetId,
      orderVariant: run.orderVariant,
      semanticModel: run.semanticModel,
      embeddingModel: run.embeddingModel,
      pipelineVersion: run.pipelineVersion,
      buildId: run.sourceBuildId,
      storageSchema: STATE_STORAGE_NAMESPACE,
    };
    if (Object.entries(identity).some(([, value]) => typeof value === "string" && !nonEmpty(value))) {
      return stop("ambiguous_mapping", "Run identity is incomplete.", { runId: run.runId });
    }
    const created: RunEvent = {
      type: "run_created",
      eventId: `phase2cb:${run.runId}:created`,
      commandId: `phase2cb:${run.runId}:create`,
      sequence: 1,
      occurredAt: run.historyCreatedAt,
      identity,
      stage: runStage(run),
    };
    const blocked: RunEvent = {
      type: "continuation_blocked",
      eventId: `phase2cb:${run.runId}:blocked`,
      commandId: `phase2cb:${run.runId}:block`,
      sequence: 2,
      occurredAt: run.historyCreatedAt,
      block: {
        reason: "explicitly_blocked",
        expected: "read_only_legacy_history",
        actual: PHASE2CB_MAPPING_VERSION,
      },
    };
    const aggregate = replayRunEvents([created, blocked]);
    const artifact: StoredArtifactRecord = {
      namespace: STATE_STORAGE_NAMESPACE,
      workspace: "synthetic",
      runId: run.runId,
      artifactId: `phase2cb:legacy-history:${run.runId}`,
      stage: runStage(run),
      version: 1,
      kind: `legacy-run-history/${PHASE2CB_MAPPING_VERSION}`,
      contentHash: historyPayload.contentHash,
      createdAt: run.historyCreatedAt,
    };
    runCommits.push({
      namespace: STATE_STORAGE_NAMESPACE,
      transactionId: `phase2cb:run:${run.runId}`,
      idempotencyKey: `phase2cb:run:${run.runId}:${historyPayload.contentHash}`,
      workspace: "synthetic",
      runId: run.runId,
      expectedRevision: 0,
      events: [created, blocked],
      aggregate,
      artifacts: [artifact],
    });
  }

  const records: readonly Readonly<{ type: GraphEvent["payload"]["type"]; record: GraphEvent["payload"]["record"]; key: string }>[] = [
    ...[...payloads.values()].sort((left, right) => sortText(left.contentHash, right.contentHash)).map((record) => ({ type: "payload_put" as const, record, key: record.contentHash })),
    ...mappedNodes.map((record) => ({ type: "node_put" as const, record, key: record.nodeId })),
    ...mappedThoughts.map((record) => ({ type: "thought_put" as const, record, key: record.thoughtId })),
    ...placements.sort((left, right) => sortText(left.thoughtId, right.thoughtId)).map((record) => ({ type: "placement_put" as const, record, key: record.thoughtId })),
    ...[...generatedLinks, ...mappedLegacyLinks].sort((left, right) => sortText(`${left.linkId}:${left.revision}`, `${right.linkId}:${right.revision}`)).map((record) => ({ type: "link_put" as const, record, key: `${record.linkId}:${record.revision}` })),
    ...embeddings.sort((left, right) => sortText(left.embeddingId, right.embeddingId)).map((record) => ({ type: "embedding_put" as const, record, key: record.embeddingId })),
    ...damagedReferences.sort((left, right) => sortText(left.damagedReferenceId, right.damagedReferenceId)).map((record) => ({ type: "damaged_reference_put" as const, record, key: record.damagedReferenceId })),
  ];
  const events: GraphEvent[] = records.map((item, index) => ({
    namespace: MINDMAP_GRAPH_NAMESPACE,
    workspace: "synthetic",
    sequence: index + 1,
    eventId: `${PHASE2CB_MAPPING_VERSION}:${item.type}:${item.key}`,
    occurredAt: MIGRATION_EVENT_TIME,
    payload: { type: item.type, record: item.record } as GraphEvent["payload"],
  }));

  let graphState: MindMapGraphState;
  try {
    graphState = canonicalGraphState(replayGraphEvents("synthetic", events));
    validateCompleteGraphState(graphState);
  } catch (error) {
    if (error instanceof GraphInvariantError) return stop(graphErrorCode(error), error.message, detailsFor(error));
    return stop("mapping_integrity_failed", error instanceof Error ? error.message : String(error));
  }
  const graphContentHash = await options.hashCanonical(canonicalJson(graphState));
  if (!HEX_64.test(graphContentHash)) return stop("mapping_integrity_failed", "Graph hasher did not return a lowercase SHA-256 digest.");
  const graphCommit = {
    namespace: MINDMAP_GRAPH_NAMESPACE,
    transactionId: `phase2cb:graph:${source.databaseSha256.slice(0, 16)}`,
    idempotencyKey: `phase2cb:graph:${graphContentHash}`,
    workspace: "synthetic" as const,
    expectedRevision: 0,
    events,
  };

  const diagnostics: Phase2CbMappingDiagnostics = {
    sourceCounts: {
      thoughts: source.thoughtCount,
      nodes: source.nodeCount,
      links: source.linkCount,
      embeddings: source.embeddingCount,
      unresolved: source.unresolvedThoughtCount,
      damagedReferences: source.damagedReferenceCount,
      events: source.eventCount,
      runs: source.runCount,
    },
    targetCounts: {
      payloads: graphState.payloads.length,
      thoughts: graphState.thoughts.length,
      nodes: graphState.nodes.length,
      placements: graphState.placements.length,
      links: graphState.links.length,
      embeddings: graphState.embeddings.length,
      damagedReferences: graphState.damagedReferences.length,
      runCommits: runCommits.length,
      runHistoryArtifacts: runCommits.reduce((sum, commit) => sum + (commit.artifacts?.length ?? 0), 0),
      legacyMetadataArtifacts: legacyMetadataArtifactCount,
    },
    generatedAdditionalPlacementLinks: generatedLinks.length,
    sourceSemanticEntitiesInvented: 0,
    sourceRecordsDropped: 0,
  };
  const rollbackContract = {
    strategy: "delete-isolated-target-on-any-failure" as const,
    sourceHashBeforeAfterRequired: true as const,
    targetMustStartEmpty: true as const,
    partialTargetAllowed: false as const,
    repeatRunHashEqualityRequired: true as const,
    diagnosticSchema: "mindmap-phase2cb-dry-run-diagnostic-v1" as const,
  };
  const mappingContentHash = await options.hashCanonical(canonicalJson({
    mappingVersion: PHASE2CB_MAPPING_VERSION,
    source,
    target: candidate.target,
    graphContentHash,
    runCommits,
    diagnostics,
    rollbackContract,
  }));
  if (!HEX_64.test(mappingContentHash)) return stop("mapping_integrity_failed", "Mapping hasher did not return a lowercase SHA-256 digest.");

  return {
    ok: true,
    plan: {
      mappingVersion: PHASE2CB_MAPPING_VERSION,
      source,
      target: candidate.target,
      graphCommit,
      graphState,
      graphContentHash,
      runCommits,
      mappingContentHash,
      diagnostics,
      rollbackContract,
      sourceWriteAllowed: false,
      targetWritePerformed: false,
      networkCallAllowed: false,
      aiCallAllowed: false,
      actualMigrationAllowed: false,
    },
  };
}
