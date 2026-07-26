import assert from "node:assert/strict";
import test from "node:test";
import {
  assessOfflineCandidateCheckpoint,
  pipelineProgressPercent,
  restoreBatchProgress,
  restoreCheckpointExecutionContext,
  shouldAutoResumeBatch,
} from "../app/lib/batch-run-state.ts";

const decision = (eventType, runId, input = {}, output = undefined) => ({
  id: `${eventType}-${Math.random()}`,
  eventType,
  createdAt: new Date().toISOString(),
  engine: "ollama",
  input: { runId, ...input },
  output,
});

test("restores 12/96 and the panel after a reload during extraction", () => {
  const runId = "v06-run-01";
  const progress = restoreBatchProgress([
    decision("batch_started", runId, { orderVariant: "round_robin" }),
    decision("pipeline_extract", runId, {}, {
      items: Array.from({ length: 12 }, (_, index) => ({ thoughtId: `synthetic-${index + 1}` })),
    }),
  ], 96);

  assert.equal(progress.status, "paused");
  assert.equal(progress.completed, 12);
  assert.equal(progress.stage, "extract");
  assert.equal(progress.runId, runId);
  assert.equal(progress.orderVariant, "round_robin");
  assert.equal(progress.interruptedByReload, true);
});

test("counts unique extracted thoughts across saved chunks", () => {
  const runId = "v06-run-01";
  const progress = restoreBatchProgress([
    decision("batch_started", runId),
    decision("pipeline_extract", runId, {}, { items: [{ thoughtId: "synthetic-1" }, { thoughtId: "synthetic-2" }] }),
    decision("pipeline_extract", runId, {}, { items: [{ thoughtId: "synthetic-2" }, { thoughtId: "synthetic-3" }] }),
  ], 96);
  assert.equal(progress.completed, 3);
});

test("restores a fresh run at the model preflight before any expensive stage", () => {
  const runId = "v06-run-01";
  const progress = restoreBatchProgress([
    decision("batch_started", runId),
  ], 96);
  assert.equal(progress.stage, "preflight");
  assert.equal(pipelineProgressPercent(progress), 0);
});

test("moves visibly to embeddings after all 96 extractions", () => {
  const runId = "v06-run-01";
  const progress = restoreBatchProgress([
    decision("batch_started", runId),
    decision("pipeline_extract", runId, {}, {
      items: Array.from({ length: 96 }, (_, index) => ({ thoughtId: `synthetic-${index + 1}` })),
    }),
  ], 96);
  assert.equal(progress.stage, "embeddings");
  assert.equal(progress.stageCompleted, 0);
  assert.equal(progress.stageTotal, 96);
  assert.equal(pipelineProgressPercent(progress), 45);
});

test("restores persisted embedding progress instead of recomputing it after F5", () => {
  const runId = "v06-run-01";
  const progress = restoreBatchProgress([
    decision("batch_started", runId),
    decision("pipeline_extract", runId, {}, {
      items: Array.from({ length: 96 }, (_, index) => ({ thoughtId: `synthetic-${index + 1}` })),
    }),
    decision("pipeline_embeddings", runId, {}, {
      embeddings: Object.fromEntries(Array.from({ length: 48 }, (_, index) => [`synthetic-${index + 1}`, [index, 1]])),
    }),
  ], 96);
  assert.equal(progress.stage, "embeddings");
  assert.equal(progress.stageCompleted, 48);
  assert.equal(progress.stageTotal, 96);
  assert.equal(pipelineProgressPercent(progress), 50);
});

test("moves from 96 saved embeddings to resumable cluster assignment progress", () => {
  const runId = "v06-run-01";
  const allEmbeddings = Object.fromEntries(Array.from({ length: 96 }, (_, index) => [`synthetic-${index + 1}`, [index, 1]]));
  const progress = restoreBatchProgress([
    decision("batch_started", runId),
    decision("pipeline_extract", runId, {}, {
      items: Array.from({ length: 96 }, (_, index) => ({ thoughtId: `synthetic-${index + 1}` })),
    }),
    decision("pipeline_embeddings", runId, {}, { embeddings: allEmbeddings }),
    decision("pipeline_cluster_plan", runId, {}, { clusters: [{ id: "a" }, { id: "b" }] }),
    decision("pipeline_cluster_assignment", runId, {}, {
      assignments: Array.from({ length: 24 }, (_, index) => ({ thoughtId: `synthetic-${index + 1}`, clusterId: "a" })),
    }),
  ], 96);
  assert.equal(progress.stage, "cluster");
  assert.equal(progress.stageCompleted, 24);
  assert.equal(progress.stageTotal, 96);
  assert.equal(pipelineProgressPercent(progress), 58.75);
});

