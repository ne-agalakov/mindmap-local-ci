#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { DatabaseSync } from "node:sqlite";

const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const asObject = (value) => value && typeof value === "object" && !Array.isArray(value) ? value : {};
const asArray = (value) => Array.isArray(value) ? value : [];
const parseJson = (value) => {
  if (value == null || value === "") return undefined;
  try { return JSON.parse(String(value)); } catch { return undefined; }
};
const text = (value) => typeof value === "string" && value.length > 0 ? value : null;
const integer = (value) => Number.isInteger(value) ? value : null;
const boolean = (value) => typeof value === "boolean" ? value : null;

function queryAll(database, sql, ...params) {
  return database.prepare(sql).all(...params);
}

function queryOne(database, sql, ...params) {
  return database.prepare(sql).get(...params) ?? null;
}

function tableExists(database, name) {
  return Boolean(queryOne(database, "SELECT 1 AS ok FROM sqlite_master WHERE type = 'table' AND name = ?", name));
}

function requiredTables(database) {
  const names = ["thoughts", "knowledge_nodes", "links", "ai_decisions"];
  const missing = names.filter((name) => !tableExists(database, name));
  if (missing.length > 0) throw new Error(`legacy_database_missing_tables:${missing.join(",")}`);
  return names;
}

function loadThoughts(database) {
  return queryAll(database, "SELECT rowid AS source_rowid, * FROM thoughts ORDER BY created_at DESC, rowid ASC").map((row) => ({
    id: String(row.id),
    title: String(row.title),
    content: String(row.content),
    type: String(row.type),
    project: String(row.project),
    tags: parseJson(row.tags_json) ?? [],
    createdAt: String(row.created_at),
    status: String(row.status),
    ...(row.analysis_summary ? { summary: String(row.analysis_summary) } : {}),
    ...(row.signals_json ? { signals: parseJson(row.signals_json) } : {}),
    ...(row.next_step ? { nextStep: String(row.next_step) } : {}),
    ...(row.embedding_json ? { embedding: parseJson(row.embedding_json) } : {}),
    originalContent: row.source_content ? String(row.source_content) : String(row.content),
    ...(row.primary_node_id ? { primaryNodeId: String(row.primary_node_id) } : {}),
    additionalNodeIds: parseJson(row.additional_node_ids_json) ?? [],
  }));
}

function loadNodes(database) {
  return queryAll(database, "SELECT rowid AS source_rowid, * FROM knowledge_nodes ORDER BY created_at ASC, rowid ASC").map((row) => ({
    id: String(row.id),
    name: String(row.name),
    kind: String(row.kind),
    ...(row.parent_id ? { parentId: String(row.parent_id) } : {}),
    createdAt: String(row.created_at),
    source: String(row.source),
    ...(row.confidence == null ? {} : { confidence: Number(row.confidence) }),
    ...(row.reason ? { reason: String(row.reason) } : {}),
    ...(row.description ? { description: String(row.description) } : {}),
    status: String(row.status),
  }));
}

function loadLinks(database) {
  return queryAll(database, "SELECT rowid AS source_rowid, * FROM links ORDER BY rowid ASC").map((row) => ({
    id: String(row.id),
    source: String(row.source),
    target: String(row.target),
    type: String(row.type),
    reason: String(row.reason),
    confidence: Number(row.confidence),
    status: String(row.status),
  }));
}

function loadDecisions(database) {
  return queryAll(database, "SELECT rowid AS source_rowid, * FROM ai_decisions ORDER BY created_at ASC, rowid ASC").map((row) => ({
    sourceRowId: Number(row.source_rowid),
    id: String(row.id),
    ...(row.thought_id ? { thoughtId: String(row.thought_id) } : {}),
    eventType: String(row.event_type),
    createdAt: String(row.created_at),
    engine: String(row.engine),
    ...(row.model ? { model: String(row.model) } : {}),
    ...(row.input_json ? { input: parseJson(row.input_json) } : {}),
    ...(row.output_json ? { output: parseJson(row.output_json) } : {}),
    ...(row.user_action ? { userAction: String(row.user_action) } : {}),
    ...(row.changes_json ? { changes: parseJson(row.changes_json) } : {}),
  }));
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
  return text(asObject(event.input).stage) ?? text(asObject(event.output).stage);
}

