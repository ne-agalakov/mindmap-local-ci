import type {
  GenerationAttemptStatus,
  GenerationAttemptStopCode,
  RecoveryCheckpoint,
  RollbackReasonCode,
} from "./constants.ts";
import type {
  ControlRegistrySnapshot,
  GenerationExecutionManifest,
  GenerationIdentity,
  GenerationImportResult,
  GenerationSeal,
  GenerationVerification,
  VerifiedBackup,
  VerifiedSource,
} from "./identities.ts";
import type {
  ActivationReceipt,
  PromotionPlan,
  ResolverVerification,
  RollbackReceipt,
} from "./registry-types.ts";

export interface AttemptCommandMeta {
  readonly commandId: string;
  readonly occurredAt: string;
  readonly expectedRevision: number;
}

export interface AttemptEventBase {
  readonly eventId: string;
  readonly commandId: string;
  readonly commandFingerprint: string;
  readonly attemptId: string;
  readonly sequence: number;
  readonly occurredAt: string;
}

export type GenerationAttemptEvent =
  | (AttemptEventBase & { readonly type: "attempt_planned"; readonly manifest: GenerationExecutionManifest })
  | (AttemptEventBase & { readonly type: "authorization_consumed"; readonly authorizationId: string })
  | (AttemptEventBase & { readonly type: "backup_verified"; readonly backup: VerifiedBackup })
  | (AttemptEventBase & { readonly type: "source_verified"; readonly source: VerifiedSource })
  | (AttemptEventBase & { readonly type: "generation_created"; readonly generation: GenerationIdentity })
  | (AttemptEventBase & { readonly type: "import_started" })
  | (AttemptEventBase & { readonly type: "import_completed"; readonly result: GenerationImportResult })
  | (AttemptEventBase & { readonly type: "generation_verified"; readonly verification: GenerationVerification })
  | (AttemptEventBase & { readonly type: "generation_sealed"; readonly seal: GenerationSeal })
  | (AttemptEventBase & {
      readonly type: "promotion_marked_ready";
      readonly registrySnapshot: ControlRegistrySnapshot;
      readonly plan: PromotionPlan;
    })
  | (AttemptEventBase & { readonly type: "promotion_committed"; readonly receipt: ActivationReceipt })
  | (AttemptEventBase & { readonly type: "resolver_verified"; readonly verification: ResolverVerification })
  | (AttemptEventBase & { readonly type: "attempt_completed" })
  | (AttemptEventBase & {
      readonly type: "rollback_required";
      readonly reasonCode: RollbackReasonCode;
      readonly message: string;
    })
  | (AttemptEventBase & { readonly type: "rollback_committed"; readonly receipt: RollbackReceipt })
  | (AttemptEventBase & {
      readonly type: "recovery_blocked";
      readonly checkpoint: RecoveryCheckpoint;
      readonly reason: string;
      readonly previousStatus: GenerationAttemptStatus;
    })
  | (AttemptEventBase & {
      readonly type: "attempt_stopped";
      readonly stopCode: GenerationAttemptStopCode;
      readonly message: string;
      readonly previousStatus: GenerationAttemptStatus;
    });

export interface ProcessedCommandReceipt {
  readonly commandId: string;
  readonly commandFingerprint: string;
  readonly sequence: number;
}

export interface GenerationAttemptAggregate {
  readonly attemptId: string;
  readonly status: GenerationAttemptStatus;
  readonly revision: number;
  readonly manifest: GenerationExecutionManifest;
  readonly processedCommands: readonly ProcessedCommandReceipt[];
  readonly authorizationConsumedAt?: string;
  readonly backup?: VerifiedBackup;
  readonly source?: VerifiedSource;
  readonly generation?: GenerationIdentity;
  readonly importResult?: GenerationImportResult;
  readonly verification?: GenerationVerification;
  readonly seal?: GenerationSeal;
  readonly promotionRegistrySnapshot?: ControlRegistrySnapshot;
  readonly promotionPlan?: PromotionPlan;
  readonly activationReceipt?: ActivationReceipt;
  readonly resolverVerification?: ResolverVerification;
  readonly rollbackReceipt?: RollbackReceipt;
  readonly rollbackReason?: Readonly<{ code: RollbackReasonCode; message: string }>;
  readonly recovery?: Readonly<{
    checkpoint: RecoveryCheckpoint;
    reason: string;
    previousStatus: GenerationAttemptStatus;
  }>;
  readonly stop?: Readonly<{
    code: GenerationAttemptStopCode;
    message: string;
    previousStatus: GenerationAttemptStatus;
  }>;
}

