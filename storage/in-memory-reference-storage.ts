import type { RunAggregate, WorkspaceKind } from "../domain/run.ts";
import { applyRunEvent } from "../state-core/run-state-core.ts";
import { canonicalClone, canonicalJson } from "./canonical-json.ts";
import {
  STATE_STORAGE_NAMESPACE,
  type CanonicalContentHasher,
  type StorageCommitReceipt,
  type StorageCommitRequest,
  type StorageCommitResult,
  type StorageRejectionCode,
  type StorageSnapshot,
  type StoredArtifactRecord,
  type StoredEventRecord,
  type StoredRunRecord,
  type TransactionalStateStorage,
} from "./contracts.ts";

export interface InMemoryStorageHooks {
  readonly beforeCommit?: (request: StorageCommitRequest) => void | Promise<void>;
}

type IdempotencyRecord = Readonly<{
  fingerprint: string;
  receipt: StorageCommitReceipt;
}>;

const runKey = (workspace: WorkspaceKind, runId: string): string => `${workspace}\u0000${runId}`;
const idempotencyKey = (workspace: WorkspaceKind, key: string): string => `${workspace}\u0000${key}`;

function reject(
  code: StorageRejectionCode,
  message: string,
  details?: Readonly<Record<string, string | number | boolean | null>>,
): StorageCommitResult {
  return { ok: false, rejection: { code, message, details } };
}

function sameCanonical(left: unknown, right: unknown): boolean {
  return canonicalJson(left) === canonicalJson(right);
}

export class InMemoryReferenceStorage implements TransactionalStateStorage {
  private readonly runs = new Map<string, StoredRunRecord>();
  private readonly events = new Map<string, readonly StoredEventRecord[]>();
  private readonly artifacts = new Map<string, readonly StoredArtifactRecord[]>();
  private readonly idempotency = new Map<string, IdempotencyRecord>();
  private readonly hashCanonical: CanonicalContentHasher;
  private readonly hooks: InMemoryStorageHooks;
  private writer: Promise<void> = Promise.resolve();

  constructor(hashCanonical: CanonicalContentHasher, hooks: InMemoryStorageHooks = {}) {
    this.hashCanonical = hashCanonical;
    this.hooks = hooks;
  }

  commit(request: StorageCommitRequest): Promise<StorageCommitResult> {
    const operation = this.writer.then(() => this.commitUnlocked(request));
    this.writer = operation.then(() => undefined, () => undefined);
    return operation;
  }

  async loadRun(workspace: WorkspaceKind, runId: string): Promise<StoredRunRecord | undefined> {
    await this.writer;
    const value = this.runs.get(runKey(workspace, runId));
    return value ? canonicalClone(value) : undefined;
  }

  async loadEvents(workspace: WorkspaceKind, runId: string): Promise<readonly StoredEventRecord[]> {
    await this.writer;
    return canonicalClone(this.events.get(runKey(workspace, runId)) ?? []);
  }

  async loadArtifacts(workspace: WorkspaceKind, runId: string): Promise<readonly StoredArtifactRecord[]> {
    await this.writer;
    return canonicalClone(this.artifacts.get(runKey(workspace, runId)) ?? []);
  }

  async exportSnapshot(): Promise<StorageSnapshot> {
    await this.writer;
    const runs = [...this.runs.values()].sort((left, right) => (
      runKey(left.workspace, left.runId).localeCompare(runKey(right.workspace, right.runId))
    ));
    const events = [...this.events.values()].flat().sort((left, right) => {
      const keyOrder = runKey(left.workspace, left.runId).localeCompare(runKey(right.workspace, right.runId));
      return keyOrder || left.sequence - right.sequence;
    });
    const artifacts = [...this.artifacts.values()].flat().sort((left, right) => {
      const keyOrder = runKey(left.workspace, left.runId).localeCompare(runKey(right.workspace, right.runId));
      return keyOrder || left.artifactId.localeCompare(right.artifactId) || left.version - right.version;
    });
    const contentHash = await this.hashCanonical(canonicalJson({
      namespace: STATE_STORAGE_NAMESPACE,
      runs,
      events,
      artifacts,
    }));
    return canonicalClone({ namespace: STATE_STORAGE_NAMESPACE, runs, events, artifacts, contentHash });
  }

