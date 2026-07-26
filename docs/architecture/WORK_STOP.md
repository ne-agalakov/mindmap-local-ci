# Work boundary after Phase 2B acceptance

Accepted foundations:

- Phase 0 exact source;
- Phase 1A merge `e7b7593932614f8dfa843298f35eff0230c1e827`;
- Phase 2A merge `aa5eaaae08a3da4d0ff00ea03aea12b793137a21`;
- Phase 2B merge `b4b35dcd7125c820f75f89387bc18ac3fa509cb0`.

## Still prohibited

- do not click Candidate 5 continuation;
- do not start Qwen or DeepSeek;
- do not package Candidate 6 from legacy orchestration;
- do not migrate, repair or modify the legacy database;
- do not execute actual target-Mac import;
- do not change target-Mac browser storage;
- do not integrate the new storage into `app/page.tsx` or production runtime;
- do not modify old IndexedDB/sql.js, Ollama routes or model configuration;
- do not import personal data;
- do not claim REQ-OBS-001, exactly-once model execution, semantic success or product readiness from migration dry-run tests.

## Allowed now

Only Phase 2C in a separate issue/branch/PR from accepted `main`:

- use the exact accepted private source package and hash;
- open source read-only;
- verify source hash/bytes before and after;
- create only a new isolated temporary `mindmap-state-core-v1*` target;
- reject non-empty or production/target-Mac target names;
- apply a versioned deterministic mapping contract;
- persist migrated state through the accepted Phase 2B adapter;
- produce deterministic target snapshot/content hash;
- repeat the dry run and prove the same hash;
- inject failures and prove full target rollback;
- prove typed stops for mismatch, personal data, wrong schema/workspace, duplicate runs, ambiguity and invalid references;
- prove zero network/model calls.

## Acceptance boundary

Phase 2C success does not authorize target-Mac migration. Actual migration requires a later separate gate with explicit confirmation, target backup/rollback, REQ-OBS-001, exact source/target hashes and no AI.

Legacy source SHA-256 remains `356b943275cce292d0e14f8a7fbe95af07e79de73f06d3e361874d342aa2f918`.
