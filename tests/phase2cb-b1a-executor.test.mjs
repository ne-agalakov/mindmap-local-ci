import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { runPhase2CbB1aHarness } from "../migration/phase2cb-b1a-executor.ts";
import { MemoryPhase2CbB1aSourceAdapter } from "../migration/phase2cb-b1a-source.ts";
import {
  InMemoryPhase2CbB1aTargetFactory,
} from "../migration/phase2cb-b1a-targets.ts";
import { planPhase2CbMapping } from "../migration/phase2cb-mapping.ts";
import { phase2CbB1aCandidate } from "../migration/phase2cb-b1a-fixture.ts";

const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const hashCanonical = (value) => sha256(value);
const hashBytes = (bytes) => sha256(bytes);
const hashPayload = (payload) => sha256(
  payload.encoding === "base64" || payload.encoding === "float32-le-base64"
    ? Buffer.from(payload.data, "base64")
    : Buffer.from(payload.data, "utf8"),
);
const mappingOptions = { hashCanonical, hashBytes };
const fixtureBytes = Buffer.from("sanitized-sqlite-fixture-logical-envelope-v1", "utf8");

function source(candidate = phase2CbB1aCandidate()) {
  return new MemoryPhase2CbB1aSourceAdapter({
    sourceId: "sanitized-memory-fixture",
    bytes: fixtureBytes,
    candidate,
    hashBytes,
  });
}

function options(targetFactory, overrides = {}) {
  let clock = Date.parse("2026-07-26T19:00:00.000Z");
  const counters = overrides.counters ?? { networkCalls: 0, modelCalls: 0 };
  return {
    runId: overrides.runId ?? "fixture-run",
    source: overrides.source ?? source(),
    targetFactory,
    mappingOptions,
    hashCanonical,
    boundaryCounters: () => ({ ...counters }),
    now: () => (clock += 7),
  };
}

test("B1a in-memory harness proves two deterministic runs, rollback, observability and zero AI/network", async () => {
  const targetFactory = new InMemoryPhase2CbB1aTargetFactory({ hashCanonical, hashPayload });
  const result = await runPhase2CbB1aHarness(options(targetFactory));
  assert.equal(result.ok, true);
  assert.equal(result.evidence.repeatPlanHashesEqual, true);
  assert.equal(result.evidence.repeatTargetHashesEqual, true);
  assert.equal(result.evidence.rollbackTargetEmpty, true);
  assert.equal(result.evidence.sourceUnchangedAcrossHarness, true);
  assert.equal(result.evidence.networkCalls, 0);
  assert.equal(result.evidence.modelCalls, 0);
  assert.equal(result.evidence.exactSourceOpened, false);
  assert.equal(result.evidence.actualMigrationPerformed, false);
  assert.match(result.evidence.first.portablePlanHash, /^[a-f0-9]{64}$/);
  assert.match(result.evidence.first.targetSnapshotHash, /^[a-f0-9]{64}$/);
  assert.equal(result.evidence.first.runCountCommitted, 2);
  assert.equal(result.evidence.first.graphCommitted, true);
  assert.equal(result.evidence.rollback.runCountCommitted, 1);
  assert.equal(result.evidence.rollback.graphCommitted, false);
  assert.equal(result.evidence.rollback.rollbackTargetEmpty, true);
  assert.equal(result.evidence.first.manifest.automaticRetryAllowed, false);
  assert.equal(result.evidence.first.manifest.exactSourceAccessAllowed, false);
  assert.ok(result.evidence.first.observations.length >= 10);
  assert.deepEqual(
    [...new Set(result.evidence.first.observations.map((item) => item.model))],
    ["без AI"],
  );
  assert.ok(result.evidence.first.observations.every((item, index, list) => index === 0 || item.sequence > list[index - 1].sequence));
});

test("B1a stops before work when boundary counters are non-zero", async () => {
  const targetFactory = new InMemoryPhase2CbB1aTargetFactory({ hashCanonical, hashPayload });
  const result = await runPhase2CbB1aHarness(options(targetFactory, {
    counters: { networkCalls: 1, modelCalls: 0 },
  }));
  assert.equal(result.ok, false);
  assert.equal(result.stop.code, "network_path_detected");
});

