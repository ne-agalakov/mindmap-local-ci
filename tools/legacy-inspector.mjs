#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const sha256 = (value) => createHash("sha256").update(value).digest("hex");

const stableJson = (value) => {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
};

const asObject = (value) => value && typeof value === "object" && !Array.isArray(value) ? value : {};
const asArray = (value) => Array.isArray(value) ? value : [];
const text = (value) => typeof value === "string" && value.length > 0 ? value : null;
const integer = (value) => Number.isInteger(value) ? value : null;
const boolean = (value) => typeof value === "boolean" ? value : null;

function eventRunId(event) {
  const input = asObject(event.input);
  const output = asObject(event.output);
  return text(input.runId) ?? text(output.runId);
}

function eventModel(event) {
  const input = asObject(event.input);
  const output = asObject(event.output);
  return text(event.model)
    ?? text(input.model)
    ?? text(input.ollamaModel)
    ?? text(input.semanticModel)
    ?? text(output.model)
    ?? text(output.ollamaModel)
    ?? text(output.semanticModel);
}

function eventStage(event) {
  const input = asObject(event.input);
  const output = asObject(event.output);
  return text(input.stage) ?? text(output.stage);
}

function eventPipelineVersion(event) {
  const input = asObject(event.input);
  const output = asObject(event.output);
  return text(input.pipelineVersion)
    ?? text(input.promptVersion)
    ?? text(output.pipelineVersion)
    ?? text(output.promptVersion);
}

function eventZeroModelCalls(event) {
  const input = asObject(event.input);
  const output = asObject(event.output);
  const recovery = asObject(output.recovery);
  return boolean(input.zeroModelCalls)
    ?? boolean(output.zeroModelCalls)
    ?? boolean(recovery.zeroModelCalls);
}

function eventCandidateCount(event) {
  const input = asObject(event.input);
  const output = asObject(event.output);
  return integer(output.candidateCount)
    ?? integer(input.candidateCount)
    ?? (Array.isArray(output.candidates) ? output.candidates.length : null);
}

function eventUnresolvedCounts(event) {
  const input = asObject(event.input);
  const output = asObject(event.output);
  const unresolvedThoughtCount = integer(input.unresolvedThoughtCount)
    ?? integer(output.unresolvedThoughtCount)
    ?? (Array.isArray(output.unresolvedThoughtIds) ? output.unresolvedThoughtIds.length : null);
  const unresolvedClusterCount = integer(input.unresolvedClusterCount)
    ?? integer(output.unresolvedClusterCount)
    ?? (Array.isArray(output.unresolvedClusterIds) ? output.unresolvedClusterIds.length : null);
  return { unresolvedThoughtCount, unresolvedClusterCount };
}

function sanitizeEvent(event, sourceIndex, sequence) {
  const input = asObject(event.input);
  const { unresolvedThoughtCount, unresolvedClusterCount } = eventUnresolvedCounts(event);
  return {
    sequence,
    sourceIndex,
    id: text(event.id),
    eventType: text(event.eventType) ?? "unknown",
    createdAt: text(event.createdAt),
    engine: text(event.engine),
    runId: eventRunId(event),
    stage: eventStage(event),
    model: eventModel(event),
    pipelineVersion: eventPipelineVersion(event),
    dataset: text(input.testDataset),
    orderVariant: text(input.orderVariant),
    resume: boolean(input.resume),
    zeroModelCalls: eventZeroModelCalls(event),
    candidateCount: eventCandidateCount(event),
    unresolvedThoughtCount,
    unresolvedClusterCount,
    eventSha256: sha256(stableJson(event)),
  };
}

function compareLegacyEvents(a, b) {
  const at = Date.parse(a.event.createdAt ?? "");
  const bt = Date.parse(b.event.createdAt ?? "");
  const av = Number.isFinite(at) ? at : Number.POSITIVE_INFINITY;
  const bv = Number.isFinite(bt) ? bt : Number.POSITIVE_INFINITY;
  return av - bv || a.sourceIndex - b.sourceIndex;
}