test("restores hierarchy assignment progress by cluster checkpoints", () => {
  const runId = "v06-run-01";
  const clusters = Array.from({ length: 10 }, (_, index) => ({ id: `cluster-${index + 1}` }));
  const progress = restoreBatchProgress([
    decision("batch_started", runId),
    decision("pipeline_cluster", runId, {}, { clusters }),
    decision("pipeline_hierarchy_plan", runId, {}, { nodes: [{ id: "area" }, { id: "direction" }] }),
    decision("pipeline_hierarchy_assignment", runId, {}, {
      assignments: clusters.slice(0, 4).map((cluster) => ({ clusterId: cluster.id, directionId: "direction" })),
    }),
  ], 96);
  assert.equal(progress.stage, "hierarchy");
  assert.equal(progress.stageCompleted, 4);
  assert.equal(progress.stageTotal, 10);
  assert.ok(pipelineProgressPercent(progress) > 70);
});

test("restores a failed alpha.12 hierarchy at the repairable hierarchy stage", () => {
  const runId = "deepseek-original";
  const clusters = [{ id: "home" }, { id: "video" }];
  const decisions = [
    decision("batch_started", runId, { orderVariant: "original" }),
    decision("pipeline_cluster", runId, {}, { clusters }),
    decision("pipeline_hierarchy_plan", runId, {}, { nodes: [{ id: "area" }, { id: "direction" }] }),
    decision("pipeline_hierarchy_assignment", runId, {}, {
      assignments: [
        { clusterId: "home", directionId: undefined },
        { clusterId: "video", directionId: "direction" },
      ],
    }),
    decision("batch_failed", runId, {}, { error: "Каркас не покрывает часть кластеров без искусственного размещения." }),
  ];
  const progress = restoreBatchProgress(decisions, 96);
  assert.equal(progress.status, "failed");
  assert.equal(progress.stage, "hierarchy");
  assert.equal(progress.runId, runId);
  assert.equal(progress.orderVariant, "original");
});

test("restores the latest run without mixing earlier completed runs", () => {
  const progress = restoreBatchProgress([
    decision("batch_started", "run-1"),
    decision("pipeline_extract", "run-1", {}, { items: [{ thoughtId: "synthetic-1" }] }),
    decision("batch_completed", "run-1"),
    decision("batch_started", "run-2", { orderVariant: "original" }),
    decision("pipeline_extract", "run-2", {}, { items: [{ thoughtId: "synthetic-9" }] }),
  ], 96);
  assert.equal(progress.runId, "run-2");
  assert.equal(progress.completed, 1);
  assert.equal(progress.status, "paused");
});

test("preserves a saved failure and its reason", () => {
  const runId = "v06-run-01";
  const progress = restoreBatchProgress([
    decision("batch_started", runId),
    decision("batch_failed", runId, {}, { error: "ollama_unavailable" }),
  ], 96);
  assert.equal(progress.status, "failed");
  assert.equal(progress.error, "ollama_unavailable");
  assert.equal(progress.interruptedByReload, undefined);
});

test("a later resume supersedes an earlier failure for the same run", () => {
  const runId = "v06-run-01";
  const progress = restoreBatchProgress([
    decision("batch_started", runId),
    decision("pipeline_extract", runId, {}, { items: [{ thoughtId: "synthetic-1" }] }),
    decision("batch_failed", runId, {}, { error: "old_error" }),
    decision("batch_started", runId, { resume: true }),
  ], 96);
  assert.equal(progress.status, "paused");
  assert.equal(progress.completed, 1);
  assert.equal(progress.interruptedByReload, true);
  assert.equal(progress.error, undefined);
});

