import { hashCanonical, type CanonicalHasher } from "../generation-core/canonical-json.ts";
import { planRollback } from "../generation-core/plans.ts";
import type { GenerationAttemptCommand } from "../generation-core/attempt-types.ts";
import type { RollbackReasonCode } from "../generation-core/constants.ts";
import type { RollbackReceipt } from "../generation-core/registry-types.ts";
import { NativeIndexedDbGenerationRegistry, type C2StorageResult } from "../generation-storage/index.ts";
import type { C4ExecutionStateStore } from "./state-store.ts";
import { NativeC4RollbackReadback } from "./native-rollback-readback.ts";
import type {
  C4ExecutionManifest,
  C4ExecutionState,
  C4LongOperationObservation,
  C4RollbackAuthorization,
  C4StopCode,
} from "./types.ts";
import type {
  C4RollbackAuthorizationReceipt,
  C4RollbackBinding,
} from "./authorization-ledger.ts";

type Awaitable<T> = T | Promise<T>;

interface DatabaseInfoLike {
  readonly name?: string;
  readonly version?: number;
}

interface EnumeratingIdbFactory {
  databases?: () => Promise<DatabaseInfoLike[]>;
}

export interface C4RollbackAuthorizationLedgerLike {
  consume(
    authorization: C4RollbackAuthorization | undefined,
    binding: C4RollbackBinding,
    consumedAt: string,
    hasher: CanonicalHasher,
  ): Promise<Readonly<
    | { ok: true; receipt: C4RollbackAuthorizationReceipt }
    | { ok: false; code: C4StopCode; message: string }
  >>;
}

export interface C4RollbackAdapter {
  rollbackOnce(request: Readonly<{
    manifest: C4ExecutionManifest;
    state: C4ExecutionState;
    binding: C4RollbackBinding;
    occurredAt: string;
  }>): Promise<Readonly<
    | { ok: true; receipt: RollbackReceipt; evidenceFingerprint: string }
    | { ok: false; code: C4StopCode; message: string; evidenceFingerprint: string }
  >>;
  readbackRollback(request: Readonly<{
    manifest: C4ExecutionManifest;
    state: C4ExecutionState;
    binding: C4RollbackBinding;
  }>): Promise<Readonly<
    | { ok: true; committed: true; receipt: RollbackReceipt; evidenceFingerprint: string }
    | { ok: true; committed: false; evidenceFingerprint: string }
    | { ok: false; code: C4StopCode; message: string; evidenceFingerprint: string }
  >>;
}

export interface C4RollbackGenerationStoreLike {
  payloadFingerprint(
    physicalGenerationDatabaseName: string,
    hasher: CanonicalHasher,
  ): Awaitable<string | undefined>;
}

export interface C4RollbackClock {
  nowIso(): string;
  nowMs?(): number;
}

export interface C4RollbackRunnerOptions {
  readonly manifest: C4ExecutionManifest;
  readonly state: C4ExecutionState;
  readonly stateStore: C4ExecutionStateStore;
  readonly authorization?: C4RollbackAuthorization;
  readonly authorizationLedger: C4RollbackAuthorizationLedgerLike;
  readonly adapter: C4RollbackAdapter;
  readonly generationStore: C4RollbackGenerationStoreLike;
  readonly hasher: CanonicalHasher;
  readonly clock: C4RollbackClock;
  readonly onObservation?: (observation: C4LongOperationObservation) => void;
  readonly heartbeatIntervalMs?: number;
  readonly hangThresholdMs?: number;
  readonly monotonicNowMs?: () => number;
}

export type C4RollbackRunnerResult = Readonly<
  | {
      ok: true;
      state: C4ExecutionState;
      authorizationReceipt: C4RollbackAuthorizationReceipt;
      rollbackReceipt: RollbackReceipt;
      payloadFingerprintBefore: string;
      payloadFingerprintAfter: string;
      observations: readonly C4LongOperationObservation[];
      rollbackCallCount: 1;
      networkCalls: 0;
      modelCalls: 0;
    }
  | {
      ok: false;
      state: C4ExecutionState;
      code: C4StopCode;
      message: string;
      observations: readonly C4LongOperationObservation[];
      rollbackCallCount: 0 | 1;
      networkCalls: 0;
      modelCalls: 0;
    }
