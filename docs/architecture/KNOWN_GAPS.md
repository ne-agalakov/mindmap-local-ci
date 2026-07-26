# Known gaps after Phase 2B acceptance

Green storage tests must not be treated as proof of migration, runtime or semantic readiness.

## Closed

- exact target-Mac legacy source is private, hash-verified, integrity-checked and read-only;
- historical model mismatch has a canonical fixture and pure blocked projection;
- immutable identity, transitions, authorization, idempotency and deterministic replay are explicit;
- transactional storage contract and native IndexedDB adapter are accepted;
- legacy database name is refused before open;
- transaction completion/abort, stale-writer rejection, reopen idempotency, workspace isolation and failed-upgrade rollback are proven;
- deterministic snapshot hash survives reopen;
- the same adapter passed `fake-indexeddb` and actual Chrome IndexedDB;
- Phase 2B final CI, artifact review, Drive readback and merge provenance are complete.

Phase 2B merge: `b4b35dcd7125c820f75f89387bc18ac3fa509cb0`.

## Still open

- Phase 2C exact-source migration dry-run issue/PR;
- versioned deterministic mapping from legacy rows to new aggregates/events/artifacts;
- source byte-stability before/after dry run;
- deterministic migrated target hash and repeat-run equality;
- failed-migration full rollback;
- typed stops for mismatch, personal data, wrong schema/workspace, duplicate runs, ambiguity, invalid references and non-empty target;
- target-Mac browser storage behavior;
- actual migration backup/rollback and explicit confirmation gate;
- production runtime boundary and storage-service integration;
- packaged browser E2E for the new runtime;
- REQ-OBS-001 rendered from persisted attempts/checkpoints;
- service-level exactly-once model execution;
- semantic pipeline revalidation, multi-order stability and personal-data safety.

Actual target-Mac migration, runtime/UI integration, model execution, Candidate 6 and personal data remain prohibited.
