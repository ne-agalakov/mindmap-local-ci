# Work boundary after Phase 2C-B1a acceptance

Accepted foundations: Phase 0, 1A, 2A, 2B, 2C-A, 2C-B0, the B1 execution plan and B1a sanitized executor/harness.

B1a merge: `aec5edaca877cec5d769f4ce4efff674a9c92a7d`.

## Allowed now

Only preparation and review of a separate B1b authorization package:

1. identify the exact accepted source path/hash without opening it;
2. identify the exact harness commit/package and temporary target naming pattern;
3. restate read-only, offline, no-retry, typed-stop and rollback contracts;
4. list the one-run proof plan and proof boundaries;
5. ask Артём for a new explicit confirmation before execution.

## Still prohibited

- opening the exact private SQLite source before confirmation;
- B1b execution;
- creating a real migration target or actual target-Mac migration;
- automatic retry after failure/reload/version change;
- Candidate 5/6, Qwen, DeepSeek or external model calls;
- legacy database write/repair;
- production runtime/UI integration;
- real thought import;
- claims of semantic success or product readiness.

A future confirmation for one B1b read-only dry run does not authorize actual migration. Actual migration remains a separate later gate.