export type GenerationAttemptCommand =
  | Readonly<{
      type: "consume_authorization";
      attemptId: string;
      authorizationId: string;
      meta: AttemptCommandMeta;
    }>
  | Readonly<{ type: "verify_backup"; attemptId: string; backup: VerifiedBackup; meta: AttemptCommandMeta }>
  | Readonly<{ type: "verify_source"; attemptId: string; source: VerifiedSource; meta: AttemptCommandMeta }>
  | Readonly<{
      type: "record_generation_created";
      attemptId: string;
      generation: GenerationIdentity;
      meta: AttemptCommandMeta;
    }>
  | Readonly<{ type: "begin_import"; attemptId: string; meta: AttemptCommandMeta }>
  | Readonly<{
      type: "record_import_completed";
      attemptId: string;
      result: GenerationImportResult;
      meta: AttemptCommandMeta;
    }>
  | Readonly<{
      type: "record_generation_verified";
      attemptId: string;
      verification: GenerationVerification;
      meta: AttemptCommandMeta;
    }>
  | Readonly<{
      type: "record_generation_sealed";
      attemptId: string;
      seal: GenerationSeal;
      meta: AttemptCommandMeta;
    }>
  | Readonly<{
      type: "mark_promotion_ready";
      attemptId: string;
      registrySnapshot: ControlRegistrySnapshot;
      meta: AttemptCommandMeta;
    }>
  | Readonly<{
      type: "record_promotion_committed";
      attemptId: string;
      receipt: ActivationReceipt;
      meta: AttemptCommandMeta;
    }>
  | Readonly<{
      type: "record_resolver_verified";
      attemptId: string;
      verification: ResolverVerification;
      meta: AttemptCommandMeta;
    }>
  | Readonly<{ type: "complete_attempt"; attemptId: string; meta: AttemptCommandMeta }>
  | Readonly<{
      type: "require_rollback";
      attemptId: string;
      reasonCode: RollbackReasonCode;
      message: string;
      meta: AttemptCommandMeta;
    }>
  | Readonly<{
      type: "record_rollback_committed";
      attemptId: string;
      receipt: RollbackReceipt;
      registrySnapshot: ControlRegistrySnapshot;
      meta: AttemptCommandMeta;
    }>
  | Readonly<{
      type: "interrupt";
      attemptId: string;
      checkpoint: RecoveryCheckpoint;
      reason: string;
      meta: AttemptCommandMeta;
    }>
  | Readonly<{
      type: "stop_attempt";
      attemptId: string;
      stopCode: GenerationAttemptStopCode;
      message: string;
      meta: AttemptCommandMeta;
    }>;

export type AttemptRejectionCode =
  | "invalid_command_meta"
  | "stale_revision"
  | "attempt_identity_mismatch"
  | "attempt_terminal"
  | "invalid_transition"
  | "idempotency_conflict"
  | "authorization_mismatch"
  | "authorization_already_consumed"
  | "backup_identity_mismatch"
  | "source_identity_mismatch"
  | "generation_identity_mismatch"
  | "import_result_mismatch"
  | "verification_mismatch"
  | "seal_mismatch"
  | "registry_identity_mismatch"
  | "registry_revision_mismatch"
  | "active_pointer_mismatch"
  | "activation_receipt_mismatch"
  | "resolver_verification_mismatch"
  | "rollback_not_required"
  | "rollback_receipt_mismatch"
  | "post_promotion_stop_requires_rollback"
  | "invalid_stop"
  | "invalid_recovery_checkpoint";

export type AttemptCommandResult =
  | Readonly<{
      ok: true;
      aggregate: GenerationAttemptAggregate;
      events: readonly GenerationAttemptEvent[];
      idempotent: boolean;
    }>
  | Readonly<{
      ok: false;
      rejection: Readonly<{
        code: AttemptRejectionCode;
        message: string;
        details?: Readonly<Record<string, string | number | boolean | null>>;
      }>;
    }>;

export interface GenerationAttemptInspection {
  readonly attemptId: string;
  readonly status: GenerationAttemptStatus;
  readonly revision: number;
  readonly terminal: boolean;
  readonly retryAllowed: false;
  readonly automaticResumeAllowed: false;
  readonly sourceOpenAllowed: boolean;
  readonly productionWriteAllowed: false;
  readonly networkAllowed: false;
  readonly modelAllowed: false;
  readonly recoveryAction: "none" | "offline_diagnosis" | "explicit_rollback";
  readonly availableCommands: readonly GenerationAttemptCommand["type"][];
}
