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

Only Phase 2C-B in a separate issue/branch/PR from accepted `main`:

- define versioned deterministic legacy→run/graph mapping;
- use the exact accepted source package read-only;
- verify source bytes/hash before and after;
- create only a fresh isolated temporary target;
- reject non-empty or production/target-Mac names;
- persist through accepted Phase 2B/2C-A adapters;
- produce deterministic target snapshot/content hash;
- repeat and prove the same result;
- inject failures and prove full rollback;
- typed-stop mismatch, personal data, wrong schema/workspace, duplicate run, ambiguity and invalid references;
- prove zero network/model calls.

## Acceptance boundary

Phase 2C-B success does not authorize actual target-Mac migration. Actual migration requires a later explicit confirmation gate with backup/rollback, exact hashes and REQ-OBS-001.

Legacy source SHA-256 remains `356b943275cce292d0e14f8a7fbe95af07e79de73f06d3e361874d342aa2f918`.
