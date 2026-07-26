# Phase 0 acceptance — freeze and exact fixtures

Phase 0 must finish before any new state-core implementation or AI run.

Status: **accepted**. The exact target-Mac browser database was exported unchanged, inspected read-only, matched to the historical diagnostics, and converted into a sanitized migration-package manifest with zero write/network/model paths.

## Required evidence

- [x] Alpha.19 source commit and artifact SHA are recorded.
- [x] Candidate 4/Candidate 5 historical diagnostic source is preserved read-only.
- [x] Original diagnostic, source archive, verified artifact, browser database, and browser evidence hashes are recorded before transformation.
- [x] A standalone browser exporter is implemented and automatically proves read-only access without write or upgrade paths.
- [x] Legacy diagnostic events receive deterministic order with explicit ambiguity when timestamps tie.
- [x] The diagnostic inspector emits canonical run identity, stage evidence, unresolved counts, source digests, and missing/ambiguous fields.
- [x] Candidate 4 state without `batch_continuation_blocked` is a named sanitized fixture.
- [x] The diagnostic inspector has no network/Ollama path and tests record zero calls.
- [x] The Phase 0 migration-package generation path is structurally read-only and has no network/Ollama/AI or target-write path; the actual Phase 2 import remains unimplemented.
- [x] Synthetic and personal records are identified in the migration manifest: the exact source contains 96 synthetic thoughts and zero personal thoughts.
- [x] The exact old browser database blob was exported on the target Mac, hashed before and after inspection, unchanged, and remains downloadable outside Git.

## Exact accepted evidence

- SQLite size: `5,070,848` bytes.
- SQLite SHA-256: `356b943275cce292d0e14f8a7fbe95af07e79de73f06d3e361874d342aa2f918`.
- Browser evidence SHA-256: `51e3d9563b09c91427716eee559745fed35d729e9ffd71f180afa91c3fc7aa2b`.
- `PRAGMA quick_check`: `ok`.
- `PRAGMA integrity_check`: `ok`.
- Tables: 96 thoughts, 30 knowledge nodes, 0 links, 133 AI decisions.
- Every thought row, node row, link row, and AI-decision row exactly matches the earlier diagnostic export after its intentional omission of embeddings.
- All 96 thoughts have 768-dimensional finite embeddings in the SQLite source.
- Six roots are areas; parent references, parent types, cycles, and duplicate paths have zero violations.
- One missing primary placement exactly matches the one explicit unresolved thought.
- Two numerical candidates have valid distinct endpoints and no duplicate pair.
- The active historical run remains Qwen, paused at candidates; under DeepSeek the derived guard is immediately `blocked`, without a continuation click and without AI authorization.

## Blocking scenario resolved

The exact database now proves the distinction between:

1. Candidate 4 blocked the Qwen/DeepSeek continuation in memory but did not persist a Candidate 5 event type;
2. Candidate 5 initially had no persisted `continuationBlock` to restore;
3. the new state-core must derive an immediate `blocked` guard from immutable run model plus configured model without requiring a continuation click.

The exact SQLite rows and the earlier diagnostics arrays are identical for thoughts, nodes, links, and decisions. The prior diagnostic fixture was therefore not an approximation of another state; it was an exact diagnostic projection of this browser database, with embeddings intentionally omitted.

## Next boundary

Phase 1 may now begin: pure state-core types, transitions, guards, and tests only. The old database remains frozen and read-only. No Candidate 5 continuation, DeepSeek semantic run, Candidate 6, target migration, or personal-data import is authorized by Phase 0 acceptance.

## Non-goals preserved

- no semantic reprocessing;
- no new model selection experiment;
- no relation generation;
- no map redesign;
- no production migration of personal thoughts;
- no attempt to repair the old database in place.
