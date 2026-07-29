# MindMap Local v0.6-alpha.19

MindMap is a local-first personal AI system for turning thoughts into understanding, decisions, actions, results and durable memory.

## Current status

Alpha.19 remains a frozen legacy research runtime. Real personal thoughts must not be loaded.

Accepted foundations:

- Phase 0 exact legacy source — `850a5fc60a154047eae1f6a5d4f63c7969ae8412`;
- Phase 1A pure state-core — `e7b7593932614f8dfa843298f35eff0230c1e827`;
- Phase 2A transactional storage contract — `aa5eaaae08a3da4d0ff00ea03aea12b793137a21`;
- Phase 2B native IndexedDB run storage — `b4b35dcd7125c820f75f89387bc18ac3fa509cb0`;
- Phase 2C-A graph/payload storage — `292634312ad04fa6e6cfc5a5ded311ac1020094d`;
- Phase 2C-B0 mapping/typed stops — `dbf2484c78e4eedcbb2efb3f0b61394b79a6d216`;
- Phase 2C-B1a sanitized executor — `aec5edaca877cec5d769f4ce4efff674a9c92a7d`;
- Phase 2C-B1b exact-source read-only dry run — `4fd14e515d2c4234f70effa475381f47bbb50e8b`;
- Phase 2C-C0 generation/registry architecture — `31657e218cd5891e9e915f698febf8ac72942ed3`.

## Phase 2C-B1a — accepted

B1a remains accepted only for its sanitized executor, rollback and observability boundary.

## Phase 2C-B1b — accepted boundary

The single exact-source B1b read-only attempt passed and is consumed. The source remained byte-identical; repeat hashes matched; injected rollback left no target or receipt; network/model calls were zero; actual migration was false.

## Phase 2C-C0 — accepted

C0 selects immutable generation databases and one atomic control-registry pointer transaction:

```text
control registry:  mindmap-state-core-control-v1
generation prefix: mindmap-state-core-v1-generation-
```

Promotion is a pointer change after reopen, verification and seal. Rollback restores the previous pointer and never edits generation payload.

## Phase 2C-C1 — implementation verified, acceptance pending

C1 implements pure deterministic TypeScript contracts/state machine on sanitized fixtures only:

- immutable artifact/source/backup/registry/generation/authorization identities;
- closed attempt states and typed commands/events/rejections/stops;
- append-only reducer, replay, canonical hashing and idempotency;
- expected registry revision and previous-pointer guards;
- pure promotion and rollback plans without data copy or payload mutation;
- terminal blocked recovery before promotion and explicit rollback after promotion;
- sanitized evidence and structural exclusion of browser, IndexedDB, filesystem, network, model, clock, randomness and exact-source paths.

Implementation proof:

```text
private head: ac639e625b6d0ced665c748c2c58f6b3753c4ffc
public head:  0eeb9fea5792b7fbf33db0061abc2f271db3b17f
shared tree:  2a536a54779634647eff8ebf2476840c257b2813
verify run:   30442139981
package run:  30442139989
```

All 9 C1 tests passed. Downloaded artifacts passed checksums, checkout provenance, executable-mode and privacy review.

C1 is not accepted until the final documentation tree is mirrored, rerun, inspected and PR #52 is merged from its factual head.

## Preserved boundary

Still prohibited:

- reopening the exact SQLite or repeating B1b;
- real backup, registry or generation creation;
- IndexedDB/runtime integration before C2;
- actual migration, promotion or rollback on the target Mac;
- automatic retry/resume;
- model/network calls and personal data.