function eventZeroModelCalls(event) {
  const input = asObject(event.input);
  const output = asObject(event.output);
  return boolean(input.zeroModelCalls)
    ?? boolean(output.zeroModelCalls)
    ?? boolean(asObject(output.recovery).zeroModelCalls);
}

function eventCandidateCount(event) {
  const input = asObject(event.input);
  const output = asObject(event.output);
  return integer(output.candidateCount)
    ?? integer(input.candidateCount)
    ?? (Array.isArray(output.candidates) ? output.candidates.length : null);
}

function eventUnresolvedCounts(event) {
  const input = asObject(event.input);
  const output = asObject(event.output);
  return {
    unresolvedThoughtCount: integer(input.unresolvedThoughtCount)
      ?? integer(output.unresolvedThoughtCount)
      ?? (Array.isArray(output.unresolvedThoughtIds) ? output.unresolvedThoughtIds.length : null),
    unresolvedClusterCount: integer(input.unresolvedClusterCount)
      ?? integer(output.unresolvedClusterCount)
      ?? (Array.isArray(output.unresolvedClusterIds) ? output.unresolvedClusterIds.length : null),
  };
}

function summarizeEvents(decisions, configuredModel) {
  const sanitized = decisions.map((event, sequence) => {
    const input = asObject(event.input);
    const { unresolvedThoughtCount, unresolvedClusterCount } = eventUnresolvedCounts(event);
    return {
      sequence,
      sourceRowId: event.sourceRowId,
      eventType: event.eventType,
      createdAt: event.createdAt,
      engine: event.engine,
      runId: eventRunId(event),
      stage: eventStage(event),
      model: eventModel(event),
      pipelineVersion: eventPipelineVersion(event),
      dataset: text(input.testDataset),
      orderVariant: text(input.orderVariant),
      resume: boolean(input.resume),
      zeroModelCalls: eventZeroModelCalls(event),
      candidateCount: eventCandidateCount(event),
      unresolvedThoughtCount,
      unresolvedClusterCount,
    };
  });
  const timestampGroups = new Map();
  for (const event of sanitized) {
    const group = timestampGroups.get(event.createdAt) ?? [];
    group.push(event.sequence);
    timestampGroups.set(event.createdAt, group);
  }
  const timestampTies = [...timestampGroups.entries()]
    .filter(([, sequences]) => sequences.length > 1)
    .map(([createdAt, sequences]) => ({ createdAt, sequences }));
  const byRun = new Map();
  for (const event of sanitized) {
    if (!event.runId) continue;
    const list = byRun.get(event.runId) ?? [];
    list.push(event);
    byRun.set(event.runId, list);
  }
  const runs = [...byRun.entries()].map(([runId, events]) => {
    const firstStart = events.find((event) => event.eventType === "batch_started") ?? {};
    const terminal = [...events].reverse().find((event) =>
      ["batch_paused", "batch_failed", "batch_completed", "batch_continuation_blocked"].includes(event.eventType),
    ) ?? events.at(-1) ?? {};
    const models = [...new Set(events.map((event) => event.model).filter(Boolean))].filter((model) => model !== "embeddinggemma");
    const runModel = models.at(-1) ?? null;
    const mismatch = Boolean(runModel && configuredModel && runModel !== configuredModel);
    return {
      runId,
      dataset: firstStart.dataset ?? null,
      orderVariant: firstStart.orderVariant ?? null,
      runModel,
      configuredModel: configuredModel ?? null,
      pipelineVersions: [...new Set(events.map((event) => event.pipelineVersion).filter(Boolean))],
      eventCount: events.length,
      terminalEventType: terminal.eventType ?? null,
      terminalCreatedAt: terminal.createdAt ?? null,
      currentStage: terminal.stage ?? null,
      candidateCount: [...events].reverse().map((event) => event.candidateCount).find(Number.isInteger) ?? null,
      unresolvedThoughtCount: [...events].reverse().map((event) => event.unresolvedThoughtCount).find(Number.isInteger) ?? null,
      unresolvedClusterCount: [...events].reverse().map((event) => event.unresolvedClusterCount).find(Number.isInteger) ?? null,
      persistedContinuationBlock: events.some((event) => event.eventType === "batch_continuation_blocked"),
      derivedGuard: mismatch ? {
        status: "blocked",
        reason: "run_model_mismatch",
        requiresContinuationClick: false,
        aiCallAllowed: false,
      } : {
        status: "compatible_or_unknown",
        reason: runModel && configuredModel ? "models_match" : "model_identity_incomplete",
        requiresContinuationClick: false,
        aiCallAllowed: false,
      },
    };
  });
  return { sanitized, timestampTies, runs };
}

