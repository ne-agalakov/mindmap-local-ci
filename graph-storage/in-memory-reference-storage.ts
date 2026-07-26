import type { WorkspaceKind } from "../domain/run.ts";
import { canonicalClone, canonicalJson } from "../storage/canonical-json.ts";
import { validateCompleteGraphState } from "./complete-state-validation.ts";
import {
  MINDMAP_GRAPH_NAMESPACE,
  type ContentAddressedPayloadRecord,
  type GraphCommitReceipt,
  type GraphCommitRequest,
  type GraphCommitResult,
  type GraphContentHasher,
  type GraphEvent,
  type GraphStorageSnapshot,
  type MindMapGraphState,
  type TransactionalGraphStorage,
} from "./contracts.ts";
import {
  GraphInvariantError,
  applyGraphEvent,
  canonicalGraphState,
  emptyGraphState,
} from "./graph-state.ts";

export type GraphPayloadHasher = (
  payload: ContentAddressedPayloadRecord,
) => string | Promise<string>;

export interface InMemoryGraphStorageOptions {
  readonly hashCanonical: GraphContentHasher;
  readonly hashPayload: GraphPayloadHasher;
  readonly beforeCommit?: (context: Readonly<{
    request: GraphCommitRequest;
    nextState: MindMapGraphState;
  }>) => void | Promise<void>;
}

interface ReceiptRow {
  readonly fingerprint: string;
  readonly receipt: GraphCommitReceipt;
}

function reject(
  code: GraphCommitResult extends { ok: false; rejection: infer R }
    ? R extends { code: infer C }
      ? C
      : never
    : never,
  message: string,
  details?: Readonly<Record<string, string | number | boolean | null>>,
): GraphCommitResult {
  return { ok: false, rejection: { code, message, details } };
}

function key(workspace: WorkspaceKind, idempotencyKey: string): string {
  return `${workspace}\u0000${idempotencyKey}`;
}

export class InMemoryGraphStorage implements TransactionalGraphStorage {
  private readonly hashCanonical: GraphContentHasher;
  private readonly hashPayload: GraphPayloadHasher;
  private readonly beforeCommit?: InMemoryGraphStorageOptions["beforeCommit"];
  private readonly states = new Map<WorkspaceKind, MindMapGraphState>();
  private readonly events = new Map<WorkspaceKind, readonly GraphEvent[]>();
  private readonly receipts = new Map<string, ReceiptRow>();
  private writer: Promise<void> = Promise.resolve();

  constructor(options: InMemoryGraphStorageOptions) {
    this.hashCanonical = options.hashCanonical;
    this.hashPayload = options.hashPayload;
    this.beforeCommit = options.beforeCommit;
  }

  commit(request: GraphCommitRequest): Promise<GraphCommitResult> {
    const operation = this.writer.then(() => this.commitSerialized(request));
    this.writer = operation.then(() => undefined, () => undefined);
    return operation;
  }

  async load(workspace: WorkspaceKind): Promise<MindMapGraphState> {
    await this.writer;
    return canonicalClone(this.states.get(workspace) ?? emptyGraphState(workspace));
  }

  async loadEvents(workspace: WorkspaceKind): Promise<readonly GraphEvent[]> {
    await this.writer;
    return canonicalClone(this.events.get(workspace) ?? []);
  }

  async exportSnapshot(workspace: WorkspaceKind): Promise<GraphStorageSnapshot> {
    await this.writer;
    const state = canonicalGraphState(this.states.get(workspace) ?? emptyGraphState(workspace));
    const contentHash = await this.hashCanonical(canonicalJson(state));
    return canonicalClone({ ...state, contentHash });
  }

  private async commitSerialized(request: GraphCommitRequest): Promise<GraphCommitResult> {
    if (request.namespace !== MINDMAP_GRAPH_NAMESPACE) {
      return reject("invalid_namespace", "Graph transaction uses an unknown namespace.");
    }
    if (
      !request.transactionId.trim()
      || !request.idempotencyKey.trim()
      || !Number.isInteger(request.expectedRevision)
      || request.expectedRevision < 0
    ) {
      return reject("invalid_transaction", "Graph transaction identity or revision is invalid.");
    }
    if (request.events.length === 0) {
      return reject("empty_event_batch", "Graph transaction must contain at least one event.");
    }

    const fingerprint = await this.hashCanonical(canonicalJson(request));
    const receiptKey = key(request.workspace, request.idempotencyKey);
    const priorReceipt = this.receipts.get(receiptKey);
    if (priorReceipt) {
      return priorReceipt.fingerprint === fingerprint
        ? { ok: true, receipt: { ...priorReceipt.receipt, idempotent: true } }
        : reject("idempotency_conflict", "Idempotency key is bound to different graph data.");
    }

    const currentState = this.states.get(request.workspace) ?? emptyGraphState(request.workspace);
    if (currentState.revision !== request.expectedRevision) {
      return reject("stale_revision", "Graph revision changed before the transaction.", {
        expectedRevision: request.expectedRevision,
        currentRevision: currentState.revision,
      });
    }

    const existingEvents = this.events.get(request.workspace) ?? [];
    const existingEventIds = new Set(existingEvents.map((event) => event.eventId));
    const batchEventIds = new Set<string>();
    for (const [index, event] of request.events.entries()) {
      const expectedSequence = request.expectedRevision + index + 1;
      if (event.sequence !== expectedSequence) {
        return reject("non_contiguous_event_sequence", "Graph event batch is not contiguous.", {
          actualSequence: event.sequence,
          expectedSequence,
        });
      }
      if (
        event.namespace !== MINDMAP_GRAPH_NAMESPACE
        || event.workspace !== request.workspace
        || !event.eventId.trim()
        || existingEventIds.has(event.eventId)
        || batchEventIds.has(event.eventId)
      ) {
        return reject("duplicate_identity", "Graph event identity is invalid or already used.", {
          eventId: event.eventId,
        });
      }
      batchEventIds.add(event.eventId);
      if (event.payload.type === "payload_put") {
        const actualHash = await this.hashPayload(event.payload.record);
        if (actualHash !== event.payload.record.contentHash) {
          return reject("payload_hash_mismatch", "Payload content does not match its content hash.", {
            contentHash: event.payload.record.contentHash,
          });
        }
      }
    }

    let nextState = canonicalClone(currentState);
    try {
      for (const event of request.events) nextState = applyGraphEvent(nextState, event);
      validateCompleteGraphState(nextState);
      await this.beforeCommit?.({ request: canonicalClone(request), nextState: canonicalClone(nextState) });
    } catch (error) {
      if (error instanceof GraphInvariantError) {
        return reject(error.code, error.message, error.details);
      }
      return reject("transaction_aborted", error instanceof Error ? error.message : String(error));
    }

    const canonicalState = canonicalGraphState(nextState);
    const stateContentHash = await this.hashCanonical(canonicalJson(canonicalState));
    const receipt: GraphCommitReceipt = Object.freeze({
      transactionId: request.transactionId,
      idempotencyKey: request.idempotencyKey,
      workspace: request.workspace,
      revision: canonicalState.revision,
      firstSequence: request.events[0].sequence,
      lastSequence: request.events.at(-1)?.sequence ?? request.events[0].sequence,
      stateContentHash,
      idempotent: false,
    });

    this.states.set(request.workspace, canonicalClone(canonicalState));
    this.events.set(request.workspace, canonicalClone([...existingEvents, ...request.events]));
    this.receipts.set(receiptKey, { fingerprint, receipt: canonicalClone(receipt) });
    return { ok: true, receipt };
  }
}
