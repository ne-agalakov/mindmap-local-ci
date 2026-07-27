import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { InMemoryGraphStorage } from "../graph-storage/in-memory-reference-storage.ts";
import { PHASE2CB_MAPPING_VERSION } from "../migration/phase2cb-contracts.ts";
import { planPhase2CbMapping } from "../migration/phase2cb-mapping.ts";
import { canonicalJson } from "../storage/canonical-json.ts";
import { InMemoryReferenceStorage } from "../storage/in-memory-reference-storage.ts";
import { ACCEPTED_LEGACY_DATABASE_SHA256, ACCEPTED_LEGACY_DATABASE_SIZE_BYTES } from "../storage/migration-plan.ts";

const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const hashCanonical = (value) => sha256(value);
const hashBytes = (bytes) => sha256(bytes);
const hashPayload = (payload) => sha256(
  payload.encoding === "base64" || payload.encoding === "float32-le-base64"
    ? Buffer.from(payload.data, "base64")
    : Buffer.from(payload.data, "utf8"),
);
const options = { hashCanonical, hashBytes };

function candidate() {
  return {
    source: {
      databaseSha256: ACCEPTED_LEGACY_DATABASE_SHA256,
      sizeBytes: ACCEPTED_LEGACY_DATABASE_SIZE_BYTES,
      sqliteHeaderValid: true,
      quickCheck: "ok",
      integrityCheck: "ok",
      workspace: "synthetic",
      thoughtCount: 3,
      nodeCount: 3,
      linkCount: 1,
      embeddingCount: 3,
      unresolvedThoughtCount: 1,
      damagedReferenceCount: 1,
      eventCount: 5,
      runCount: 2,
      personalThoughtCount: 0,
    },
    target: {
      databaseName: "mindmap-state-core-v1-phase2cb-dry-run-fixture-001",
      workspace: "synthetic",
      mode: "isolated-temporary",
      isEmpty: true,
      isTargetMacProduction: false,
    },
    nodes: [
      { id: "project-1", name: "Release proof", kind: "project", parentId: "direction-1", createdAt: "2026-07-25T00:02:00.000Z", status: "active", legacyMetadata: { source: "ai", confidence: 0.8 } },
      { id: "area-1", name: "Systems", kind: "area", createdAt: "2026-07-25T00:00:00.000Z", status: "active" },
      { id: "direction-1", name: "MindMap core", kind: "direction", parentId: "area-1", createdAt: "2026-07-25T00:01:00.000Z", status: "active" },
    ],
    thoughts: [
      {
        id: "synthetic-003",
        originalContent: "Preserve a broken legacy pointer explicitly",
        type: "Наблюдение",
        status: "inbox",
        createdAt: "2026-07-25T00:05:00.000Z",
        embeddingModel: "embeddinggemma",
        embedding: [0.5, -0.25],
        unresolved: { reason: "legacy_reference_damaged" },
        legacyMetadata: { title: "Broken pointer", tags: ["fixture"] },
        damagedReferences: [{
          field: "primaryNodeId",
          targetKind: "node",
          targetId: "missing-node",
          reason: "missing_target",
          detectedAt: "2026-07-25T00:05:01.000Z",
        }],
      },
      {
        id: "synthetic-001",
        originalContent: "Freeze the deterministic mapping contract",
        type: "Решение",
        status: "active",
        createdAt: "2026-07-25T00:03:00.000Z",
        embeddingModel: "embeddinggemma",
        embedding: [0.125, 0.25],
        primaryNodeId: "direction-1",
      },
      {
        id: "synthetic-002",
        originalContent: "Run an isolated dry-run later",
        type: "Действие",
        status: "inbox",
        createdAt: "2026-07-25T00:04:00.000Z",
        embeddingModel: "embeddinggemma",
        embedding: [-0.5, 0.75],
        primaryNodeId: "project-1",
        additionalNodeIds: ["direction-1"],
      },
    ],
    links: [{
      id: "legacy-link-1",
      sourceId: "synthetic-001",
      targetId: "synthetic-002",
      type: "Зависит от",
      status: "confirmed",
      createdAt: "2026-07-25T00:06:00.000Z",
      updatedAt: "2026-07-25T00:06:01.000Z",
      legacyMetadata: { reason: "fixture dependency", confidence: 0.9 },
    }],
    runs: [
      {
        runId: "legacy-run-2",
        datasetId: "approved-96-v1",
        orderVariant: "original",
        semanticModel: "qwen3:8b",
        embeddingModel: "embeddinggemma",
        pipelineVersion: "0.6.0-alpha.18",
        sourceBuildId: "legacy-alpha19",
        initialStage: "hierarchy",
        sourceEventCount: 2,
        historyCreatedAt: "2026-07-25T00:08:00.000Z",
        history: { terminal: "failed", eventDigests: ["b", "a"] },
      },
      {
        runId: "legacy-run-1",
        datasetId: "approved-96-v1",
        orderVariant: "round_robin",
        semanticModel: "qwen3:8b",
        embeddingModel: "embeddinggemma",
        pipelineVersion: "0.6.0-alpha.12",
        sourceBuildId: "legacy-alpha19",
        initialStage: "candidates",
        sourceEventCount: 3,
        historyCreatedAt: "2026-07-25T00:07:00.000Z",
        history: { terminal: "paused", eventDigests: ["c", "d", "e"] },
      },
    ],
  };
}

