# MindMap architecture map

This directory is the durable map for the state-core refoundation.

## Current documents

- [`CURRENT_STATE_AUDIT.md`](./CURRENT_STATE_AUDIT.md) — Alpha.19 audit.
- [`REFOUNDATION_PLAN.md`](./REFOUNDATION_PLAN.md) — target boundaries and phased plan.
- [`DECISION_LOG.md`](./DECISION_LOG.md) — architecture decisions and consequences.
- [`PHASE0_RESULT.md`](./PHASE0_RESULT.md) — exact legacy evidence.
- [`PHASE1A_RESULT.md`](./PHASE1A_RESULT.md) — accepted pure state core.
- [`ADR-0001-PHASE2-STORAGE-ADAPTER.md`](./ADR-0001-PHASE2-STORAGE-ADAPTER.md) — native run-storage decision.
- [`PHASE2A_RESULT.md`](./PHASE2A_RESULT.md) — accepted transactional contract.
- [`PHASE2B_RESULT.md`](./PHASE2B_RESULT.md) — accepted run adapter.
- [`ADR-0002-PHASE2C-GRAPH-PAYLOAD-STORAGE.md`](./ADR-0002-PHASE2C-GRAPH-PAYLOAD-STORAGE.md) — accepted graph/payload decision.
- [`PHASE2CA_VERIFICATION.md`](./PHASE2CA_VERIFICATION.md) — accepted Phase 2C-A evidence and limits.
- [`KNOWN_GAPS.md`](./KNOWN_GAPS.md) — remaining evidence gaps.
- [`WORK_STOP.md`](./WORK_STOP.md) — current work boundary.

## Status

Accepted:

- Phase 0 `850a5fc60a154047eae1f6a5d4f63c7969ae8412`;
- Phase 1A `e7b7593932614f8dfa843298f35eff0230c1e827`;
- Phase 2A `aa5eaaae08a3da4d0ff00ea03aea12b793137a21`;
- Phase 2B `b4b35dcd7125c820f75f89387bc18ac3fa509cb0`;
- Phase 2C-A `292634312ad04fa6e6cfc5a5ded311ac1020094d`.

The next allowed boundary is Phase 2C-B: exact read-only source → isolated temporary target, deterministic mapping/hash, repeatability, typed stops and rollback. Actual target-Mac migration, runtime/UI, semantic execution, Candidate 6, legacy writes and real thoughts remain unauthorized.
