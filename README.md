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

## Phase 2C-B1b — accepted and consumed

The single exact-source B1b read-only attempt passed and is consumed. The source stayed byte-identical, injected rollback left no target or receipt, network/model calls were zero and actual migration was false. B1b must not be repeated.

## Phase 2C-C0 and C1 — accepted

C0 selects immutable generation databases and one atomic control-registry pointer transaction:

```text
control registry:  mindmap-state-core-control-v1
generation prefix: mindmap-state-core-v1-generation-
```

C1 pure contracts/state machine were accepted by merge `f8ac03fbb24493dbeac7385687b3f4a93eb10bf8`.

## Phase 2C-C2 — final proof complete, merge pending

C2 implements C1 in native IndexedDB fixture namespaces:

- separate immutable generation seal storage;
- registry with active pointers, attempts, events, seal attestations and receipts;
- atomic promotion and explicit rollback;
- revision, pointer, identity, hash and idempotency guards;
- promotion/rollback abort with no partial mutation;
- deterministic close/reopen;
- persisted `blocked_recovery` and `rollback_required`;
- actual Chrome proof, REQ-OBS-001 and downloadable sanitized diagnostics.

Final pre-merge identity:

```text
private head: 83eb9a06610ff737676b002837beadf6807926dd
public head:  cdd6939409d8bbb33da20c9875dc082cd2c39bd3
shared tree:  158527376a989b304f097006ba39488d79a04c8f
verify:       30516236010
package:      30516236013
private PR:   #54
```

Downloaded final artifacts passed checksums, reconstructed-tree provenance, inventory, launcher-mode and privacy review. C2 remains unaccepted until the final metadata tree passes and PR #54 is factually merged with expected-head protection.

## Preserved boundary

Still prohibited:

- reopening the exact SQLite or repeating B1b;
- private backup access;
- production registry/generation creation on the target Mac;
- C3/C4 execution;
- actual migration, production promotion or rollback;
- automatic retry/resume;
- model/network calls and personal data.
