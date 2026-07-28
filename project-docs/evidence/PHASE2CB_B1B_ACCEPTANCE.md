# Phase 2C-B1b exact-source dry-run acceptance

Date: 2026-07-28
Status: accepted read-only dry run; actual migration remains prohibited

## Accepted package and authorization

```text
package repository: ne-agalakov/mindmap-local-ci
package commit:     982cadbc62c42659aa567b803574e3e04066babc
package tree:       9b2d2588ba678f5c2bc5737687049be75c2ece96
authorization:      artem-2026-07-27-b1b-once
run ID:             b1b-20260728115431-22839
```

The one authorized exact-source B1b attempt was executed once on the target Mac and is now consumed. The package cannot be treated as authorization for a second attempt.

## Evidence identity

```text
mindmap-phase2cb-b1b-evidence.json
size:   33,054 bytes
sha256: bcd8a88469b627591eea15c430539a2ca95307655b528364b96ab9c3fc0bc6b0

mindmap-phase2cb-b1b-run-manifest.json
size:   1,076 bytes
sha256: fcd3220fe64814d9a83171cc1ececcc7433d2b6fe5c848477d469afce3f202c7
```

Only these sanitized JSON files were reviewed. The exact SQLite source was not uploaded, copied into Git or included in an artifact.

## Exact source result

```text
size before: 5,070,848 bytes
size after:  5,070,848 bytes
sha256 before: 356b943275cce292d0e14f8a7fbe95af07e79de73f06d3e361874d342aa2f918
sha256 after:  356b943275cce292d0e14f8a7fbe95af07e79de73f06d3e361874d342aa2f918
open mode: readonly
query_only: true
quick_check: ok
integrity_check: ok
```

Counts matched the accepted source contract exactly:

```text
thoughts:         96
nodes:            30
links:             0
decisions:       133
embeddings:       96
runs:              3
personalThoughts:  0
unresolved:        1
damaged references: 0
```

The source bytes and modification timestamp were unchanged across all runs. Source write performed: false.

## Determinism and target result

Two clean runs used separate fresh native IndexedDB targets.

```text
portable plan hash — first:  d8a1289c6f1865db940f65e46aec569400b630aec3cc53bdfd897f223d2436a8
portable plan hash — second: d8a1289c6f1865db940f65e46aec569400b630aec3cc53bdfd897f223d2436a8

target snapshot hash — first:  6319ee79284b0ca1afc5fe93d53ef37b4a9c5f85c0c9634976afa1a4979f5689
target snapshot hash — second: 6319ee79284b0ca1afc5fe93d53ef37b4a9c5f85c0c9634976afa1a4979f5689
```

Both clean targets committed three runs and the graph aggregate, produced equal portable-plan and target-snapshot hashes, and were deleted after evidence capture.

The raw `mappingContentHash` values differ between first, second and rollback runs because the mapping plan includes each isolated target database identity. This is expected. The target-independent `portablePlanHash` and final `targetSnapshotHash` are the repeatability gates, and both matched.

## Rollback result

The injected-failure run stopped with `transaction_failure` after the first run commit attempt. It did not commit the graph, left no target or receipt, and the isolated rollback namespace was deleted.

```text
runCountCommitted before injected stop: 1
graphCommitted: false
rollbackTargetEmpty: true
targetDeletedAfterEvidence: true
```

This proves cleanup of the temporary test target. It does not authorize or prove rollback of a future production migration.

## Observability and boundary result

The trace recorded manifest freeze, preflight hashing, read-only extraction, deterministic planning, target freshness, creation, transactional progress, verification, source re-hash, cleanup and terminal state. Every stage reported `без AI`.

```text
external network calls: 0
model calls:            0
actual migration:       false
production namespace:   false
automatic retry:        false
```

No raw thought text, node labels, model payloads, source bytes or source path were included in the evidence.

## Acceptance decision

Phase 2C-B1b is accepted for the exact-source read-only dry-run objective:

- exact source identity and integrity were confirmed;
- source immutability was confirmed;
- deterministic mapping and target persistence were confirmed twice;
- injected rollback cleanup was confirmed;
- temporary targets were removed;
- REQ-OBS trace was present;
- network/model calls remained zero;
- actual migration did not occur.

## Preserved boundary and next gate

B1b acceptance does not authorize actual migration. The following remain prohibited until a new explicit decision and separate implementation/release gate:

- production namespace creation;
- writing migrated state as the user's working database;
- deleting or replacing the legacy source;
- a second B1b execution;
- model calls, Candidate 5/6 or real personal thoughts;
- claims about semantic quality or multi-order stability.

The next permitted work is offline planning of an actual-migration gate: backup identity, production target namespace, atomic promotion, rollback, REQ-OBS, interruption/reload tests and explicit user confirmation immediately before execution.