function validateStructure(thoughts, nodes, links, decisions) {
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const thoughtById = new Map(thoughts.map((thought) => [thought.id, thought]));
  const invalidParents = [];
  const invalidParentTypes = [];
  const cycles = [];
  const roots = [];
  for (const node of nodes) {
    if (!node.parentId) roots.push(node.id);
    else if (!nodeById.has(node.parentId)) invalidParents.push(node.id);
    else {
      const parent = nodeById.get(node.parentId);
      if (node.kind === "area" || (node.kind === "direction" && parent.kind !== "area") || (node.kind === "project" && parent.kind !== "direction")) {
        invalidParentTypes.push(node.id);
      }
    }
    const seen = new Set();
    let current = node;
    while (current) {
      if (seen.has(current.id)) { cycles.push(node.id); break; }
      seen.add(current.id);
      current = current.parentId ? nodeById.get(current.parentId) : null;
    }
  }
  const paths = nodes.map((node) => {
    const names = [];
    const seen = new Set();
    let current = node;
    while (current) {
      if (seen.has(current.id)) return null;
      seen.add(current.id);
      names.push(current.name);
      current = current.parentId ? nodeById.get(current.parentId) : null;
    }
    return names.reverse().join("\u0000");
  }).filter(Boolean);
  const duplicatePaths = paths.length - new Set(paths).size;
  const primaryMissing = thoughts.filter((thought) => !thought.primaryNodeId);
  const primaryInvalid = thoughts.filter((thought) => thought.primaryNodeId && !nodeById.has(thought.primaryNodeId));
  const primaryWrongType = thoughts.filter((thought) => {
    const node = thought.primaryNodeId ? nodeById.get(thought.primaryNodeId) : null;
    return node && !["direction", "project"].includes(node.kind);
  });
  const additionalInvalid = thoughts.flatMap((thought) => asArray(thought.additionalNodeIds).filter((id) => !nodeById.has(id)));
  const embeddingDimensions = new Map();
  let embeddingParseErrors = 0;
  let embeddingNonFinite = 0;
  for (const thought of thoughts) {
    if (!Array.isArray(thought.embedding)) { embeddingParseErrors += 1; continue; }
    embeddingDimensions.set(thought.embedding.length, (embeddingDimensions.get(thought.embedding.length) ?? 0) + 1);
    if (thought.embedding.some((value) => typeof value !== "number" || !Number.isFinite(value))) embeddingNonFinite += 1;
  }
  const candidateEvents = decisions.filter((event) => event.eventType === "pipeline_candidates");
  const latestCandidates = asArray(asObject(candidateEvents.at(-1)?.output).candidates);
  const candidatePairs = new Set();
  let candidateInvalidIds = 0;
  let candidateSelfPairs = 0;
  let candidateDuplicatePairs = 0;
  for (const candidate of latestCandidates) {
    const object = asObject(candidate);
    const sourceId = text(object.sourceId);
    const targetId = text(object.targetId);
    if (!sourceId || !targetId || !thoughtById.has(sourceId) || !thoughtById.has(targetId)) candidateInvalidIds += 1;
    if (sourceId && sourceId === targetId) candidateSelfPairs += 1;
    const key = sourceId && targetId ? [sourceId, targetId].sort().join("\u0000") : null;
    if (key && candidatePairs.has(key)) candidateDuplicatePairs += 1;
    if (key) candidatePairs.add(key);
  }
  const unresolvedThoughtIds = asArray(asObject(decisions.filter((event) => event.eventType === "pipeline_hierarchy").at(-1)?.output).unresolvedThoughtIds);
  return {
    roots: roots.length,
    rootKinds: Object.fromEntries([...new Set(nodes.map((node) => node.kind))].map((kind) => [kind, roots.filter((id) => nodeById.get(id)?.kind === kind).length])),
    invalidParentReferences: invalidParents.length,
    invalidParentTypes: invalidParentTypes.length,
    cycles: cycles.length,
    duplicatePaths,
    primaryPlacementMissing: primaryMissing.length,
    primaryPlacementInvalid: primaryInvalid.length,
    primaryPlacementWrongType: primaryWrongType.length,
    additionalPlacementInvalid: additionalInvalid.length,
    unresolvedMatchesMissingPrimary: new Set(unresolvedThoughtIds).size === primaryMissing.length && primaryMissing.every((thought) => unresolvedThoughtIds.includes(thought.id)),
    embeddingDimensions: Object.fromEntries([...embeddingDimensions.entries()].sort((a, b) => a[0] - b[0])),
    embeddingParseErrors,
    embeddingNonFinite,
    latestCandidateCount: latestCandidates.length,
    candidateInvalidIds,
    candidateSelfPairs,
    candidateDuplicatePairs,
    linksWithInvalidEndpoints: links.filter((link) => !thoughtById.has(link.source) || !thoughtById.has(link.target)).length,
  };
}