>;

function defaultMonotonicNowMs(): number {
  return typeof globalThis.performance?.now === "function"
    ? globalThis.performance.now()
    : Date.now();
}

class RollbackObservability {
  private readonly values: C4LongOperationObservation[] = [];
  private readonly startedAt: number;
  private readonly heartbeatIntervalMs: number;
  private readonly hangThresholdMs: number;
  private readonly monotonicNowMs: () => number;
  private sequence = 0;

  constructor(
    private readonly state: C4ExecutionState,
    private readonly clock: C4RollbackClock,
    private readonly onObservation?: (observation: C4LongOperationObservation) => void,
    heartbeatIntervalMs = 1_000,
    hangThresholdMs = 30_000,
    monotonicNowMs: () => number = defaultMonotonicNowMs,
  ) {
    this.heartbeatIntervalMs = Math.max(1, heartbeatIntervalMs);
    this.hangThresholdMs = Math.max(1, hangThresholdMs);
    this.monotonicNowMs = monotonicNowMs;
    this.startedAt = this.monotonicNowMs();
  }

  record(
    workName: string,
    runtimeState: C4LongOperationObservation["state"],
    processed: number,
    total: number,
    lastProgress: string,
  ): void {
    const observation: C4LongOperationObservation = Object.freeze({
      sequence: ++this.sequence,
      checkpoint: this.state.checkpoint,
      workName,
      workType: "local",
      elapsedMs: Math.max(0, this.monotonicNowMs() - this.startedAt),
      processed,
      total,
      lastProgress,
      heartbeatAt: this.clock.nowIso(),
      state: runtimeState,
      model: "без AI",
    });
    this.values.push(observation);
    this.onObservation?.(observation);
  }

