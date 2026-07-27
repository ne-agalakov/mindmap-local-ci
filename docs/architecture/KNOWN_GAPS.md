# Known gaps after Phase 2C-B1a corrected exact-tree gate

Green tests prove only the listed sanitized executor/harness behavior. They do not prove exact-source migration or product semantics.

## Closed in B1a code gate

- sanitized SQLite opened physically read-only on Linux/macOS;
- source before/after identity remained equal;
- deterministic two-clean-run plan and target hashes;
- native IndexedDB temporary target in actual Chrome;
- injected failure left no partial target or idempotency receipt;
- typed stops and no automatic retry;
- REQ-OBS trace, live status, inactivity/possibly-hung state and diagnostics action in the sanitized harness;
- zero network/model calls and installed network guards;
- corrected private/public tree equality `8ef2603b85aef1e7f1ff055cce7579259e3ee659`;
- Linux/macOS/full/Chrome/package gates and downloaded-artifact inspection;
- two delivery defects diagnosed and corrected before merge.

## Still open

- final documentation-tree exact rerun and PR #43 merge/provenance;
- B1b exact-source read-only dry run;
- exact source byte-stability during B1b;
- exact 96/30/0/133 count validation against the accepted source;
- deterministic target equality from the exact source;
- exact-source injected rollback;
- actual target-Mac migration, backup and rollback;
- same-fixture cross-environment graph equality beyond the B1a portable plan proof;
- production runtime/UI integration;
- persisted production REQ-OBS-001;
- service-level exactly-once AI execution;
- semantic quality, multi-order stability and real-data safety.

B1b, actual migration, models, runtime/UI and real thoughts remain prohibited.