test("alpha.7 hierarchy failure resumes from saved clusters without repeating 96 thoughts", () => {
  const runId = "v06-run-alpha7";
  const progress = restoreBatchProgress([
    decision("batch_started", runId, { orderVariant: "round_robin", pipelineVersion: "0.6.0-alpha.7" }),
    decision("pipeline_extract", runId, {}, {
      items: Array.from({ length: 96 }, (_, index) => ({ thoughtId: `synthetic-${index + 1}` })),
    }),
    decision("pipeline_embeddings", runId, {}, {
      embeddings: Object.fromEntries(Array.from({ length: 96 }, (_, index) => [`synthetic-${index + 1}`, [index, 1]])),
    }),
    decision("pipeline_cluster", runId, {}, {
      clusters: [{ id: "home" }, { id: "work" }],
    }),
    decision("batch_failed", runId, { stage: "hierarchy" }, { error: "invalid_model_json" }),
    decision("batch_started", runId, { resume: true, pipelineVersion: "0.6.0-alpha.8" }),
  ], 96);

  assert.equal(progress.status, "paused");
  assert.equal(progress.completed, 96);
  assert.equal(progress.stage, "hierarchy");
  assert.equal(progress.stageCompleted, 0);
  assert.equal(progress.stageTotal, 2);
});

test("returns idle when no run exists", () => {
  assert.deepEqual(restoreBatchProgress([], 96), { status: "idle", completed: 0, total: 96 });
});

test("never automatically resumes a run after reload or pause", () => {
  assert.equal(shouldAutoResumeBatch({
    status: "paused",
    completed: 12,
    total: 96,
    runId: "run-1",
    interruptedByReload: true,
  }), false);
  assert.equal(shouldAutoResumeBatch({
    status: "paused",
    completed: 12,
    total: 96,
    runId: "run-1",
    interruptedByReload: false,
  }), false);
  assert.equal(shouldAutoResumeBatch({ status: "completed", completed: 96, total: 96 }), false);
});

test("offline hierarchy review remains paused at hierarchy and does not impersonate candidates", () => {
  const runId = "alpha15-offline-review";
  const progress = restoreBatchProgress([
    decision("batch_started", runId, { orderVariant: "original" }),
    decision("pipeline_cluster", runId, {}, { clusters: [{ id: "c1" }, { id: "c2" }] }),
    decision("pipeline_hierarchy", runId, {}, {
      nodes: [],
      placements: [],
      unresolvedThoughtIds: ["synthetic-15"],
    }),
    decision("batch_paused", runId, { stage: "hierarchy" }, {
      message: "Иерархия восстановлена; кандидаты не запускались.",
    }),
  ], 96);

  assert.equal(progress.status, "paused");
  assert.equal(progress.stage, "hierarchy");
  assert.equal(progress.awaitingConfirmation, true);
  assert.match(progress.error, /кандидаты не запускались/);
});

test("locally calculated candidates remain paused before AI relations", () => {
  const runId = "candidate-review";
  const progress = restoreBatchProgress([
    decision("batch_started", runId, { orderVariant: "original" }),
    decision("pipeline_hierarchy", runId, {}, { nodes: [], placements: [] }),
    decision("pipeline_candidates", runId, {}, { candidates: [{ sourceId: "a", targetId: "b" }] }),
    decision("batch_paused", runId, { stage: "candidates", zeroModelCalls: true }, {
      message: "Кандидаты рассчитаны. AI-проверка не запускалась.",
    }),
  ], 96);

  assert.equal(progress.status, "paused");
  assert.equal(progress.stage, "candidates");
  assert.equal(progress.awaitingConfirmation, true);
  assert.match(progress.error, /AI-проверка не запускалась/);
});

test("an unresolved thought does not block offline candidates after a confirmed hierarchy pause", () => {
  const runId = "alpha17-unresolved-offline";
  const embeddings = Object.fromEntries(
    Array.from({ length: 96 }, (_, index) => [`synthetic-${index + 1}`, [index, 1]]),
  );
  const checkpoint = [
    decision("batch_started", runId, { orderVariant: "original" }),
    decision("pipeline_embeddings", runId, {}, { embeddings }),
    {
      ...decision("pipeline_hierarchy", runId, {}, {
        nodes: [],
        placements: [],
        unresolvedThoughtIds: ["synthetic-96"],
      }),
      engine: "offline",
    },
    {
      ...decision("batch_paused", runId, { stage: "hierarchy", zeroModelCalls: true }, {
        message: "Иерархия восстановлена без AI.",
      }),
      engine: "offline",
      userAction: "offline_hierarchy_recovered_for_review",
    },
  ];

  const assessment = assessOfflineCandidateCheckpoint(checkpoint, runId, 96);

  assert.equal(assessment.ready, true);
  assert.equal(assessment.embeddingCount, 96);
  assert.equal(assessment.unresolvedThoughtCount, 1);
});

