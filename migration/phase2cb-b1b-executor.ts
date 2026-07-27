import {
  PHASE2CB_B1B_AUTHORIZATION_ID,
  PHASE2CB_B1B_DIAGNOSTIC_SCHEMA,
  PHASE2CB_B1B_HARNESS_VERSION,
  type Phase2CbB1bExecutorOptions,
  type Phase2CbB1bHarnessEvidence,
  type Phase2CbB1bHarnessResult,
  type Phase2CbB1bStop,
} from "./phase2cb-b1b-contracts.ts";
import { countersAreZero, safeRunId, sourceSnapshotsEqual } from "./phase2cb-b1a-runtime.ts";
import { singleB1bRun } from "./phase2cb-b1b-single-run.ts";

function stop(code: Phase2CbB1bStop["code"], message: string, details?: Phase2CbB1bStop["details"]): Phase2CbB1bStop {
  return Object.freeze({ code, message, details });
}

export async function runPhase2CbB1bHarness(
  options: Phase2CbB1bExecutorOptions,
): Promise<Phase2CbB1bHarnessResult> {
  if (options.source.authorizationId !== PHASE2CB_B1B_AUTHORIZATION_ID) {
    return { ok: false, stop: stop("authorization_missing", "B1b one-shot authorization is missing.") };
  }
  if (!options.source.manifestFrozenBeforeOpen) {
    return { ok: false, stop: stop("manifest_not_frozen", "B1b run manifest was not frozen before source access.") };
  }
  const before = await options.source.snapshot();
  const first = await singleB1bRun(options, "first", false);
  if ("stop" in first) return { ok: false, stop: first.stop, partialEvidence: { first: first.evidence } };
  const second = await singleB1bRun(options, "second", false);
  if ("stop" in second) return { ok: false, stop: second.stop, partialEvidence: { first: first.evidence, second: second.evidence } };
  const rollback = await singleB1bRun(options, "rollback", true);
  if (!("stop" in rollback) || rollback.stop.code !== "transaction_failure") {
    return {
      ok: false,
      stop: stop("rollback_failure", "Injected-failure B1b run did not stop with transaction_failure."),
      partialEvidence: { first: first.evidence, second: second.evidence, rollback },
    };
  }

  const after = await options.source.snapshot();
  const repeatPlanHashesEqual = first.evidence.portablePlanHash === second.evidence.portablePlanHash;
  const repeatTargetHashesEqual = first.evidence.targetSnapshotHash === second.evidence.targetSnapshotHash;
  const rollbackTargetEmpty = rollback.evidence.rollbackTargetEmpty === true;
  const sourceUnchangedAcrossHarness = sourceSnapshotsEqual(before, after)
    && first.evidence.sourceUnchanged
    && second.evidence.sourceUnchanged
    && rollback.evidence.sourceUnchanged;
  const counters = options.boundaryCounters();

  if (!repeatPlanHashesEqual || !repeatTargetHashesEqual) {
    return {
      ok: false,
      stop: stop("repeat_hash_mismatch", "Two clean B1b runs produced different hashes.", {
        repeatPlanHashesEqual,
        repeatTargetHashesEqual,
      }),
      partialEvidence: { first: first.evidence, second: second.evidence, rollback: rollback.evidence },
    };
  }
  if (!rollbackTargetEmpty) return { ok: false, stop: stop("rollback_failure", "Injected B1b target was not empty after rollback.") };
  if (!sourceUnchangedAcrossHarness) return { ok: false, stop: stop("source_changed_during_run", "Source changed across B1b harness.") };
  if (!countersAreZero(counters)) {
    return {
      ok: false,
      stop: stop(counters.networkCalls ? "network_path_detected" : "model_call_detected", "Boundary counter is non-zero after B1b."),
    };
  }

  const evidence: Phase2CbB1bHarnessEvidence = Object.freeze({
    schema: PHASE2CB_B1B_DIAGNOSTIC_SCHEMA,
    harnessVersion: PHASE2CB_B1B_HARNESS_VERSION,
    authorizationId: PHASE2CB_B1B_AUTHORIZATION_ID,
    runId: safeRunId(options.runId),
    sourceKind: options.source.sourceKind,
    first: first.evidence,
    second: second.evidence,
    rollback: rollback.evidence,
    repeatPlanHashesEqual,
    repeatTargetHashesEqual,
    rollbackTargetEmpty,
    sourceUnchangedAcrossHarness,
    manifestFrozenBeforeOpen: true,
    networkCalls: 0,
    modelCalls: 0,
    exactSourceOpened: options.source.exactSourceOpened,
    actualMigrationPerformed: false,
    automaticRetryAllowed: false,
    result: "passed",
  });
  return { ok: true, evidence };
}
