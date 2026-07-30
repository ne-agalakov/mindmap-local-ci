import { executeGenerationAttemptCommand } from "../../generation-core/attempt-commands.ts";
import type { ActiveGenerationPointer } from "../../generation-core/identities.ts";
import type { ActivationReceipt, PromotionPlan, RollbackPlan, RollbackReceipt } from "../../generation-core/registry-types.ts";
import { planPromotion, planRollback } from "../../generation-core/plans.ts";
import { activePointerFor, samePointer } from "../../generation-core/validators.ts";
import type { GenerationAttemptCommand } from "../../generation-core/attempt-types.ts";
import {
  ACTIVATION_RECEIPTS_STORE,
  ATTEMPTS_STORE,
  EVENTS_STORE,
  IDEMPOTENCY_STORE,
  POINTERS_STORE,
  REGISTRY_STORE,
  ROLLBACK_RECEIPTS_STORE,
  SEAL_ATTESTATIONS_STORE,
  type AttemptEventRow,
  type AttemptRow,
  type C2StorageResult,
  type CommitPromotionRequest,
  type CommitRollbackRequest,
  type IdempotencyRow,
  type RegistryRow,
  type RegistryWriteContext,
  type SealAttestationRow,
  assertRegistryRow,
  assertSafeC2GenerationDatabaseName,
  buildSnapshot,
  cloneCanonical,
  domainFailure,
  idempotencyFingerprint,
  isAttemptCommandSuccess,
  operationIdValid,
  receiptCommandMeta,
  reject,
  requestResult,
  sameCanonical,
  transactionCompletion,
} from "./c2-indexeddb-common.ts";

