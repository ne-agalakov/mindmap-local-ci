# Work boundary after Phase 2C-B0 acceptance

Accepted foundations:

- Phase 0 exact source;
- Phase 1A `e7b7593932614f8dfa843298f35eff0230c1e827`;
- Phase 2A `aa5eaaae08a3da4d0ff00ea03aea12b793137a21`;
- Phase 2B `b4b35dcd7125c820f75f89387bc18ac3fa509cb0`;
- Phase 2C-A `292634312ad04fa6e6cfc5a5ded311ac1020094d`;
- Phase 2C-B0 `dbf2484c78e4eedcbb2efb3f0b61394b79a6d216`.

## Allowed now

Only preparation and review of a separate B1 exact-source read-only → fresh isolated temporary-target plan. Planning must preserve exact source hash, no source writes, deterministic target identity, rollback, typed stops and zero model calls.

## Still prohibited

- opening the private source or creating the B1 target before the separate gate;
- actual target-Mac migration;
- Candidate 5 continuation;
- Qwen or DeepSeek;
- Candidate 6;
- legacy database write/repair;
- production runtime/UI integration;
- real thought import;
- claims of REQ-OBS-001, exactly-once model execution, semantic success or product readiness.

B0 acceptance does not authorize B1 execution. Legacy source SHA-256 remains `356b943275cce292d0e14f8a7fbe95af07e79de73f06d3e361874d342aa2f918`.