test("offline candidates refuse an incomplete embedding checkpoint without invoking a model", () => {
  const runId = "alpha17-incomplete-embeddings";
  const checkpoint = [
    decision("batch_started", runId, { orderVariant: "original" }),
    decision("pipeline_embeddings", runId, {}, {
      embeddings: { "synthetic-1": [1, 0] },
    }),
    {
      ...decision("pipeline_hierarchy", runId, {}, {
        nodes: [],
        placements: [],
        unresolvedThoughtIds: ["synthetic-96"],
      }),
      engine: "offline",
    },
    {
      ...decision("batch_paused", runId, { stage: "hierarchy", zeroModelCalls: true }),
      engine: "offline",
      userAction: "offline_hierarchy_recovered_for_review",
    },
  ];

  const assessment = assessOfflineCandidateCheckpoint(checkpoint, runId, 96);

  assert.equal(assessment.ready, false);
  assert.equal(assessment.reason, "incomplete_embeddings");
  assert.equal(assessment.embeddingCount, 1);
});


test("restored offline candidates never inherit a historical Qwen label", () => {
  const runId = "qwen-offline-candidates";
  const decisions = [
    { ...decision("pipeline_preflight", runId, {}, { ok: true }), model: "qwen3:8b" },
    { ...decision("pipeline_candidates", runId, {}, { candidates: [] }), engine: "offline", model: undefined },
    {
      ...decision("batch_paused", runId, { stage: "candidates", zeroModelCalls: true }, { message: "ready" }),
      engine: "offline",
      model: undefined,
      userAction: "candidates_ready_for_review",
    },
  ];
  assert.deepEqual(restoreCheckpointExecutionContext(decisions, runId, "candidates"), {
    workKind: "local",
    modelLabel: "без AI",
  });
});

test("restored offline hierarchy never inherits a historical model label", () => {
  const runId = "qwen-offline-hierarchy";
  const decisions = [
    { ...decision("pipeline_preflight", runId, {}, { ok: true }), model: "qwen3:8b" },
    {
      ...decision("batch_paused", runId, { stage: "hierarchy", zeroModelCalls: true }, { message: "review" }),
      engine: "offline",
      model: undefined,
      userAction: "offline_hierarchy_recovered_for_review",
    },
  ];
  assert.deepEqual(restoreCheckpointExecutionContext(decisions, runId, "hierarchy"), {
    workKind: "local",
    modelLabel: "без AI",
  });
});

test("restored AI checkpoints retain their run model and AI work type", () => {
  const runId = "qwen-extract";
  const decisions = [
    { ...decision("pipeline_preflight", runId, {}, { ok: true }), model: "qwen3:8b" },
  ];
  assert.deepEqual(restoreCheckpointExecutionContext(decisions, runId, "extract"), {
    workKind: "ai",
    modelLabel: "qwen3:8b",
  });
});


test("an AI-stage failure is not mislabeled as offline merely because the journal event uses engine offline", () => {
  const runId = "qwen-ai-failure";
  const decisions = [
    { ...decision("pipeline_preflight", runId, {}, { ok: true }), model: "qwen3:8b" },
    {
      ...decision("batch_failed", runId, { stage: "relations" }, { error: "invalid_model_json" }),
      engine: "offline",
      model: undefined,
      userAction: "pipeline_stopped_without_partial_map",
    },
  ];
  assert.deepEqual(restoreCheckpointExecutionContext(decisions, runId, "relations"), {
    workKind: "ai",
    modelLabel: "qwen3:8b",
  });
});

test("persists a model mismatch block across reload without changing the paused candidate stage", () => {
  const runId = "qwen-candidate-review";
  const progress = restoreBatchProgress([
    decision("batch_started", runId, { orderVariant: "original" }),
    decision("pipeline_candidates", runId, {}, { candidates: [{ sourceId: "a", targetId: "b" }] }),
    decision("batch_paused", runId, { stage: "candidates", zeroModelCalls: true }, {
      message: "Кандидаты рассчитаны. AI-проверка не запускалась.",
    }),
    decision("batch_continuation_blocked", runId, {
      stage: "candidates",
      code: "model_mismatch",
      savedRunModel: "qwen3:8b",
      configuredModel: "deepseek-r1:8b",
      zeroModelCalls: true,
    }, {
      message: "AI-вызов не выполнен.",
    }),
  ], 96);

  assert.equal(progress.status, "paused");
  assert.equal(progress.stage, "candidates");
  assert.deepEqual(progress.continuationBlock, {
    code: "model_mismatch",
    runModel: "qwen3:8b",
    configuredModel: "deepseek-r1:8b",
  });
  assert.equal(progress.error, "AI-вызов не выполнен.");
});
