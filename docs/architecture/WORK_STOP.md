# Work boundary during Phase 2C-A final merge gate

Accepted foundations:

- Phase 0 exact source;
- Phase 1A merge `e7b7593932614f8dfa843298f35eff0230c1e827`;
- Phase 2A merge `aa5eaaae08a3da4d0ff00ea03aea12b793137a21`;
- Phase 2B merge `b4b35dcd7125c820f75f89387bc18ac3fa509cb0`.

Phase 2C-A implementation and all pre-merge evidence gates have passed. PR #38 is not accepted until merge and exact provenance.

## Still prohibited

- do not click Candidate 5 continuation;
- do not start Qwen or DeepSeek;
- do not package Candidate 6;
- do not migrate, repair or modify the legacy database;
- do not begin Phase 2C-B before Phase 2C-A merge provenance;
- do not execute actual target-Mac import;
- do not change target-Mac production browser storage;
- do not integrate new storage into production runtime/UI;
- do not modify old IndexedDB/sql.js, Ollama routes or model configuration;
- do not import personal data;
- do not claim REQ-OBS-001, exactly-once model execution, semantic success or product readiness.

## Allowed now

Only completion of the Phase 2C-A acceptance gate:

- update repository documentation to the verified evidence;
- mirror the exact final documentation tree into public CI;
- run Linux/macOS/full/browser/package checks;
- download and inspect exact artifacts outside the runner;
- merge PR #38 only with expected-head protection;
- record merge SHA in a separate provenance update;
- update and reverse-read Google Drive.

## After acceptance

Phase 2C-B may be planned in a separate issue/branch/PR from accepted main. It may only use the exact private source read-only and a fresh isolated temporary target. It must prove source byte-stability, deterministic mapping/hash, repeatability, typed stops, full rollback and zero network/model calls.

Phase 2C-B success does not authorize actual target-Mac migration. Actual migration requires a later explicit user-confirmed gate with backup/rollback and REQ-OBS-001.

Legacy source SHA-256 remains `356b943275cce292d0e14f8a7fbe95af07e79de73f06d3e361874d342aa2f918`.
