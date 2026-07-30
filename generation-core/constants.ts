export const CONTROL_REGISTRY_NAME = "mindmap-state-core-control-v1" as const;
export const CONTROL_REGISTRY_SCHEMA_VERSION = "phase2cc-registry-v1" as const;
export const GENERATION_DATABASE_PREFIX = "mindmap-state-core-v1-generation-" as const;
export const GENERATION_MANIFEST_VERSION = "phase2cc-c1-manifest-v1" as const;
export const GENERATION_MAPPING_VERSION = "phase2cb-mapping-v1" as const;
export const GENERATION_STORAGE_SCHEMA = "mindmap-state-core-v1" as const;
export const RETRY_POLICY = "new-explicit-confirmation-required" as const;
export const MODEL_MODE = "без AI" as const;

export const LEGACY_DATABASE_NAMES = ["mindmap-local-semantic-v060"] as const;
export const TEMPORARY_DATABASE_PREFIXES = [
  "mindmap-state-core-v1-phase2cb-",
  "mindmap-state-core-v1-phase2cc-fixture-",
] as const;

export const ATTEMPT_STOP_CODES = [
  "authorization_mismatch",
  "package_identity_mismatch",
  "source_identity_mismatch",
  "backup_identity_mismatch",
  "registry_identity_mismatch",
  "registry_revision_mismatch",
  "active_pointer_mismatch",
  "generation_identity_mismatch",
  "generation_collision",
  "transaction_failure",
  "import_result_mismatch",
  "verification_mismatch",
  "seal_mismatch",
  "promotion_conflict",
  "resolver_verification_failed",
  "rollback_conflict",
  "evidence_failure",
  "external_call_boundary_violation",
] as const;
export type GenerationAttemptStopCode = (typeof ATTEMPT_STOP_CODES)[number];

export const ROLLBACK_REASON_CODES = [
  "resolver_open_failed",
  "resolver_hash_mismatch",
  "interrupted_after_promotion",
  "final_evidence_incomplete",
] as const;
export type RollbackReasonCode = (typeof ROLLBACK_REASON_CODES)[number];

export const RECOVERY_CHECKPOINTS = [
  "before_authorization_consume",
  "after_authorization_consume",
  "during_backup_copy",
  "after_backup_verification",
  "after_generation_schema_creation",
  "before_first_run_commit",
  "after_run_commit",
  "before_graph_commit",
  "after_graph_commit",
  "after_import_verification",
  "before_seal",
  "after_seal",
  "before_promotion_transaction",
  "inside_promotion_before_pointer_write",
  "after_pointer_requests_before_completion",
  "after_promotion_completion",
  "during_resolver_verification",
  "before_rollback_transaction",
  "after_rollback_transaction",
] as const;
export type RecoveryCheckpoint = (typeof RECOVERY_CHECKPOINTS)[number];

export const ATTEMPT_STATUSES = [
  "planned",
  "authorization_consumed",
  "backup_verified",
  "source_verified",
  "generation_created",
  "importing",
  "imported",
  "verified",
  "sealed",
  "promotion_ready",
  "promotion_committed",
  "resolver_verified",
  "completed",
  "rollback_required",
  "rolled_back",
  "blocked_recovery",
  "stopped",
] as const;
export type GenerationAttemptStatus = (typeof ATTEMPT_STATUSES)[number];

export const TERMINAL_ATTEMPT_STATUSES: ReadonlySet<GenerationAttemptStatus> = new Set([
  "completed",
  "rolled_back",
  "blocked_recovery",
  "stopped",
]);

export const ALLOWED_ATTEMPT_TRANSITIONS: Readonly<
  Record<GenerationAttemptStatus, readonly GenerationAttemptStatus[]>
> = {
  planned: ["authorization_consumed", "blocked_recovery", "stopped"],
  authorization_consumed: ["backup_verified", "blocked_recovery", "stopped"],
  backup_verified: ["source_verified", "blocked_recovery", "stopped"],
  source_verified: ["generation_created", "blocked_recovery", "stopped"],
  generation_created: ["importing", "blocked_recovery", "stopped"],
  importing: ["imported", "blocked_recovery", "stopped"],
  imported: ["verified", "blocked_recovery", "stopped"],
  verified: ["sealed", "blocked_recovery", "stopped"],
  sealed: ["promotion_ready", "blocked_recovery", "stopped"],
  promotion_ready: ["promotion_committed", "blocked_recovery", "stopped"],
  promotion_committed: ["resolver_verified", "rollback_required"],
  resolver_verified: ["completed", "rollback_required"],
  completed: [],
  rollback_required: ["rolled_back"],
  rolled_back: [],
  blocked_recovery: [],
  stopped: [],
};

export function canTransitionAttempt(
  from: GenerationAttemptStatus,
  to: GenerationAttemptStatus,
): boolean {
  return ALLOWED_ATTEMPT_TRANSITIONS[from].includes(to);
}
