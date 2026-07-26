import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  inspectRun,
  startCleanRunFromRuntimeGuard,
} from "../state-core/index.ts";

test("exact paused Alpha.19 run can create a separate clean DeepSeek run without mutating history", async () => {
  const fixture = JSON.parse(await readFile(
    new URL("../fixtures/legacy/browser-database-inspection.json", import.meta.url),
    "utf8",
  ));
  const historical = {
    identity: {
      runId: fixture.activeRun.runId,
      workspace: "synthetic",
      datasetId: fixture.activeRun.dataset,
      orderVariant: fixture.activeRun.orderVariant,
      semanticModel: fixture.activeRun.runModel,
      embeddingModel: "embeddinggemma",
      pipelineVersion: fixture.activeRun.pipelineVersions.at(-1),
      buildId: "legacy-alpha19",
      storageSchema: "legacy-sqljs-v060",
    },
    status: "paused",
    stage: fixture.activeRun.currentStage,
    revision: fixture.database.tables.aiDecisions,
    attempts: [],
    completedStages: ["preflight", "extraction", "embeddings", "clustering", "hierarchy", "projects_and_placement", "candidates"],
  };
  const runtime = {
    configuredSemanticModel: fixture.activeRun.configuredModel,
    configuredEmbeddingModel: "embeddinggemma",
    buildId: "phase1-build-deepseek",
    storageSchema: "mindmap-state-core-v1",
    supportedPipelineVersions: ["state-core-v1"],
    compatibleSourceBuildIds: [],
  };

  const before = structuredClone(historical);
  const inspection = inspectRun(historical, {
    ...runtime,
    storageSchema: "legacy-sqljs-v060",
    supportedPipelineVersions: [fixture.activeRun.pipelineVersions.at(-1)],
    compatibleSourceBuildIds: ["legacy-alpha19"],
  });
  assert.equal(inspection.effectiveStatus, "blocked");
  assert.equal(inspection.block?.reason, "run_model_mismatch");

  const result = startCleanRunFromRuntimeGuard(historical, {
    runId: "deepseek-clean-original",
    workspace: "synthetic",
    datasetId: fixture.activeRun.dataset,
    orderVariant: fixture.activeRun.orderVariant,
    semanticModel: "deepseek-r1:8b",
    embeddingModel: "embeddinggemma",
    pipelineVersion: "state-core-v1",
    buildId: "phase1-build-deepseek",
    storageSchema: "mindmap-state-core-v1",
  }, "preflight", runtime, {
    commandId: "create-clean-deepseek",
    occurredAt: "2026-07-25T15:30:00.000Z",
    expectedRevision: historical.revision,
  });

  assert.equal(result.ok, true, result.ok ? undefined : result.rejection.message);
  assert.equal(result.aggregate.status, "created");
  assert.equal(result.aggregate.identity.runId, "deepseek-clean-original");
  assert.equal(result.aggregate.identity.semanticModel, "deepseek-r1:8b");
  assert.deepEqual(historical, before, "historical run must remain byte-equivalent in memory");
});

test("clean run from runtime guard rejects a compatible unblocked historical run", () => {
  const historical = {
    identity: {
      runId: "compatible-run",
      workspace: "synthetic",
      datasetId: "approved-96-v1",
      orderVariant: "original",
      semanticModel: "qwen3:8b",
      embeddingModel: "embeddinggemma",
      pipelineVersion: "state-core-v1",
      buildId: "build-a",
      storageSchema: "mindmap-state-core-v1",
    },
    status: "paused",
    stage: "candidates",
    revision: 7,
    attempts: [],
    completedStages: [],
  };
  const runtime = {
    configuredSemanticModel: "qwen3:8b",
    configuredEmbeddingModel: "embeddinggemma",
    buildId: "build-a",
    storageSchema: "mindmap-state-core-v1",
    supportedPipelineVersions: ["state-core-v1"],
    compatibleSourceBuildIds: [],
  };
  const result = startCleanRunFromRuntimeGuard(historical, {
    ...historical.identity,
    runId: "unnecessary-clean-run",
  }, "preflight", runtime, {
    commandId: "unnecessary",
    occurredAt: "2026-07-25T15:31:00.000Z",
    expectedRevision: historical.revision,
  });
  assert.equal(result.ok, false);
  assert.equal(result.rejection.code, "invalid_transition");
});
