# Phase 2B result — native IndexedDB adapter

Date: 2026-07-25

Status: accepted and merged. Phase 2C isolated migration dry-run is the next allowed boundary.

Issue: #19. Pull request: #33.

## Objective

Implement the native IndexedDB adapter selected by ADR-0001 against the accepted `TransactionalStateStorage` contract without opening the Alpha.19 database or executing migration.

## Accepted adapter

`storage/indexeddb/native-indexeddb-storage.ts` provides:

- native IndexedDB with versioned meta, runs, events, artifacts and receipts stores;
- validated `mindmap-state-core-v1*` database names;
- refusal of legacy `mindmap-local-semantic-v060` before `indexedDB.open`;
- one serialized writer per adapter;
- IndexedDB write serialization and final revision/content-hash recheck across adapter instances;
- one atomic transaction for event batch, aggregate, artifacts and receipt;
- transaction completion as the commit signal;
- typed abort/stale/idempotency/identity/replay rejections;
- deterministic replay and content-hash validation before write;
- reopen-stable idempotency and snapshots;
- compound workspace/run keys;
- schema-upgrade abort handling;
- no network, model or legacy sql.js path.

## Integration and browser evidence

`tests/native-indexeddb-storage-phase2b.test.mjs` covers legacy-name refusal, atomic persistence/reopen, idempotency/conflict, multi-instance stale writers, explicit abort rollback, workspace isolation, failed upgrade rollback, stable snapshot hash and forbidden dependencies.

The same adapter is Vite-built and executed in headless Chrome against actual browser IndexedDB:

```text
browserIndexedDb: true
atomicCommit: true
reopen: true
idempotency: true
workspaceIsolation: true
abortRollback: true
upgradeRollback: true
snapshotHash: 23c72cfd4768f5c76f0f376646fcbbd8a7630fb973e85704f460f19af6b27409
```

The first browser workflow exposed a cleanup race only after all storage assertions passed: Chrome still owned its temporary profile when deletion started. The runner now waits for Chrome/server termination and uses bounded cleanup retries. The repeated full workflow passed.

## Acceptance evidence

Code head:

```text
2ced13b72d1f582028348bedc2ca6a7ef0e57246
```

Final reviewed head:

```text
5a8b4f6a418b465da7383d7c999485bae1f9a900
```

PR #33 was squash-merged as:

```text
b4b35dcd7125c820f75f89387bc18ac3fa509cb0
```

Final proof:

- Linux full + actual Chrome harness: passed;
- macOS targeted: passed;
- source and compact-exporter packaging: passed;
- GitHub Actions artifact SHA-256: `706a463af20e4cc1aaa956a8e0812376886e543e83f249aa1359b9ce673881c7`;
- inner source ZIP SHA-256: `9c338e5a3b4e13d8b81bdafcf592fab30fa9e7a41034b9c5e1a21fd25494e2c2`;
- inner exporter ZIP SHA-256: `e69444565228be51418a499f6d778fb91741b95f780f15c2fc8b3da850a2ebd9`;
- portable checksums, embedded commit, required files, privacy and credential scans passed;
- changes after the code head were documentation/provenance/release-gate only;
- Google Drive was updated after merge and reverse-read.

No legacy database open/write, migration, network, Ollama, Qwen or DeepSeek call occurred.

## Source reconciliation

PR #17 remains closed unmerged research evidence only. Its competing API was not accepted or merged.

## Preserved boundary

Phase 2B does not:

- execute migration into the new database;
- change target-Mac storage;
- integrate storage into production runtime/UI;
- render REQ-OBS-001;
- prove service-level exactly-once model execution;
- use personal data;
- prove semantic quality or multi-order stability.

## Next gate

Phase 2C may implement a read-only exact-source migration dry run into a new isolated temporary target. It must prove source byte-stability, deterministic target hash, repeatability, typed stops and full rollback. Actual target-Mac migration remains prohibited.
