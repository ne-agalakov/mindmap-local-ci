# MindMap Local v0.6-alpha.19

MindMap is a local-first personal AI system intended to turn a stream of thoughts into understanding, connections, priorities, decisions, actions, results and durable memory.

## Current status

Alpha.19 remains a frozen research prototype and must not receive real personal data.

Accepted foundations:

- Phase 0 exact legacy evidence: merge `850a5fc60a154047eae1f6a5d4f63c7969ae8412`;
- Phase 1A pure state core: merge `e7b7593932614f8dfa843298f35eff0230c1e827`;
- Phase 2A transactional storage contract and ADR: merge `aa5eaaae08a3da4d0ff00ea03aea12b793137a21`;
- Phase 2B native IndexedDB adapter: merge `b4b35dcd7125c820f75f89387bc18ac3fa509cb0`.

Phase 2C-A is implemented in PR #38. Its code, focused target-Mac proof, public-mirror Linux/macOS/browser CI, packaging, downloaded-artifact inspection and Google Drive readback have passed. It is **not accepted until PR #38 is merged and exact merge provenance is recorded**.

## Phase 2C-A graph and payload storage

The implementation adds:

- canonical `mindmap-graph-v1` records for content payloads, thoughts, typed area/direction/project hierarchy, placement or `unresolved`, links, embeddings and damaged references;
- deterministic graph event replay and canonical snapshot hashes;
- strict hierarchy, placement, payload, embedding, link-lifecycle and workspace validation;
- serialized in-memory reference storage;
- native IndexedDB graph storage sharing a fresh unified database with the accepted run adapter;
- atomic graph events, materialized state and idempotency receipt;
- stale-revision and idempotency-conflict rejection;
- corruption refusal, abort rollback and synthetic/personal isolation;
- refusal to silently extend an existing run-only database.

Verified code head:

```text
02df8758a7c42b33b22b397dae74445cd6a5f7ac
```

Current private documentation head before the final gate:

```text
85b158ebed11f494fe7e4766453693de01d75bfe
```

## Target-Mac browser evidence

The offline real-Chrome proof passed:

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
- offline runner ZIP: `aef0111128e2182218081ef2fa5536e24bde3bc4383961455e5150c5ba559419`;
- executed harness: `ecfee87cac41410a2d1f5b71f3c1a90303f53f42afcf3007c11dd33b6ba2231a`.

The macOS application-management warning remains an unexplained environmental anomaly. The runner contains no write path into `/Applications`; the warning is neither ignored nor represented as a proven code failure.

## Public CI mirror evidence

Private GitHub Actions could not start because the account's private minutes were exhausted. A separate public mirror was created from a history-free, audited snapshot:

```text
private source: 85b158ebed11f494fe7e4766453693de01d75bfe
public snapshot: f4f7d3a127fd0ed3c09431f24ade3acd73b78810
tree:            5c7dc8a0cf607ce24f591ba91c4431d30f035f51
snapshot digest: 7fa3dc7f0fedcd8b6f96d309fecb178a1e6d1a3b7919eec928809be5ea6988f4
```

Repeated public gates on the unchanged tree passed:

- verify run `30196934408`: Linux full, lint, complete test suite, actual Chrome run-storage and graph-storage harnesses, macOS launchers;
- package-source run `30196934411`: full tests, source packaging, compact exporter packaging and artifact upload.

Downloaded artifacts were inspected outside the runner:

- source artifact: `c26b5d16138713b69eba3aedba1d84512cac8e0c9429a598921a8ead8fab1c67`;
- inner source ZIP: `ce8dded192e282a15faf652e2dd9b68aec4fd045403ef5a6027c4e25f155c45b`;
- inner exporter ZIP: `fcc1c4522d3151b4884df2cf32bde6dc0c34279ced4bf0c22266216414d431c8`;
- browser proof artifact: `bdb578601f74b7214b8a51c0d3a3c1b1d8b6bab47f79a555d554ec7a504dbb31`.

No database, `.env`, credential, local `/Users/...` path, runtime cache, personal data or model path was found.

The target-Mac and GitHub browser snapshot hashes are not compared as one state because the harnesses use different fixed payloads, IDs and timestamps. Each harness proves close/reopen equality for its own fixture. Same-fixture cross-environment hash equality remains an explicit uncovered regression.

## Commands

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

## Preserved boundary

Still prohibited:

- Candidate 5 continuation;
- Qwen or DeepSeek execution;
- Candidate 6;
- opening, writing or repairing the legacy database;
- Phase 2C-B before Phase 2C-A merge provenance;
- actual target-Mac migration or production-storage change;
- runtime/UI integration and REQ-OBS-001 claims;
- semantic claims or personal data.

## Next verified step

Run the exact final documentation head through the public mirror, download and inspect its artifacts, merge PR #38 with an expected-head guard, and record the merge SHA in a separate provenance update with Google Drive readback. Only then may Phase 2C-B planning begin. Actual migration remains prohibited.
