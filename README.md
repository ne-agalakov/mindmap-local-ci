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
- Phase 2C-B1b exact-source read-only dry run — accepted and merged as `4fd14e515d2c4234f70effa475381f47bbb50e8b`.

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

## Phase 2C-C0 — active design gate

Issue #48 / PR #49 define actual-migration architecture without execution.

ADR-0002 selects:

```text
control registry:  mindmap-state-core-control-v1
generation prefix: mindmap-state-core-v1-generation-
```

A verified and sealed immutable generation becomes active only through one atomic control-registry pointer transaction. Rollback restores the previous pointer through an explicit transaction and never edits payload. Runtime resolver integration on sanitized fixtures must pass before exact-source execution.

Safe sequence:

```text
C0 architecture and failure matrix
C1 pure registry/generation contracts
C2 native IndexedDB promotion/rollback/crash proof
C3 packaged runtime resolver on sanitized fixtures
C4 exact-source one-shot package
new explicit user confirmation
actual migration and activation
```

## Reviewed C0 gate

```text
private head: 1e13024eeef8cec8ec05f721bf9ce703f884bc91
public head:  189e86ae8a92912d399196bed15d8ece849a58e9
shared tree:  c09d95579292970a851cf0c1a43abce13a800d3a
verify:       30424595380
package:      30424595384
```

Linux/macOS/full/actual-Chrome/package gates passed. Downloaded source, exporter and B1b packages passed portable checksums, actual-checkout repository/commit provenance, launcher-mode and privacy review.

Three release-gate defects were found and fixed before acceptance: a weakened historical README marker, source-package repository/commit mismatch and exporter-package repository/commit mismatch. Each is now regression-tested.

## Preserved boundary

Still prohibited:

- reopening the exact SQLite or repeating B1b;
- creating the real backup, registry or production generation;
- actual target-Mac migration or promotion;
- source write, repair, replacement or deletion;
- automatic retry after failure, reload or version change;
- model execution;
- semantic-quality claims and real personal thoughts.

## Current verified step

Artifact revision 11 and final Google Drive readback are synchronized. Mirror and verify the final documentation tree, inspect its downloaded artifact, then merge PR #49. After merge, only C1 pure contracts on sanitized fixtures are allowed.

See:

- `project-docs/architecture/ADR-0002_PHASE2CC_GENERATION_REGISTRY.md`;
- `project-docs/evidence/PHASE2CC_C0_CONTRACT.md`;
- `project-docs/evidence/PHASE2CC_C0_FAILURE_MATRIX.md`;
- `project-docs/evidence/PHASE2CC_C0_IMPLEMENTATION_PLAN.md`;
- `project-docs/evidence/PHASE2CC_C0_STATUS.md`.