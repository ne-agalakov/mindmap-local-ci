import { replayGenerationAttemptEvents } from "../../generation-core/attempt-reducer.ts";
import type { GenerationAttemptAggregate, GenerationAttemptEvent } from "../../generation-core/attempt-types.ts";
import type { GenerationIdentity, GenerationSeal } from "../../generation-core/identities.ts";
import { assertGenerationManifest } from "../../generation-core/validators.ts";
import {
  ATTEMPTS_STORE,
  BY_ATTEMPT_INDEX,
  EVENTS_STORE,
  IDEMPOTENCY_STORE,
  SEAL_ATTESTATIONS_STORE,
  type AttemptEventRow,
  type AttemptRow,
  type AttestGenerationSealRequest,
  type C2StorageResult,
  type IdempotencyRow,
  type RegistryWriteContext,
  type SealAttestationRow,
  assertSafeC2GenerationDatabaseName,
  cloneCanonical,
  idempotencyFingerprint,
  operationIdValid,
  reject,
  requestResult,
  sameCanonical,
  transactionCompletion,
} from "./c2-indexeddb-common.ts";
import { NativeIndexedDbGenerationSealStore } from "./native-generation-seal-store.ts";

export async function commitAttemptResultSerialized(
  context: RegistryWriteContext,
  operationId: string,
  expectedAttemptRevision: number,
  aggregate: GenerationAttemptAggregate,
  events: readonly GenerationAttemptEvent[],
): Promise<C2StorageResult<GenerationAttemptAggregate>> {
  if (!operationIdValid(operationId) || !Number.isInteger(expectedAttemptRevision) || expectedAttemptRevision < 0 || events.length < 1) {
    return reject("invalid_request", "Attempt commit operation, expected revision and events are required.");
  }
  try {
    assertGenerationManifest(aggregate.manifest);
  } catch (error) {
    return reject("attempt_replay_mismatch", error instanceof Error ? error.message : String(error));
  }
  const fingerprint = idempotencyFingerprint("commit_attempt", {
    expectedAttemptRevision,
    aggregate,
    events,
  }, context.hasher);
  const database = await context.openDatabase();
  const transaction = database.transaction(
    [ATTEMPTS_STORE, EVENTS_STORE, SEAL_ATTESTATIONS_STORE, IDEMPOTENCY_STORE],
    "readwrite",
  );
  const completion = transactionCompletion(transaction);
  try {
    const idempotency = transaction.objectStore(IDEMPOTENCY_STORE);
    const prior = await requestResult(idempotency.get(operationId)) as IdempotencyRow<GenerationAttemptAggregate> | undefined;
    if (prior) {
      if (prior.fingerprint !== fingerprint) {
        transaction.abort();
        await completion.catch(() => undefined);
        return reject("idempotency_conflict", "Attempt operation is bound to different data.");
      }
      await completion;
      return { ok: true, value: cloneCanonical(prior.result), idempotent: true };
    }
    const attempts = transaction.objectStore(ATTEMPTS_STORE);
    const currentRow = await requestResult(attempts.get(aggregate.attemptId)) as AttemptRow | undefined;
    const currentRevision = currentRow?.aggregate.revision ?? 0;
    if (currentRevision !== expectedAttemptRevision) {
      transaction.abort();
      await completion.catch(() => undefined);
      return reject("stale_attempt_revision", "Persisted attempt revision changed before commit.", {
        expectedRevision: expectedAttemptRevision,
        currentRevision,
      });
    }
    if (!currentRow && expectedAttemptRevision !== 0) {
      transaction.abort();
      await completion.catch(() => undefined);
      return reject("attempt_not_found", "Attempt does not exist at the expected revision.");
    }
    if (currentRow && expectedAttemptRevision === 0) {
      transaction.abort();
      await completion.catch(() => undefined);
      return reject("attempt_already_exists", "Attempt already exists.");
    }
    const eventStore = transaction.objectStore(EVENTS_STORE);
    const existingRows = await requestResult(eventStore.index(BY_ATTEMPT_INDEX).getAll(aggregate.attemptId)) as AttemptEventRow[];
    const existingEvents = existingRows.sort((left, right) => left.sequence - right.sequence).map((row) => row.event);
    let replayed: GenerationAttemptAggregate;
    try {
      replayed = replayGenerationAttemptEvents([...existingEvents, ...events]);
    } catch (error) {
      transaction.abort();
      await completion.catch(() => undefined);
      return reject("attempt_replay_mismatch", error instanceof Error ? error.message : String(error));
    }
    if (!sameCanonical(replayed, aggregate)) {
      transaction.abort();
      await completion.catch(() => undefined);
      return reject("attempt_replay_mismatch", "Supplied aggregate is not the deterministic replay result.");
    }
    for (const event of events) {
      eventStore.add({ attemptId: event.attemptId, sequence: event.sequence, event: cloneCanonical(event) } satisfies AttemptEventRow);
    }
    const sealEvent = events.find((event) => event.type === "generation_sealed");
    if (sealEvent?.type === "generation_sealed") {
      const existingSeal = await requestResult(
        transaction.objectStore(SEAL_ATTESTATIONS_STORE).get(sealEvent.seal.generationId),
      ) as SealAttestationRow | undefined;
      if (existingSeal) {
        transaction.abort();
        await completion.catch(() => undefined);
        return reject("seal_immutable_conflict", "Seal attestation cannot predate the sealed attempt commit.");
      }
    }
    const result = cloneCanonical(aggregate);
    attempts.put({ attemptId: aggregate.attemptId, aggregate: result } satisfies AttemptRow);
    idempotency.add({ operationId, kind: "commit_attempt", fingerprint, result } satisfies IdempotencyRow<GenerationAttemptAggregate>);
    context.testHooks.afterAttemptWritesQueued?.(transaction);
    await completion;
    return { ok: true, value: result, idempotent: false };
  } catch (error) {
    try { transaction.abort(); } catch { /* already inactive */ }
    await completion.catch(() => undefined);
    return reject("transaction_aborted", error instanceof Error ? error.message : String(error));
  }
}

