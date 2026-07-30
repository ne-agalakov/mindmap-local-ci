# Phase 2C-B0 — deterministic mapping and typed-stop contract

Date: 2026-07-26

Status: implemented on a separate Phase 2C-B branch with sanitized fixtures only; not accepted and not authorized to open the private SQLite source.

Parent issue: #37.

## Objective

Freeze the deterministic legacy → accepted run/graph mapping before any exact-source dry run. B0 is a pure planner. It does not open SQLite, IndexedDB, the target Mac database, network, Ollama, Qwen or DeepSeek and does not create a migration target.

Mapping version:

```text
phase2cb-mapping-v1
```

## Exact source gate

The planner accepts only metadata bound to the Phase 0 source:

```text
size:    5,070,848 bytes
SHA-256: 356b943275cce292d0e14f8a7fbe95af07e79de73f06d3e361874d342aa2f918
workspace: synthetic
personal thoughts: 0
quick_check: ok
integrity_check: ok
```

Input collection counts must exactly equal the declared thought, node, link, embedding, unresolved, damaged-reference, event and run counts. Every accepted thought must have one finite embedding.

## Target gate

B0 accepts only an empty target identity whose name starts with:

```text
mindmap-state-core-v1-phase2cb-dry-run-
```

The target must be marked `isolated-temporary`, synthetic and not the target-Mac production database. B0 records the target identity but performs no write.

## Graph mapping

Deterministic rules:

- `originalContent` becomes the exact `thought-text` payload;
- non-graph legacy fields supplied by the source loader are preserved as canonical entity-metadata artifacts keyed inside their payload envelope by source entity kind and ID;
- recognized legacy thought types/statuses map through a closed vocabulary; unknown values stop rather than falling back silently;
- area/direction/project nodes keep source IDs and exact titles;
- area is root, direction requires area parent, project requires direction parent and an explicit mapped project state;
- a primary placement becomes `placed/proposed`, never silently confirmed;
- a missing primary placement requires explicit `unresolved`; no implicit unresolved is manufactured;
- additional placements become proposed `related` thought→node links with deterministic IDs;
- legacy links use a closed kind/status map; confirmed/rejected state is replayed through `proposed → final` events;
- float arrays become deterministic little-endian Float32 payloads bound to exact thought-text hash, model and dimensions;
- damaged references remain separate records and never masquerade as unresolved;
- all graph events, IDs, ordering and hashes are deterministic.

Content hashes are hashes of exact payload bytes. If identical bytes would require incompatible payload kinds, B0 returns `payload_conflict`; it does not alter bytes or invent a salted hash.

## Legacy run history

Legacy operational events are not rewritten into invented modern attempts.

For every source run, B0:

1. preserves the supplied canonical legacy history as an `artifact-json` payload;
2. creates an accepted run aggregate with the exact source identity fields and target storage schema;
3. immediately records `explicitly_blocked` so imported historical runs cannot continue or call AI;
4. attaches metadata pointing to the preserved history payload.

The source terminal state remains inside the history artifact. The target aggregate is a quarantine projection, not a claim that the historical run originally had the modern state-machine event sequence.

## Typed stops

The planner stops before mutation on:

- source hash/size/schema/integrity mismatch;
- count mismatch or personal data;
- wrong workspace, forbidden target namespace or non-empty target;
- duplicate identities;
- payload-kind collision;
- unknown/ambiguous type, status, project state or link vocabulary;
- invalid hierarchy, placement, link or damaged reference;
- invalid embedding or timestamp;
- non-canonical run history or mapping-integrity failure.

B1 adds the runtime `transaction_failure` stop.

## Rollback contract for B1

The frozen contract requires:

```text
strategy: delete-isolated-target-on-any-failure
source hash before/after: required equal
target starts empty: required
partial target: forbidden
repeat-run hash equality: required
diagnostic schema: mindmap-phase2cb-dry-run-diagnostic-v1
```

This contract does not implement B1 execution. It defines what B1 must prove.

## Sanitized regression coverage

Focused tests cover:

- deterministic graph/run plans under reordered source collections;
- exact placement/unresolved/damaged-reference separation;
- embedding byte size and text-hash binding;
- proposed additional-placement links and confirmed-link lifecycle replay;
- quarantined run aggregates plus preserved history artifacts;
- successful commits through the accepted in-memory run and graph adapters;
- typed stops and immutable safety flags;
- explicit payload-kind collision;
- source scan proving no SQLite, IndexedDB, network, model or runtime dependency.

## Not proven

- exact private SQLite loading;
- 96/30/0/133 full-source mapping;
- source hash stability before/after an actual read;
- native IndexedDB temporary-target write;
- repeat-run target hash;
- injected B1 transaction rollback;
- Linux/macOS/actual-browser final gate for the eventual exact B0 head;
- downloaded-artifact review, Drive readback or merge provenance.

B1, actual migration, runtime/UI, models and real thoughts remain blocked until B0 is accepted through its own gate.
