import type { RunIdentity } from "../domain/run.ts";
import {
  STATE_STORAGE_NAMESPACE,
  type MigrationPlanResult,
  type MigrationRunPlan,
  type MigrationSourceIdentity,
  type MigrationStopCode,
} from "./contracts.ts";

export const ACCEPTED_LEGACY_DATABASE_SHA256 = "356b943275cce292d0e14f8a7fbe95af07e79de73f06d3e361874d342aa2f918";
export const ACCEPTED_LEGACY_DATABASE_SIZE_BYTES = 5_070_848;

export interface LegacyMigrationCandidate {
  readonly source: MigrationSourceIdentity;
  readonly runs: readonly Readonly<{
    identity: RunIdentity;
    sourceEventCount: number;
    ambiguityCodes?: readonly string[];
    invalidReferenceCount?: number;
  }>[];
  readonly targetIsEmpty: boolean;
}

function stop(
  code: MigrationStopCode,
  message: string,
  details?: Readonly<Record<string, string | number | boolean | null>>,
): MigrationPlanResult {
  return {
    ok: false,
    stop: { code, message, details },
    sourceWriteAllowed: false,
    targetWritePerformed: false,
    networkCallAllowed: false,
    aiCallAllowed: false,
  };
}

export function planLegacyMigration(candidate: LegacyMigrationCandidate): MigrationPlanResult {
  if (candidate.source.sourceDatabaseSha256 !== ACCEPTED_LEGACY_DATABASE_SHA256) {
    return stop("source_hash_mismatch", "Legacy source hash is not the accepted Phase 0 source.", {
      expected: ACCEPTED_LEGACY_DATABASE_SHA256,
      actual: candidate.source.sourceDatabaseSha256,
    });
  }
  if (candidate.source.sourceSizeBytes !== ACCEPTED_LEGACY_DATABASE_SIZE_BYTES) {
    return stop("source_size_mismatch", "Legacy source size is not the accepted Phase 0 source size.", {
      expected: ACCEPTED_LEGACY_DATABASE_SIZE_BYTES,
      actual: candidate.source.sourceSizeBytes,
    });
  }
  if (!candidate.targetIsEmpty) {
    return stop("target_not_empty", "Migration planning requires an empty isolated target namespace.");
  }
  if (candidate.source.sourceWorkspace !== "synthetic") {
    return stop("workspace_mismatch", "Accepted Phase 0 source must be migrated only into synthetic workspace.");
  }
  if (candidate.source.personalThoughtCount !== 0) {
    return stop("personal_data_present", "Legacy source contains records requiring personal-data review.", {
      personalThoughtCount: candidate.source.personalThoughtCount,
    });
  }

  const seenRunIds = new Set<string>();
  const plans: MigrationRunPlan[] = [];
  for (const run of candidate.runs) {
    if (run.identity.workspace !== "synthetic" || run.identity.storageSchema !== STATE_STORAGE_NAMESPACE) {
      return stop("workspace_mismatch", "Migration run identity targets a forbidden workspace or schema.", {
        runId: run.identity.runId,
      });
    }
    if (seenRunIds.has(run.identity.runId)) {
      return stop("ambiguous_legacy_state", "Migration candidate contains duplicate run identity.", {
        runId: run.identity.runId,
      });
    }
    seenRunIds.add(run.identity.runId);
    if ((run.ambiguityCodes?.length ?? 0) > 0) {
      return stop("ambiguous_legacy_state", "Legacy run contains unresolved migration ambiguity.", {
        runId: run.identity.runId,
        ambiguityCount: run.ambiguityCodes?.length ?? 0,
      });
    }
    if ((run.invalidReferenceCount ?? 0) > 0) {
      return stop("invalid_reference", "Legacy run contains invalid references.", {
        runId: run.identity.runId,
        invalidReferenceCount: run.invalidReferenceCount ?? 0,
      });
    }
    if (!Number.isInteger(run.sourceEventCount) || run.sourceEventCount < 1) {
      return stop("ambiguous_legacy_state", "Legacy run event count is invalid.", {
        runId: run.identity.runId,
        sourceEventCount: run.sourceEventCount,
      });
    }
    plans.push({
      identity: run.identity,
      sourceEventCount: run.sourceEventCount,
      expectedTargetRevision: run.sourceEventCount,
    });
  }

  return {
    ok: true,
    source: candidate.source,
    targetNamespace: STATE_STORAGE_NAMESPACE,
    runs: plans,
    sourceWriteAllowed: false,
    targetWritePerformed: false,
    networkCallAllowed: false,
    aiCallAllowed: false,
  };
}
