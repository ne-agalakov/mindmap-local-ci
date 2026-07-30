import { canonicalJson } from "../storage/canonical-json.ts";
import { planPhase2CbMapping } from "./phase2cb-mapping.ts";
import {
  PHASE2CB_B1_TEMP_DATABASE_PREFIX,
} from "./phase2cb-b1a-contracts.ts";
import {
  PHASE2CB_B1B_AUTHORIZATION_ID,
  PHASE2CB_B1B_DIAGNOSTIC_SCHEMA,
  PHASE2CB_B1B_HARNESS_VERSION,
  type Phase2CbB1bExecutorOptions,
  type Phase2CbB1bRunManifest,
  type Phase2CbB1bSingleRunEvidence,
  type Phase2CbB1bSingleRunResult,
  type Phase2CbB1bStop,
} from "./phase2cb-b1b-contracts.ts";
import {
  HEX_64,
  Observer,
  safeRunId,
  sourceSnapshotsEqual,
} from "./phase2cb-b1a-runtime.ts";

function b1bStop(code: Phase2CbB1bStop["code"], message: string, details?: Phase2CbB1bStop["details"], mappingStopCode?: string): Phase2CbB1bStop {
  return Object.freeze({ code, message, details, mappingStopCode });
}

function manifest(runId: string, databaseName: string, exact: boolean): Phase2CbB1bRunManifest {
  return Object.freeze({
    schema: PHASE2CB_B1B_DIAGNOSTIC_SCHEMA,
    harnessVersion: PHASE2CB_B1B_HARNESS_VERSION,
    authorizationId: PHASE2CB_B1B_AUTHORIZATION_ID,
    runId,
    executionMode: exact ? "b1b-exact-source-readonly" : "b1b-sanitized-rehearsal",
    targetDatabaseName: databaseName,
    modelMode: "без AI",
    retryPolicy: "new-explicit-confirmation-required",
    automaticRetryAllowed: false,
    exactSourceAccessAllowed: true,
    actualMigrationAllowed: false,
    manifestFrozenBeforeOpen: true,
  });
}

async function portablePlanHash(
  plan: Readonly<{
    mappingVersion: string;
    source: unknown;
    graphContentHash: string;
    runCommits: unknown;
    diagnostics: unknown;
    rollbackContract: unknown;
  }>,
  hashCanonical: Phase2CbB1bExecutorOptions["hashCanonical"],
): Promise<string> {
  return hashCanonical(canonicalJson({
    mappingVersion: plan.mappingVersion,
    source: plan.source,
    graphContentHash: plan.graphContentHash,
    runCommits: plan.runCommits,
    diagnostics: plan.diagnostics,
    rollbackContract: plan.rollbackContract,
  }));
}