function summarizeRun(runId, events, configuredModel) {
  const started = events.filter((event) => event.eventType === "batch_started");
  const firstStart = started[0] ?? {};
  const terminal = [...events].reverse().find((event) =>
    ["batch_paused", "batch_failed", "batch_completed", "batch_continuation_blocked"].includes(event.eventType),
  ) ?? events.at(-1) ?? {};
  const models = [...new Set(events.map((event) => event.model).filter(Boolean))];
  const semanticModels = models.filter((model) => model !== "embeddinggemma");
  const runModel = semanticModels.at(-1) ?? null;
  const pipelineVersions = [...new Set(events.map((event) => event.pipelineVersion).filter(Boolean))];
  const blockEvents = events.filter((event) => event.eventType === "batch_continuation_blocked");
  const latestCandidateCount = [...events].reverse().map((event) => event.candidateCount).find(Number.isInteger) ?? null;
  const latestUnresolvedThoughtCount = [...events].reverse().map((event) => event.unresolvedThoughtCount).find(Number.isInteger) ?? null;
  const latestUnresolvedClusterCount = [...events].reverse().map((event) => event.unresolvedClusterCount).find(Number.isInteger) ?? null;
  const mismatch = Boolean(runModel && configuredModel && runModel !== configuredModel);
  const status = terminal.eventType === "batch_completed"
    ? "completed"
    : terminal.eventType === "batch_failed"
      ? "failed"
      : mismatch
        ? "blocked"
        : terminal.eventType === "batch_paused"
          ? "paused"
          : "unknown";

  return {
    runId,
    dataset: firstStart.dataset ?? null,
    orderVariant: firstStart.orderVariant ?? null,
    runModel,
    configuredModel: configuredModel ?? null,
    modelSet: semanticModels,
    modelAmbiguous: semanticModels.length > 1,
    pipelineVersions,
    firstEventSequence: events[0]?.sequence ?? null,
    lastEventSequence: events.at(-1)?.sequence ?? null,
    eventCount: events.length,
    currentStage: terminal.stage ?? null,
    terminalEventType: terminal.eventType ?? null,
    terminalCreatedAt: terminal.createdAt ?? null,
    candidateCount: latestCandidateCount,
    unresolvedThoughtCount: latestUnresolvedThoughtCount,
    unresolvedClusterCount: latestUnresolvedClusterCount,
    persistedContinuationBlock: blockEvents.length > 0,
    modelMismatch: mismatch,
    derivedGuard: mismatch
      ? {
          status: "blocked",
          reason: "run_model_mismatch",
          runModel,
          configuredModel,
          requiresContinuationClick: false,
          aiCallAllowed: false,
        }
      : {
          status: "compatible_or_unknown",
          reason: runModel && configuredModel ? "models_match" : "model_identity_incomplete",
          runModel,
          configuredModel: configuredModel ?? null,
          requiresContinuationClick: false,
          aiCallAllowed: false,
        },
    status,
  };
}

