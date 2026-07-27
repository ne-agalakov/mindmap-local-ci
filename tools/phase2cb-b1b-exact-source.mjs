#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { basename } from "node:path";
import { DatabaseSync } from "node:sqlite";

export const B1B_EXPECTED_SOURCE = Object.freeze({
  sizeBytes: 5_070_848,
  sha256: "356b943275cce292d0e14f8a7fbe95af07e79de73f06d3e361874d342aa2f918",
  thoughts: 96,
  nodes: 30,
  links: 0,
  decisions: 133,
  embeddings: 96,
  runs: 3,
  personalThoughts: 0,
});

const PIPELINE_STAGES = new Set([
  "preflight", "extraction", "embeddings", "clustering", "hierarchy",
  "projects_and_placement", "candidates", "relations", "duplicates",
  "contradictions", "next_action",
]);
const EXPECTED_TABLES = ["thoughts", "knowledge_nodes", "links", "ai_decisions"];
const asObject = (value) => value && typeof value === "object" && !Array.isArray(value) ? value : {};
const asArray = (value) => Array.isArray(value) ? value : [];
const parseJson = (value) => {
  if (value == null || value === "") return undefined;
  try { return JSON.parse(String(value)); } catch { throw new Error("source_json_parse_failure"); }
};
const text = (value) => typeof value === "string" && value.trim() ? value : null;
const sha256 = (value) => createHash("sha256").update(value).digest("hex");

function canonicalize(value) {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("non_finite_canonical_number");
    return value;
  }
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
  }
  throw new Error("unsupported_canonical_value");
}

function canonicalJson(value) {
  return JSON.stringify(canonicalize(value));
}

function iso(value, code = "invalid_source_timestamp") {
  const raw = String(value ?? "");
  const time = Date.parse(raw);
  if (!Number.isFinite(time)) throw new Error(code);
  return new Date(time).toISOString();
}

function queryAll(database, sql, ...params) {
  return database.prepare(sql).all(...params);
}

function queryOne(database, sql, ...params) {
  return database.prepare(sql).get(...params) ?? null;
}

function tableExists(database, name) {
  return Boolean(queryOne(database, "SELECT 1 AS ok FROM sqlite_master WHERE type = 'table' AND name = ?", name));
}

function eventRunId(event) {
  return text(asObject(event.input).runId) ?? text(asObject(event.output).runId);
}

function eventModel(event) {
  const input = asObject(event.input);
  const output = asObject(event.output);
  return text(event.model)
    ?? text(input.model)
    ?? text(input.ollamaModel)
    ?? text(input.semanticModel)
    ?? text(output.model)
    ?? text(output.ollamaModel)
    ?? text(output.semanticModel);
}

function eventPipelineVersion(event) {
  const input = asObject(event.input);
  const output = asObject(event.output);
  return text(input.pipelineVersion)
    ?? text(input.promptVersion)
    ?? text(output.pipelineVersion)
    ?? text(output.promptVersion);
}

function eventStage(event) {
  const direct = text(asObject(event.input).stage) ?? text(asObject(event.output).stage);
  if (direct && PIPELINE_STAGES.has(direct)) return direct;
  const type = event.eventType;
  if (type.includes("preflight")) return "preflight";
  if (type.includes("extract")) return "extraction";
  if (type.includes("embedding")) return "embeddings";
  if (type.includes("cluster")) return "clustering";
  if (type.includes("hierarchy")) return "hierarchy";
  if (type.includes("project") || type.includes("placement")) return "projects_and_placement";
  if (type.includes("candidate")) return "candidates";
  if (type.includes("relation") || type.includes("link")) return "relations";
  if (type.includes("duplicate")) return "duplicates";
  if (type.includes("contradiction")) return "contradictions";
  if (type.includes("next_action") || type.includes("next-step")) return "next_action";
  return null;
}

function loadRows(database) {
  const thoughts = queryAll(database, "SELECT rowid AS source_rowid, * FROM thoughts ORDER BY created_at DESC, rowid ASC");
  const nodes = queryAll(database, "SELECT rowid AS source_rowid, * FROM knowledge_nodes ORDER BY created_at ASC, rowid ASC");
  const links = queryAll(database, "SELECT rowid AS source_rowid, * FROM links ORDER BY rowid ASC");
  const decisions = queryAll(database, "SELECT rowid AS source_rowid, * FROM ai_decisions ORDER BY created_at ASC, rowid ASC");
  return { thoughts, nodes, links, decisions };
}

