# MindMap Local v0.6-alpha.19

MindMap is a local-first personal AI system for turning a stream of thoughts into understanding, connections, priorities, decisions, actions, results and durable memory.

## Current status

Alpha.19 is frozen as a read-only research prototype and must not receive real personal thought data.

Accepted foundations:

- Phase 0 exact legacy evidence — `850a5fc60a154047eae1f6a5d4f63c7969ae8412`;
- Phase 1A pure state-core — `e7b7593932614f8dfa843298f35eff0230c1e827`;
- Phase 2A transactional storage contract — `aa5eaaae08a3da4d0ff00ea03aea12b793137a21`;
- Phase 2B native IndexedDB run storage — `b4b35dcd7125c820f75f89387bc18ac3fa509cb0`;
- Phase 2C-A graph/payload storage — `292634312ad04fa6e6cfc5a5ded311ac1020094d`;
- Phase 2C-B0 deterministic mapping/typed-stop contract — `dbf2484c78e4eedcbb2efb3f0b61394b79a6d216`;
- Phase 2C-B1a sanitized executor/rollback harness — `aec5edaca877cec5d769f4ce4efff674a9c92a7d`;
- Phase 2C-B1b exact-source read-only dry run — accepted and merged as `4fd14e515d2c4234f70effa475381f47bbb50e8b` on 2026-07-28.

## Phase 2C-B1b — accepted boundary

The one authorized exact-source B1b read-only dry run was executed once on the target Mac and is consumed.

```text
repository: ne-agalakov/mindmap-local-ci
commit:     982cadbc62c42659aa567b803574e3e04066babc
tree:       9b2d2588ba678f5c2bc5737687049be75c2ece96
run ID:     b1b-20260728115431-22839
```

Confirmed:

- exact source size and SHA-256 matched before and after;
- read-only/query-only, quick check and integrity check passed;
- counts `96/30/0/133/96/3/0` matched;
- one unresolved thought and zero damaged references;
- two clean temporary targets produced equal portable-plan and target-snapshot hashes;
- injected rollback left no target or receipt;
- all temporary targets were deleted;
- network/model calls were zero;
- actual migration did not occur.

Final acceptance provenance:

```text
reviewed private head: 3e9660f2be6b57c8c0547c1fc4052d54ba8d0486
public CI head:        b69d41a580b1b9eee1c920836911eb6b12aa1e3b
shared reviewed tree:  0305705240750d2b2a8d687611261b8fd39c2610
squash merge:          4fd14e515d2c4234f70effa475381f47bbb50e8b
post-merge docs:       e6bd47011fad2dab5a8617f5f754739de1915fd9
```

## Phase 2C-C0 — active design gate

Issue #48 and draft PR #49 define the actual-migration architecture without execution.

ADR-0002 selects:

- immutable generation databases;
- control registry `mindmap-state-core-control-v1`;
- generation prefix `mindmap-state-core-v1-generation-`;
- atomic active-pointer promotion;
- explicit rollback receipts;
- one-shot artifact/source/generation-bound authorization;
- REQ-OBS-001 for every migration and recovery stage.

The safe sequence is now:

```text
C0 architecture and failure matrix
C1 pure registry/generation contracts on sanitized fixtures
C2 native IndexedDB registry, promotion, rollback and crash/reload proof
C3 packaged runtime resolver integration on sanitized fixtures
C4 exact-source one-shot package
new explicit user confirmation
actual migration and activation
```

Runtime resolver integration must be proven before actual migration because IndexedDB has no atomic database rename. The runtime will activate only a fully verified and sealed immutable generation through the control registry.

## Preserved boundary

Still prohibited:

- reopening the exact SQLite or repeating B1b;
- creating the real backup, registry or production generation;
- actual target-Mac migration or promotion;
- source write, repair, replacement or deletion;
- automatic retry after failure, reload or version change;
- Candidate 5/6, Qwen, DeepSeek or other model execution;
- semantic-quality claims and real personal thoughts.

## Current verified step

Complete C0 review, exact-tree public CI, downloaded-artifact inspection and Drive reverse-read. After C0 acceptance, only C1 pure contracts and sanitized fixtures are allowed.

## Commands

```bash
npm run install:ci
npm run test:state-core
npm run test:storage-contract
npm run test:indexeddb-storage
npm run test:graph-storage
npm run test:migration-contract
npm run test:browser-storage
npm run test:browser-graph-storage
npm run test:browser-phase2cb-b1a
npm run test:browser-phase2cb-b1b
npm test
npm run package:source
npm run package:phase2cb-b1b
```

See:

- `project-docs/evidence/PHASE2CB_B1B_ACCEPTANCE.md`;
- `project-docs/architecture/ADR-0002_PHASE2CC_GENERATION_REGISTRY.md`;
- `project-docs/evidence/PHASE2CC_C0_CONTRACT.md`;
- `project-docs/evidence/PHASE2CC_C0_FAILURE_MATRIX.md`;
- `project-docs/evidence/PHASE2CC_C0_IMPLEMENTATION_PLAN.md`;
- `project-docs/evidence/PHASE2CC_C0_STATUS.md`.