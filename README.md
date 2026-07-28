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
- Phase 2C-B1b exact-source read-only dry run — accepted on 2026-07-28; implementation PR #46 awaits final documentation-head merge gate.

## Phase 2C-B1a — accepted

B1a is accepted only for sanitized fixtures.

Exact provenance:

```text
final private head: c1237b9ba012d60dc720bf940082c7d8e88f4e1e
public exact head:  667b218b8bf863c45ae074db65a314e77786f8d0
shared Git tree:    58d2bb0e9b7edebb3d3d830064406feffbff5181
squash merge:       aec5edaca877cec5d769f4ce4efff674a9c92a7d
```

Proven on sanitized fixtures:

- physical read-only SQLite source;
- source bytes unchanged;
- deterministic two-run plan and target hashes;
- native IndexedDB isolated temporary targets in actual Chrome;
- injected rollback with no partial target or idempotency receipt;
- typed stops and no automatic retry;
- REQ-OBS trace, inactivity/possibly-hung state and diagnostics;
- zero network and model calls.

## Phase 2C-B1b — exact-source dry run accepted

The one authorized exact-source B1b read-only dry run was executed once on the target Mac on 2026-07-28. The attempt is consumed and must not be repeated.

Accepted package identity:

```text
repository: ne-agalakov/mindmap-local-ci
commit:     982cadbc62c42659aa567b803574e3e04066babc
tree:       9b2d2588ba678f5c2bc5737687049be75c2ece96
run ID:     b1b-20260728115431-22839
```

Confirmed from sanitized evidence:

- exact SQLite matched `5,070,848` bytes and SHA-256 `356b943275cce292d0e14f8a7fbe95af07e79de73f06d3e361874d342aa2f918`;
- `readonly`, `query_only`, `quick_check = ok`, `integrity_check = ok`;
- exact counts `96/30/0/133/96/3/0` for thoughts/nodes/links/decisions/embeddings/runs/personal thoughts;
- one honest unresolved thought and zero damaged references;
- source size, SHA-256 and modification timestamp unchanged before and after all runs;
- two clean fresh native IndexedDB targets produced equal portable plan hash and equal target snapshot hash;
- injected rollback stopped with `transaction_failure`, committed no graph and left no target or receipt;
- every temporary target was deleted after evidence capture;
- external network calls = 0, model calls = 0, actual migration = false;
- sanitized evidence contains no source bytes, raw thought text, node labels, source path or model payloads.

The per-target `mappingContentHash` differs by design because each plan contains a distinct isolated target database name. The target-independent portable plan hash and persisted target snapshot hash both matched and are the accepted repeatability gates.

## Preserved boundary

B1b acceptance proves the exact-source read-only dry-run path only.

Still prohibited:

- actual target-Mac migration or production namespace use;
- source write, repair, replacement or deletion;
- a second B1b attempt;
- automatic retry after failure, reload or version change;
- Candidate 5/6, Qwen, DeepSeek or other model execution;
- production runtime/UI integration;
- semantic-quality claims and real personal thoughts.

## Next verified step

Mirror the final B1b acceptance documentation tree to the public CI repository, prove exact tree equality, rerun Linux/macOS/full/actual-Chrome/package gates, inspect the downloaded artifacts, then merge PR #46. After that, only offline design of a separately authorized actual-migration gate is permitted. Actual migration itself requires a new explicit confirmation immediately before execution.

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

See `project-docs/evidence/PHASE2CB_B1A_ACCEPTANCE.md`, `project-docs/evidence/PHASE2CB_B1B_PACKAGE_READINESS.md` and `project-docs/evidence/PHASE2CB_B1B_ACCEPTANCE.md` for the exact proof and boundaries.