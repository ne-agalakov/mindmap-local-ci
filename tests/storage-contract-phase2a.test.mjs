import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { canonicalJson } from "../storage/canonical-json.ts";
import { STATE_STORAGE_NAMESPACE } from "../storage/contracts.ts";
import { InMemoryReferenceStorage } from "../storage/in-memory-reference-storage.ts";
import {
  ACCEPTED_LEGACY_DATABASE_SHA256,
  ACCEPTED_LEGACY_DATABASE_SIZE_BYTES,
  planLegacyMigration,
} from "../storage/migration-plan.ts";
import {
  authorizeAttempt,
  createRun,
  requestAttempt,
} from "../state-core/run-state-core.ts";

const hashCanonical = (value) => createHash("sha256").update(value).digest("hex");

const identity = Object.freeze({
  runId: "phase2a-run-1",
  workspace: "synthetic",
  datasetId: "approved-96-v1",
  orderVariant: "original",
  semanticModel: "qwen3:8b",
  embeddingModel: "embeddinggemma",
  pipelineVersion: "state-core-v1",
  buildId: "phase2a-test-build",
  storageSchema: STATE_STORAGE_NAMESPACE,
});

const runtime = Object.freeze({
  configuredSemanticModel: "qwen3:8b",
  configuredEmbeddingModel: "embeddinggemma",
  buildId: "phase2a-test-build",
  storageSchema: STATE_STORAGE_NAMESPACE,
  supportedPipelineVersions: ["state-core-v1"],
  compatibleSourceBuildIds: [],
});

const meta = (commandId, expectedRevision) => ({
  commandId,
  expectedRevision,
  occurredAt: `2026-07-25T16:${String(expectedRevision).padStart(2, "0")}:00.000Z`,
});

function accepted(result) {
  assert.equal(result.ok, true, result.ok ? "" : JSON.stringify(result.rejection));
  return result;
}

function buildCreateCommit(runIdentity = identity, transactionId = "tx-create") {
  const created = accepted(createRun(runIdentity, "preflight", meta("cmd-create", 0)));
  return {
    result: created,
    request: {
      namespace: STATE_STORAGE_NAMESPACE,
      transactionId,
      idempotencyKey: `${transactionId}:idem`,
      workspace: runIdentity.workspace,
      runId: runIdentity.runId,
      expectedRevision: 0,
      events: created.events,
      aggregate: created.aggregate,
    },
  };
}

function buildAuthorizedBatch(baseAggregate, suffix = "one") {
  const requested = accepted(requestAttempt(baseAggregate, {
    attemptId: `attempt-${suffix}`,
    stage: "preflight",
    model: "qwen3:8b",
    inputHash: `input-${suffix}`,
    idempotencyKey: `attempt-idem-${suffix}`,
  }, runtime, meta(`cmd-request-${suffix}`, baseAggregate.revision)));
  const authorized = accepted(authorizeAttempt(requested.aggregate, {
    attemptId: `attempt-${suffix}`,
    authorizationId: `authorization-${suffix}`,
  }, runtime, meta(`cmd-authorize-${suffix}`, requested.aggregate.revision)));
  return {
    events: [...requested.events, ...authorized.events],
    aggregate: authorized.aggregate,
  };
}

test("canonical JSON is deterministic and rejects non-finite values", () => {
  assert.equal(canonicalJson({ z: 1, a: { d: 4, b: 2 } }), canonicalJson({ a: { b: 2, d: 4 }, z: 1 }));
  assert.throws(() => canonicalJson({ value: Number.NaN }), /non_finite_number/);
});

test("event batch and aggregate revision commit atomically", async () => {
  const storage = new InMemoryReferenceStorage(hashCanonical);
  const created = buildCreateCommit();
  const createReceipt = await storage.commit(created.request);
  assert.equal(createReceipt.ok, true);

  const batch = buildAuthorizedBatch(created.result.aggregate);
  const request = {
    namespace: STATE_STORAGE_NAMESPACE,
    transactionId: "tx-authorize",
    idempotencyKey: "tx-authorize:idem",
    workspace: "synthetic",
    runId: identity.runId,
    expectedRevision: 1,
    events: batch.events,
    aggregate: batch.aggregate,
  };
  const result = await storage.commit(request);
  assert.equal(result.ok, true);
  assert.equal(result.receipt.firstSequence, 2);
  assert.equal(result.receipt.lastSequence, 3);
  assert.equal(result.receipt.revision, 3);
  const stored = await storage.loadRun("synthetic", identity.runId);
  const events = await storage.loadEvents("synthetic", identity.runId);
  assert.equal(stored?.revision, 3);
  assert.equal(events.length, 3);
  assert.equal(canonicalJson(stored?.aggregate), canonicalJson(batch.aggregate));
});

test("same transaction is idempotent and conflicting retry is rejected", async () => {
  const storage = new InMemoryReferenceStorage(hashCanonical);
  const created = buildCreateCommit();
  const first = await storage.commit(created.request);
  const repeated = await storage.commit(created.request);
  assert.equal(first.ok, true);
  assert.equal(repeated.ok, true);
  assert.equal(repeated.receipt.idempotent, true);
  assert.equal(repeated.receipt.contentHash, first.receipt.contentHash);

  const conflict = await storage.commit({
    ...created.request,
    transactionId: "tx-create-conflict",
  });
  assert.equal(conflict.ok, false);
  assert.equal(conflict.rejection.code, "idempotency_conflict");
  assert.equal((await storage.loadEvents("synthetic", identity.runId)).length, 1);
});

