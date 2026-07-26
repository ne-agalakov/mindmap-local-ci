import { MINDMAP_GRAPH_NAMESPACE } from "../../graph-storage/contracts.ts";
import { NativeIndexedDbGraphStorage } from "../../graph-storage/indexeddb/native-indexeddb-graph-storage.ts";
import { STATE_STORAGE_NAMESPACE } from "../../storage/contracts.ts";
import { NativeIndexedDbStorage } from "../../storage/indexeddb/native-indexeddb-storage.ts";
import { createRun } from "../../state-core/run-state-core.ts";

type HarnessResult = Readonly<{
  ok: boolean;
  browserIndexedDb: boolean;
  atomicCommit?: boolean;
  reopen?: boolean;
  idempotency?: boolean;
  workspaceIsolation?: boolean;
  abortRollback?: boolean;
  runAdapterCompatibility?: boolean;
  runOnlyRefusal?: boolean;
  snapshotHash?: string;
  error?: string;
}>;

declare global {
  interface Window {
    __MINDMAP_GRAPH_STORAGE_HARNESS_RESULT__?: HarnessResult;
  }
}

const resultElement = document.querySelector<HTMLPreElement>("#result");
const prefix = `${STATE_STORAGE_NAMESPACE}-graph-browser-harness`;

function show(result: HarnessResult): void {
  window.__MINDMAP_GRAPH_STORAGE_HARNESS_RESULT__ = result;
  if (resultElement) {
    resultElement.dataset.status = result.ok ? "passed" : "failed";
    resultElement.textContent = JSON.stringify(result, null, 2);
  }
  document.title = result.ok
    ? "PASS — MindMap Graph IndexedDB Harness"
    : "FAIL — MindMap Graph IndexedDB Harness";
}

async function sha256Bytes(bytes: Uint8Array): Promise<string> {
  const input = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  const digest = await crypto.subtle.digest("SHA-256", input);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function hashCanonical(value: string): Promise<string> {
  return sha256Bytes(new TextEncoder().encode(value));
}

async function hashPayload(record: Readonly<{ encoding: string; data: string }>): Promise<string> {
  if (record.encoding === "base64" || record.encoding === "float32-le-base64") {
    const binary = atob(record.data);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    return sha256Bytes(bytes);
  }
  return sha256Bytes(new TextEncoder().encode(record.data));
}

function deleteDatabase(name: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(name);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error(`delete_failed:${name}`));
    request.onblocked = () => reject(new Error(`delete_blocked:${name}`));
  });
}

function graphRequest(workspace: "synthetic" | "personal", suffix: string) {
  const text = `Browser graph thought ${workspace} ${suffix}`;
  const bytes = new TextEncoder().encode(text);
  return sha256Bytes(bytes).then((contentHash) => {
    const payload = {
      namespace: MINDMAP_GRAPH_NAMESPACE,
      workspace,
      contentHash,
      kind: "thought-text" as const,
      mediaType: "text/plain; charset=utf-8",
      encoding: "utf8" as const,
      byteLength: bytes.byteLength,
      data: text,
    };
    const thought = {
      namespace: MINDMAP_GRAPH_NAMESPACE,
      workspace,
      thoughtId: `thought-${suffix}`,
      revision: 1,
      textPayloadHash: contentHash,
      semanticType: "observation" as const,
      status: "inbox" as const,
      createdAt: "2026-07-25T22:30:00.000Z",
      updatedAt: "2026-07-25T22:30:00.000Z",
    };
    const placement = {
      namespace: MINDMAP_GRAPH_NAMESPACE,
      workspace,
      thoughtId: thought.thoughtId,
      revision: 1,
      kind: "unresolved" as const,
      reason: "awaiting_review" as const,
      updatedAt: "2026-07-25T22:30:00.000Z",
    };
    return {
      namespace: MINDMAP_GRAPH_NAMESPACE,
      transactionId: `graph-${suffix}`,
      idempotencyKey: `graph-${suffix}:idem`,
      workspace,
      expectedRevision: 0,
      events: [
        {
          namespace: MINDMAP_GRAPH_NAMESPACE,
          workspace,
          sequence: 1,
          eventId: `graph-${suffix}-payload`,
          occurredAt: "2026-07-25T22:30:01.000Z",
          payload: { type: "payload_put" as const, record: payload },
        },
        {
          namespace: MINDMAP_GRAPH_NAMESPACE,
          workspace,
          sequence: 2,
          eventId: `graph-${suffix}-thought`,
          occurredAt: "2026-07-25T22:30:02.000Z",
          payload: { type: "thought_put" as const, record: thought },
        },
        {
          namespace: MINDMAP_GRAPH_NAMESPACE,
          workspace,
          sequence: 3,
          eventId: `graph-${suffix}-placement`,
          occurredAt: "2026-07-25T22:30:03.000Z",
          payload: { type: "placement_put" as const, record: placement },
        },
      ],
    };
  });
}

function runCommitRequest() {
  const identity = Object.freeze({
    runId: "browser-unified-run",
    workspace: "synthetic" as const,
    datasetId: "approved-96-v1",
    orderVariant: "original",
    semanticModel: "qwen3:8b",
    embeddingModel: "embeddinggemma",
    pipelineVersion: "state-core-v1",
    buildId: "phase2ca-browser-harness",
    storageSchema: STATE_STORAGE_NAMESPACE,
  });
  const created = createRun(identity, "preflight", {
    commandId: "browser-unified-run-create",
    expectedRevision: 0,
    occurredAt: "2026-07-25T22:31:00.000Z",
  });
  if (!created.ok) throw new Error(`run_fixture_rejected:${created.rejection.code}`);
  return {
    identity,
    request: {
      namespace: STATE_STORAGE_NAMESPACE,
      transactionId: "browser-unified-run-transaction",
      idempotencyKey: "browser-unified-run-transaction:idem",
      workspace: "synthetic" as const,
      runId: identity.runId,
      expectedRevision: 0,
      events: created.events,
      aggregate: created.aggregate,
    },
  };
}

