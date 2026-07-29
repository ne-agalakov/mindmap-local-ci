import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { chmodSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { loadExactPhase2CbCandidate, snapshotExactSource } from "../tools/phase2cb-b1b-exact-source.mjs";

const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const iso = (index) => new Date(Date.UTC(2026, 6, 25, 0, 0, index)).toISOString();

function createFixture(path) {
  const db = new DatabaseSync(path);
  db.exec(`
    PRAGMA journal_mode=DELETE;
    CREATE TABLE thoughts (
      id TEXT PRIMARY KEY, title TEXT, content TEXT, type TEXT, project TEXT,
      tags_json TEXT, created_at TEXT, status TEXT, analysis_summary TEXT,
      signals_json TEXT, next_step TEXT, embedding_json TEXT, source_content TEXT,
      primary_node_id TEXT, additional_node_ids_json TEXT
    );
    CREATE TABLE knowledge_nodes (
      id TEXT PRIMARY KEY, name TEXT, kind TEXT, parent_id TEXT, created_at TEXT,
      source TEXT, confidence REAL, reason TEXT, description TEXT, status TEXT
    );
    CREATE TABLE links (
      id TEXT PRIMARY KEY, source TEXT, target TEXT, type TEXT, reason TEXT,
      confidence REAL, status TEXT, created_at TEXT, updated_at TEXT
    );
    CREATE TABLE ai_decisions (
      id TEXT PRIMARY KEY, thought_id TEXT, event_type TEXT, created_at TEXT,
      engine TEXT, model TEXT, input_json TEXT, output_json TEXT,
      user_action TEXT, changes_json TEXT
    );
  `);
  const node = db.prepare("INSERT INTO knowledge_nodes VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
  for (let i = 1; i <= 6; i += 1) node.run(`area-${i}`, `Area ${i}`, "area", null, iso(i), "ai", 1, null, null, "active");
  for (let i = 1; i <= 12; i += 1) node.run(`direction-${i}`, `Direction ${i}`, "direction", `area-${((i - 1) % 6) + 1}`, iso(10 + i), "ai", 1, null, null, "active");
  for (let i = 1; i <= 12; i += 1) node.run(`project-${i}`, `Project ${i}`, "project", `direction-${i}`, iso(30 + i), "ai", 1, null, null, "active");

  const thought = db.prepare("INSERT INTO thoughts VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
  const embedding = JSON.stringify(Array.from({ length: 768 }, (_, index) => index / 1000));
  for (let i = 1; i <= 96; i += 1) {
    const id = `synthetic-${String(i).padStart(3, "0")}`;
    thought.run(
      id, `Title ${i}`, `Content ${i}`, i % 2 ? "Идея" : "Действие", "",
      "[]", new Date(Date.UTC(2026, 6, 25, 1, 0, i)).toISOString(), i % 3 ? "active" : "inbox",
      null, null, null, embedding, `Original ${i}`,
      i === 96 ? null : `direction-${((i - 1) % 12) + 1}`, "[]",
    );
  }

  const decision = db.prepare("INSERT INTO ai_decisions VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
  const runSpecs = [
    ["run-1", 57, "round_robin", "batch_completed", null],
    ["run-2", 32, "original", "batch_failed", "hierarchy"],
    ["run-3", 44, "original", "batch_paused", "candidates"],
  ];
  let sequence = 0;
  for (const [runId, count, orderVariant, terminalType, terminalStage] of runSpecs) {
    for (let index = 0; index < count; index += 1) {
      const createdAt = new Date(Date.UTC(2026, 6, 25, 2, 0, sequence++)).toISOString();
      let eventType = index === 0 ? "batch_started" : "pipeline_preflight";
      let engine = index === 0 ? "user" : "ollama";
      let model = index === 0 ? null : "qwen3:8b";
      let input = { runId, pipelineVersion: "0.6.0-alpha.18" };
      let output = {};
      if (index === 0) input = { ...input, testDataset: "approved-96-v1", orderVariant };
      if (runId === "run-3" && index === count - 2) {
        eventType = "pipeline_hierarchy"; engine = "ollama"; model = "qwen3:8b";
        output = { unresolvedThoughtIds: ["synthetic-096"] };
      }
      if (index === count - 1) {
        eventType = terminalType; engine = "offline"; model = null;
        input = { ...input, ...(terminalStage ? { stage: terminalStage } : {}) };
      }
      decision.run(`event-${sequence}`, null, eventType, createdAt, engine, model, JSON.stringify(input), JSON.stringify(output), null, null);
    }
  }
  db.close();
  chmodSync(path, 0o444);
}

test("exact-source loader freezes manifest before read-only SQLite and produces the complete candidate", async () => {
  const root = mkdtempSync(join(tmpdir(), "mindmap-b1b-source-"));
  const path = join(root, "fixture.sqlite");
  createFixture(path);
  const bytes = readFileSync(path);
  const expectedSource = { sizeBytes: bytes.byteLength, sha256: sha256(bytes) };
  let databaseOpenBoundaryReached = false;
  const loaded = await loadExactPhase2CbCandidate(path, {
    expectedSource,
    manifestFrozenBeforeOpen: true,
    onBeforeDatabaseOpen() { databaseOpenBoundaryReached = true; },
  });
  assert.equal(databaseOpenBoundaryReached, true);
  assert.equal(loaded.inspection.openMode, "readonly");
  assert.equal(loaded.inspection.queryOnly, true);
  assert.deepEqual(loaded.inspection.counts, {
    thoughts: 96, nodes: 30, links: 0, decisions: 133, embeddings: 96, runs: 3, personalThoughts: 0,
  });
  assert.equal(loaded.candidate.thoughts.length, 96);
  assert.equal(loaded.candidate.nodes.length, 30);
  assert.equal(loaded.candidate.runs.reduce((sum, run) => sum + run.sourceEventCount, 0), 133);
  assert.equal(loaded.candidate.thoughts.filter((thought) => thought.unresolved).length, 1);
  assert.equal(loaded.candidate.thoughts.find((thought) => thought.id === "synthetic-096").unresolved.reason, "no_suitable_parent");
  assert.equal(loaded.candidate.runs.every((run) => run.history.rawPayloadsIncluded === false), true);
  assert.equal(loaded.sourceSnapshotBefore.sha256, loaded.sourceSnapshotAfter.sha256);
  assert.equal((await snapshotExactSource(path)).sha256, expectedSource.sha256);
});

test("size/hash mismatch stops before the SQLite open boundary", async () => {
  const root = mkdtempSync(join(tmpdir(), "mindmap-b1b-source-stop-"));
  const path = join(root, "fixture.sqlite");
  createFixture(path);
  let opened = false;
  await assert.rejects(
    loadExactPhase2CbCandidate(path, {
      expectedSource: { sizeBytes: 1, sha256: "0".repeat(64) },
      manifestFrozenBeforeOpen: true,
      onBeforeDatabaseOpen() { opened = true; },
    }),
    /source_size_mismatch/,
  );
  assert.equal(opened, false);
});

test("manifest omission blocks before the SQLite open boundary", async () => {
  const root = mkdtempSync(join(tmpdir(), "mindmap-b1b-manifest-stop-"));
  const path = join(root, "fixture.sqlite");
  createFixture(path);
  const bytes = readFileSync(path);
  let opened = false;
  await assert.rejects(
    loadExactPhase2CbCandidate(path, {
      expectedSource: { sizeBytes: bytes.byteLength, sha256: sha256(bytes) },
      manifestFrozenBeforeOpen: false,
      onBeforeDatabaseOpen() { opened = true; },
    }),
    /manifest_not_frozen_before_source_open/,
  );
  assert.equal(opened, false);
});
