#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { inspectLegacyDiagnostics } from "./legacy-inspector.mjs";

const decisiveTypes = new Set([
  "batch_started",
  "pipeline_preflight",
  "pipeline_cluster",
  "pipeline_hierarchy_plan",
  "pipeline_hierarchy",
  "pipeline_candidates",
  "batch_paused",
  "batch_failed",
  "batch_completed",
  "batch_continuation_blocked",
]);

export function projectStateMachineFixture(inspection) {
  const active = inspection.activeRun;
  if (!active) throw new Error("active run is absent");
  return {
    fixtureFormat: "mindmap-state-core-legacy-fixture",
    fixtureSchemaVersion: 1,
    source: inspection.source,
    privacy: inspection.privacy,
    counts: inspection.counts,
    ordering: inspection.ordering,
    allEventDigestSha256: inspection.allEventDigestSha256,
    activeRun: {
      runId: active.runId,
      dataset: active.dataset,
      orderVariant: active.orderVariant,
      runModel: active.runModel,
      configuredModel: active.configuredModel,
      pipelineVersions: active.pipelineVersions,
      currentStage: active.currentStage,
      terminalEventType: active.terminalEventType,
      terminalCreatedAt: active.terminalCreatedAt,
      candidateCount: active.candidateCount,
      unresolvedThoughtCount: active.unresolvedThoughtCount,
      unresolvedClusterCount: active.unresolvedClusterCount,
      persistedContinuationBlock: active.persistedContinuationBlock,
      derivedGuard: active.derivedGuard,
      status: active.status,
    },
    runSummaries: inspection.runs.map((run) => ({
      runId: run.runId,
      orderVariant: run.orderVariant,
      runModel: run.runModel,
      eventCount: run.eventCount,
      terminalEventType: run.terminalEventType,
      currentStage: run.currentStage,
      persistedContinuationBlock: run.persistedContinuationBlock,
    })),
    decisiveEvents: inspection.events
      .filter((event) => decisiveTypes.has(event.eventType))
      .map((event) => Object.fromEntries(Object.entries({
        sequence: event.sequence,
        sourceIndex: event.sourceIndex,
        eventType: event.eventType,
        createdAt: event.createdAt,
        engine: event.engine,
        stage: event.stage,
        model: event.model,
        pipelineVersion: event.pipelineVersion,
        resume: event.resume,
        zeroModelCalls: event.zeroModelCalls,
        candidateCount: event.candidateCount,
        unresolvedThoughtCount: event.unresolvedThoughtCount,
        unresolvedClusterCount: event.unresolvedClusterCount,
        eventSha256: event.eventSha256,
      }).filter(([, value]) => value !== null && value !== undefined))),
    evidence: inspection.evidence,
  };
}

async function main(argv) {
  const [inputPath, configuredModel, outputPath] = argv;
  if (!inputPath || !configuredModel || !outputPath) {
    throw new Error("usage: node tools/legacy-fixture-projector.mjs <diagnostics.json> <configured-model> <output.json>");
  }
  const raw = await readFile(inputPath);
  const inspection = inspectLegacyDiagnostics(raw, {
    configuredModel,
    sourceName: inputPath.split(/[\\/]/).at(-1),
  });
  const fixture = projectStateMachineFixture(inspection);
  await writeFile(outputPath, `${JSON.stringify(fixture, null, 2)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
