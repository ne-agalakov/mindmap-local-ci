# Known gaps after Phase 2C-B1a acceptance

B1a is accepted only for sanitized executor/harness behavior. Green CI and artifact evidence do not prove exact-source migration or product semantics.

## Closed

- B1a private/public final tree equality `58d2bb0e9b7edebb3d3d830064406feffbff5181`;
- final Linux/macOS/full/actual-Chrome/package gates;
- downloaded source/exporter/browser artifact inspection;
- physical read-only sanitized SQLite;
- source before/after identity;
- deterministic two-clean-run plan and target hashes;
- actual Chrome IndexedDB temporary targets;
- injected rollback with no partial target or receipt;
- typed stops and no automatic retry;
- sanitized REQ-OBS trace/live state/diagnostics;
- zero network/model calls;
- merge PR #43 and post-merge canonical Drive readback;
- initial Chrome-runner and macOS checkout delivery defects diagnosed and corrected before acceptance.

## Still open

- B1b exact-source read-only dry run;
- exact source path/package identity before access;
- exact source byte/hash stability during B1b;
- exact 96 thoughts / 30 nodes / 0 links / 133 decisions count validation;
- deterministic target equality from the exact source;
- exact-source injected rollback and full target cleanup;
- actual target-Mac migration, backup and rollback;
- same-fixture cross-environment equality beyond the portable B1a plan proof;
- production runtime/UI integration;
- persisted production REQ-OBS-001;
- service-level exactly-once AI execution;
- semantic quality, multi-order stability and real-data safety.

B1b, actual migration, models, runtime/UI and real thoughts remain prohibited until their own explicit gates.
