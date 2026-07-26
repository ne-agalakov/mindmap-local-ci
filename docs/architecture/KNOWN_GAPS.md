# Known gaps after Phase 2C-A acceptance

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

Phase 2C-A merge: `292634312ad04fa6e6cfc5a5ded311ac1020094d`.

## Still open

- same-fixture cross-environment graph snapshot equality;
- Phase 2C-B deterministic migration mapping;
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