  async monitor<T>(workName: string, operation: () => Promise<T> | T): Promise<T> {
    const stageStartedAt = this.monotonicNowMs();
    this.record(workName, "working", 0, 1, `${workName} started.`);
    let settled = false;
    const timer = globalThis.setInterval(() => {
      if (settled) return;
      const quietMs = Math.max(0, this.monotonicNowMs() - stageStartedAt);
      if (quietMs >= this.hangThresholdMs) {
        this.record(
          workName,
          "possibly_hung",
          0,
          1,
          `No confirmed progress for ${Math.round(quietMs)} ms; the rollback process may be hung. Safe actions: download diagnostics, inspect durable state, stop and diagnose offline. No automatic retry, resume, cleanup or AI call.`,
        );
      } else {
        this.record(
          workName,
          "working",
          0,
          1,
          `Heartbeat; no confirmed progress for ${Math.round(quietMs)} ms.`,
        );
      }
    }, this.heartbeatIntervalMs);
    try {
      return await operation();
    } catch (error) {
      this.record(
        workName,
        "failed",
        0,
        1,
        `${workName} failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    } finally {
      settled = true;
      globalThis.clearInterval(timer);
    }
  }

  snapshot(): readonly C4LongOperationObservation[] {
    return Object.freeze(this.values.map((value) => Object.freeze({ ...value })));
  }
}

export function buildC4RollbackBinding(
  manifest: C4ExecutionManifest,
  state: C4ExecutionState,
  hasher: CanonicalHasher,
): C4RollbackBinding {
  if (!state.activationReceipt || !state.stop || !state.rollbackRequired || state.status !== "rollback_required") {
    throw new Error("c4_rollback_state_not_eligible");
  }
  return Object.freeze({
    attemptId: state.attemptId,
    currentRegistryRevision: state.activationReceipt.committedRegistryRevision,
    failedGenerationId: manifest.generationId,
    failedLogicalGenerationDatabaseName: manifest.logicalGenerationDatabaseName,
    failedPhysicalGenerationDatabaseName: manifest.physicalGenerationDatabaseName,
    previousPointerFingerprint: hashCanonical(state.activationReceipt.previousPointer ?? null, hasher),
    activationReceiptFingerprint: hashCanonical(state.activationReceipt, hasher),
    failureCode: state.stop.code,
    failureEvidenceHash: state.stop.evidenceHash,
  });
}

function rollbackIntentState(
  state: C4ExecutionState,
  authorizationReceipt: C4RollbackAuthorizationReceipt,
  occurredAt: string,
  hasher: CanonicalHasher,
): C4ExecutionState {
  return Object.freeze({
    ...state,
    revision: state.revision + 1,
    history: Object.freeze([...state.history, Object.freeze({
      sequence: state.history.length + 1,
      checkpoint: state.checkpoint,
      label: "rollback_single_call_intent",
      occurredAt,
      evidenceFingerprint: hashCanonical({
        rollbackAuthorizationReceipt: authorizationReceipt,
        rollbackCallCount: 1,
        outcome: "uncertain",
      }, hasher),
      statusAfter: "rollback_required",
    })]),
  });
}

function hasRollbackIntent(state: C4ExecutionState): boolean {
  return state.history.some((event) => event.label === "rollback_single_call_intent");
}

function completedRollbackState(
  state: C4ExecutionState,
  receipt: RollbackReceipt,
  occurredAt: string,
  evidenceFingerprint: string,
): C4ExecutionState {
  return Object.freeze({
    ...state,
    revision: state.revision + 1,
    status: "completed",
    rollbackRequired: false,
    rollbackReceipt: receipt,
    history: Object.freeze([...state.history, Object.freeze({
      sequence: state.history.length + 1,
      checkpoint: state.checkpoint,
      label: "rollback_committed",
      occurredAt,
      evidenceFingerprint,
      statusAfter: "completed",
    })]),
  });
}

function failedResult(
  state: C4ExecutionState,
  code: C4StopCode,
  message: string,
  observations: RollbackObservability,
  rollbackCallCount: 0 | 1,
): C4RollbackRunnerResult {
  return Object.freeze({
    ok: false,
    state,
    code,
    message,
    observations: observations.snapshot(),
    rollbackCallCount,
    networkCalls: 0,
    modelCalls: 0,
  });
}

function createObservability(
  state: C4ExecutionState,
  options: Pick<C4RollbackRunnerOptions, "clock" | "onObservation" | "heartbeatIntervalMs" | "hangThresholdMs" | "monotonicNowMs">,
): RollbackObservability {
  return new RollbackObservability(
    state,
    options.clock,
    options.onObservation,
    options.heartbeatIntervalMs,
    options.hangThresholdMs,
    options.monotonicNowMs,
  );
}

export async function runSanitizedC4Rollback(
  options: C4RollbackRunnerOptions,
): Promise<C4RollbackRunnerResult> {
  const observations = createObservability(options.state, options);
  const durable = await observations.monitor(
    "Load exact durable C4 rollback state",
    () => options.stateStore.load(options.state.attemptId),
  );
  if (!durable || durable.revision !== options.state.revision) {
    observations.record("C4 rollback preflight", "failed", 0, 1, "Durable C4 state is missing or revision changed.");
    return failedResult(durable ?? options.state, "rollback_binding_mismatch", "Rollback requires the exact durable C4 revision.", observations, 0);
  }
  if (hasRollbackIntent(durable)) {
    observations.record("C4 rollback preflight", "failed", 0, 1, "A durable rollback intent already exists; readback only.");
    return failedResult(durable, "rollback_authorization_consumed", "Second rollback call is prohibited after durable rollback intent.", observations, 0);
  }

  let binding: C4RollbackBinding;
  try {
    binding = buildC4RollbackBinding(options.manifest, durable, options.hasher);
  } catch (error) {
    observations.record("C4 rollback preflight", "failed", 0, 1, "Rollback state is not eligible.");
    return failedResult(durable, "rollback_binding_mismatch", error instanceof Error ? error.message : String(error), observations, 0);
  }

  const consumed = await observations.monitor(
    "Consume detached rollback authorization",
    () => options.authorizationLedger.consume(options.authorization, binding, options.clock.nowIso(), options.hasher),
  );
  if (!consumed.ok) {
    observations.record("C4 rollback authorization", "failed", 0, 1, consumed.message);
    return failedResult(durable, consumed.code, consumed.message, observations, 0);
  }
  observations.record("C4 rollback authorization", "completed", 1, 1, "Rollback authorization receipt persisted.");

  const before = await observations.monitor(
    "Read sealed generation payload fingerprint before rollback",
    () => options.generationStore.payloadFingerprint(options.manifest.physicalGenerationDatabaseName, options.hasher),
  );
  if (!before) {
    observations.record("C4 rollback payload verification", "failed", 0, 1, "Sealed generation payload fingerprint is unavailable.");
    return failedResult(durable, "rollback_binding_mismatch", "Sealed generation payload fingerprint is unavailable.", observations, 0);
  }

  const intent = rollbackIntentState(durable, consumed.receipt, options.clock.nowIso(), options.hasher);
  const persistedIntent = await observations.monitor(
    "Persist single-call rollback intent before C2",
    () => options.stateStore.commit(durable.revision, intent),
  );
  if (!persistedIntent.ok) {
    observations.record("C4 rollback intent", "failed", 0, 1, `Rollback intent persistence failed: ${persistedIntent.code}.`);
    return failedResult(durable, "rollback_binding_mismatch", `Rollback authorization consumed but intent persistence failed: ${persistedIntent.code}.`, observations, 0);
  }
  let state = persistedIntent.value;
  observations.record("C4 rollback intent", "completed", 1, 1, "Single rollback call intent persisted before C2.");

  const rolledBack = await observations.monitor(
    "Invoke the single authorized C2 pointer rollback",
    () => options.adapter.rollbackOnce({ manifest: options.manifest, state, binding, occurredAt: options.clock.nowIso() }),
  );
  if (!rolledBack.ok) {
    observations.record("C4 atomic pointer rollback", "failed", 0, 1, rolledBack.message);
    return failedResult(state, rolledBack.code, rolledBack.message, observations, 1);
  }

  const after = await observations.monitor(
    "Read sealed generation payload fingerprint after rollback",
    () => options.generationStore.payloadFingerprint(options.manifest.physicalGenerationDatabaseName, options.hasher),
  );
  if (!after || before !== after) {
    observations.record("C4 rollback payload verification", "failed", 0, 1, "Rollback mutated or lost immutable generation payload.");
    return failedResult(state, "rollback_binding_mismatch", "Rollback mutated or lost immutable generation payload.", observations, 1);
  }
  observations.record("C4 rollback payload verification", "completed", 1, 1, "Generation payload fingerprint remained byte-contract identical.");

  const next = completedRollbackState(state, rolledBack.receipt, options.clock.nowIso(), rolledBack.evidenceFingerprint);
  const persisted = await observations.monitor(
    "Persist committed rollback receipt in C4 journal",
    () => options.stateStore.commit(state.revision, next),
  );
  if (!persisted.ok) {
    observations.record("C4 rollback completion", "failed", 0, 1, "C2 rollback may have committed; explicit readback is required.");
    return failedResult(state, "rollback_binding_mismatch", `Rollback receipt may be committed but C4 journal persistence failed: ${persisted.code}.`, observations, 1);
  }
  state = persisted.value;
  observations.record("C4 rollback completion", "completed", 1, 1, "Pointer and rollback receipt committed; payload unchanged.");
  return Object.freeze({
    ok: true,
    state,
    authorizationReceipt: consumed.receipt,
    rollbackReceipt: rolledBack.receipt,
    payloadFingerprintBefore: before,
    payloadFingerprintAfter: after,
    observations: observations.snapshot(),
    rollbackCallCount: 1,
    networkCalls: 0,
    modelCalls: 0,
  });
}

export interface ReconcileC4RollbackOptions {
  readonly manifest: C4ExecutionManifest;
  readonly stateStore: C4ExecutionStateStore;
  readonly adapter: Pick<C4RollbackAdapter, "readbackRollback">;
  readonly generationStore: C4RollbackGenerationStoreLike;
  readonly hasher: CanonicalHasher;
  readonly clock: C4RollbackClock;
  readonly onObservation?: (observation: C4LongOperationObservation) => void;
  readonly heartbeatIntervalMs?: number;
  readonly hangThresholdMs?: number;
  readonly monotonicNowMs?: () => number;
}

export type ReconcileC4RollbackResult = Readonly<
  | { ok: true; committed: boolean; state: C4ExecutionState; rollbackCallProduced: false; observations: readonly C4LongOperationObservation[] }
  | { ok: false; code: C4StopCode; message: string; state?: C4ExecutionState; rollbackCallProduced: false; observations: readonly C4LongOperationObservation[] }
>;

export async function reconcileUncertainC4Rollback(options: ReconcileC4RollbackOptions): Promise<ReconcileC4RollbackResult> {
  const placeholder = Object.freeze({
    attemptId: options.manifest.attemptId,
    revision: 0,
    checkpoint: "P00" as const,
    status: "rejected_preflight" as const,
    history: Object.freeze([]),
    sourceOpenCount: 0,
    backupVerified: false,
    generationCreated: false,
    generationSealed: false,
    promotionCallCount: 0 as const,
    promotionOutcome: "not_called" as const,
    resolverVerified: false,
    rollbackRequired: false,
    automaticResumeAllowed: false as const,
    automaticRetryAllowed: false as const,
    automaticCleanupAllowed: false as const,
    networkCalls: 0 as const,
    modelCalls: 0 as const,
  });
  const bootstrapObservations = new RollbackObservability(placeholder, options.clock, options.onObservation, options.heartbeatIntervalMs, options.hangThresholdMs, options.monotonicNowMs);
  const loaded = await bootstrapObservations.monitor("Load durable rollback intent for readback", () => options.stateStore.load(options.manifest.attemptId));
  const observations = loaded
    ? new RollbackObservability(loaded, options.clock, options.onObservation, options.heartbeatIntervalMs, options.hangThresholdMs, options.monotonicNowMs)
    : bootstrapObservations;
  if (!loaded || !hasRollbackIntent(loaded) || loaded.status !== "rollback_required") {
    observations.record("C4 rollback readback", "failed", 0, 1, "Durable rollback intent is missing.");
    return Object.freeze({ ok: false, code: "rollback_binding_mismatch", message: "Durable rollback intent is missing or state is not rollback_required.", ...(loaded ? { state: loaded } : {}), rollbackCallProduced: false, observations: observations.snapshot() });
  }

  let binding: C4RollbackBinding;
  try {
    binding = buildC4RollbackBinding(options.manifest, loaded, options.hasher);
  } catch (error) {
    observations.record("C4 rollback readback", "failed", 0, 1, "Rollback binding cannot be reconstructed.");
    return Object.freeze({ ok: false, code: "rollback_binding_mismatch", message: error instanceof Error ? error.message : String(error), state: loaded, rollbackCallProduced: false, observations: observations.snapshot() });
  }

  const readback = await observations.monitor("Read C2 pointer and rollback receipt without issuing rollback", () => options.adapter.readbackRollback({ manifest: options.manifest, state: loaded, binding }));
  if (!readback.ok) {
    observations.record("C4 rollback readback", "failed", 0, 1, readback.message);
    return Object.freeze({ ok: false, code: readback.code, message: readback.message, state: loaded, rollbackCallProduced: false, observations: observations.snapshot() });
  }
  if (!readback.committed) {
    observations.record("C4 rollback readback", "completed", 1, 1, "No rollback receipt found; state remains rollback_required and no second call is issued.");
    return Object.freeze({ ok: true, committed: false, state: loaded, rollbackCallProduced: false, observations: observations.snapshot() });
  }

  const payload = await observations.monitor("Verify immutable generation payload after rollback readback", () => options.generationStore.payloadFingerprint(options.manifest.physicalGenerationDatabaseName, options.hasher));
  if (!payload) {
    observations.record("C4 rollback readback", "failed", 0, 1, "Generation payload is unavailable.");
    return Object.freeze({ ok: false, code: "rollback_binding_mismatch", message: "Generation payload is unavailable after rollback readback.", state: loaded, rollbackCallProduced: false, observations: observations.snapshot() });
  }

  const completed = completedRollbackState(loaded, readback.receipt, options.clock.nowIso(), readback.evidenceFingerprint);
  const persisted = await observations.monitor("Persist rollback readback completion without a second C2 call", () => options.stateStore.commit(loaded.revision, completed));
  if (!persisted.ok) {
    observations.record("C4 rollback readback", "failed", 0, 1, "Readback result could not be persisted.");
    return Object.freeze({ ok: false, code: "rollback_binding_mismatch", message: `Rollback readback journal persistence failed: ${persisted.code}.`, state: loaded, rollbackCallProduced: false, observations: observations.snapshot() });
  }
  observations.record("C4 rollback readback", "completed", 1, 1, "Committed rollback receipt reconciled without a second rollback call.");
  return Object.freeze({ ok: true, committed: true, state: persisted.value, rollbackCallProduced: false, observations: observations.snapshot() });
}

function rollbackReason(code: C4StopCode): RollbackReasonCode {
  if (code === "resolver_failure") return "resolver_open_failed";
  if (code === "target_snapshot_mismatch") return "resolver_hash_mismatch";
  if (code === "diagnostics_unsanitized") return "final_evidence_incomplete";
  return "interrupted_after_promotion";
}

function storageFailure<T>(result: Exclude<C2StorageResult<T>, { readonly ok: true }>): Readonly<{ ok: false; code: C4StopCode; message: string; evidenceFingerprint: string }> {
  const code: C4StopCode = result.rejection.code === "registry_revision_mismatch" ? "rollback_authorization_stale" : "rollback_binding_mismatch";
  return Object.freeze({ ok: false, code, message: `${result.rejection.code}:${result.rejection.message}`, evidenceFingerprint: `${result.rejection.code}:${result.rejection.message}` });
}

async function existingDatabaseNames(indexedDB: IDBFactory): Promise<readonly string[] | undefined> {
  const enumerate = (indexedDB as unknown as EnumeratingIdbFactory).databases;
  if (typeof enumerate !== "function") return undefined;
  return Object.freeze((await enumerate.call(indexedDB)).flatMap((entry) => entry.name ? [entry.name] : []).sort());
}

export interface NativeC4RollbackAdapterOptions {
  readonly indexedDB: IDBFactory;
  readonly hasher: CanonicalHasher;
}

export class NativeC4RollbackAdapter implements C4RollbackAdapter {
  private readonly indexedDB: IDBFactory;
  private readonly hasher: CanonicalHasher;
  private readonly readback: NativeC4RollbackReadback;
  private calls = 0;

  constructor(options: NativeC4RollbackAdapterOptions) {
    this.indexedDB = options.indexedDB;
    this.hasher = options.hasher;
    this.readback = new NativeC4RollbackReadback(options);
  }

  get rollbackCallCount(): number { return this.calls; }

  async rollbackOnce(request: Readonly<{ manifest: C4ExecutionManifest; state: C4ExecutionState; binding: C4RollbackBinding; occurredAt: string }>): Promise<Readonly<
    | { ok: true; receipt: RollbackReceipt; evidenceFingerprint: string }
    | { ok: false; code: C4StopCode; message: string; evidenceFingerprint: string }
  >> {
    this.calls += 1;
    if (this.calls !== 1) return Object.freeze({ ok: false, code: "rollback_authorization_consumed", message: "Second rollback call prohibited.", evidenceFingerprint: "second_rollback_call" });
    const names = await existingDatabaseNames(this.indexedDB);
    if (!names || !names.includes(request.manifest.physicalRegistryDatabaseName)) {
      return Object.freeze({ ok: false, code: "rollback_binding_mismatch", message: "Fixture registry is absent or cannot be enumerated; rollback will not create it.", evidenceFingerprint: hashCanonical({ attemptId: request.manifest.attemptId, registryExists: false }, this.hasher) });
    }

    const registry = new NativeIndexedDbGenerationRegistry({ indexedDB: this.indexedDB, databaseName: request.manifest.physicalRegistryDatabaseName, hasher: this.hasher });
    try {
      let aggregate = await registry.loadAttempt(request.manifest.attemptId);
      const snapshot = await registry.loadRegistry();
      if (!aggregate || !snapshot || !aggregate.activationReceipt) return Object.freeze({ ok: false, code: "rollback_binding_mismatch", message: "C1 attempt, registry or activation receipt missing.", evidenceFingerprint: "rollback_native_state_missing" });
      if (
        snapshot.revision !== request.binding.currentRegistryRevision
        || hashCanonical(aggregate.activationReceipt, this.hasher) !== request.binding.activationReceiptFingerprint
        || hashCanonical(aggregate.activationReceipt.previousPointer ?? null, this.hasher) !== request.binding.previousPointerFingerprint
        || aggregate.activationReceipt.nextPointer.generationId !== request.binding.failedGenerationId
        || aggregate.activationReceipt.nextPointer.databaseName !== request.binding.failedLogicalGenerationDatabaseName
      ) return Object.freeze({ ok: false, code: "rollback_binding_mismatch", message: "Native registry does not match rollback authorization binding.", evidenceFingerprint: "rollback_native_binding_mismatch" });
      if (aggregate.status === "promotion_committed" || aggregate.status === "resolver_verified") {
        const command: GenerationAttemptCommand = { type: "require_rollback", attemptId: aggregate.attemptId, reasonCode: rollbackReason(request.binding.failureCode), message: `C4 failure evidence ${request.binding.failureEvidenceHash}`, meta: { commandId: `${aggregate.attemptId}-c4-require-rollback`, occurredAt: request.occurredAt, expectedRevision: aggregate.revision } };
        const required = await registry.commitCommand({ operationId: command.meta.commandId, command });
        if (!required.ok) return storageFailure(required);
        aggregate = required.value;
      }
      if (aggregate.status !== "rollback_required") return Object.freeze({ ok: false, code: "rollback_binding_mismatch", message: `Native attempt is not rollback_required: ${aggregate.status}.`, evidenceFingerprint: "rollback_status_mismatch" });
      const latest = await registry.loadRegistry();
      if (!latest) return Object.freeze({ ok: false, code: "rollback_binding_mismatch", message: "Registry disappeared before rollback.", evidenceFingerprint: "rollback_registry_missing" });
      const plan = planRollback(aggregate, latest);
      if (plan.payloadMutationRequired !== false) return Object.freeze({ ok: false, code: "rollback_binding_mismatch", message: "Rollback plan unexpectedly requests payload mutation.", evidenceFingerprint: "rollback_payload_mutation_requested" });
      const rolledBack = await registry.commitRollback({ operationId: `${aggregate.attemptId}-c4-atomic-rollback`, attemptId: aggregate.attemptId, plan, commandId: `${aggregate.attemptId}-c4-record-rollback`, occurredAt: request.occurredAt });
      if (!rolledBack.ok) return storageFailure(rolledBack);
      return Object.freeze({ ok: true, receipt: rolledBack.value, evidenceFingerprint: hashCanonical(rolledBack.value, this.hasher) });
    } finally {
      registry.close();
    }
  }

  readbackRollback(request: Parameters<C4RollbackAdapter["readbackRollback"]>[0]): ReturnType<C4RollbackAdapter["readbackRollback"]> {
    return this.readback.readbackRollback(request);
  }
}