async function verifyUnifiedDatabase(): Promise<Pick<HarnessResult,
  "atomicCommit" | "reopen" | "idempotency" | "workspaceIsolation" | "runAdapterCompatibility" | "snapshotHash"
>> {
  const name = `${prefix}-unified`;
  await deleteDatabase(name);
  const synthetic = await graphRequest("synthetic", "same-id");
  const personal = await graphRequest("personal", "same-id");
  const graph = new NativeIndexedDbGraphStorage({ indexedDB, databaseName: name, hashCanonical, hashPayload });
  const syntheticCommit = await graph.commit(synthetic);
  const personalCommit = await graph.commit(personal);
  if (!syntheticCommit.ok || !personalCommit.ok) throw new Error("graph_browser_commit_failed");
  const firstSnapshot = await graph.exportSnapshot("synthetic");
  graph.close();

  const reopened = new NativeIndexedDbGraphStorage({ indexedDB, databaseName: name, hashCanonical, hashPayload });
  const repeated = await reopened.commit(synthetic);
  const secondSnapshot = await reopened.exportSnapshot("synthetic");
  const personalState = await reopened.load("personal");
  if (!repeated.ok || repeated.receipt.idempotent !== true) throw new Error("graph_browser_idempotency_failed");
  if (firstSnapshot.contentHash !== secondSnapshot.contentHash) throw new Error("graph_browser_snapshot_changed");
  if (personalState.thoughts[0]?.workspace !== "personal") throw new Error("graph_browser_workspace_mixed");
  reopened.close();

  const runFixture = runCommitRequest();
  const runStore = new NativeIndexedDbStorage({ indexedDB, databaseName: name, hashCanonical });
  const runResult = await runStore.commit(runFixture.request);
  if (!runResult.ok) throw new Error(`unified_run_commit_failed:${runResult.rejection.code}`);
  const loadedRun = await runStore.loadRun("synthetic", runFixture.identity.runId);
  runStore.close();
  if (loadedRun?.revision !== 1) throw new Error("unified_run_reopen_failed");

  const graphAfterRun = new NativeIndexedDbGraphStorage({ indexedDB, databaseName: name, hashCanonical, hashPayload });
  const graphState = await graphAfterRun.load("synthetic");
  graphAfterRun.close();
  if (graphState.thoughts.length !== 1) throw new Error("unified_run_damaged_graph");
  await deleteDatabase(name);

  return {
    atomicCommit: syntheticCommit.receipt.revision === 3,
    reopen: true,
    idempotency: true,
    workspaceIsolation: true,
    runAdapterCompatibility: true,
    snapshotHash: firstSnapshot.contentHash,
  };
}

async function verifyAbortRollback(): Promise<boolean> {
  const name = `${prefix}-abort`;
  await deleteDatabase(name);
  const request = await graphRequest("synthetic", "abort");
  const graph = new NativeIndexedDbGraphStorage({
    indexedDB,
    databaseName: name,
    hashCanonical,
    hashPayload,
    testHooks: {
      afterWriteRequestsQueued(transaction) {
        transaction.abort();
      },
    },
  });
  const result = await graph.commit(request);
  const state = await graph.load("synthetic");
  const events = await graph.loadEvents("synthetic");
  graph.close();
  await deleteDatabase(name);
  return !result.ok && result.rejection.code === "transaction_aborted" && state.revision === 0 && events.length === 0;
}

async function verifyRunOnlyRefusal(): Promise<boolean> {
  const name = `${prefix}-run-only`;
  await deleteDatabase(name);
  const runOnly = new NativeIndexedDbStorage({ indexedDB, databaseName: name, hashCanonical });
  await runOnly.loadRun("synthetic", "missing");
  runOnly.close();

  const graph = new NativeIndexedDbGraphStorage({ indexedDB, databaseName: name, hashCanonical, hashPayload });
  let refused = false;
  try {
    await graph.load("synthetic");
  } catch (error) {
    refused = error instanceof Error && error.message.includes("unified_graph_schema_missing");
  }
  graph.close();

  const runReopened = new NativeIndexedDbStorage({ indexedDB, databaseName: name, hashCanonical });
  const unchanged = await runReopened.loadRun("synthetic", "missing");
  runReopened.close();
  await deleteDatabase(name);
  return refused && unchanged === undefined;
}

async function main(): Promise<void> {
  try {
    if (!("indexedDB" in globalThis)) throw new Error("browser_indexeddb_unavailable");
    const unified = await verifyUnifiedDatabase();
    const abortRollback = await verifyAbortRollback();
    const runOnlyRefusal = await verifyRunOnlyRefusal();
    if (!abortRollback) throw new Error("graph_browser_abort_rollback_failed");
    if (!runOnlyRefusal) throw new Error("graph_browser_run_only_refusal_failed");
    show({
      ok: true,
      browserIndexedDb: true,
      ...unified,
      abortRollback,
      runOnlyRefusal,
    });
  } catch (error) {
    show({
      ok: false,
      browserIndexedDb: "indexedDB" in globalThis,
      error: error instanceof Error ? `${error.message}\n${error.stack ?? ""}` : String(error),
    });
  }
}

void main();
