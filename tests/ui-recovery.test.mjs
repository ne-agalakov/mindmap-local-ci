import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("first paint does not flash demo thoughts before IndexedDB recovery", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(source, /useState<Thought\[\]>\(\[\]\)/);
  assert.match(source, /useState<ThoughtLink\[\]>\(\[\]\)/);
  assert.match(source, /useState<KnowledgeNode\[\]>\(\[\]\)/);
});

test("embedding work has a visible stage and persistent checkpoint event", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(source, /embeddings: "векторизация мыслей"/);
  assert.match(source, /pipelineDecision\(runId, "pipeline_embeddings"/);
});

test("a strict-model preflight runs before extraction and is checkpointed", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(source, /stage: "preflight"/);
  assert.match(source, /pipelineDecision\(\s*runId,\s*"pipeline_preflight"/);
  assert.match(source, /requiredCapability: "ollama_json_schema"/);
});

test("cluster work is checkpointed by batches and pause aborts the active request", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(source, /pipelineDecision\(runId, "pipeline_cluster_plan"/);
  assert.match(source, /pipelineDecision\(runId, "pipeline_cluster_assignment"/);
  assert.match(source, /activeBatchRequestRef\.current\?\.abort\(\)/);
  assert.doesNotMatch(source, /attempts=3/);
});

test("hierarchy work is split into a saved plan and cluster batches", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(source, /pipelineDecision\(runId, "pipeline_hierarchy_plan"/);
  assert.match(source, /pipelineDecision\(runId, "pipeline_hierarchy_assignment"/);
  assert.match(source, /offset \+= SEMANTIC_STAGE_LIMITS\.hierarchyAssignmentBatch/);
  assert.doesNotMatch(source, /stage: "hierarchy", clusters: clusterResponse\.clusters/);
});

test("DeepSeek is an explicit alternate launcher and cannot silently replace the active model", async () => {
  const deepseekLauncher = await readFile(new URL("../start-mindmap-deepseek.command", import.meta.url), "utf8");
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(deepseekLauncher, /OLLAMA_MODEL="deepseek-r1:8b"/);
  assert.match(source, /model_changed_during_run/);
  assert.match(source, /const key = `\$\{run\.model\}\|\$\{run\.pipelineVersion\}`/);
});

test("failed model runs can start a separate run in the same order without deleting history", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(source, /forceNewSameOrder/);
  assert.match(source, /Новый прогон на выбранной модели в том же порядке/);
  assert.match(source, /restart \? \[\] : sourceDecisions/);
});

test("hierarchy recovery is checkpointed and resumes before relations", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(source, /"pipeline_hierarchy_repair"/);
  assert.match(source, /stage: "hierarchy_repair"/);
  assert.match(source, /for \(let repairRound = restoredHierarchyRepairs\.length; repairRound < 2/);
  assert.match(source, /stillUncovered/);
});

test("a failed hierarchy exposes offline recovery before any new model request", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const start = source.indexOf("async function recoverFailedHierarchyOffline()");
  const end = source.indexOf("\n  function pauseSyntheticTest()", start);
  const handler = source.slice(start, end);
  assert.ok(start > 0 && end > start);
  assert.match(handler, /reconcileHierarchyCheckpoints/);
  assert.match(handler, /zeroModelCalls: true/);
  assert.doesNotMatch(handler, /requestSemanticStage|requestStage|fetch\("\/api\/semantic-pipeline"/);
  assert.match(handler, /problem\.reason === "unresolved_direction"/);
  assert.match(handler, /unresolvedClusterIds: built\.unresolvedClusterIds/);
  assert.match(handler, /primaryNodeId: placement\?\.primaryNodeId/);
  assert.match(handler, /"Не определено"/);
  assert.match(source, /Восстановить без AI/);
  assert.match(source, /Скачать диагностику/);
  assert.match(source, /offlineHierarchyReviewReady/);
  assert.match(source, /offline_hierarchy_recovered_for_review/);
});

test("REQ-OBS-001 covers every pipeline stage without resetting the timer on progress", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  for (const stage of ["preflight", "extract", "embeddings", "cluster", "hierarchy", "candidates", "relations", "complete"]) {
    assert.match(source, new RegExp(`${stage}: \\{`));
  }
  assert.match(source, /"Длительность этапа" : "Таймер этапа"/);
  assert.match(source, /не сохранена в старом checkpoint/);
  assert.match(source, /Последнее продвижение:/);
  assert.match(source, /Heartbeat:/);
  assert.match(source, /Модель:/);
  assert.match(source, /возможно, процесс завис/);
  assert.doesNotMatch(source, /StageElapsedTimer/);
  assert.doesNotMatch(source, /key=\{`\$\{batchProgress\.stage\}-\$\{batchProgress\.stageCompleted/);
});

test("offline review stays on hierarchy and states that candidates never started", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const start = source.indexOf("async function recoverFailedHierarchyOffline()");
  const end = source.indexOf("\n  function pauseSyntheticTest()", start);
  const handler = source.slice(start, end);
  assert.match(handler, /stage: "hierarchy"/);
  assert.doesNotMatch(handler, /stage: "candidates"/);
  assert.match(handler, /Численные кандидаты и связи не запускались/);
});

test("reload and model failures cannot trigger hidden AI retries", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(source, /autoResumeBatchRef/);
  assert.match(source, /Автоматический повтор отключён/);
  assert.match(source, /"pipeline_ai_call_planned"/);
  assert.match(source, /attempt: 1/);
  assert.match(source, /Повторных автоматических попыток нет/);
});

test("candidate calculation yields to the UI and exposes numeric pair progress", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(source, /selectSemanticCandidatesIncremental/);
  assert.match(source, /Проверено \$\{processedPairs\} из \$\{totalPairs\} численных пар/);
  assert.match(source, /modelLabel: "без AI"/);
  assert.match(source, /Рассчитать кандидатов без AI/);
  const handlerStart = source.indexOf("async function calculateCandidatesWithoutAi()");
  const handlerEnd = source.indexOf("\n  async function continueSyntheticTestWithConfirmation()", handlerStart);
  const handler = source.slice(handlerStart, handlerEnd);
  assert.match(handler, /assessOfflineCandidateCheckpoint/);
  assert.match(handler, /sourceCheckpoint: "offline_hierarchy_recovered_for_review"/);
  assert.match(handler, /unresolvedThoughtCount: assessment\.unresolvedThoughtCount/);
  assert.match(handler, /zeroModelCalls: true/);
  assert.match(handler, /"offline"/);
  assert.doesNotMatch(handler, /runSyntheticTest|requestSemanticStage|requestStage|fetch\(/);
  assert.match(handler, /userAction: "candidates_ready_for_review"/);
  assert.match(handler, /runtimeState: "paused"/);
  assert.match(handler, /AI-проверка связей не запускалась/);
  assert.equal(source.match(/userAction: "candidates_ready_for_review"/g)?.length, 1);
  assert.match(source, /Следующий этап отправит сохранённые пары модели/);
});

test("the paused 82 percent hierarchy is explicitly labeled as completed, not stalled", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(source, /82% — иерархия завершена/);
  assert.match(source, /намеренная пауза/);
  assert.match(source, /а не зависание/);
});

test("offline pipeline decisions cannot be mislabeled as ollama", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(source, /engine: PersistedAiDecision\["engine"\] = "ollama"/);
  assert.match(source, /model: engine === "ollama" \? model : undefined/);
  assert.match(source, /computed_offline_without_model/);
});

test("map renders structural and proposed semantic edges and exports the full graph", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(source, /buildMapGraph/);
  assert.match(source, /Экспорт карты/);
  assert.match(source, /exportFullMap\("svg"\)/);
  assert.match(source, /exportFullMap\("png"\)/);
  assert.match(source, /PNG · до 6144 px/);
  const observationStyles = styles.slice(
    styles.indexOf(".map-export-observation {"),
    styles.indexOf(".map-export-observation .operation-observability"),
  );
  assert.match(observationStyles, /position: fixed/);
  assert.match(observationStyles, /bottom: 176px/);
  assert.match(observationStyles, /align-items: flex-start/);
});


test("checkpoint restore derives work type and model from the checkpoint, not the last historical model", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const state = await readFile(new URL("../app/lib/batch-run-state.ts", import.meta.url), "utf8");
  assert.match(source, /restoreCheckpointExecutionContext/);
  assert.match(source, /workKind: checkpointExecution\.workKind/);
  assert.match(source, /modelLabel: checkpointExecution\.modelLabel/);
  assert.match(state, /terminalInput\?\.zeroModelCalls === true/);
  assert.match(state, /stage === "candidates"/);
  assert.match(state, /modelLabel: "без AI"/);
});

test("candidate continuation verifies the configured model before any AI POST", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const route = await readFile(new URL("../app/api/semantic-pipeline/route.ts", import.meta.url), "utf8");
  const start = source.indexOf("async function continueSyntheticTestWithConfirmation()");
  const end = source.indexOf("\n  function saveAnalysisReview", start);
  const handler = source.slice(start, end);
  assert.match(handler, /requestConfiguredSemanticModel/);
  assert.match(handler, /configured\.model !== runModel/);
  assert.match(handler, /AI-вызов не выполнен/);
  assert.ok(handler.indexOf("requestConfiguredSemanticModel") < handler.indexOf("runSyntheticTest(false)"));
  assert.match(route, /export function GET\(\)/);
});

test("a blocked candidate continuation cannot be clicked repeatedly and exposes a clean-run path", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(source, /eventType: "batch_continuation_blocked"/);
  assert.match(source, /zeroModelCalls: true/);
  assert.match(source, /Продолжение заблокировано/);
  assert.match(source, /disabled aria-disabled="true"/);
  assert.match(source, /Новый чистый run на/);
  assert.match(source, /История прежнего run сохранится/);
});
