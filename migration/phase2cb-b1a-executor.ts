import {
  PHASE2CB_B1A_DIAGNOSTIC_SCHEMA,
  PHASE2CB_B1A_HARNESS_VERSION,
  type Phase2CbB1aExecutorOptions,
  type Phase2CbB1aHarnessEvidence,
  type Phase2CbB1aHarnessResult,
} from "./phase2cb-b1a-contracts.ts";
import {
  countersAreZero,
  safeRunId,
  sourceSnapshotsEqual,
  stop,
} from "./phase2cb-b1a-runtime.ts";
import { singleRun } from "./phase2cb-b1a-single-run.ts";

export async function runPhase2CbB1aHarness(
  options: Phase2CbB1aExecutorOptions,
): Promise<Phase2CbB1aHarnessResult> {
  const before = await options.source.snapshot();
  const first = await singleRun(options, "first", false);
  if ("stop" in first) return { ok: false, stop: first.stop, partialEvidence: { first: first.evidence } };
  const second = await singleRun(options, "second", false);
  if ("stop" in second) return { ok: false, stop: second.stop, partialEvidence: { first: first.evidence, second: second.evidence } };
  const rollback = await singleRun(options, "rollback", true);
  if (!("stop" in rollback) || rollback.stop.code !== "transaction_failure") {
    return {
      ok: false,
      stop: stop("rollback_failure", "Injected-failure run did not stop with transaction_failure."),
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
      stop: stop("repeat_hash_mismatch", "Two clean B1a runs produced different hashes.", {
        repeatPlanHashesEqual,
        repeatTargetHashesEqual,
      }),
      partialEvidence: { first: first.evidence, second: second.evidence, rollback: rollback.evidence },
    };
  }
  if (!rollbackTargetEmpty) return { ok: false, stop: stop("rollback_failure", "Injected target was not empty after rollback.") };
  if (!sourceUnchangedAcrossHarness) return { ok: false, stop: stop("source_changed_during_run", "Source changed across B1a harness.") };
  if (!countersAreZero(counters)) {
    return {
      ok: false,
      stop: stop(counters.networkCalls ? "network_path_detected" : "model_call_detected", "Boundary counter is non-zero after B1a."),
    };
  }

  const evidence: Phase2CbB1aHarnessEvidence = Object.freeze({
    schema: PHASE2CB_B1A_DIAGNOSTIC_SCHEMA,
    harnessVersion: PHASE2CB_B1A_HARNESS_VERSION,
    runId: safeRunId(options.runId),
    first: first.evidence,
    second: second.evidence,
    rollback: rollback.evidence,
    repeatPlanHashesEqual,
    repeatTargetHashesEqual,
    rollbackTargetEmpty,
    sourceUnchangedAcrossHarness,
    networkCalls: 0,
    modelCalls: 0,
    exactSourceOpened: false,
    actualMigrationPerformed: false,
    result: "passed",
  });
  return { ok: true, evidence };
}
