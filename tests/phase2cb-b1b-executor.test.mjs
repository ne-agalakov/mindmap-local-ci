import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { runPhase2CbB1bHarness } from "../migration/phase2cb-b1b-executor.ts";
import { PreparedPhase2CbB1bSourceAdapter } from "../migration/phase2cb-b1b-source.ts";
import { InMemoryPhase2CbB1aTargetFactory } from "../migration/phase2cb-b1a-targets.ts";
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
const acceptedSnapshot = {
  exists: true,
  sizeBytes: 5_070_848,
  sha256: "356b943275cce292d0e14f8a7fbe95af07e79de73f06d3e361874d342aa2f918",
};

function source({ exact = false, candidate = phase2CbB1aCandidate() } = {}) {
  return new PreparedPhase2CbB1bSourceAdapter({
    sourceKind: exact ? "exact-source" : "sanitized-rehearsal",
    sourceId: exact ? "exact-source-prepared" : "sanitized-rehearsal",
    sourceSnapshot: acceptedSnapshot,
    candidate,
    exactSourceOpened: exact,
  });
}

function options(targetFactory, overrides = {}) {
  let clock = Date.parse("2026-07-27T08:00:00.000Z");
  const counters = overrides.counters ?? { networkCalls: 0, modelCalls: 0 };
  return {
    runId: overrides.runId ?? "b1b-fixture",
    source: overrides.source ?? source(),
    targetFactory,
    mappingOptions,
    hashCanonical,
    boundaryCounters: () => ({ ...counters }),
    now: () => (clock += 7),
  };
}

test("B1b rehearsal proves repeat hashes, rollback, cleanup and no automatic retry", async () => {
  const targetFactory = new InMemoryPhase2CbB1aTargetFactory({ hashCanonical, hashPayload });
  const result = await runPhase2CbB1bHarness(options(targetFactory));
  assert.equal(result.ok, true);
  assert.equal(result.evidence.sourceKind, "sanitized-rehearsal");
  assert.equal(result.evidence.exactSourceOpened, false);
  assert.equal(result.evidence.repeatPlanHashesEqual, true);
  assert.equal(result.evidence.repeatTargetHashesEqual, true);
  assert.equal(result.evidence.rollbackTargetEmpty, true);
  assert.equal(result.evidence.sourceUnchangedAcrossHarness, true);
  assert.equal(result.evidence.networkCalls, 0);
  assert.equal(result.evidence.modelCalls, 0);
  assert.equal(result.evidence.actualMigrationPerformed, false);
  assert.equal(result.evidence.automaticRetryAllowed, false);
  assert.equal(result.evidence.first.manifest.exactSourceAccessAllowed, true);
  assert.equal(result.evidence.first.manifest.actualMigrationAllowed, false);
  assert.equal(result.evidence.first.manifest.retryPolicy, "new-explicit-confirmation-required");
  assert.match(result.evidence.first.portablePlanHash, /^[a-f0-9]{64}$/);
  assert.match(result.evidence.first.targetSnapshotHash, /^[a-f0-9]{64}$/);
});

test("B1b exact-source prepared mode records exact source opening without authorizing migration", async () => {
  const targetFactory = new InMemoryPhase2CbB1aTargetFactory({ hashCanonical, hashPayload });
  const result = await runPhase2CbB1bHarness(options(targetFactory, { source: source({ exact: true }), runId: "exact-prepared" }));
  assert.equal(result.ok, true);
  assert.equal(result.evidence.sourceKind, "exact-source");
  assert.equal(result.evidence.exactSourceOpened, true);
  assert.equal(result.evidence.actualMigrationPerformed, false);
  assert.equal(result.evidence.first.manifest.executionMode, "b1b-exact-source-readonly");
});

test("B1b refuses exact-source mode when read-only opening was not proven", async () => {
  const targetFactory = new InMemoryPhase2CbB1aTargetFactory({ hashCanonical, hashPayload });
  const invalid = new PreparedPhase2CbB1bSourceAdapter({
    sourceKind: "exact-source",
    sourceId: "unopened-exact-source",
    sourceSnapshot: acceptedSnapshot,
    candidate: phase2CbB1aCandidate(),
    exactSourceOpened: false,
  });
  const result = await runPhase2CbB1bHarness(options(targetFactory, { source: invalid }));
  assert.equal(result.ok, false);
  assert.equal(result.stop.code, "exact_source_not_opened");
});

test("B1b stops when boundary counters are non-zero", async () => {
  const targetFactory = new InMemoryPhase2CbB1aTargetFactory({ hashCanonical, hashPayload });
  const result = await runPhase2CbB1bHarness(options(targetFactory, { counters: { networkCalls: 1, modelCalls: 0 } }));
  assert.equal(result.ok, false);
  assert.equal(result.stop.code, "network_path_detected");
});

test("B1b does not retry target creation after failure", async () => {
  let createCalls = 0;
  const targetFactory = {
    async exists() { return false; },
    async create() { createCalls += 1; throw new Error("target_creation_failure"); },
    async destroy() {},
  };
  const result = await runPhase2CbB1bHarness(options(targetFactory, { runId: "no-retry" }));
  assert.equal(result.ok, false);
  assert.equal(result.stop.code, "transaction_failure");
  assert.equal(createCalls, 1);
});