export async function singleB1bRun(
  options: Phase2CbB1bExecutorOptions,
  suffix: "first" | "second" | "rollback",
  injectFailure: boolean,
): Promise<Phase2CbB1bSingleRunResult> {
  const now = options.now ?? Date.now;
  const observer = new Observer(
    now,
    options.observe,
    options.heartbeatIntervalMs,
    options.possiblyHungThresholdMs,
  );
  const safeId = safeRunId(options.runId);
  const targetDatabaseName = `${PHASE2CB_B1_TEMP_DATABASE_PREFIX}${safeId}-${suffix}`;
  const runManifest = manifest(`${safeId}-${suffix}`, targetDatabaseName, options.source.sourceKind === "exact-source");
  let sourceBefore = { exists: false, sizeBytes: 0, sha256: "" };
  let sourceAfter = sourceBefore;
  let logicalSourceSha256 = "";
  let mappingVersion = "";
  let mappingContentHash = "";
  let portableHash = "";
  let targetSnapshotHash: string | undefined;
  let targetDeletedAfterEvidence = false;
  let rollbackTargetEmpty: boolean | undefined;
  let runCountCommitted = 0;
  let graphCommitted = false;
  let target: Awaited<ReturnType<typeof options.targetFactory.create>> | undefined;

  const evidence = (): Phase2CbB1bSingleRunEvidence => Object.freeze({
    manifest: runManifest,
    sourceSnapshotBefore: sourceBefore,
    sourceSnapshotAfter: sourceAfter,
    sourceUnchanged: sourceSnapshotsEqual(sourceBefore, sourceAfter),
    logicalSourceSha256,
    mappingVersion,
    mappingContentHash,
    portablePlanHash: portableHash,
    targetSnapshotHash,
    targetDeletedAfterEvidence,
    rollbackTargetEmpty,
    runCountCommitted,
    graphCommitted,
    networkCalls: options.boundaryCounters().networkCalls,
    modelCalls: options.boundaryCounters().modelCalls,
    observations: Object.freeze([...observer.trace]),
  });

  const fail = async (failure: Phase2CbB1bStop): Promise<Phase2CbB1bSingleRunResult> => {
    try {
      await observer.run(
        "cleanup",
        "local",
        "working",
        async () => {
          await target?.close();
          await options.targetFactory.destroy(targetDatabaseName);
        },
        { message: "Deleting isolated target after stop." },
      );
      targetDeletedAfterEvidence = true;
      rollbackTargetEmpty = !(await options.targetFactory.exists(targetDatabaseName));
      if (!rollbackTargetEmpty) {
        failure = b1bStop("rollback_failure", "Isolated target still exists after rollback cleanup.", {
          targetDatabaseName,
          originalStop: failure.code,
        });
      }
    } catch (error) {
      rollbackTargetEmpty = false;
      failure = b1bStop("rollback_failure", error instanceof Error ? error.message : String(error), {
        targetDatabaseName,
        originalStop: failure.code,
      });
    }
    sourceAfter = await options.source.snapshot().catch(() => sourceAfter);
    observer.emit("complete", "validating", "stopped", { message: failure.code });
    return { ok: false, stop: failure, evidence: evidence() };
  };

  try {
    observer.emit("freeze_manifest", "local", "working");
    if (options.source.authorizationId !== PHASE2CB_B1B_AUTHORIZATION_ID) {
      return fail(b1bStop("authorization_missing", "B1b one-shot authorization is missing."));
    }
    if (!options.source.manifestFrozenBeforeOpen) {
      return fail(b1bStop("manifest_not_frozen", "B1b manifest was not frozen before source access."));
    }
    if (options.source.sourceKind === "exact-source" && !options.source.exactSourceOpened) {
      return fail(b1bStop("exact_source_not_opened", "Exact-source B1b adapter did not prove read-only source opening."));
    }

    observer.emit("offline_preflight", "validating", "validating");
    const initialCounters = options.boundaryCounters();
    if (initialCounters.networkCalls !== 0) return fail(b1bStop("network_path_detected", "Network counter is non-zero before B1b."));
    if (initialCounters.modelCalls !== 0) return fail(b1bStop("model_call_detected", "Model counter is non-zero before B1b."));

    sourceBefore = await observer.run(
      "source_snapshot_before",
      "local",
      "working",
      async () => options.source.snapshot(),
    );
    if (!sourceBefore.exists || !HEX_64.test(sourceBefore.sha256)) {
      return fail(b1bStop("source_not_found", "Prepared B1b source is absent or has no valid SHA-256."));
    }

    const extractedCandidate = await observer.run(
      "read_only_extraction",
      "local",
      "working",
      async () => options.source.readCandidate(),
    );
    const candidate = {
      ...extractedCandidate,
      target: {
        databaseName: targetDatabaseName,
        workspace: "synthetic" as const,
        mode: "isolated-temporary" as const,
        isEmpty: true,
        isTargetMacProduction: false as const,
      },
    };
    logicalSourceSha256 = candidate.source.databaseSha256;

    const planned = await observer.run(
      "deterministic_planning",
      "validating",
      "validating",
      async () => planPhase2CbMapping(candidate, options.mappingOptions),
    );
    if ("stop" in planned) {
      return fail(b1bStop("mapping_stopped", planned.stop.message, planned.stop.details, planned.stop.code));
    }
    mappingVersion = planned.plan.mappingVersion;
    mappingContentHash = planned.plan.mappingContentHash;
    portableHash = await observer.run(
      "deterministic_planning",
      "validating",
      "validating",
      async () => portablePlanHash(planned.plan, options.hashCanonical),
      { message: "Computing target-independent portable plan hash." },
    );
    if (!HEX_64.test(portableHash)) {
      return fail(b1bStop("verification_failure", "Portable plan hasher returned an invalid digest."));
    }

    const targetExists = await observer.run(
      "target_freshness",
      "validating",
      "validating",
      async () => options.targetFactory.exists(targetDatabaseName),
    );
    if (targetExists) {
      return fail(b1bStop("target_namespace_not_fresh", "B1b target namespace already exists.", { targetDatabaseName }));
    }

    target = await observer.run(
      "target_creation",
      "saving",
      "saving",
      async () => options.targetFactory.create(targetDatabaseName),
    );

    const transactionalStop = await observer.run(
      "transactional_write",
      "saving",
      "saving",
      async (progress) => {
        const total = planned.plan.runCommits.length + 1;
        progress(0, total, "Starting isolated target transaction sequence.");
        for (const [index, commit] of planned.plan.runCommits.entries()) {
          const result = await target!.runStorage.commit(commit);
          if ("rejection" in result) {
            return b1bStop("transaction_failure", result.rejection.message, {
              rejectionCode: result.rejection.code,
              runId: commit.runId,
            });
          }
          runCountCommitted += 1;
          progress(index + 1, total, `Persisted run ${index + 1} of ${planned.plan.runCommits.length}.`);
          if (injectFailure && index === 0) {
            throw new Error("injected_failure_before_final_commit");
          }
        }
        const graphResult = await target!.graphStorage.commit(planned.plan.graphCommit);
        if ("rejection" in graphResult) {
          return b1bStop("transaction_failure", graphResult.rejection.message, {
            rejectionCode: graphResult.rejection.code,
          });
        }
        graphCommitted = true;
        progress(total, total, "Persisted graph aggregate.");
        return undefined;
      },
      { processed: 0, total: planned.plan.runCommits.length + 1 },
    );
    if (transactionalStop) return fail(transactionalStop);

    const [runSnapshot, graphSnapshot] = await observer.run(
      "verification",
      "validating",
      "validating",
      async () => Promise.all([
        target!.runStorage.exportSnapshot(),
        target!.graphStorage.exportSnapshot("synthetic"),
      ]),
    );
    if (graphSnapshot.contentHash !== planned.plan.graphContentHash) {
      return fail(b1bStop("verification_failure", "Persisted graph hash differs from the B0 plan.", {
        expected: planned.plan.graphContentHash,
        actual: graphSnapshot.contentHash,
      }));
    }
    if (
      runSnapshot.runs.length !== planned.plan.runCommits.length
      || runSnapshot.artifacts.length !== planned.plan.diagnostics.targetCounts.runHistoryArtifacts
    ) {
      return fail(b1bStop("verification_failure", "Persisted run snapshot counts differ from the plan.", {
        expectedRuns: planned.plan.runCommits.length,
        actualRuns: runSnapshot.runs.length,
        expectedArtifacts: planned.plan.diagnostics.targetCounts.runHistoryArtifacts,
        actualArtifacts: runSnapshot.artifacts.length,
      }));
    }
    targetSnapshotHash = await observer.run(
      "verification",
      "validating",
      "validating",
      async () => options.hashCanonical(canonicalJson({
        run: runSnapshot,
        graph: graphSnapshot,
      })),
      { message: "Computing deterministic target snapshot hash." },
    );
    if (!HEX_64.test(targetSnapshotHash)) {
      return fail(b1bStop("verification_failure", "Target snapshot hasher returned an invalid digest."));
    }

    sourceAfter = await observer.run(
      "source_snapshot_after",
      "local",
      "working",
      async () => options.source.snapshot(),
    );
    if (!sourceSnapshotsEqual(sourceBefore, sourceAfter)) {
      return fail(b1bStop("source_changed_during_run", "Prepared source identity changed during B1b."));
    }
    const finalCounters = options.boundaryCounters();
    if (finalCounters.networkCalls !== 0) return fail(b1bStop("network_path_detected", "Network call was observed during B1b."));
    if (finalCounters.modelCalls !== 0) return fail(b1bStop("model_call_detected", "Model call was observed during B1b."));

    await observer.run(
      "cleanup",
      "local",
      "working",
      async () => {
        await target!.close();
        await options.targetFactory.destroy(targetDatabaseName);
      },
      { message: "Removing isolated B1b temporary target after evidence capture." },
    );
    targetDeletedAfterEvidence = true;
    rollbackTargetEmpty = !(await options.targetFactory.exists(targetDatabaseName));
    if (!rollbackTargetEmpty) return fail(b1bStop("rollback_failure", "B1b target was not removed after evidence capture."));

    observer.emit("complete", "validating", "completed");
    return { ok: true, evidence: evidence() };
  } catch (error) {
    return fail(b1bStop("transaction_failure", error instanceof Error ? error.message : String(error), {
      targetDatabaseName,
    }));
  }
}