export async function attestGenerationSealSerialized(
  context: RegistryWriteContext,
  request: AttestGenerationSealRequest,
): Promise<C2StorageResult<SealAttestationRow>> {
  if (!operationIdValid(request.operationId) || !request.attemptId.trim()) {
    return reject("invalid_request", "Seal attestation operation and attempt IDs are required.");
  }
  try {
    assertSafeC2GenerationDatabaseName(request.physicalGenerationDatabaseName);
  } catch (error) {
    return reject("invalid_database_name", error instanceof Error ? error.message : String(error));
  }
  const physicalGeneration = new NativeIndexedDbGenerationSealStore({
    indexedDB: context.indexedDbFactory,
    databaseName: request.physicalGenerationDatabaseName,
    hasher: context.hasher,
  });
  let physicalIdentity: GenerationIdentity | undefined;
  let physicalSeal: GenerationSeal | undefined;
  try {
    [physicalIdentity, physicalSeal] = await Promise.all([
      physicalGeneration.loadIdentity(),
      physicalGeneration.loadSeal(),
    ]);
  } finally {
    physicalGeneration.close();
  }
  if (!physicalIdentity || !physicalSeal || !sameCanonical(physicalSeal, request.seal)) {
    return reject("seal_mismatch", "Physical generation must reopen with the exact requested immutable seal.");
  }
  const fingerprint = idempotencyFingerprint("attest_generation_seal", request, context.hasher);
  const database = await context.openDatabase();
  const transaction = database.transaction(
    [ATTEMPTS_STORE, SEAL_ATTESTATIONS_STORE, IDEMPOTENCY_STORE],
    "readwrite",
  );
  const completion = transactionCompletion(transaction);
  try {
    const idempotency = transaction.objectStore(IDEMPOTENCY_STORE);
    const prior = await requestResult(idempotency.get(request.operationId)) as IdempotencyRow<SealAttestationRow> | undefined;
    if (prior) {
      if (prior.fingerprint !== fingerprint) {
        transaction.abort();
        await completion.catch(() => undefined);
        return reject("idempotency_conflict", "Seal attestation operation is bound to different data.");
      }
      await completion;
      return { ok: true, value: cloneCanonical(prior.result), idempotent: true };
    }
    const attemptRow = await requestResult(transaction.objectStore(ATTEMPTS_STORE).get(request.attemptId)) as AttemptRow | undefined;
    if (!attemptRow) {
      transaction.abort();
      await completion.catch(() => undefined);
      return reject("attempt_not_found", "Seal attestation attempt does not exist.");
    }
    const aggregate = attemptRow.aggregate;
    if (
      !aggregate.seal
      || !["sealed", "promotion_ready"].includes(aggregate.status)
      || !sameCanonical(aggregate.seal, request.seal)
      || !sameCanonical(physicalIdentity, aggregate.manifest.generation)
      || request.seal.generationId !== aggregate.manifest.generation.generationId
      || request.seal.databaseName !== aggregate.manifest.generation.databaseName
      || request.seal.targetSnapshotHash !== aggregate.manifest.expectedTargetSnapshotHash
    ) {
      transaction.abort();
      await completion.catch(() => undefined);
      return reject("seal_mismatch", "Seal attestation does not match the persisted sealed attempt.");
    }
    const sealStore = transaction.objectStore(SEAL_ATTESTATIONS_STORE);
    const existing = await requestResult(sealStore.get(request.seal.generationId)) as SealAttestationRow | undefined;
    const result: SealAttestationRow = {
      generationId: request.seal.generationId,
      attemptId: aggregate.attemptId,
      seal: cloneCanonical(request.seal),
      logicalGeneration: cloneCanonical(aggregate.manifest.generation),
      physicalGenerationDatabaseName: request.physicalGenerationDatabaseName,
    };
    if (existing && !sameCanonical(existing, result)) {
      transaction.abort();
      await completion.catch(() => undefined);
      return reject("seal_immutable_conflict", "Seal attestation is immutable and already bound to another physical store.");
    }
    if (!existing) sealStore.add(cloneCanonical(result));
    idempotency.add({
      operationId: request.operationId,
      kind: "attest_generation_seal",
      fingerprint,
      result,
    } satisfies IdempotencyRow<SealAttestationRow>);
    await completion;
    return { ok: true, value: cloneCanonical(result), idempotent: false };
  } catch (error) {
    try { transaction.abort(); } catch { /* already inactive */ }
    await completion.catch(() => undefined);
    return reject("transaction_aborted", error instanceof Error ? error.message : String(error));
  }
}