function projectedDecisions(rows) {
  return rows.map((row) => ({
    sourceRowId: Number(row.source_rowid),
    id: String(row.id),
    ...(row.thought_id ? { thoughtId: String(row.thought_id) } : {}),
    eventType: String(row.event_type),
    createdAt: iso(row.created_at),
    engine: String(row.engine),
    ...(row.model ? { model: String(row.model) } : {}),
    ...(row.input_json ? { input: parseJson(row.input_json) } : {}),
    ...(row.output_json ? { output: parseJson(row.output_json) } : {}),
    ...(row.user_action ? { userAction: String(row.user_action) } : {}),
    ...(row.changes_json ? { changes: parseJson(row.changes_json) } : {}),
  }));
}

function latestUnresolvedIds(decisions) {
  const hierarchy = decisions.filter((event) => event.eventType === "pipeline_hierarchy").at(-1);
  return new Set(asArray(asObject(hierarchy?.output).unresolvedThoughtIds).map(String));
}

function mapNodes(rows) {
  return rows.map((row) => ({
    id: String(row.id),
    name: String(row.name),
    kind: String(row.kind),
    ...(row.parent_id ? { parentId: String(row.parent_id) } : {}),
    createdAt: iso(row.created_at),
    status: String(row.status),
    legacyMetadata: {
      source: row.source == null ? null : String(row.source),
      confidence: row.confidence == null ? null : Number(row.confidence),
      reason: row.reason == null ? null : String(row.reason),
      description: row.description == null ? null : String(row.description),
    },
  }));
}

function mapThoughts(rows, nodes, unresolvedIds) {
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  return rows.map((row) => {
    const id = String(row.id);
    const embedding = parseJson(row.embedding_json);
    if (!Array.isArray(embedding) || embedding.length !== 768 || embedding.some((value) => typeof value !== "number" || !Number.isFinite(value))) {
      throw new Error(`invalid_embedding:${id}`);
    }
    const rawPrimary = row.primary_node_id ? String(row.primary_node_id) : null;
    const isLegacyUnmatched = rawPrimary === "__unmatched__";
    const primaryNodeId = rawPrimary && !isLegacyUnmatched ? rawPrimary : null;
    const additionalNodeIds = asArray(parseJson(row.additional_node_ids_json)).map(String);
    const invalidAdditional = additionalNodeIds.find((nodeId) => !nodeById.has(nodeId));
    if (invalidAdditional) throw new Error(`invalid_additional_node_reference:${id}`);
    if (primaryNodeId) {
      const target = nodeById.get(primaryNodeId);
      if (!target || !["direction", "project"].includes(target.kind)) throw new Error(`invalid_primary_node_reference:${id}`);
    }
    const unresolved = !primaryNodeId && (isLegacyUnmatched || unresolvedIds.has(id));
    if (!primaryNodeId && !unresolved) throw new Error(`missing_unresolved_marker:${id}`);
    return {
      id,
      originalContent: row.source_content ? String(row.source_content) : String(row.content),
      type: String(row.type),
      status: String(row.status),
      createdAt: iso(row.created_at),
      embeddingModel: "embeddinggemma",
      embedding,
      ...(primaryNodeId ? { primaryNodeId } : {}),
      ...(additionalNodeIds.length ? { additionalNodeIds } : {}),
      ...(unresolved ? { unresolved: { reason: "no_suitable_parent" } } : {}),
      legacyMetadata: {
        title: row.title == null ? null : String(row.title),
        content: row.content == null ? null : String(row.content),
        project: row.project == null ? null : String(row.project),
        tags: parseJson(row.tags_json) ?? [],
        summary: row.analysis_summary == null ? null : String(row.analysis_summary),
        signals: parseJson(row.signals_json) ?? null,
        nextStep: row.next_step == null ? null : String(row.next_step),
      },
    };
  });
}

function mapLinks(rows) {
  return rows.map((row) => {
    if (!row.created_at) throw new Error(`link_timestamp_missing:${row.id}`);
    return {
      id: String(row.id),
      sourceId: String(row.source),
      targetId: String(row.target),
      type: String(row.type),
      status: String(row.status),
      createdAt: iso(row.created_at),
      ...(row.updated_at ? { updatedAt: iso(row.updated_at) } : {}),
      legacyMetadata: {
        reason: row.reason == null ? null : String(row.reason),
        confidence: row.confidence == null ? null : Number(row.confidence),
      },
    };
  });
}