function compareDiagnostics(diagnosticsBytes, thoughts, nodes, links, decisions) {
  const document = JSON.parse(new TextDecoder().decode(diagnosticsBytes));
  if (document?.format !== "mindmap-diagnostics") throw new Error("unsupported_diagnostics_format");
  const diagnosticThoughts = thoughts.map(({ embedding: _embedding, ...thought }) => thought);
  const decisionRows = decisions.map(({ sourceRowId: _sourceRowId, ...event }) => event);
  return {
    sourceSha256: sha256(diagnosticsBytes),
    sourceSizeBytes: diagnosticsBytes.byteLength,
    thoughtsExactEqual: JSON.stringify(document.thoughts) === JSON.stringify(diagnosticThoughts),
    knowledgeNodesExactEqual: JSON.stringify(document.knowledgeNodes) === JSON.stringify(nodes),
    linksExactEqual: JSON.stringify(document.links) === JSON.stringify(links),
    aiDecisionsExactEqual: JSON.stringify(document.aiDecisions) === JSON.stringify(decisionRows),
    diagnosticsIntentionallyOmitEmbeddings: true,
  };
}

export async function inspectLegacyDatabase(databasePath, { configuredModel = null, diagnosticsPath = null } = {}) {
  const rawBytes = await readFile(databasePath);
  if (new TextDecoder().decode(rawBytes.subarray(0, 16)) !== "SQLite format 3\u0000") throw new Error("invalid_sqlite_header");
  const database = new DatabaseSync(databasePath, { readOnly: true });
  let result;
  try {
    database.exec("PRAGMA query_only = ON");
    requiredTables(database);
    const quickCheck = queryOne(database, "PRAGMA quick_check")?.quick_check ?? null;
    const integrityCheck = queryOne(database, "PRAGMA integrity_check")?.integrity_check ?? null;
    const thoughts = loadThoughts(database);
    const nodes = loadNodes(database);
    const links = loadLinks(database);
    const decisions = loadDecisions(database);
    const events = summarizeEvents(decisions, configuredModel);
    const activeRun = events.runs.at(-1) ?? null;
    const syntheticThoughts = thoughts.filter((thought) => /^synthetic-\d{3}$/.test(thought.id));
    const personalThoughts = thoughts.filter((thought) => !/^synthetic-\d{3}$/.test(thought.id));
    const syntheticNumbers = new Set(syntheticThoughts.map((thought) => Number(thought.id.slice(-3))));
    const eventTypes = Object.fromEntries([...new Set(decisions.map((event) => event.eventType))].sort().map((type) => [type, decisions.filter((event) => event.eventType === type).length]));
    result = {
      format: "mindmap-legacy-database-inspection",
      schemaVersion: 1,
      source: {
        name: databasePath.split(/[\\/]/).at(-1),
        sizeBytes: rawBytes.byteLength,
        sha256: sha256(rawBytes),
        sqliteHeaderValid: true,
        sourceModified: false,
      },
      database: {
        openMode: "readonly",
        queryOnly: true,
        quickCheck,
        integrityCheck,
        tables: {
          thoughts: thoughts.length,
          knowledgeNodes: nodes.length,
          links: links.length,
          aiDecisions: decisions.length,
        },
      },
      privacy: {
        thoughtTextIncluded: false,
        nodeLabelsIncluded: false,
        rawModelPayloadsIncluded: false,
        rawDatabaseCommitted: false,
      },
      workspaceClassification: {
        rule: "thought IDs matching /^synthetic-\\d{3}$/ belong to synthetic workspace; every other thought belongs to personal review",
        syntheticThoughts: syntheticThoughts.length,
        personalThoughts: personalThoughts.length,
        allSyntheticIdsContinuous001To096: syntheticThoughts.length === 96 && Array.from({ length: 96 }, (_, index) => index + 1).every((value) => syntheticNumbers.has(value)),
        sourceDataset: activeRun?.dataset ?? null,
        migrationSplitRequired: true,
      },
      structure: validateStructure(thoughts, nodes, links, decisions),
      events: {
        eventTypes,
        runCount: events.runs.length,
        timestampOrderingRule: "created_at ASC, source rowid ASC",
        timestampTies: events.timestampTies,
        forbiddenContinuationOrAiAttemptEventsPresent: decisions.some((event) => [
          "batch_continuation_blocked",
          "pipeline_ai_call_planned",
          "pipeline_ai_call_started",
          "pipeline_ai_call_completed",
        ].includes(event.eventType)),
      },
      activeRun,
      diagnosticsComparison: diagnosticsPath
        ? compareDiagnostics(await readFile(diagnosticsPath), thoughts, nodes, links, decisions)
        : null,
      migrationPackage: {
        format: "mindmap-legacy-migration-package-manifest",
        schemaVersion: 1,
        sourceDatabaseSha256: sha256(rawBytes),
        sourceWorkspace: personalThoughts.length === 0 ? "synthetic" : "mixed_requires_review",
        syntheticRecordCounts: {
          thoughts: syntheticThoughts.length,
          nodes: nodes.length,
          links: links.length,
          aiDecisions: decisions.length,
        },
        personalRecordCounts: { thoughts: personalThoughts.length },
        targetNamespace: "mindmap-state-core-v1",
        targetWritePerformed: false,
        legacyWriteAllowed: false,
        networkCallAllowed: false,
        aiCallAllowed: false,
        importStatus: "blocked_until_phase2_transactional_storage_exists",
      },
      execution: {
        databaseWritePerformed: false,
        databaseMigrationPerformed: false,
        networkFetchCalls: 0,
        ollamaCalls: 0,
        qwenCalls: 0,
        deepseekCalls: 0,
      },
    };
  } finally {
    database.close();
  }
  const afterBytes = await readFile(databasePath);
  const afterSha256 = sha256(afterBytes);
  result.source.sha256AfterInspection = afterSha256;
  result.source.sourceModified = afterBytes.byteLength !== rawBytes.byteLength || afterSha256 !== result.source.sha256;
  if (result.source.sourceModified) throw new Error("legacy_database_modified_during_inspection");
  return result;
}

async function main(argv) {
  const args = [...argv];
  const databasePath = args.shift();
  if (!databasePath) throw new Error("usage: node tools/legacy-database-inspector.mjs <database.sqlite> [--diagnostics FILE] [--configured-model MODEL] [--output FILE]");
  let diagnosticsPath = null;
  let configuredModel = null;
  let outputPath = null;
  while (args.length > 0) {
    const flag = args.shift();
    const value = args.shift();
    if (!value) throw new Error(`missing value for ${flag}`);
    if (flag === "--diagnostics") diagnosticsPath = value;
    else if (flag === "--configured-model") configuredModel = value;
    else if (flag === "--output") outputPath = value;
    else throw new Error(`unknown option:${flag}`);
  }
  const result = await inspectLegacyDatabase(databasePath, { configuredModel, diagnosticsPath });
  const serialized = `${JSON.stringify(result, null, 2)}\n`;
  if (outputPath) await writeFile(outputPath, serialized);
  else process.stdout.write(serialized);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
