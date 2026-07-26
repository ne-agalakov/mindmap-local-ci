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
  upgradeRollback?: boolean;
  snapshotHash?: string;
  error?: string;
}>;

declare global {
  interface Window {
    __MINDMAP_STORAGE_HARNESS_RESULT__?: HarnessResult;
  }
}

const resultElement = document.querySelector<HTMLPreElement>("#result");
const databasePrefix = `${STATE_STORAGE_NAMESPACE}-browser-harness`;

function show(result: HarnessResult): void {
  window.__MINDMAP_STORAGE_HARNESS_RESULT__ = result;
  if (resultElement) {
    resultElement.dataset.status = result.ok ? "passed" : "failed";
    resultElement.textContent = JSON.stringify(result, null, 2);
  }
  document.title = result.ok ? "PASS — MindMap IndexedDB Harness" : "FAIL — MindMap IndexedDB Harness";
}

async function hashCanonical(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function deleteDatabase(name: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(name);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error(`delete_failed:${name}`));
    request.onblocked = () => reject(new Error(`delete_blocked:${name}`));
  });
}

function identity(workspace: "synthetic" | "personal") {
  return Object.freeze({
    runId: "browser-run",
    workspace,
    datasetId: "approved-96-v1",
    orderVariant: "original",
    semanticModel: "qwen3:8b",
    embeddingModel: "embeddinggemma",
    pipelineVersion: "state-core-v1",
    buildId: "phase2b-browser-harness",
    storageSchema: STATE_STORAGE_NAMESPACE,
  });
}

function createCommit(workspace: "synthetic" | "personal", suffix: string) {
  const runIdentity = identity(workspace);
  const created = createRun(runIdentity, "preflight", {
    commandId: `command-${suffix}`,
    expectedRevision: 0,
    occurredAt: `2026-07-25T19:00:${workspace === "synthetic" ? "01" : "02"}.000Z`,
  });
  if (!created.ok) throw new Error(`create_run_rejected:${created.rejection.code}`);
  return {
    aggregate: created.aggregate,
    request: {
      namespace: STATE_STORAGE_NAMESPACE,
      transactionId: `transaction-${suffix}`,
      idempotencyKey: `transaction-${suffix}:idem`,
      workspace,
      runId: runIdentity.runId,
      expectedRevision: 0,
      events: created.events,
      aggregate: created.aggregate,
    },
  };
}

async function runMainDatabase(): Promise<Pick<HarnessResult,
  "atomicCommit" | "reopen" | "idempotency" | "workspaceIsolation" | "snapshotHash"
>> {
  const databaseName = `${databasePrefix}-main`;
  await deleteDatabase(databaseName);

  const synthetic = createCommit("synthetic", "synthetic");
  const personal = createCommit("personal", "personal");
  const store = new NativeIndexedDbStorage({ indexedDB, databaseName, hashCanonical });
  const syntheticCommit = await store.commit(synthetic.request);
  const personalCommit = await store.commit(personal.request);
  if (!syntheticCommit.ok || !personalCommit.ok) throw new Error("browser_commit_failed");

  const syntheticRun = await store.loadRun("synthetic", "browser-run");
  const personalRun = await store.loadRun("personal", "browser-run");
  if (!syntheticRun || !personalRun) throw new Error("workspace_run_missing");
  if (syntheticRun.aggregate.identity.workspace !== "synthetic") throw new Error("synthetic_workspace_corrupted");
  if (personalRun.aggregate.identity.workspace !== "personal") throw new Error("personal_workspace_corrupted");
  const firstSnapshot = await store.exportSnapshot();
  store.close();

  const reopened = new NativeIndexedDbStorage({ indexedDB, databaseName, hashCanonical });
  const reopenedRun = await reopened.loadRun("synthetic", "browser-run");
  const repeated = await reopened.commit(synthetic.request);
  const secondSnapshot = await reopened.exportSnapshot();
  if (!reopenedRun || reopenedRun.revision !== 1) throw new Error("reopen_revision_mismatch");
  if (!repeated.ok || repeated.receipt.idempotent !== true) throw new Error("reopen_idempotency_failed");
  if (firstSnapshot.contentHash !== secondSnapshot.contentHash) throw new Error("snapshot_hash_changed_after_reopen");
  reopened.close();
  await deleteDatabase(databaseName);

  return {
    atomicCommit: syntheticCommit.receipt.revision === 1 && personalCommit.receipt.revision === 1,
    reopen: true,
    idempotency: true,
    workspaceIsolation: true,
    snapshotHash: firstSnapshot.contentHash,
  };
}

async function runAbortDatabase(): Promise<boolean> {
  const databaseName = `${databasePrefix}-abort`;
  await deleteDatabase(databaseName);
  const created = createCommit("synthetic", "abort");
  const store = new NativeIndexedDbStorage({
    indexedDB,
    databaseName,
    hashCanonical,
    testHooks: {
      afterWriteRequestsQueued(transaction) {
        transaction.abort();
      },
    },
  });
  const result = await store.commit(created.request);
  const run = await store.loadRun("synthetic", "browser-run");
  const events = await store.loadEvents("synthetic", "browser-run");
  store.close();
  await deleteDatabase(databaseName);
  return !result.ok && result.rejection.code === "transaction_aborted" && run === undefined && events.length === 0;
}

async function runUpgradeDatabase(): Promise<boolean> {
  const databaseName = `${databasePrefix}-upgrade`;
  await deleteDatabase(databaseName);
  const created = createCommit("synthetic", "upgrade");
  const versionOne = new NativeIndexedDbStorage({
    indexedDB,
    databaseName,
    databaseVersion: 1,
    hashCanonical,
  });
  const committed = await versionOne.commit(created.request);
  if (!committed.ok) throw new Error("upgrade_fixture_commit_failed");
  versionOne.close();

  const failedUpgrade = new NativeIndexedDbStorage({
    indexedDB,
    databaseName,
    databaseVersion: 2,
    hashCanonical,
    testHooks: {
      beforeUpgradeComplete() {
        throw new Error("browser_simulated_upgrade_failure");
      },
    },
  });
  let rejected = false;
  try {
    await failedUpgrade.loadRun("synthetic", "browser-run");
  } catch (error) {
    rejected = error instanceof Error && error.message.includes("browser_simulated_upgrade_failure");
  }
  failedUpgrade.close();

  const reopenedVersionOne = new NativeIndexedDbStorage({
    indexedDB,
    databaseName,
    databaseVersion: 1,
    hashCanonical,
  });
  const run = await reopenedVersionOne.loadRun("synthetic", "browser-run");
  reopenedVersionOne.close();
  await deleteDatabase(databaseName);
  return rejected && run?.revision === 1;
}

async function main(): Promise<void> {
  try {
    if (!("indexedDB" in globalThis)) throw new Error("browser_indexeddb_unavailable");
    const mainResult = await runMainDatabase();
    const abortRollback = await runAbortDatabase();
    const upgradeRollback = await runUpgradeDatabase();
    if (!abortRollback) throw new Error("browser_abort_rollback_failed");
    if (!upgradeRollback) throw new Error("browser_upgrade_rollback_failed");
    show({
      ok: true,
      browserIndexedDb: true,
      ...mainResult,
      abortRollback,
      upgradeRollback,
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
