# Known gaps after Phase 2C-B0 acceptance

Green storage tests are not proof of migration, runtime or semantic readiness.

## Closed

- exact legacy source is private, hash-verified and read-only;
- pure state identity/transitions/replay are accepted;
- transactional run storage is accepted;
- canonical graph/payload contracts and native graph storage are accepted;
- target-Mac real-Chrome storage scenarios passed;
- exact public Linux/macOS/full/browser/package gates passed;
- final downloaded artifacts passed external inventory/privacy/credential checks;
- Drive post-merge update/readback and merge provenance are complete;
- private Actions failure was explained by exhausted private minutes;
- release-marker and generic-path scan regressions were diagnosed and recorded.
- Phase 2C-B0 sanitized mapping/typed-stop tests passed;
- Phase 2C-B0 pre-documentation private/public tree equality passed;
- Phase 2C-B0 Linux/macOS/full/browser/package gates passed;
- Phase 2C-B0 downloaded artifacts passed database/privacy/credential/forbidden-dependency inspection;
- the stale Phase 2C-A-only artifact revision was identified as a documentation gate regression, not a mapping failure.

Phase 2C-A merge: `292634312ad04fa6e6cfc5a5ded311ac1020094d`.
Phase 2C-B0 merge: `dbf2484c78e4eedcbb2efb3f0b61394b79a6d216`.

## Still open

- same-fixture cross-environment graph snapshot equality;
- exact-source isolated dry run;
- source byte-stability;
- deterministic target hash and repeat-run equality;
- failed-migration rollback;
- typed stops for mismatch, personal data, wrong schema/workspace, duplicate runs, ambiguity, invalid references and non-empty target;
- target-Mac production storage;
- actual migration backup/rollback and explicit confirmation;
- production runtime integration and packaged browser E2E;
- REQ-OBS-001 from persisted attempts/checkpoints;
- service-level exactly-once model execution;
- semantic revalidation, multi-order stability and real-data safety.

Actual migration, runtime/UI, model execution, Candidate 6 and real thoughts remain prohibited.

## Phase 2C-B0 accepted boundary

Final private/public exact tree `10b0cd7fea77fdff04cf2e072be9604d2a5c05cb` passed CI and artifact review. B0 is closed. Exact-source B1, source byte-stability, isolated target determinism/rollback and actual migration remain open and separately gated.
