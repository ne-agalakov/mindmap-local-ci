import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { inspectLegacyDatabase } from "../tools/legacy-database-inspector.mjs";

const hashFile = async (path) => createHash("sha256").update(await readFile(path)).digest("hex");

async function createFixture() {
  const directory = await mkdtemp(join(tmpdir(), "mindmap-legacy-db-"));
  const databasePath = join(directory, "legacy.sqlite");
  const diagnosticsPath = join(directory, "diagnostics.json");
  const database = new DatabaseSync(databasePath);
  database.exec(`
    CREATE TABLE thoughts (
      id TEXT PRIMARY KEY, title TEXT NOT NULL, content TEXT NOT NULL, type TEXT NOT NULL,
      project TEXT NOT NULL, tags_json TEXT NOT NULL DEFAULT '[]', created_at TEXT NOT NULL,
      status TEXT NOT NULL, next_step TEXT, embedding_json TEXT, analysis_summary TEXT,
      signals_json TEXT, source_content TEXT, primary_node_id TEXT,
      additional_node_ids_json TEXT NOT NULL DEFAULT '[]'
    );
    CREATE TABLE knowledge_nodes (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, kind TEXT NOT NULL, parent_id TEXT,
      created_at TEXT NOT NULL, source TEXT NOT NULL, confidence REAL, reason TEXT,
      description TEXT, status TEXT NOT NULL
    );
    CREATE TABLE links (
      id TEXT PRIMARY KEY, source TEXT NOT NULL, target TEXT NOT NULL, type TEXT NOT NULL,
      reason TEXT NOT NULL, confidence REAL NOT NULL, status TEXT NOT NULL
    );
    CREATE TABLE ai_decisions (
      id TEXT PRIMARY KEY, thought_id TEXT, event_type TEXT NOT NULL, created_at TEXT NOT NULL,
      engine TEXT NOT NULL, model TEXT, input_json TEXT, output_json TEXT,
      user_action TEXT, changes_json TEXT
    );
  `);
  database.prepare(`INSERT INTO knowledge_nodes
    (id,name,kind,parent_id,created_at,source,confidence,reason,description,status)
    VALUES (?,?,?,?,?,?,?,?,?,?)`).run("area-1", "Area", "area", null, "2026-07-25T00:00:00.000Z", "ai", 1, "fixture", null, "active");
  database.prepare(`INSERT INTO knowledge_nodes
    (id,name,kind,parent_id,created_at,source,confidence,reason,description,status)
    VALUES (?,?,?,?,?,?,?,?,?,?)`).run("direction-1", "Direction", "direction", "area-1", "2026-07-25T00:00:01.000Z", "ai", 1, "fixture", null, "active");
  const insertThought = database.prepare(`INSERT INTO thoughts
    (id,title,content,type,project,tags_json,created_at,status,next_step,embedding_json,analysis_summary,signals_json,source_content,primary_node_id,additional_node_ids_json)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  insertThought.run("synthetic-001", "Synthetic", "Synthetic", "Идея", "", "[]", "2026-07-25T00:00:03.000Z", "inbox", null, "[0,1]", null, null, "Synthetic", "direction-1", "[]");
  insertThought.run("personal-001", "Personal", "Personal", "Идея", "", "[]", "2026-07-25T00:00:02.000Z", "inbox", null, "[1,0]", null, null, "Personal", "direction-1", "[]");
  const insertDecision = database.prepare(`INSERT INTO ai_decisions
    (id,thought_id,event_type,created_at,engine,model,input_json,output_json,user_action,changes_json)
    VALUES (?,?,?,?,?,?,?,?,?,?)`);
  insertDecision.run("event-1", null, "batch_started", "2026-07-25T00:01:00.000Z", "user", null,
    JSON.stringify({ runId: "run-1", testDataset: "approved-96-v1", orderVariant: "original", pipelineVersion: "0.6.0-alpha.18" }), null, null, null);
  insertDecision.run("event-2", null, "pipeline_candidates", "2026-07-25T00:02:00.000Z", "offline", null,
    JSON.stringify({ runId: "run-1", promptVersion: "0.6.0-alpha.18", zeroModelCalls: true }),
    JSON.stringify({ candidates: [{ sourceId: "synthetic-001", targetId: "personal-001", similarity: 0.8, purposes: ["related"] }], candidateCount: 1 }), null, null);
  insertDecision.run("event-3", null, "batch_paused", "2026-07-25T00:02:00.000Z", "offline", null,
    JSON.stringify({ runId: "run-1", orderVariant: "original", completed: 2, stage: "candidates", zeroModelCalls: true }),
    JSON.stringify({ candidateCount: 1, unresolvedThoughtCount: 0 }), null, null);
  database.close();

  const thoughts = [
    { id: "synthetic-001", title: "Synthetic", content: "Synthetic", type: "Идея", project: "", tags: [], createdAt: "2026-07-25T00:00:03.000Z", status: "inbox", originalContent: "Synthetic", primaryNodeId: "direction-1", additionalNodeIds: [] },
    { id: "personal-001", title: "Personal", content: "Personal", type: "Идея", project: "", tags: [], createdAt: "2026-07-25T00:00:02.000Z", status: "inbox", originalContent: "Personal", primaryNodeId: "direction-1", additionalNodeIds: [] },
  ];
  const knowledgeNodes = [
    { id: "area-1", name: "Area", kind: "area", createdAt: "2026-07-25T00:00:00.000Z", source: "ai", confidence: 1, reason: "fixture", status: "active" },
    { id: "direction-1", name: "Direction", kind: "direction", parentId: "area-1", createdAt: "2026-07-25T00:00:01.000Z", source: "ai", confidence: 1, reason: "fixture", status: "active" },
  ];
  const aiDecisions = [
    { id: "event-1", eventType: "batch_started", createdAt: "2026-07-25T00:01:00.000Z", engine: "user", input: { runId: "run-1", testDataset: "approved-96-v1", orderVariant: "original", pipelineVersion: "0.6.0-alpha.18" } },
    { id: "event-2", eventType: "pipeline_candidates", createdAt: "2026-07-25T00:02:00.000Z", engine: "offline", input: { runId: "run-1", promptVersion: "0.6.0-alpha.18", zeroModelCalls: true }, output: { candidates: [{ sourceId: "synthetic-001", targetId: "personal-001", similarity: 0.8, purposes: ["related"] }], candidateCount: 1 } },
    { id: "event-3", eventType: "batch_paused", createdAt: "2026-07-25T00:02:00.000Z", engine: "offline", input: { runId: "run-1", orderVariant: "original", completed: 2, stage: "candidates", zeroModelCalls: true }, output: { candidateCount: 1, unresolvedThoughtCount: 0 } },
  ];
  await writeFile(diagnosticsPath, JSON.stringify({
    format: "mindmap-diagnostics",
    schemaVersion: 3,
    thoughts,
    knowledgeNodes,
    links: [],
    aiDecisions,
  }));
  return { directory, databasePath, diagnosticsPath };
}

test("legacy database inspector is read-only, deterministic, and separates workspaces", async (t) => {
  const fixture = await createFixture();
  t.after(() => rm(fixture.directory, { recursive: true, force: true }));
  const before = await hashFile(fixture.databasePath);
  const result = await inspectLegacyDatabase(fixture.databasePath, {
    configuredModel: "deepseek-r1:8b",
    diagnosticsPath: fixture.diagnosticsPath,
  });
  const after = await hashFile(fixture.databasePath);
  assert.equal(after, before);
  assert.equal(result.source.sha256, before);
  assert.equal(result.source.sha256AfterInspection, before);
  assert.equal(result.source.sourceModified, false);
  assert.equal(result.database.openMode, "readonly");
  assert.equal(result.database.quickCheck, "ok");
  assert.equal(result.database.integrityCheck, "ok");
  assert.deepEqual(result.database.tables, { thoughts: 2, knowledgeNodes: 2, links: 0, aiDecisions: 3 });
  assert.equal(result.workspaceClassification.syntheticThoughts, 1);
  assert.equal(result.workspaceClassification.personalThoughts, 1);
  assert.equal(result.migrationPackage.sourceWorkspace, "mixed_requires_review");
  assert.equal(result.migrationPackage.targetWritePerformed, false);
  assert.equal(result.migrationPackage.legacyWriteAllowed, false);
  assert.equal(result.migrationPackage.networkCallAllowed, false);
  assert.equal(result.migrationPackage.aiCallAllowed, false);
  assert.equal(result.structure.invalidParentReferences, 0);
  assert.equal(result.structure.cycles, 0);
  assert.equal(result.structure.latestCandidateCount, 1);
  assert.equal(result.structure.candidateInvalidIds, 0);
  assert.equal(result.events.timestampTies.length, 1);
  assert.equal(result.events.forbiddenContinuationOrAiAttemptEventsPresent, false);
  assert.equal(result.diagnosticsComparison.thoughtsExactEqual, true);
  assert.equal(result.diagnosticsComparison.knowledgeNodesExactEqual, true);
  assert.equal(result.diagnosticsComparison.linksExactEqual, true);
  assert.equal(result.diagnosticsComparison.aiDecisionsExactEqual, true);
});

test("inspector source has no network, model, migration, or write execution path", async () => {
  const source = await readFile(new URL("../tools/legacy-database-inspector.mjs", import.meta.url), "utf8");
  assert.match(source, /new DatabaseSync\(databasePath, \{ readOnly: true \}\)/);
  assert.match(source, /PRAGMA query_only = ON/);
  for (const forbidden of [
    "fetch(",
    "node:http",
    "node:https",
    "child_process",
    ".exec(\"INSERT",
    ".exec(\"UPDATE",
    ".exec(\"DELETE",
    ".exec(\"CREATE",
    "sql.js",
  ]) {
    assert.equal(source.includes(forbidden), false, `forbidden inspector path: ${forbidden}`);
  }
});

test("committed browser database fixture bytes match EVIDENCE exactly", async () => {
  const evidence = JSON.parse(await readFile(new URL("../fixtures/legacy/EVIDENCE.json", import.meta.url), "utf8"));
  const fixtureBytes = await readFile(new URL("../fixtures/legacy/browser-database-inspection.json", import.meta.url));
  const actualSha256 = createHash("sha256").update(fixtureBytes).digest("hex");
  assert.equal(fixtureBytes.byteLength, evidence.browserDatabaseFixture.sizeBytes);
  assert.equal(actualSha256, evidence.browserDatabaseFixture.sha256);
  const fixture = JSON.parse(fixtureBytes);
  assert.equal(fixture.source.sha256, evidence.sources.find((source) => source.name.endsWith(".sqlite")).sha256);
  assert.equal(fixture.source.sourceModified, false);
  assert.equal(fixture.execution.databaseWritePerformed, false);
  assert.equal(fixture.execution.networkFetchCalls, 0);
  assert.equal(fixture.execution.ollamaCalls, 0);
});
