# MindMap architecture map

This directory is the durable map for the state-core refoundation.

## Current documents

- [`CURRENT_STATE_AUDIT.md`](./CURRENT_STATE_AUDIT.md) — Alpha.19 audit.
- [`REFOUNDATION_PLAN.md`](./REFOUNDATION_PLAN.md) — target boundaries and phased plan.
- [`DECISION_LOG.md`](./DECISION_LOG.md) — architecture decisions and consequences.
- [`PHASE0_RESULT.md`](./PHASE0_RESULT.md) — exact legacy evidence.
- [`PHASE1A_RESULT.md`](./PHASE1A_RESULT.md) — accepted pure state core.
- [`ADR-0001-PHASE2-STORAGE-ADAPTER.md`](./ADR-0001-PHASE2-STORAGE-ADAPTER.md) — native IndexedDB decision.
- [`PHASE2A_RESULT.md`](./PHASE2A_RESULT.md) — accepted transactional storage contract.
- [`PHASE2B_RESULT.md`](./PHASE2B_RESULT.md) — accepted native adapter and browser proof.
- [`KNOWN_GAPS.md`](./KNOWN_GAPS.md) — remaining evidence gaps.
- [`WORK_STOP.md`](./WORK_STOP.md) — current work boundary.

## Status

Phase 0 exact source is accepted. Alpha.19 remains frozen.

Phase 1A is accepted as merge `e7b7593932614f8dfa843298f35eff0230c1e827`.

Phase 2A is accepted as merge `aa5eaaae08a3da4d0ff00ea03aea12b793137a21`.

Phase 2B is accepted as merge `b4b35dcd7125c820f75f89387bc18ac3fa509cb0`. The native IndexedDB adapter passed `fake-indexeddb`, actual Chrome IndexedDB, Linux/macOS CI, packaging, downloaded-artifact review and Drive readback.

The next allowed boundary is Phase 2C: exact read-only source package to an isolated temporary target, deterministic target hash, repeatability and rollback. Actual target-Mac migration, production runtime/UI, semantic execution, Candidate 6, legacy writes and personal data remain unauthorized.
