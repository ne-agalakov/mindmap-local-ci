# MindMap Local v0.6-alpha.19

MindMap is a local-first personal AI system intended to turn a stream of thoughts into understanding, connections, priorities, decisions, actions, results, and durable memory.

## Current status

Alpha.19 remains a frozen research prototype and must not receive real personal data.

Accepted foundations:

- Phase 0 exact legacy evidence: merge `850a5fc60a154047eae1f6a5d4f63c7969ae8412`;
- Phase 1A pure state core: merge `e7b7593932614f8dfa843298f35eff0230c1e827`;
- Phase 2A transactional storage contract and ADR: merge `aa5eaaae08a3da4d0ff00ea03aea12b793137a21`;
- Phase 2B native IndexedDB adapter: merge `b4b35dcd7125c820f75f89387bc18ac3fa509cb0`.

Phase 2C-A is implemented in PR #38 but is **not accepted**. The verified code head is:

```text
02df8758a7c42b33b22b397dae74445cd6a5f7ac
```

A focused offline real-Chrome IndexedDB proof passed on the target Mac. GitHub Actions, downloaded-artifact, Drive synchronization and merge-provenance gates remain open.

## Accepted Phase 2B adapter

Phase 2B final reviewed head:

```text
5a8b4f6a418b465da7383d7c999485bae1f9a900
```

Code head:

```text
2ced13b72d1f582028348bedc2ca6a7ef0e57246
```

The adapter under `storage/indexeddb/` implements the accepted `TransactionalStateStorage` port:

- validated database names under `mindmap-state-core-v1*`;
- legacy `mindmap-local-semantic-v060` refusal before `indexedDB.open`;
- versioned meta, runs, events, artifacts and receipts stores;
- one atomic transaction for event batch, aggregate, artifacts and receipt;
- transaction completion as the commit signal;
- final revision/content-hash recheck across adapter instances;
- deterministic replay and content-hash validation;
- reopen-stable idempotency and conflict detection;
- synthetic/personal compound-key isolation;
- abort rollback and schema-upgrade rollback;
- deterministic snapshot after close/reopen.

The same adapter passed `fake-indexeddb` and actual headless Chrome IndexedDB:

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

The first browser workflow passed all storage assertions but exposed a temporary Chrome-profile cleanup race. The runner now waits for Chrome/server termination before cleanup; the repeated workflow passed.

## Final Phase 2B evidence

- Linux full + actual Chrome harness: passed;
- macOS targeted: passed;
- source and compact-exporter packaging: passed;
- GitHub Actions artifact SHA-256: `706a463af20e4cc1aaa956a8e0812376886e543e83f249aa1359b9ce673881c7`;
- inner source ZIP SHA-256: `9c338e5a3b4e13d8b81bdafcf592fab30fa9e7a41034b9c5e1a21fd25494e2c2`;
- inner exporter ZIP SHA-256: `e69444565228be51418a499f6d778fb91741b95f780f15c2fc8b3da850a2ebd9`;
- embedded commit, portable checksums, required files, privacy and credential scans passed;
- Google Drive was updated after merge and read back.

## Phase 2C-A — implemented, not accepted

PR #38 adds:

- canonical `mindmap-graph-v1` records for content payloads, thoughts, typed hierarchy, placement/unresolved, links, embeddings and damaged references;
- deterministic graph event replay and snapshot hashes;
- strict graph invariants and proposal lifecycle rules;
- serialized in-memory reference storage;
- native IndexedDB graph storage sharing a fresh unified database with the accepted run adapter;
- atomic graph events, materialized state and idempotency receipt;
- corruption refusal, abort rollback and workspace isolation;
- focused fake-IndexedDB and actual-browser harnesses.

The target-Mac proof is bound to exact code head `02df8758a7c42b33b22b397dae74445cd6a5f7ac`:

```text
browserIndexedDb: true
atomicCommit: true
reopen: true
idempotency: true
workspaceIsolation: true
runAdapterCompatibility: true
abortRollback: true
runOnlyRefusal: true
corruption follow-up: integrity_mismatch
snapshotHash: ee7f14540dbc394654b81e1724dc35b0b01f8d13f303ab03a157e5c1079b4fc1
```

Evidence:

- proof JSON SHA-256: `5b47e3681a23474d21ee2f703c93a94a8f79d2b93c11e65642667ce8283b97bc`;
- offline runner ZIP SHA-256: `aef0111128e2182218081ef2fa5536e24bde3bc4383961455e5150c5ba559419`;
- browser harness SHA-256: `ecfee87cac41410a2d1f5b71f3c1a90303f53f42afcf3007c11dd33b6ba2231a`;
- no npm, Vite, private data, migration or model calls were used.

During the run macOS displayed a Terminal application-management warning. The runner source contains no write path into `/Applications`; the warning origin remains unresolved and is recorded without being treated as a proven code failure.

GitHub `verify` and `package-source` runs, including a manual retry, failed before their first step and produced no step logs or artifacts. This is an unresolved infrastructure blocker, not a passed gate and not evidence that the test suite failed.

See `docs/architecture/PHASE2CA_VERIFICATION.md` and `docs/evidence/phase2ca-macos-indexeddb-proof.json`.

Commands:

```bash
npm run install:ci
npm run test:state-core
npm run test:storage-contract
npm run test:indexeddb-storage
npm run test:graph-storage
npm run test:browser-storage
npm run test:browser-graph-storage
npm test
npm run package:source
```

## Exact legacy evidence

```text
Diagnostics SHA-256: 5fbcf8eb9ee8abf32939707270761568e56a6b3ca7a347e3953212baf0cd18e5
Database SHA-256:    356b943275cce292d0e14f8a7fbe95af07e79de73f06d3e361874d342aa2f918
Database size:       5,070,848 bytes
Evidence SHA-256:    51e3d9563b09c91427716eee559745fed35d729e9ffd71f180afa91c3fc7aa2b
```

The source remains private and immutable. PR #17 remains closed unmerged research input.

## Preserved boundary

Still prohibited:

- Candidate 5 continuation;
- Qwen or DeepSeek execution;
- Candidate 6;
- opening, writing or repairing the legacy database;
- Phase 2C-B before Phase 2C-A acceptance;
- actual target-Mac migration or target-Mac production-storage change;
- production runtime/UI integration and REQ-OBS-001 claims;
- semantic claims or personal data.

## Next verified step

Restore a runnable GitHub Actions gate for PR #38. Run full verification and packaging on the exact final head, download and inspect the artifact, synchronize Drive and reverse-read it, then merge with exact provenance. Only that acceptance may unblock the separate Phase 2C-B exact-source isolated dry run. Actual target-Mac migration remains prohibited.
