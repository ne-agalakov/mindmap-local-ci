# Phase 0 result — exact legacy database accepted

Date: 2026-07-25

Status: **Phase 0 accepted.** The exact target-Mac IndexedDB/sql.js blob was exported unchanged, inspected read-only, matched to the historical diagnostics, and reduced to sanitized deterministic fixtures. Storage refoundation remains pending; no semantic run is authorized.

## Inputs preserved outside Git

The following exact private sources remain unchanged outside the repository:

- diagnostics SHA-256 `5fbcf8eb9ee8abf32939707270761568e56a6b3ca7a347e3953212baf0cd18e5`;
- SQLite SHA-256 `356b943275cce292d0e14f8a7fbe95af07e79de73f06d3e361874d342aa2f918`;
- browser evidence SHA-256 `51e3d9563b09c91427716eee559745fed35d729e9ffd71f180afa91c3fc7aa2b`.

The raw database is not committed because it contains private thought text, full embeddings, and raw model payloads. All source and fixture hashes are recorded in `fixtures/legacy/EVIDENCE.json`.

## Read-only inspectors

`tools/legacy-inspector.mjs` inspects the historical diagnostics without network or model access and produces the canonical run fixture.

`tools/legacy-database-inspector.mjs` opens the exact SQLite source with `readOnly: true` and `PRAGMA query_only = ON`. It:

- validates the SQLite header;
- computes the source SHA-256 before inspection and again after the database is closed;
- runs `PRAGMA quick_check` and `PRAGMA integrity_check`;
- reads only the four legacy tables;
- checks hierarchy, references, cycles, duplicate paths, placements, embeddings, candidates, and event ordering;
- classifies synthetic and personal records without retaining text;
- compares database rows to the earlier diagnostics export in memory;
- emits only a sanitized inspection and migration-package manifest;
- contains no HTTP, fetch, child-process, sql.js, write, migration, Ollama, Qwen, or DeepSeek execution path.

## Exact database result

The browser export evidence and independently recomputed values match:

- size: `5,070,848` bytes;
- SHA-256: `356b943275cce292d0e14f8a7fbe95af07e79de73f06d3e361874d342aa2f918`;
- bytes modified: false;
- database upgrade/write/migration: false;
- network/Ollama/Qwen/DeepSeek calls: 0.

SQLite checks:

- header: valid SQLite 3;
- `quick_check`: `ok`;
- `integrity_check`: `ok`;
- hash before and after inspection: identical.

Exact tables:

- thoughts: 96;
- knowledge nodes: 30;
- links: 0;
- AI decisions: 133.

## Exact relationship to the diagnostics

The database loader projection was reconstructed using the legacy application mapping. After the intentional removal of embeddings performed by the diagnostics exporter:

- every thought row is exactly equal;
- every knowledge-node row is exactly equal;
- every link row is exactly equal;
- every AI-decision row is exactly equal.

Therefore the earlier diagnostic fixture describes this exact browser database state rather than an approximate or manually reconstructed state. The SQLite source additionally contains 96 finite embeddings of dimension 768, which the diagnostic export intentionally omitted.

## Structural result

- six roots, all of kind `area`;
- 24 directions and zero project nodes;
- zero missing parent references;
- zero invalid parent types;
- zero hierarchy cycles;
- zero duplicate full paths;
- 95 valid primary placements;
- one missing primary placement, exactly matching the one explicit unresolved thought;
- zero invalid additional placements;
- two numerical candidates with existing distinct thought endpoints;
- zero duplicate candidate pairs;
- zero relation links saved.

This validates structural integrity of the preserved state. It does **not** validate semantic quality of the hierarchy, projects, candidates, or prior completed run.

## Workspace separation

All 96 thought IDs are the continuous synthetic namespace `synthetic-001` through `synthetic-096`. The active run dataset is `approved-96-v1`. No personal thought record exists in the exact source.

The sanitized migration manifest therefore marks:

- source workspace: `synthetic`;
- synthetic thoughts: 96;
- personal thoughts: 0;
- legacy writes: forbidden;
- target writes: not performed;
- network/model calls: forbidden;
- target import: blocked until Phase 2 transactional storage exists.

## Active historical run

- run ID: `v06-run-03-1784797750173`;
- dataset/order: `approved-96-v1` / `original`;
- historical semantic model: `qwen3:8b`;
- configured comparison model: `deepseek-r1:8b`;
- terminal event: `batch_paused`;
- stage: `candidates`;
- candidates: 2;
- unresolved thoughts: 1;
- persisted `batch_continuation_blocked`: absent.

The new state-core guard remains deterministically `blocked` from immutable model mismatch. No continuation click is required and AI authorization is false.

## Ordering ambiguity retained

Two timestamp ties exist and are resolved only by immutable source order:

- hierarchy result then hierarchy pause at `2026-07-23T12:23:44.274Z`;
- candidate result then candidate pause at `2026-07-23T16:16:18.713Z`.

The new storage must replace this weak ordering with a monotonic event sequence.

## Tests and proof boundary

The database-inspector regression creates a real SQLite fixture, runs the exact inspector, and proves:

- the file hash is unchanged;
- read-only/query-only mode is used;
- integrity checks pass;
- workspace classification is deterministic;
- diagnostics comparison is exact;
- migration-package generation performs no target write;
- source code has no network/model/migration/write execution path.

Phase 0 proves preservation, identity, structural inspection, and the zero-call boundary. It does not prove a target migration, state-core implementation, semantic stability, REQ-OBS-001 in the future runtime, or suitability for personal data.

## Next verified step

Begin Phase 1 only: pure run identity, states, transitions, guards, authorization, idempotency, and projections with no React, storage, network, or model dependencies. Candidate 5 continuation, DeepSeek semantic execution, Candidate 6, target migration, and personal-data import remain prohibited.
