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
- Phase 2C-B1b exact-source read-only dry run — `4fd14e515d2c4234f70effa475381f47bbb50e8b`;
- Phase 2C-C0 actual-migration architecture/release gate — `31657e218cd5891e9e915f698febf8ac72942ed3`.

## Phase 2C-B1a — accepted

B1a remains accepted only for its sanitized executor, rollback and observability boundary.

## Phase 2C-B1b — accepted boundary

The one authorized exact-source B1b read-only dry run was executed once and is consumed.

- exact source size/SHA-256 stayed unchanged;
- exact counts `96/30/0/133/96/3/0` matched;
- one unresolved thought and zero damaged references;
- two clean targets produced equal portable-plan and target-snapshot hashes;
- injected rollback left no target or receipt;
- network/model calls were zero;
- actual migration did not occur.

## Phase 2C-C0 — accepted

C0 fixes the architecture and release boundary without executing migration:

```text
control registry:  mindmap-state-core-control-v1
generation prefix: mindmap-state-core-v1-generation-
```

A verified and sealed immutable generation becomes active only through one atomic control-registry pointer transaction. Rollback restores the previous pointer through an explicit transaction and never edits payload. Runtime resolver integration on sanitized fixtures must pass before exact-source execution.

Final accepted identity:

```text
private head: af8f3c55d9e352c1f25d7aa8f720a7e55c6611b5
public head:  9bb65ab0bfdc1631c93d3de42dd97be6f2b23dc6
shared tree:  a8523316e16273f633fac8caac95e96a5fec1080
verify:       30425727226
package:      30425727235
merge:        31657e218cd5891e9e915f698febf8ac72942ed3
```

The current-head Linux/macOS/full/actual-Chrome/package gates passed twice. Downloaded source, exporter, B1b and browser-proof artifacts passed portable checksums, actual-checkout provenance, executable-mode and privacy review.

Three release defects were proved and regression-tested before merge: a weakened historical README marker, incorrect source-package repository/commit provenance and the same independent exporter-package defect.

A documentation error that had recorded unverified merge identity `69a9fc703a79f3aaa4bd44fc372f0cc8c9cb59f4` was removed from canonical Drive documents after GitHub API verification. It is not an accepted project commit.

## Phase 2C-C1 — allowed boundary

Only C1 pure registry/generation contracts and attempt state machine on sanitized fixtures are allowed now. C1 must not depend on IndexedDB, browser, filesystem, exact SQLite, backup files, network, model services, clocks or randomness.

Safe sequence remains:

```text
C1 pure registry/generation contracts
C2 native IndexedDB promotion/rollback/crash proof
C3 packaged runtime resolver on sanitized fixtures
C4 exact-source one-shot package
new explicit user confirmation
actual migration and activation
```

## Preserved boundary

Still prohibited:

- reopening the exact SQLite or repeating B1b;
- creating the real backup, registry or production generation;
- actual target-Mac migration, promotion or rollback;
- source write, repair, replacement or deletion;
- automatic retry after failure, reload or version change;
- model execution or external network calls;
- semantic-quality claims and real personal thoughts.

See:

- `project-docs/architecture/ADR-0002_PHASE2CC_GENERATION_REGISTRY.md`;
- `project-docs/evidence/PHASE2CC_C0_CONTRACT.md`;
- `project-docs/evidence/PHASE2CC_C0_FAILURE_MATRIX.md`;
- `project-docs/evidence/PHASE2CC_C0_IMPLEMENTATION_PLAN.md`;
- `project-docs/evidence/PHASE2CC_C0_ACCEPTANCE.md`.
