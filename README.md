# MindMap Local v0.6-alpha.19

MindMap is a local-first personal AI system for turning thoughts into understanding, decisions, actions, results and durable memory.

## Current status

Alpha.19 remains a frozen legacy research runtime. Real personal thoughts must not be loaded.

Accepted foundations:

- Phase 0 exact legacy source — `850a5fc60a154047eae1f6a5d4f63c7969ae8412`;
- Phase 1A pure state-core — `e7b7593932614f8dfa843298f35eff0230c1e827`;
- Phase 2A storage contract — `aa5eaaae08a3da4d0ff00ea03aea12b793137a21`;
- Phase 2B native IndexedDB run storage — `b4b35dcd7125c820f75f89387bc18ac3fa509cb0`;
- Phase 2C-A graph/payload storage — `292634312ad04fa6e6cfc5a5ded311ac1020094d`;
- Phase 2C-B0 mapping/typed stops — `dbf2484c78e4eedcbb2efb3f0b61394b79a6d216`;
- Phase 2C-B1a sanitized executor — `aec5edaca877cec5d769f4ce4efff674a9c92a7d`;
- Phase 2C-B1b exact-source read-only dry run — `4fd14e515d2c4234f70effa475381f47bbb50e8b`;
- Phase 2C-C0 generation/registry architecture — `31657e218cd5891e9e915f698febf8ac72942ed3`;
- Phase 2C-C1 pure generation contracts — `f8ac03fbb24493dbeac7385687b3f4a93eb10bf8`.

## Phase 2C-B1a — accepted

B1a is accepted only for its sanitized executor, rollback and observability boundary.

## Phase 2C-B1b — accepted boundary

The single exact-source B1b read-only attempt passed and is consumed. The source remained byte-identical; repeat hashes matched; injected rollback left no target or receipt; network/model calls were zero; actual migration was false. B1b must not be repeated.

## Phase 2C-C0 — accepted

C0 selects immutable generation databases and one atomic control-registry pointer transaction:

```text
control registry:  mindmap-state-core-control-v1
generation prefix: mindmap-state-core-v1-generation-
```

Promotion is a pointer change after reopen, verification and seal. Rollback restores the previous pointer and never edits generation payload.

## Phase 2C-C1 — accepted

C1 pure contracts/state machine were accepted by merge `f8ac03fbb24493dbeac7385687b3f4a93eb10bf8`.

```text
private head: 6fe3b07c5a2cb0ba8a42528799f74569bbea885a
public head:  dede561068650d9302c0570c22286f3cc3bb6da2
shared tree:  9ad59159129eab08e77d4f435f40dd410754a81a
verify:       30443877441
package:      30443877425
```

C1 proves deterministic identities, transitions, replay, idempotency, one-shot authorization, revision/pointer guards, blocked recovery and explicit rollback plans on sanitized in-memory fixtures. It does not prove native persistence.

## Phase 2C-C2 — implementation verified, acceptance pending

C2 implements the accepted C1 contract in native IndexedDB fixture namespaces:

- separate immutable generation seal storage;
- control registry with active pointers, attempts, events, seal attestations and receipts;
- atomic promotion and explicit rollback;
- revision, previous-pointer and idempotency guards;
- injected promotion/rollback abort with no partial mutation;
- deterministic close/reopen;
- persisted `blocked_recovery` and `rollback_required`;
- actual Chrome proof, REQ-OBS-001 trace and downloadable sanitized diagnostics.

Candidate identity:

```text
private head: 57472ea9b54f1f967b064ff305e187222a29ba30
public head:  b58bfbaa8c535c3bcfb73f135263906e9a2c7777
shared tree:  088cdf17babc38f559559aa794360f2b1a4a9344
verify:       30455093681
package:      30455093613
```

Downloaded candidate artifacts passed checksums, checkout provenance, inventory and privacy review. C2 is not accepted until the final documentation tree is mirrored, rerun, inspected and factually merged.

## Preserved boundary

Still prohibited:

- reopening the exact SQLite or repeating B1b;
- private backup access;
- production registry/generation creation on the target Mac;
- C3/C4 execution;
- actual migration, production promotion or rollback;
- automatic retry/resume;
- model/network calls and personal data.
