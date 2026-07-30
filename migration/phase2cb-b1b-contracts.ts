import type { Phase2CbMappingCandidate, Phase2CbMappingOptions } from "./phase2cb-contracts.ts";
import type {
  Phase2CbB1aBoundaryCounters,
  Phase2CbB1aObservation,
  Phase2CbB1aSourceSnapshot,
  Phase2CbB1aTargetFactory,
} from "./phase2cb-b1a-contracts.ts";

export const PHASE2CB_B1B_HARNESS_VERSION = "phase2cb-b1b-harness-v1" as const;
export const PHASE2CB_B1B_DIAGNOSTIC_SCHEMA = "mindmap-phase2cb-b1b-diagnostic-v1" as const;
export const PHASE2CB_B1B_AUTHORIZATION_ID = "artem-2026-07-27-b1b-once" as const;

export interface Phase2CbB1bPreparedSourceAdapter {
  readonly mode: "prepared-readonly-candidate";
  readonly sourceKind: "sanitized-rehearsal" | "exact-source";
  readonly sourceId: string;
  readonly authorizationId: typeof PHASE2CB_B1B_AUTHORIZATION_ID;
  readonly manifestFrozenBeforeOpen: true;
  readonly exactSourceOpened: boolean;
  snapshot(): Promise<Phase2CbB1aSourceSnapshot>;
  readCandidate(): Promise<Phase2CbMappingCandidate>;
}

export type Phase2CbB1bStopCode =
  | "authorization_missing"
  | "manifest_not_frozen"
  | "exact_source_not_opened"
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

export interface Phase2CbB1bStop {
  readonly code: Phase2CbB1bStopCode;
  readonly message: string;
  readonly mappingStopCode?: string;
  readonly details?: Readonly<Record<string, string | number | boolean | null>>;
}

export interface Phase2CbB1bRunManifest {
  readonly schema: typeof PHASE2CB_B1B_DIAGNOSTIC_SCHEMA;
  readonly harnessVersion: typeof PHASE2CB_B1B_HARNESS_VERSION;
  readonly authorizationId: typeof PHASE2CB_B1B_AUTHORIZATION_ID;
  readonly runId: string;
  readonly executionMode: "b1b-exact-source-readonly" | "b1b-sanitized-rehearsal";
  readonly targetDatabaseName: string;
  readonly modelMode: "без AI";
  readonly retryPolicy: "new-explicit-confirmation-required";
  readonly automaticRetryAllowed: false;
  readonly exactSourceAccessAllowed: true;
  readonly actualMigrationAllowed: false;
  readonly manifestFrozenBeforeOpen: true;
}

export interface Phase2CbB1bSingleRunEvidence {
  readonly manifest: Phase2CbB1bRunManifest;
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

export type Phase2CbB1bSingleRunResult =
  | Readonly<{ ok: true; evidence: Phase2CbB1bSingleRunEvidence }>
  | Readonly<{ ok: false; stop: Phase2CbB1bStop; evidence: Phase2CbB1bSingleRunEvidence }>;

export interface Phase2CbB1bHarnessEvidence {
  readonly schema: typeof PHASE2CB_B1B_DIAGNOSTIC_SCHEMA;
  readonly harnessVersion: typeof PHASE2CB_B1B_HARNESS_VERSION;
  readonly authorizationId: typeof PHASE2CB_B1B_AUTHORIZATION_ID;
  readonly runId: string;
  readonly sourceKind: "sanitized-rehearsal" | "exact-source";
  readonly first: Phase2CbB1bSingleRunEvidence;
  readonly second: Phase2CbB1bSingleRunEvidence;
  readonly rollback: Phase2CbB1bSingleRunEvidence;
  readonly repeatPlanHashesEqual: boolean;
  readonly repeatTargetHashesEqual: boolean;
  readonly rollbackTargetEmpty: boolean;
  readonly sourceUnchangedAcrossHarness: boolean;
  readonly manifestFrozenBeforeOpen: true;
  readonly networkCalls: 0;
  readonly modelCalls: 0;
  readonly exactSourceOpened: boolean;
  readonly actualMigrationPerformed: false;
  readonly automaticRetryAllowed: false;
  readonly result: "passed";
}

export type Phase2CbB1bHarnessResult =
  | Readonly<{ ok: true; evidence: Phase2CbB1bHarnessEvidence }>
  | Readonly<{ ok: false; stop: Phase2CbB1bStop; partialEvidence?: Readonly<Record<string, unknown>> }>;

export interface Phase2CbB1bExecutorOptions {
  readonly runId: string;
  readonly source: Phase2CbB1bPreparedSourceAdapter;
  readonly targetFactory: Phase2CbB1aTargetFactory;
  readonly mappingOptions: Phase2CbMappingOptions;
  readonly hashCanonical: (canonicalContent: string) => string | Promise<string>;
  readonly boundaryCounters: () => Phase2CbB1aBoundaryCounters;
  readonly now?: () => number;
  readonly observe?: (observation: Phase2CbB1aObservation) => void;
  readonly heartbeatIntervalMs?: number;
  readonly possiblyHungThresholdMs?: number;
}