export async function commitPromotionSerialized(
  context: RegistryWriteContext,
  request: CommitPromotionRequest,
): Promise<C2StorageResult<ActivationReceipt>> {
  if (
    !operationIdValid(request.operationId)
    || !request.attemptId.trim()
    || !request.commandId.trim()
    || !request.occurredAt.trim()
  ) return reject("invalid_request", "Promotion request identity and time are required.");
  try {
    assertSafeC2GenerationDatabaseName(request.physicalGenerationDatabaseName);
  } catch (error) {
    return reject("invalid_database_name", error instanceof Error ? error.message : String(error));
  }
  const fingerprint = idempotencyFingerprint("commit_promotion", request, context.hasher);
  const database = await context.openDatabase();
  const transaction = database.transaction(
    [REGISTRY_STORE, POINTERS_STORE, ATTEMPTS_STORE, EVENTS_STORE, SEAL_ATTESTATIONS_STORE,
      ACTIVATION_RECEIPTS_STORE, IDEMPOTENCY_STORE],
    "readwrite",
  );
  const completion = transactionCompletion(transaction);
  try {
    const idempotency = transaction.objectStore(IDEMPOTENCY_STORE);
    const prior = await requestResult(idempotency.get(request.operationId)) as IdempotencyRow<ActivationReceipt> | undefined;
    if (prior) {
      if (prior.fingerprint !== fingerprint) {
        transaction.abort();
        await completion.catch(() => undefined);
        return reject("idempotency_conflict", "Promotion operation is bound to different data.");
      }
      await completion;
      return { ok: true, value: cloneCanonical(prior.result), idempotent: true };
    }
    const registryRow = await requestResult(transaction.objectStore(REGISTRY_STORE).get("registry")) as RegistryRow | undefined;
    if (!registryRow) {
      transaction.abort();
      await completion.catch(() => undefined);
      return reject("registry_not_initialized", "Registry must be initialized before promotion.");
    }
    const validRegistryRow = assertRegistryRow(registryRow);
    const pointerStore = transaction.objectStore(POINTERS_STORE);
    const allPointers = await requestResult(pointerStore.getAll()) as ActiveGenerationPointer[];
    const snapshot = buildSnapshot(validRegistryRow.revision, allPointers);
    const attemptRow = await requestResult(transaction.objectStore(ATTEMPTS_STORE).get(request.attemptId)) as AttemptRow | undefined;
    if (!attemptRow) {
      transaction.abort();
      await completion.catch(() => undefined);
      return reject("attempt_not_found", "Promotion attempt does not exist.");
    }
    const aggregate = attemptRow.aggregate;
    if (aggregate.status !== "promotion_ready" || !aggregate.promotionPlan) {
      transaction.abort();
      await completion.catch(() => undefined);
      return reject("promotion_not_ready", "Attempt is not promotion-ready.");
    }
    let expectedPlan: PromotionPlan;
    try {
      expectedPlan = planPromotion(aggregate, snapshot);
    } catch (error) {
      transaction.abort();
      await completion.catch(() => undefined);
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes("registry_revision")) return reject("registry_revision_mismatch", message);
      if (message.includes("active_pointer")) return reject("active_pointer_mismatch", message);
      return reject("promotion_not_ready", message);
    }
    if (!sameCanonical(expectedPlan, request.plan) || !sameCanonical(aggregate.promotionPlan, request.plan)) {
      transaction.abort();
      await completion.catch(() => undefined);
      return reject("promotion_not_ready", "Promotion plan does not match the persisted attempt and registry.");
    }
    const currentPointer = activePointerFor(snapshot, aggregate.manifest.workspace);
    if (snapshot.revision !== request.plan.expectedRegistryRevision) {
      transaction.abort();
      await completion.catch(() => undefined);
      return reject("registry_revision_mismatch", "Registry revision changed before promotion.");
    }
    if (!samePointer(currentPointer, request.plan.previousPointer)) {
      transaction.abort();
      await completion.catch(() => undefined);
      return reject("active_pointer_mismatch", "Active pointer changed before promotion.");
    }
    const attestationStore = transaction.objectStore(SEAL_ATTESTATIONS_STORE);
    const attestation = await requestResult(attestationStore.get(request.seal.generationId)) as SealAttestationRow | undefined;
    if (
      !attestation
      || !sameCanonical(attestation.seal, request.seal)
      || attestation.physicalGenerationDatabaseName !== request.physicalGenerationDatabaseName
      || request.seal.generationId !== request.plan.nextPointer.generationId
      || request.seal.databaseName !== request.plan.nextPointer.databaseName
      || request.seal.targetSnapshotHash !== request.plan.nextPointer.targetSnapshotHash
    ) {
      transaction.abort();
      await completion.catch(() => undefined);
      return reject("seal_mismatch", "Persisted seal attestation does not match the promotion plan.");
    }
    const receipt: ActivationReceipt = {
      ...request.plan.receiptDraft,
      committedRegistryRevision: request.plan.expectedRegistryRevision + 1,
      committedAt: request.occurredAt,
      outcome: "committed",
    };
    const command: GenerationAttemptCommand = {
      type: "record_promotion_committed",
      attemptId: aggregate.attemptId,
      receipt,
      meta: receiptCommandMeta(request.commandId, aggregate, request.occurredAt),
    };
    const result = executeGenerationAttemptCommand(aggregate, command, context.hasher);
    if (!isAttemptCommandSuccess(result)) {
      transaction.abort();
      await completion.catch(() => undefined);
      return domainFailure<ActivationReceipt>(result);
    }
    const event = result.events[0];
    if (!event) {
      transaction.abort();
      await completion.catch(() => undefined);
      return reject("activation_receipt_conflict", "Promotion command did not produce an event.");
    }
    transaction.objectStore(REGISTRY_STORE).put({ ...registryRow, revision: receipt.committedRegistryRevision } satisfies RegistryRow);
    pointerStore.put(cloneCanonical(request.plan.nextPointer));
    transaction.objectStore(ATTEMPTS_STORE).put({ attemptId: aggregate.attemptId, aggregate: cloneCanonical(result.aggregate) } satisfies AttemptRow);
    transaction.objectStore(EVENTS_STORE).add({ attemptId: aggregate.attemptId, sequence: event.sequence, event: cloneCanonical(event) } satisfies AttemptEventRow);
    transaction.objectStore(ACTIVATION_RECEIPTS_STORE).add(cloneCanonical(receipt));
    idempotency.add({ operationId: request.operationId, kind: "commit_promotion", fingerprint, result: receipt } satisfies IdempotencyRow<ActivationReceipt>);
    context.testHooks.afterPromotionWritesQueued?.(transaction);
    await completion;
    return { ok: true, value: cloneCanonical(receipt), idempotent: false };
  } catch (error) {
    try { transaction.abort(); } catch { /* already inactive */ }
    await completion.catch(() => undefined);
    return reject("transaction_aborted", error instanceof Error ? error.message : String(error));
  }
}

