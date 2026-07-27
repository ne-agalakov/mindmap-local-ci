import type { TransactionalGraphStorage } from "../graph-storage/contracts.ts";
import type { TransactionalStateStorage } from "../storage/contracts.ts";
import { PHASE2CB_TEMP_DATABASE_PREFIX } from "./phase2cb-contracts.ts";
import type {
  Phase2CbMappingCandidate,
  Phase2CbMappingOptions,
  Phase2CbStopCode,
} from "./phase2cb-contracts.ts";

export const PHASE2CB_B1A_HARNESS_VERSION = "phase2cb-b1a-harness-v1" as const;
export const PHASE2CB_B1_TEMP_DATABASE_PREFIX = `${PHASE2CB_TEMP_DATABASE_PREFIX}b1-` as const;
export const PHASE2CB_B1A_DIAGNOSTIC_SCHEMA = "mindmap-phase2cb-b1a-diagnostic-v1" as const;

export type Phase2CbB1aStep =
  | "freeze_manifest"
  | "offline_preflight"
  | "source_snapshot_before"
  | "read_only_extraction"
  | "deterministic_planning"
  | "target_freshness"
  | "target_creation"
  | "transactional_write"
  | "verification"
  | "source_snapshot_after"
  | "cleanup"
  | "complete";

export type Phase2CbB1aWorkType = "local" | "saving" | "validating";
export type Phase2CbB1aObservedState = "working" | "saving" | "validating" | "possibly_hung" | "stopped" | "completed";

export interface Phase2CbB1aObservation {
  readonly sequence: number;
  readonly step: Phase2CbB1aStep;
  readonly workType: Phase2CbB1aWorkType;
  readonly state: Phase2CbB1aObservedState;
  readonly stepStartedAt: string;
  readonly heartbeatAt: string;
  readonly elapsedMs: number;
  readonly lastProgressAt: string;
  readonly inactivityMs: number;
  readonly processed?: number;
  readonly total?: number;
  readonly model: "без AI";
  readonly message?: string;
}

export interface Phase2CbB1aSourceSnapshot {
  readonly exists: boolean;
  readonly sizeBytes: number;
  readonly sha256: string;
  readonly modifiedTimeMs?: number;
}

export interface Phase2CbB1aSourceAdapter {
  readonly mode: "sanitized-fixture";
  readonly sourceId: string;
  snapshot(): Promise<Phase2CbB1aSourceSnapshot>;
  readCandidate(): Promise<Phase2CbMappingCandidate>;
}

export interface Phase2CbB1aTargetHandle {
  readonly databaseName: string;
  readonly runStorage: TransactionalStateStorage;
  readonly graphStorage: TransactionalGraphStorage;
  close(): void | Promise<void>;
}

export interface Phase2CbB1aTargetFactory {
  exists(databaseName: string): Promise<boolean>;
  create(databaseName: string): Promise<Phase2CbB1aTargetHandle>;
  destroy(databaseName: string): Promise<void>;
}

export interface Phase2CbB1aBoundaryCounters {
  readonly networkCalls: number;
  readonly modelCalls: number;
}

export type Phase2CbB1aStopCode =
  | "exact_source_forbidden_in_b1a"
  | "source_not_found"
  | "source_changed_during_run"
  | "target_namespace_not_fresh"
  | "mapping_stopped"
  | "transaction_failure"
  | "verification_failure"
  | "rollback_failure"
  | "repeat_hash_mismatch"
  | "network_path_detected"
  | "model_call_detected";

export interface Phase2CbB1aStop {
  readonly code: Phase2CbB1aStopCode;
  readonly message: string;
  readonly mappingStopCode?: Phase2CbStopCode;
  readonly details?: Readonly<Record<string, string | number | boolean | null>>;
}

export interface Phase2CbB1aRunManifest {
  readonly schema: typeof PHASE2CB_B1A_DIAGNOSTIC_SCHEMA;
  readonly harnessVersion: typeof PHASE2CB_B1A_HARNESS_VERSION;
  readonly runId: string;
  readonly executionMode: "b1a-sanitized-fixture";
  readonly targetDatabaseName: string;
  readonly modelMode: "без AI";
  readonly retryPolicy: "manual-confirmation-required";
  readonly automaticRetryAllowed: false;
  readonly exactSourceAccessAllowed: false;
}

export interface Phase2CbB1aSingleRunEvidence {
  readonly manifest: Phase2CbB1aRunManifest;
  readonly sourceSnapshotBefore: Phase2CbB1aSourceSnapshot;
  readonly sourceSnapshotAfter: Phase2CbB1aSourceSnapshot;
  readonly sourceUnchanged: boolean;
  readonly logicalSourceSha256: string;
  readonly mappingVersion: string;
  readonly mappingContentHash: string;
  readonly portablePlanHash: string;
  readonly targetSnapshotHash?: string;
  readonly targetDeletedAfterEvidence: boolean;
  readonly rollbackTargetEmpty?: boolean;
  readonly runCountCommitted: number;
  readonly graphCommitted: boolean;
  readonly networkCalls: number;
  readonly modelCalls: number;
  readonly observations: readonly Phase2CbB1aObservation[];
}

export type Phase2CbB1aSingleRunResult =
  | Readonly<{ ok: true; evidence: Phase2CbB1aSingleRunEvidence }>
  | Readonly<{ ok: false; stop: Phase2CbB1aStop; evidence: Phase2CbB1aSingleRunEvidence }>;

export interface Phase2CbB1aHarnessEvidence {
  readonly schema: typeof PHASE2CB_B1A_DIAGNOSTIC_SCHEMA;
  readonly harnessVersion: typeof PHASE2CB_B1A_HARNESS_VERSION;
  readonly runId: string;
  readonly first: Phase2CbB1aSingleRunEvidence;
  readonly second: Phase2CbB1aSingleRunEvidence;
  readonly rollback: Phase2CbB1aSingleRunEvidence;
  readonly repeatPlanHashesEqual: boolean;
  readonly repeatTargetHashesEqual: boolean;
  readonly rollbackTargetEmpty: boolean;
  readonly sourceUnchangedAcrossHarness: boolean;
  readonly networkCalls: 0;
  readonly modelCalls: 0;
  readonly exactSourceOpened: false;
  readonly actualMigrationPerformed: false;
  readonly result: "passed";
}

export type Phase2CbB1aHarnessResult =
  | Readonly<{ ok: true; evidence: Phase2CbB1aHarnessEvidence }>
  | Readonly<{ ok: false; stop: Phase2CbB1aStop; partialEvidence?: Readonly<Record<string, unknown>> }>;

export interface Phase2CbB1aExecutorOptions {
  readonly runId: string;
  readonly source: Phase2CbB1aSourceAdapter;
  readonly targetFactory: Phase2CbB1aTargetFactory;
  readonly mappingOptions: Phase2CbMappingOptions;
  readonly hashCanonical: (canonicalContent: string) => string | Promise<string>;
  readonly boundaryCounters: () => Phase2CbB1aBoundaryCounters;
  readonly now?: () => number;
  readonly observe?: (observation: Phase2CbB1aObservation) => void;
  readonly heartbeatIntervalMs?: number;
  readonly possiblyHungThresholdMs?: number;
}