  private async commitUnlocked(request: StorageCommitRequest): Promise<StorageCommitResult> {
    if (request.namespace !== STATE_STORAGE_NAMESPACE) {
      return reject("invalid_namespace", "Target namespace is not the accepted Phase 2 namespace.", {
        actual: request.namespace,
        expected: STATE_STORAGE_NAMESPACE,
      });
    }
    if (
      !request.transactionId.trim()
      || !request.idempotencyKey.trim()
      || !request.runId.trim()
      || request.expectedRevision < 0
    ) {
      return reject("invalid_transaction", "Transaction identity or expected revision is invalid.");
    }
    if (request.events.length === 0) {
      return reject("empty_event_batch", "A storage transaction must persist at least one state event.");
    }

    const fingerprint = await this.hashCanonical(canonicalJson(request));
    const idempotencyStorageKey = idempotencyKey(request.workspace, request.idempotencyKey);
    const previousTransaction = this.idempotency.get(idempotencyStorageKey);
    if (previousTransaction) {
      return previousTransaction.fingerprint === fingerprint
        ? { ok: true, receipt: { ...previousTransaction.receipt, idempotent: true } }
        : reject("idempotency_conflict", "Idempotency key is already bound to different transaction data.");
    }

    const key = runKey(request.workspace, request.runId);
    const current = this.runs.get(key);
    if (!current && request.expectedRevision !== 0) {
      return reject("run_not_found", "Run does not exist at the expected revision.", {
        expectedRevision: request.expectedRevision,
      });
    }
    if (current && request.expectedRevision === 0) {
      return reject("run_already_exists", "Run already exists in this workspace.");
    }
    if (current && current.revision !== request.expectedRevision) {
      return reject("stale_revision", "Persisted revision does not match the command revision.", {
        expectedRevision: request.expectedRevision,
        currentRevision: current.revision,
      });
    }

    for (const [index, event] of request.events.entries()) {
      const expectedSequence = request.expectedRevision + index + 1;
      if (event.sequence !== expectedSequence) {
        return reject("non_contiguous_event_sequence", "Event sequence is not contiguous.", {
          actual: event.sequence,
          expected: expectedSequence,
        });
      }
    }
    const expectedAggregateRevision = request.expectedRevision + request.events.length;
    if (request.aggregate.revision !== expectedAggregateRevision) {
      return reject("aggregate_revision_mismatch", "Aggregate revision does not match the event batch.", {
        actual: request.aggregate.revision,
        expected: expectedAggregateRevision,
      });
    }
    if (
      request.aggregate.identity.runId !== request.runId
      || request.aggregate.identity.workspace !== request.workspace
    ) {
      return reject("identity_mismatch", "Aggregate identity does not match the storage key.");
    }
    if (current && !sameCanonical(current.aggregate.identity, request.aggregate.identity)) {
      return reject("identity_mismatch", "Immutable run identity changed between revisions.");
    }

    let replayed: RunAggregate | undefined = current?.aggregate;
    try {
      for (const event of request.events) replayed = applyRunEvent(replayed, event);
    } catch (error) {
      return reject("aggregate_replay_mismatch", error instanceof Error ? error.message : "Event replay failed.");
    }
    if (!replayed || !sameCanonical(replayed, request.aggregate)) {
      return reject("aggregate_replay_mismatch", "Supplied aggregate is not the deterministic event replay result.");
    }

    const previousArtifacts = this.artifacts.get(key) ?? [];
    const nextArtifacts = [...previousArtifacts];
    const seenArtifactIds = new Set(previousArtifacts.map((artifact) => artifact.artifactId));
    for (const artifact of request.artifacts ?? []) {
      if (
        artifact.namespace !== STATE_STORAGE_NAMESPACE
        || artifact.workspace !== request.workspace
        || artifact.runId !== request.runId
        || !artifact.artifactId.trim()
        || !artifact.kind.trim()
        || !artifact.contentHash.trim()
        || !artifact.createdAt.trim()
        || artifact.version < 1
        || seenArtifactIds.has(artifact.artifactId)
      ) {
        return reject("artifact_mismatch", "Artifact does not belong to this atomic run transaction.", {
          artifactId: artifact.artifactId,
        });
      }
      seenArtifactIds.add(artifact.artifactId);
      nextArtifacts.push(canonicalClone(artifact));
    }

    const previousEvents = this.events.get(key) ?? [];
    const nextEvents: StoredEventRecord[] = [
      ...previousEvents,
      ...request.events.map((event) => ({
        namespace: STATE_STORAGE_NAMESPACE,
        workspace: request.workspace,
        runId: request.runId,
        sequence: event.sequence,
        event: canonicalClone(event),
      })),
    ];
    const contentHash = await this.hashCanonical(canonicalJson({
      namespace: STATE_STORAGE_NAMESPACE,
      aggregate: replayed,
      events: nextEvents,
      artifacts: nextArtifacts,
    }));
    const nextRun: StoredRunRecord = canonicalClone({
      namespace: STATE_STORAGE_NAMESPACE,
      workspace: request.workspace,
      runId: request.runId,
      revision: replayed.revision,
      aggregate: replayed,
      contentHash,
    });

    try {
      await this.hooks.beforeCommit?.(request);
    } catch (error) {
      return reject("transaction_aborted", error instanceof Error ? error.message : "Transaction aborted before commit.");
    }

    this.runs.set(key, nextRun);
    this.events.set(key, canonicalClone(nextEvents));
    this.artifacts.set(key, canonicalClone(nextArtifacts));

    const receipt: StorageCommitReceipt = {
      transactionId: request.transactionId,
      idempotencyKey: request.idempotencyKey,
      workspace: request.workspace,
      runId: request.runId,
      revision: replayed.revision,
      firstSequence: request.events[0].sequence,
      lastSequence: request.events.at(-1)?.sequence ?? request.events[0].sequence,
      contentHash,
      idempotent: false,
    };
    this.idempotency.set(idempotencyStorageKey, { fingerprint, receipt });
    return { ok: true, receipt };
  }
}
