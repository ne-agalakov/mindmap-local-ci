import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { inspectLegacyDiagnostics } from "../tools/legacy-inspector.mjs";
import { projectStateMachineFixture } from "../tools/legacy-fixture-projector.mjs";

const fixtureUrl = new URL("./fixtures/legacy/alpha19-candidate4-minimal.json", import.meta.url);
const canonicalUrl = new URL("../fixtures/legacy/alpha19-candidate4-run03.canonical.json", import.meta.url);
const evidenceUrl = new URL("../fixtures/legacy/EVIDENCE.json", import.meta.url);

test("Candidate 4 fixture is blocked immediately under DeepSeek without a persisted block event", async () => {
  const raw = await readFile(fixtureUrl);
  let fetchCalls = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    fetchCalls += 1;
    throw new Error("network access is forbidden");
  };
  try {
    const result = inspectLegacyDiagnostics(raw, {
      sourceName: "alpha19-candidate4-minimal.json",
      configuredModel: "deepseek-r1:8b",
    });
    assert.equal(result.activeRun.runModel, "qwen3:8b");
    assert.equal(result.activeRun.configuredModel, "deepseek-r1:8b");
    assert.equal(result.activeRun.persistedContinuationBlock, false);
    assert.equal(result.activeRun.derivedGuard.status, "blocked");
    assert.equal(result.activeRun.derivedGuard.reason, "run_model_mismatch");
    assert.equal(result.activeRun.derivedGuard.requiresContinuationClick, false);
    assert.equal(result.activeRun.derivedGuard.aiCallAllowed, false);
    assert.equal(result.activeRun.currentStage, "candidates");
    assert.equal(result.activeRun.candidateCount, 2);
    assert.equal(result.evidence.networkOrModelCallPerformed, false);
    assert.equal(fetchCalls, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("equal timestamps are ordered by immutable source index and reported", async () => {
  const raw = await readFile(fixtureUrl);
  const result = inspectLegacyDiagnostics(raw);
  const tied = result.ordering.timestampTies.find((item) => item.createdAt === "2026-07-23T16:16:18.713Z");
  assert.deepEqual(tied.sequences, [2, 3]);
  assert.equal(result.events[2].id, "candidates");
  assert.equal(result.events[3].id, "pause");
});

test("canonical inspection excludes thought text and raw event payloads", async () => {
  const raw = await readFile(fixtureUrl);
  const result = inspectLegacyDiagnostics(raw);
  const serialized = JSON.stringify(result);
  assert.equal(result.privacy.originalThoughtTextsIncluded, false);
  assert.equal(result.privacy.rawModelResponsesIncluded, false);
  assert.equal(result.privacy.eventPayloadsIncluded, false);
  assert.equal(serialized.includes("sourceId"), false);
  assert.equal(serialized.includes("targetId"), false);
});

test("fixture projector keeps only decisive state-machine evidence", async () => {
  const raw = await readFile(fixtureUrl);
  const inspection = inspectLegacyDiagnostics(raw, { configuredModel: "deepseek-r1:8b" });
  const projected = projectStateMachineFixture(inspection);
  assert.equal(projected.activeRun.derivedGuard.status, "blocked");
  assert.equal(projected.activeRun.persistedContinuationBlock, false);
  assert.deepEqual(projected.decisiveEvents.map((event) => event.eventType), [
    "batch_started",
    "pipeline_preflight",
    "pipeline_candidates",
    "batch_paused",
  ]);
  assert.equal(JSON.stringify(projected).includes("sourceId"), false);
});

test("committed exact fixture bytes match the recorded evidence hash", async () => {
  const [canonicalBytes, evidenceBytes] = await Promise.all([
    readFile(canonicalUrl),
    readFile(evidenceUrl),
  ]);
  const evidence = JSON.parse(evidenceBytes.toString("utf8"));
  const actual = createHash("sha256").update(canonicalBytes).digest("hex");
  const canonical = JSON.parse(canonicalBytes.toString("utf8"));
  assert.equal(actual, evidence.canonicalFixture.sha256);
  assert.equal(canonical.source.sha256, evidence.sources[0].sha256);
  assert.equal(canonical.activeRun.derivedGuard.status, "blocked");
  assert.equal(canonical.activeRun.derivedGuard.requiresContinuationClick, false);
  assert.equal(canonical.evidence.networkOrModelCallPerformed, false);
});

test("unsupported documents fail before inspection", () => {
  const raw = new TextEncoder().encode(JSON.stringify({ format: "other", aiDecisions: [] }));
  assert.throws(() => inspectLegacyDiagnostics(raw), /unsupported legacy diagnostics format/);
});