function clone(value) {
  return structuredClone(value);
}

async function expectStop(mutator, code) {
  const value = candidate();
  mutator(value);
  const result = await planPhase2CbMapping(value, options);
  assert.equal(result.ok, false);
  assert.equal(result.stop.code, code);
  assert.equal(result.sourceWriteAllowed, false);
  assert.equal(result.targetWritePerformed, false);
  assert.equal(result.networkCallAllowed, false);
  assert.equal(result.aiCallAllowed, false);
  assert.equal(result.actualMigrationAllowed, false);
}

test("B0 maps sanitized graph and quarantined run history deterministically without mutation", async () => {
  const first = await planPhase2CbMapping(candidate(), options);
  assert.equal(first.ok, true);
  assert.equal(first.plan.mappingVersion, PHASE2CB_MAPPING_VERSION);
  assert.equal(first.plan.sourceWriteAllowed, false);
  assert.equal(first.plan.targetWritePerformed, false);
  assert.equal(first.plan.actualMigrationAllowed, false);
  assert.match(first.plan.mappingContentHash, /^[a-f0-9]{64}$/);
  assert.match(first.plan.graphContentHash, /^[a-f0-9]{64}$/);
  assert.equal(first.plan.graphState.thoughts.length, 3);
  assert.equal(first.plan.graphState.nodes.length, 3);
  assert.equal(first.plan.graphState.placements.length, 3);
  assert.equal(first.plan.graphState.embeddings.length, 3);
  assert.equal(first.plan.graphState.damagedReferences.length, 1);
  assert.equal(first.plan.graphState.links.length, 2);
  assert.equal(first.plan.diagnostics.generatedAdditionalPlacementLinks, 1);
  assert.equal(first.plan.diagnostics.targetCounts.legacyMetadataArtifacts, 3);
  assert.equal(first.plan.diagnostics.sourceSemanticEntitiesInvented, 0);
  assert.equal(first.plan.diagnostics.sourceRecordsDropped, 0);
  assert.deepEqual(first.plan.rollbackContract, {
    strategy: "delete-isolated-target-on-any-failure",
    sourceHashBeforeAfterRequired: true,
    targetMustStartEmpty: true,
    partialTargetAllowed: false,
    repeatRunHashEqualityRequired: true,
    diagnosticSchema: "mindmap-phase2cb-dry-run-diagnostic-v1",
  });

  const unresolved = first.plan.graphState.placements.find((item) => item.thoughtId === "synthetic-003");
  assert.deepEqual(unresolved, {
    namespace: "mindmap-graph-v1",
    workspace: "synthetic",
    thoughtId: "synthetic-003",
    revision: 1,
    kind: "unresolved",
    reason: "legacy_reference_damaged",
    updatedAt: "2026-07-25T00:05:00.000Z",
  });
  assert.equal(first.plan.graphState.links.find((item) => item.linkId === "legacy-link-1")?.status, "confirmed");
  assert.equal(first.plan.graphState.links.find((item) => item.linkId.startsWith("legacy-additional-placement:"))?.status, "proposed");
  assert.equal(first.plan.graphState.payloads.filter((item) => item.kind === "artifact-json").length, 5);

  for (const embedding of first.plan.graphState.embeddings) {
    const thought = first.plan.graphState.thoughts.find((item) => item.thoughtId === embedding.thoughtId);
    assert.equal(embedding.sourceTextContentHash, thought.textPayloadHash);
    const vector = first.plan.graphState.payloads.find((item) => item.contentHash === embedding.vectorPayloadHash);
    assert.equal(vector.byteLength, embedding.dimensions * 4);
  }

  assert.equal(first.plan.runCommits.length, 2);
  for (const commit of first.plan.runCommits) {
    assert.equal(commit.aggregate.status, "blocked");
    assert.equal(commit.aggregate.explicitBlock?.reason, "explicitly_blocked");
    assert.equal(commit.events.length, 2);
    assert.equal(commit.artifacts?.length, 1);
    const artifactPayload = first.plan.graphState.payloads.find((item) => item.contentHash === commit.artifacts[0].contentHash);
    assert.equal(artifactPayload?.kind, "artifact-json");
  }

  const graphStorage = new InMemoryGraphStorage({ hashCanonical, hashPayload });
  const graphCommit = await graphStorage.commit(first.plan.graphCommit);
  assert.equal(graphCommit.ok, true);
  assert.equal(graphCommit.receipt.stateContentHash, first.plan.graphContentHash);

  const runStorage = new InMemoryReferenceStorage(hashCanonical);
  for (const commit of first.plan.runCommits) assert.equal((await runStorage.commit(commit)).ok, true);
  const runSnapshot = await runStorage.exportSnapshot();
  assert.equal(runSnapshot.runs.length, 2);
  assert.equal(runSnapshot.artifacts.length, 2);

  const reordered = candidate();
  reordered.nodes.reverse();
  reordered.thoughts.reverse();
  reordered.links.reverse();
  reordered.runs.reverse();
  reordered.thoughts[1].additionalNodeIds?.reverse();
  const second = await planPhase2CbMapping(reordered, options);
  assert.equal(second.ok, true);
  assert.equal(second.plan.mappingContentHash, first.plan.mappingContentHash);
  assert.equal(canonicalJson(second.plan.graphCommit), canonicalJson(first.plan.graphCommit));
  assert.equal(canonicalJson(second.plan.runCommits), canonicalJson(first.plan.runCommits));
});