test("stale concurrent writers serialize and only the first commit wins", async () => {
  const storage = new InMemoryReferenceStorage(hashCanonical);
  const created = buildCreateCommit();
  await storage.commit(created.request);

  const firstBatch = buildAuthorizedBatch(created.result.aggregate, "first");
  const secondBatch = buildAuthorizedBatch(created.result.aggregate, "second");
  const [first, second] = await Promise.all([
    storage.commit({
      namespace: STATE_STORAGE_NAMESPACE,
      transactionId: "tx-first",
      idempotencyKey: "tx-first:idem",
      workspace: "synthetic",
      runId: identity.runId,
      expectedRevision: 1,
      events: firstBatch.events,
      aggregate: firstBatch.aggregate,
    }),
    storage.commit({
      namespace: STATE_STORAGE_NAMESPACE,
      transactionId: "tx-second",
      idempotencyKey: "tx-second:idem",
      workspace: "synthetic",
      runId: identity.runId,
      expectedRevision: 1,
      events: secondBatch.events,
      aggregate: secondBatch.aggregate,
    }),
  ]);
  assert.equal(first.ok, true);
  assert.equal(second.ok, false);
  assert.equal(second.rejection.code, "stale_revision");
  assert.equal((await storage.loadRun("synthetic", identity.runId))?.revision, 3);
});

test("failure before commit leaves no partial run, event, artifact, or idempotency receipt", async () => {
  let shouldAbort = true;
  const storage = new InMemoryReferenceStorage(hashCanonical, {
    beforeCommit: () => {
      if (shouldAbort) throw new Error("simulated_crash_before_commit");
    },
  });
  const created = buildCreateCommit();
  const aborted = await storage.commit(created.request);
  assert.equal(aborted.ok, false);
  assert.equal(aborted.rejection.code, "transaction_aborted");
  assert.equal(await storage.loadRun("synthetic", identity.runId), undefined);
  assert.deepEqual(await storage.loadEvents("synthetic", identity.runId), []);

  shouldAbort = false;
  const retried = await storage.commit(created.request);
  assert.equal(retried.ok, true);
  assert.equal(retried.receipt.idempotent, false);
});

test("workspace identity cannot cross from synthetic to personal", async () => {
  const storage = new InMemoryReferenceStorage(hashCanonical);
  const created = buildCreateCommit();
  const result = await storage.commit({
    ...created.request,
    workspace: "personal",
  });
  assert.equal(result.ok, false);
  assert.equal(result.rejection.code, "identity_mismatch");
  assert.equal(await storage.loadRun("personal", identity.runId), undefined);
});

test("snapshot export is deterministic across repeated reads", async () => {
  const storage = new InMemoryReferenceStorage(hashCanonical);
  await storage.commit(buildCreateCommit().request);
  const first = await storage.exportSnapshot();
  const second = await storage.exportSnapshot();
  assert.deepEqual(second, first);
  assert.equal(first.namespace, STATE_STORAGE_NAMESPACE);
  assert.match(first.contentHash, /^[a-f0-9]{64}$/);
});

test("migration planning is read-only and bound to exact accepted source", () => {
  const source = {
    sourceDatabaseSha256: ACCEPTED_LEGACY_DATABASE_SHA256,
    sourceSizeBytes: ACCEPTED_LEGACY_DATABASE_SIZE_BYTES,
    sourceWorkspace: "synthetic",
    thoughtCount: 96,
    nodeCount: 30,
    linkCount: 0,
    eventCount: 133,
    personalThoughtCount: 0,
  };
  const ready = planLegacyMigration({
    source,
    targetIsEmpty: true,
    runs: [{ identity, sourceEventCount: 44, ambiguityCodes: [], invalidReferenceCount: 0 }],
  });
  assert.equal(ready.ok, true);
  assert.equal(ready.sourceWriteAllowed, false);
  assert.equal(ready.targetWritePerformed, false);
  assert.equal(ready.networkCallAllowed, false);
  assert.equal(ready.aiCallAllowed, false);

  const wrongHash = planLegacyMigration({
    source: { ...source, sourceDatabaseSha256: "0".repeat(64) },
    targetIsEmpty: true,
    runs: [{ identity, sourceEventCount: 44 }],
  });
  assert.equal(wrongHash.ok, false);
  assert.equal(wrongHash.stop.code, "source_hash_mismatch");

  const ambiguity = planLegacyMigration({
    source,
    targetIsEmpty: true,
    runs: [{ identity, sourceEventCount: 44, ambiguityCodes: ["equal_timestamp_without_sequence"] }],
  });
  assert.equal(ambiguity.ok, false);
  assert.equal(ambiguity.stop.code, "ambiguous_legacy_state");
});

test("Phase 2A storage code has no browser, UI, network, model, or legacy write dependency", async () => {
  const paths = [
    "../storage/contracts.ts",
    "../storage/canonical-json.ts",
    "../storage/in-memory-reference-storage.ts",
    "../storage/migration-plan.ts",
  ];
  const source = (await Promise.all(paths.map((path) => readFile(new URL(path, import.meta.url), "utf8"))))
    .join("\n")
    .toLowerCase();
  for (const forbidden of [
    "react",
    "indexeddb",
    "dexie",
    "fetch(",
    "node:http",
    "node:https",
    "ollama",
    "deepseek-r1",
    "qwen3",
    "mindmap-local-semantic-v060",
    "mindmap-v0.6.sqlite",
    "objectstore.put(",
    "objectstore.add(",
    "objectstore.delete(",
    "objectstore.clear(",
  ]) {
    assert.equal(source.includes(forbidden), false, `forbidden Phase 2A dependency/path: ${forbidden}`);
  }
});
