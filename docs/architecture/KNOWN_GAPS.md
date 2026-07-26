# Known gaps during Phase 2C-A final gate

Green storage tests are not proof of migration, runtime or semantic readiness.

## Closed

- exact legacy source is private, hash-verified, integrity-checked and read-only;
- historical model mismatch has a canonical blocked projection;
- immutable state identity, transitions, authorization, idempotency and replay are explicit;
- transactional run storage and native IndexedDB adapter are accepted;
- Phase 2C-A graph/payload contracts and native graph storage are implemented;
- target-Mac real-Chrome atomicity, reopen, idempotency, isolation, abort and corruption refusal passed;
- public-mirror Linux/macOS/full/browser/package gates passed;
- downloaded source/exporter/browser artifacts passed external inventory, privacy and credential inspection;
- canonical Drive documents were updated and reverse-read;
- private Actions pre-step failure was explained by exhausted private minutes.

## Still open before acceptance

- exact final documentation-head public CI and artifact review;
- PR #38 merge and merge provenance.

## Still open after acceptance

- same-fixture cross-environment graph snapshot equality;
- Phase 2C-B exact-source migration dry run;
- deterministic mapping from legacy rows to new run/graph events and payloads;
- source byte-stability before/after dry run;
- deterministic target hash and repeat-run equality;
- failed-migration full rollback;
- typed stops for mismatch, personal data, wrong schema/workspace, duplicate runs, ambiguity, invalid references and non-empty target;
- target-Mac production storage behavior;
- actual migration backup/rollback and explicit confirmation;
- production runtime integration and packaged browser E2E;
- REQ-OBS-001 from persisted attempts/checkpoints;
- service-level exactly-once model execution;
- semantic pipeline revalidation, multi-order stability and personal-data safety.

Actual migration, runtime/UI integration, model execution, Candidate 6 and personal data remain prohibited.