test("B0 typed stops reject unsafe or ambiguous input before mutation", async () => {
  await expectStop((value) => { value.source.databaseSha256 = "0".repeat(64); }, "source_hash_mismatch");
  await expectStop((value) => { value.source.sizeBytes += 1; }, "source_size_mismatch");
  await expectStop((value) => { value.source.sqliteHeaderValid = false; }, "source_schema_mismatch");
  await expectStop((value) => { value.source.integrityCheck = "corrupt"; }, "source_integrity_failed");
  await expectStop((value) => { value.source.personalThoughtCount = 1; }, "personal_data_present");
  await expectStop((value) => { value.target.workspace = "personal"; }, "workspace_mismatch");
  await expectStop((value) => { value.target.databaseName = "mindmap-state-core-v1"; }, "target_namespace_forbidden");
  await expectStop((value) => { value.target.isEmpty = false; }, "target_not_empty");
  await expectStop((value) => { value.nodes.push(clone(value.nodes[0])); value.source.nodeCount += 1; }, "duplicate_identity");
  await expectStop((value) => { value.thoughts[0].type = "Неизвестный legacy тип"; }, "ambiguous_mapping");
  await expectStop((value) => { value.thoughts[0].primaryNodeId = "missing"; delete value.thoughts[0].unresolved; value.source.unresolvedThoughtCount = 0; }, "invalid_reference");
  await expectStop((value) => { value.nodes.find((item) => item.id === "direction-1").parentId = "project-1"; }, "invalid_hierarchy");
  await expectStop((value) => { value.thoughts[0].embedding[0] = Number.NaN; }, "invalid_embedding");
  await expectStop((value) => { value.thoughts[0].createdAt = "yesterday"; }, "invalid_timestamp");
  await expectStop((value) => { value.source.thoughtCount += 1; }, "count_mismatch");
});

test("B0 exposes payload-kind collisions instead of silently changing hashes", async () => {
  await expectStop((value) => {
    value.nodes[0].name = value.thoughts[0].originalContent;
  }, "payload_conflict");
});

test("B0 source module has no database, IndexedDB, network, model, or runtime dependency", async () => {
  const { readFile } = await import("node:fs/promises");
  const source = await readFile(new URL("../migration/phase2cb-mapping.ts", import.meta.url), "utf8");
  assert.doesNotMatch(source, /node:sqlite|DatabaseSync|indexedDB|fetch\(|XMLHttpRequest|WebSocket|Ollama|Qwen|DeepSeek|app\/page|local-db/);
});