test("B1 target namespace from accepted plan is accepted by the B0 mapper", async () => {
  const candidate = phase2CbB1aCandidate();
  candidate.target.databaseName = "mindmap-state-core-v1-phase2cb-dry-run-b1-contract-regression";
  const result = await planPhase2CbMapping(candidate, mappingOptions);
  assert.equal(result.ok, true);
});

test("B1a core has no SQLite, network, model or runtime dependency", async () => {
  const { readFile } = await import("node:fs/promises");
  for (const path of [
    "../migration/phase2cb-b1a-contracts.ts",
    "../migration/phase2cb-b1a-executor.ts",
    "../migration/phase2cb-b1a-source.ts",
    "../migration/phase2cb-b1a-targets.ts",
  ]) {
    const content = await readFile(new URL(path, import.meta.url), "utf8");
    assert.doesNotMatch(content, /node:sqlite|DatabaseSync|fetch\(|XMLHttpRequest|WebSocket|Ollama|Qwen|DeepSeek|app\/page|local-db/);
  }
});

test("B1a emits heartbeat and possibly-hung evidence without retrying the operation", async () => {
  const base = source();
  let reads = 0;
  const delayedSource = {
    mode: "sanitized-fixture",
    sourceId: "delayed-sanitized-fixture",
    snapshot: () => base.snapshot(),
    async readCandidate() {
      reads += 1;
      await new Promise((resolve) => setTimeout(resolve, 35));
      return base.readCandidate();
    },
  };
  const targetFactory = new InMemoryPhase2CbB1aTargetFactory({ hashCanonical, hashPayload });
  const result = await runPhase2CbB1aHarness({
    ...options(targetFactory, { source: delayedSource, runId: "heartbeat" }),
    now: Date.now,
    heartbeatIntervalMs: 5,
    possiblyHungThresholdMs: 10,
  });
  assert.equal(result.ok, true);
  assert.equal(reads, 3);
  assert.ok(result.evidence.first.observations.some((item) => item.step === "read_only_extraction" && item.message === "heartbeat"));
  assert.ok(result.evidence.first.observations.some((item) => item.step === "read_only_extraction" && item.state === "possibly_hung"));
  assert.ok(result.evidence.first.observations.some((item) => item.message?.includes("возможно, процесс завис")));
});

test("B1a rejects exact-source mode before reading candidate", async () => {
  let reads = 0;
  const forbiddenSource = {
    mode: "exact-source",
    sourceId: "private-source-forbidden",
    snapshot: async () => ({ exists: true, sizeBytes: 1, sha256: "0".repeat(64) }),
    readCandidate: async () => {
      reads += 1;
      return phase2CbB1aCandidate();
    },
  };
  const targetFactory = new InMemoryPhase2CbB1aTargetFactory({ hashCanonical, hashPayload });
  const result = await runPhase2CbB1aHarness(options(targetFactory, { source: forbiddenSource }));
  assert.equal(result.ok, false);
  assert.equal(result.stop.code, "exact_source_forbidden_in_b1a");
  assert.equal(reads, 0);
});

test("B1a detects source mutation and removes the partial isolated target", async () => {
  const candidate = phase2CbB1aCandidate();
  let snapshots = 0;
  const mutatingSource = {
    mode: "sanitized-fixture",
    sourceId: "mutating-fixture",
    async snapshot() {
      snapshots += 1;
      return {
        exists: true,
        sizeBytes: 10,
        sha256: snapshots >= 3 ? "b".repeat(64) : "a".repeat(64),
      };
    },
    async readCandidate() { return structuredClone(candidate); },
  };
  const targetFactory = new InMemoryPhase2CbB1aTargetFactory({ hashCanonical, hashPayload });
  const result = await runPhase2CbB1aHarness(options(targetFactory, { source: mutatingSource, runId: "mutating" }));
  assert.equal(result.ok, false);
  assert.equal(result.stop.code, "source_changed_during_run");
  assert.equal(result.partialEvidence.first.rollbackTargetEmpty, true);
});

test("B1a does not automatically retry target creation after a failure", async () => {
  let createCalls = 0;
  const targetFactory = {
    async exists() { return false; },
    async create() {
      createCalls += 1;
      throw new Error("synthetic_target_creation_failure");
    },
    async destroy() {},
  };
  const result = await runPhase2CbB1aHarness(options(targetFactory, { runId: "no-retry" }));
  assert.equal(result.ok, false);
  assert.equal(result.stop.code, "transaction_failure");
  assert.equal(createCalls, 1);
});