export function inspectLegacyDiagnostics(rawBytes, { configuredModel = null, sourceName = null } = {}) {
  if (!(rawBytes instanceof Uint8Array)) {
    throw new TypeError("rawBytes must be a Uint8Array");
  }
  let document;
  try {
    document = JSON.parse(new TextDecoder().decode(rawBytes));
  } catch (error) {
    throw new Error(`invalid legacy diagnostics JSON: ${error.message}`);
  }
  if (document?.format !== "mindmap-diagnostics" || !Array.isArray(document.aiDecisions)) {
    throw new Error("unsupported legacy diagnostics format");
  }

  const sourceEvents = document.aiDecisions.map((event, sourceIndex) => ({ event: asObject(event), sourceIndex }));
  const invalidTimestampSourceIndices = sourceEvents
    .filter(({ event }) => !Number.isFinite(Date.parse(event.createdAt ?? "")))
    .map(({ sourceIndex }) => sourceIndex);
  const ordered = [...sourceEvents].sort(compareLegacyEvents);
  const events = ordered.map(({ event, sourceIndex }, sequence) => sanitizeEvent(event, sourceIndex, sequence));

  const timestampGroups = new Map();
  for (const event of events) {
    if (!event.createdAt) continue;
    const group = timestampGroups.get(event.createdAt) ?? [];
    group.push(event.sequence);
    timestampGroups.set(event.createdAt, group);
  }
  const timestampTies = [...timestampGroups.entries()]
    .filter(([, sequences]) => sequences.length > 1)
    .map(([createdAt, sequences]) => ({ createdAt, sequences }));

  const byRun = new Map();
  for (const event of events) {
    if (!event.runId) continue;
    const runEvents = byRun.get(event.runId) ?? [];
    runEvents.push(event);
    byRun.set(event.runId, runEvents);
  }
  const runs = [...byRun.entries()].map(([runId, runEvents]) => summarizeRun(runId, runEvents, configuredModel));
  const activeRunId = text(document.syntheticTest?.runId) ?? runs.at(-1)?.runId ?? null;
  const activeRun = runs.find((run) => run.runId === activeRunId) ?? null;
  const activeRunEvents = activeRunId ? events.filter((event) => event.runId === activeRunId) : [];

  return {
    canonicalFormat: "mindmap-legacy-inspection",
    canonicalSchemaVersion: 1,
    source: {
      name: sourceName,
      sha256: sha256(rawBytes),
      sizeBytes: rawBytes.byteLength,
      format: document.format,
      schemaVersion: document.schemaVersion ?? null,
      appVersion: text(document.appVersion),
      semanticPipelineVersion: text(document.semanticPipelineVersion),
      exportedAt: text(document.exportedAt),
    },
    privacy: {
      originalThoughtTextsIncluded: false,
      rawModelResponsesIncluded: false,
      nodeLabelsIncluded: false,
      eventPayloadsIncluded: false,
      eventDigestsIncluded: true,
    },
    counts: {
      thoughts: asArray(document.thoughts).length,
      knowledgeNodes: asArray(document.knowledgeNodes).length,
      links: asArray(document.links).length,
      aiDecisions: sourceEvents.length,
      runs: runs.length,
    },
    ordering: {
      rule: "createdAt ASC, sourceIndex ASC",
      invalidTimestampSourceIndices,
      timestampTies,
      sourceOrderPreservedAsTieBreaker: true,
    },
    activeRunId,
    activeRun,
    runs,
    events: activeRunEvents,
    eventScope: "active-run-only",
    allEventDigestSha256: sha256(events.map((event) => event.eventSha256).join("\n")),
    evidence: {
      continuationBlockEventPresentForActiveRun: activeRun?.persistedContinuationBlock ?? false,
      immediateModelGuardDerivedWithoutClick: activeRun?.derivedGuard?.status === "blocked",
      legacySourceModified: false,
      networkOrModelCallPerformed: false,
    },
  };
}

async function main(argv) {
  const args = [...argv];
  const inputPath = args.shift();
  if (!inputPath) {
    throw new Error("usage: node tools/legacy-inspector.mjs <diagnostics.json> [--configured-model MODEL] [--output FILE]");
  }
  let configuredModel = null;
  let outputPath = null;
  while (args.length > 0) {
    const flag = args.shift();
    const value = args.shift();
    if (!value) throw new Error(`missing value for ${flag}`);
    if (flag === "--configured-model") configuredModel = value;
    else if (flag === "--output") outputPath = value;
    else throw new Error(`unknown option: ${flag}`);
  }
  const raw = await readFile(inputPath);
  const result = inspectLegacyDiagnostics(raw, { configuredModel, sourceName: inputPath.split(/[\\/]/).at(-1) });
  const serialized = `${JSON.stringify(result, null, 2)}\n`;
  if (outputPath) await writeFile(outputPath, serialized);
  else process.stdout.write(serialized);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