function mapRuns(decisions, sourceSha256) {
  const groups = new Map();
  for (const event of decisions) {
    const runId = eventRunId(event);
    if (!runId) throw new Error(`decision_without_run_id:${event.id}`);
    const list = groups.get(runId) ?? [];
    list.push(event);
    groups.set(runId, list);
  }
  return [...groups.entries()].map(([runId, events]) => {
    const starts = events.filter((event) => event.eventType === "batch_started");
    const firstStart = starts[0];
    if (!firstStart) throw new Error(`run_without_batch_started:${runId}`);
    const startInput = asObject(firstStart.input);
    const datasetId = text(startInput.testDataset) ?? text(startInput.dataset) ?? "approved-96-v1";
    const orderVariant = text(startInput.orderVariant) ?? "original";
    const models = events.map(eventModel).filter(Boolean);
    const semanticModel = [...models].reverse().find((model) => model !== "embeddinggemma") ?? "qwen3:8b";
    const embeddingModel = models.includes("embeddinggemma") ? "embeddinggemma" : "embeddinggemma";
    const pipelineVersions = [...new Set(events.map(eventPipelineVersion).filter(Boolean))];
    const pipelineVersion = pipelineVersions.at(-1) ?? "0.6.0-alpha.18";
    const terminal = [...events].reverse().find((event) => ["batch_paused", "batch_failed", "batch_completed", "batch_continuation_blocked"].includes(event.eventType)) ?? events.at(-1);
    const stage = eventStage(terminal) ?? [...events].reverse().map(eventStage).find(Boolean) ?? "preflight";
    const timestampGroups = new Map();
    const eventDigests = events.map((event, sequence) => {
      const list = timestampGroups.get(event.createdAt) ?? [];
      list.push(sequence);
      timestampGroups.set(event.createdAt, list);
      return {
        sequence,
        sourceRowId: event.sourceRowId,
        eventType: event.eventType,
        createdAt: event.createdAt,
        engine: event.engine,
        model: eventModel(event),
        stage: eventStage(event),
        sha256: sha256(canonicalJson(event)),
      };
    });
    const timestampTies = [...timestampGroups.entries()]
      .filter(([, sequences]) => sequences.length > 1)
      .map(([createdAt, sequences]) => ({ createdAt, sequences }));
    return {
      runId,
      datasetId,
      orderVariant,
      semanticModel,
      embeddingModel,
      pipelineVersion,
      sourceBuildId: `legacy-alpha19-${sourceSha256.slice(0, 12)}`,
      initialStage: stage,
      sourceEventCount: events.length,
      historyCreatedAt: events[0].createdAt,
      history: {
        ordering: "created_at ASC, source rowid ASC",
        terminalEventType: terminal?.eventType ?? null,
        terminalCreatedAt: terminal?.createdAt ?? null,
        pipelineVersions,
        timestampTies,
        eventDigests,
        rawPayloadsIncluded: false,
      },
      invalidReferenceCount: 0,
    };
  });
}

export async function snapshotExactSource(path) {
  try {
    const [info, bytes] = await Promise.all([stat(path), readFile(path)]);
    return Object.freeze({
      exists: true,
      sizeBytes: bytes.byteLength,
      sha256: sha256(bytes),
      modifiedTimeMs: info.mtimeMs,
      sqliteHeaderValid: new TextDecoder().decode(bytes.subarray(0, 16)) === "SQLite format 3\u0000",
    });
  } catch (error) {
    if (error?.code === "ENOENT") return Object.freeze({ exists: false, sizeBytes: 0, sha256: "", sqliteHeaderValid: false });
    throw error;
  }
}