export async function commitRollbackSerialized(
  context: RegistryWriteContext,
  request: CommitRollbackRequest,
): Promise<C2StorageResult<RollbackReceipt>> {
  if (
    !operationIdValid(request.operationId)
    || !request.attemptId.trim()
    || !request.commandId.trim()
    || !request.occurredAt.trim()
  ) return reject("invalid_request", "Rollback request identity and time are required.");
  const fingerprint = idempotencyFingerprint("commit_rollback", request, context.hasher);
  const database = await context.openDatabase();
  const transaction = database.transaction(
    [REGISTRY_STORE, POINTERS_STORE, ATTEMPTS_STORE, EVENTS_STORE, ROLLBACK_RECEIPTS_STORE, IDEMPOTENCY_STORE],
    "readwrite",
  );
  const completion = transactionCompletion(transaction);
  try {
    const idempotency = transaction.objectStore(IDEMPOTENCY_STORE);
    const prior = await requestResult(idempotency.get(request.operationId)) as IdempotencyRow<RollbackReceipt> | undefined;
    if (prior) {
      if (prior.fingerprint !== fingerprint) {
        transaction.abort();
        await completion.catch(() => undefined);
        return reject("idempotency_conflict", "Rollback operation is bound to different data.");
      }
      await completion;
      return { ok: true, value: cloneCanonical(prior.result), idempotent: true };
    }
    const registryRow = await requestResult(transaction.objectStore(REGISTRY_STORE).get("registry")) as RegistryRow | undefined;
    if (!registryRow) {
      transaction.abort();
      await completion.catch(() => undefined);
      return reject("registry_not_initialized", "Registry must be initialized before rollback.");
    }
    const validRegistryRow = assertRegistryRow(registryRow);
    const pointerStore = transaction.objectStore(POINTERS_STORE);
    const allPointers = await requestResult(pointerStore.getAll()) as ActiveGenerationPointer[];
    const snapshot = buildSnapshot(validRegistryRow.revision, allPointers);
    const attemptRow = await requestResult(transaction.objectStore(ATTEMPTS_STORE).get(request.attemptId)) as AttemptRow | undefined;
    if (!attemptRow) {
      transaction.abort();
      await completion.catch(() => undefined);
      return reject("attempt_not_found", "Rollback attempt does not exist.");
    }
    const aggregate = attemptRow.aggregate;
    if (aggregate.status !== "rollback_required") {
      transaction.abort();
      await completion.catch(() => undefined);
      return reject("rollback_not_required", "Attempt does not require rollback.");
    }
    let expectedPlan: RollbackPlan;
    try {
      expectedPlan = planRollback(aggregate, snapshot);
    } catch (error) {
      transaction.abort();
      await completion.catch(() => undefined);
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes("revision")) return reject("registry_revision_mismatch", message);
      if (message.includes("pointer")) return reject("active_pointer_mismatch", message);
      return reject("rollback_not_required", message);
    }
    if (!sameCanonical(expectedPlan, request.plan)) {
      transaction.abort();
      await completion.catch(() => undefined);
      return reject("rollback_not_required", "Rollback plan does not match persisted state.");
    }
    const receipt: RollbackReceipt = {
      ...request.plan.receiptDraft,
      committedRegistryRevision: request.plan.expectedRegistryRevision + 1,
      committedAt: request.occurredAt,
      outcome: "rolled_back",
    };
    const command: GenerationAttemptCommand = {
      type: "record_rollback_committed",
      attemptId: aggregate.attemptId,
      receipt,
      registrySnapshot: snapshot,
      meta: receiptCommandMeta(request.commandId, aggregate, request.occurredAt),
    };
    const result = executeGenerationAttemptCommand(aggregate, command, context.hasher);
    if (!isAttemptCommandSuccess(result)) {
      transaction.abort();
      await completion.catch(() => undefined);
      return domainFailure<RollbackReceipt>(result);
    }
    const event = result.events[0];
    if (!event) {
      transaction.abort();
      await completion.catch(() => undefined);
      return reject("rollback_receipt_conflict", "Rollback command did not produce an event.");
    }
    transaction.objectStore(REGISTRY_STORE).put({ ...registryRow, revision: receipt.committedRegistryRevision } satisfies RegistryRow);
    if (request.plan.restoredPointer) pointerStore.put(cloneCanonical(request.plan.restoredPointer));
    else pointerStore.delete(aggregate.manifest.workspace);
    transaction.objectStore(ATTEMPTS_STORE).put({ attemptId: aggregate.attemptId, aggregate: cloneCanonical(result.aggregate) } satisfies AttemptRow);
    transaction.objectStore(EVENTS_STORE).add({ attemptId: aggregate.attemptId, sequence: event.sequence, event: cloneCanonical(event) } satisfies AttemptEventRow);
    transaction.objectStore(ROLLBACK_RECEIPTS_STORE).add(cloneCanonical(receipt));
    idempotency.add({ operationId: request.operationId, kind: "commit_rollback", fingerprint, result: receipt } satisfies IdempotencyRow<RollbackReceipt>);
    context.testHooks.afterRollbackWritesQueued?.(transaction);
    await completion;
    return { ok: true, value: cloneCanonical(receipt), idempotent: false };
  } catch (error) {
    try { transaction.abort(); } catch { /* already inactive */ }
    await completion.catch(() => undefined);
    return reject("transaction_aborted", error instanceof Error ? error.message : String(error));
  }
}
