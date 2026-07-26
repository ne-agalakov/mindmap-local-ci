# Work boundary after Phase 2C-A acceptance

Accepted foundations:

- Phase 0 exact source;
- Phase 1A `e7b7593932614f8dfa843298f35eff0230c1e827`;
- Phase 2A `aa5eaaae08a3da4d0ff00ea03aea12b793137a21`;
- Phase 2B `b4b35dcd7125c820f75f89387bc18ac3fa509cb0`;
- Phase 2C-A `292634312ad04fa6e6cfc5a5ded311ac1020094d`.

## Still prohibited

- Candidate 5 continuation;
- Qwen or DeepSeek;
- Candidate 6;
- legacy database write/repair;
- actual target-Mac import or production-storage change;
- production runtime/UI integration;
- changes to old sql.js/Ollama/model configuration;
- real thought import;
- claims of REQ-OBS-001, exactly-once model execution, semantic success or product readiness.

## Allowed now

Only Phase 2C-B0 in a separate issue/branch/PR from accepted `main`:

- define and test the versioned deterministic legacy→run/graph mapping using sanitized fixtures;
- define typed stops, B1 rollback contract and diagnostic schema;
- prove the B0 module has no SQLite, IndexedDB, network/model or runtime dependency;
- run final public-mirror CI, artifact review, documentation/Drive readback and merge provenance.

B0 must not open the exact source or create a target. B1 read-only exact-source → isolated temporary target remains blocked until B0 is accepted.

## Acceptance boundary

Phase 2C-B success does not authorize actual target-Mac migration. Actual migration requires a later explicit confirmation gate with backup/rollback, exact hashes and REQ-OBS-001.

Legacy source SHA-256 remains `356b943275cce292d0e14f8a7fbe95af07e79de73f06d3e361874d342aa2f918`.