export async function loadExactPhase2CbCandidate(path, options = {}) {
  const expectedSource = options.expectedSource ?? B1B_EXPECTED_SOURCE;
  const before = await snapshotExactSource(path);
  if (!before.exists) throw new Error("source_not_found");
  if (before.sizeBytes !== expectedSource.sizeBytes) throw new Error("source_size_mismatch");
  if (before.sha256 !== expectedSource.sha256) throw new Error("source_hash_mismatch");
  if (!before.sqliteHeaderValid) throw new Error("source_schema_mismatch");
  if (options.manifestFrozenBeforeOpen !== true) throw new Error("manifest_not_frozen_before_source_open");
  options.onBeforeDatabaseOpen?.();

  const database = new DatabaseSync(path, { readOnly: true });
  let candidate;
  let inspection;
  try {
    database.exec("PRAGMA query_only = ON");
    const missing = EXPECTED_TABLES.filter((name) => !tableExists(database, name));
    if (missing.length) throw new Error(`source_schema_mismatch:${missing.join(",")}`);
    const quickCheck = queryOne(database, "PRAGMA quick_check")?.quick_check ?? null;
    const integrityCheck = queryOne(database, "PRAGMA integrity_check")?.integrity_check ?? null;
    if (quickCheck !== "ok" || integrityCheck !== "ok") throw new Error("source_integrity_failure");
    const rows = loadRows(database);
    const decisions = projectedDecisions(rows.decisions);
    const nodes = mapNodes(rows.nodes);
    const unresolvedIds = latestUnresolvedIds(decisions);
    const thoughts = mapThoughts(rows.thoughts, nodes, unresolvedIds);
    const links = mapLinks(rows.links);
    const runs = mapRuns(decisions, before.sha256);
    const personalThoughts = thoughts.filter((thought) => !/^synthetic-\d{3}$/.test(thought.id));
    const damagedReferenceCount = thoughts.reduce((sum, thought) => sum + (thought.damagedReferences?.length ?? 0), 0);
    const unresolvedThoughtCount = thoughts.filter((thought) => thought.unresolved).length;
    const actual = {
      thoughts: thoughts.length,
      nodes: nodes.length,
      links: links.length,
      decisions: decisions.length,
      embeddings: thoughts.filter((thought) => Array.isArray(thought.embedding)).length,
      runs: runs.length,
      personalThoughts: personalThoughts.length,
    };
    for (const [key, expected] of Object.entries({
      thoughts: B1B_EXPECTED_SOURCE.thoughts,
      nodes: B1B_EXPECTED_SOURCE.nodes,
      links: B1B_EXPECTED_SOURCE.links,
      decisions: B1B_EXPECTED_SOURCE.decisions,
      embeddings: B1B_EXPECTED_SOURCE.embeddings,
      runs: B1B_EXPECTED_SOURCE.runs,
      personalThoughts: B1B_EXPECTED_SOURCE.personalThoughts,
    })) {
      if (actual[key] !== expected) throw new Error(`count_mismatch:${key}:${actual[key]}:${expected}`);
    }
    candidate = {
      source: {
        databaseSha256: before.sha256,
        sizeBytes: before.sizeBytes,
        sqliteHeaderValid: true,
        quickCheck,
        integrityCheck,
        workspace: "synthetic",
        thoughtCount: thoughts.length,
        nodeCount: nodes.length,
        linkCount: links.length,
        embeddingCount: actual.embeddings,
        unresolvedThoughtCount,
        damagedReferenceCount,
        eventCount: decisions.length,
        runCount: runs.length,
        personalThoughtCount: personalThoughts.length,
      },
      target: {
        databaseName: "mindmap-state-core-v1-phase2cb-b1-exact-placeholder",
        workspace: "synthetic",
        mode: "isolated-temporary",
        isEmpty: true,
        isTargetMacProduction: false,
      },
      thoughts,
      nodes,
      links,
      runs,
    };
    inspection = Object.freeze({
      format: "mindmap-phase2cb-b1b-source-inspection-v1",
      sourceName: basename(path),
      sizeBytes: before.sizeBytes,
      sha256: before.sha256,
      openMode: "readonly",
      queryOnly: true,
      quickCheck,
      integrityCheck,
      counts: Object.freeze(actual),
      unresolvedThoughtCount,
      damagedReferenceCount,
      rawThoughtTextIncluded: false,
      rawModelPayloadsIncluded: false,
      databaseWritePerformed: false,
      networkCalls: 0,
      modelCalls: 0,
    });
  } finally {
    database.close();
  }
  const after = await snapshotExactSource(path);
  if (after.sizeBytes !== before.sizeBytes || after.sha256 !== before.sha256) throw new Error("source_changed_during_readonly_extraction");
  return Object.freeze({ candidate, inspection, sourceSnapshotBefore: before, sourceSnapshotAfter: after });
}
