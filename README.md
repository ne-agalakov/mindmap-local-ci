# MindMap Local v0.6-alpha.19

MindMap is a local-first personal AI system for turning a stream of thoughts into understanding, connections, priorities, decisions, actions, results and durable memory.

## Current status

Alpha.19 is frozen as a read-only research prototype and must not receive real personal thought data.

Accepted foundations:

- Phase 0 exact legacy evidence — `850a5fc60a154047eae1f6a5d4f63c7969ae8412`;
- Phase 1A pure state-core — `e7b7593932614f8dfa843298f35eff0230c1e827`;
- Phase 2A transactional storage contract — `aa5eaaae08a3da4d0ff00ea03aea12b793137a21`;
- Phase 2B native IndexedDB run storage — `b4b35dcd7125c820f75f89387bc18ac3fa509cb0`;
- Phase 2C-A graph/payload storage — `292634312ad04fa6e6cfc5a5ded311ac1020094d`;
- Phase 2C-B0 deterministic mapping/typed-stop contract — `dbf2484c78e4eedcbb2efb3f0b61394b79a6d216`;
- Phase 2C-B1a sanitized executor/rollback harness — `aec5edaca877cec5d769f4ce4efff674a9c92a7d`.

## Phase 2C-B1a — accepted

B1a is accepted only for sanitized fixtures.

Exact provenance:

```text
final private head: c1237b9ba012d60dc720bf940082c7d8e88f4e1e
public exact head:  667b218b8bf863c45ae074db65a314e77786f8d0
shared Git tree:    58d2bb0e9b7edebb3d3d830064406feffbff5181
squash merge:       aec5edaca877cec5d769f4ce4efff674a9c92a7d
```

Proven on sanitized fixtures:

- physical read-only SQLite source;
- source bytes unchanged;
- deterministic two-run plan and target hashes;
- native IndexedDB isolated temporary targets in actual Chrome;
- injected rollback with no partial target or idempotency receipt;
- typed stops and no automatic retry;
- REQ-OBS trace, inactivity/possibly-hung state and diagnostics;
- zero network and model calls.

## Phase 2C-B1b — package gate complete, local run pending

Artyom authorized exactly one exact-source read-only B1b dry run on 2026-07-27. The verified package has been prepared, but the exact private SQLite source has not been opened and the authorized run has not been consumed.

Code-head identity before the final documentation commit:

```text
private implementation head: d477203bbdf226e3252f741b31c9d45acf1b1499
public exact-tree head:       47876e8b35a8b7c93903f82022a28eab64f02d53
shared implementation tree:   ad431eaed0945039371011df1be0c989a634b050
```

Exact-tree CI passed Linux lint/full tests, macOS launchers/tests, actual-Chrome run-storage, graph-storage, B1a and B1b rehearsal harnesses, and packaging. The downloaded one-shot ZIP was independently inspected: seven expected files, launcher mode `0755`, portable checksum, no SQLite, diagnostics, dependencies, secrets or private payload strings.

Three delivery regressions were proven and fixed before handoff:

1. packaging trusted an outer pull-request `GITHUB_SHA` that could name an unavailable merge commit;
2. package metadata could pair a private repository name with a public-mirror commit;
3. the B1b Vite harness referenced `/src/page.ts` instead of its actual `/page.ts` entry.

All three have regression coverage.

## Preserved boundary

The B1b package authorizes only one read-only dry run against the exact accepted SQLite source and fresh isolated temporary IndexedDB targets.

Still prohibited:

- actual target-Mac migration or production namespace use;
- any source write, repair or replacement;
- automatic retry after failure, reload or version change;
- Candidate 5/6, Qwen, DeepSeek or other model execution;
- production runtime/UI integration;
- semantic claims and real personal thoughts.

A failed one-shot dry run does not authorize a second attempt. Sanitized evidence must be inspected first.

## Next verified step

Complete the final documentation-head exact-tree CI and downloaded-artifact inspection. Then run the verified one-shot package once on the target Mac, select only the exact SQLite source (`5,070,848` bytes; SHA-256 `356b943275cce292d0e14f8a7fbe95af07e79de73f06d3e361874d342aa2f918`) and inspect the sanitized evidence. Actual migration remains a separate later gate.

## Commands

```bash
npm run install:ci
npm run test:state-core
npm run test:storage-contract
npm run test:indexeddb-storage
npm run test:graph-storage
npm run test:migration-contract
npm run test:browser-storage
npm run test:browser-graph-storage
npm run test:browser-phase2cb-b1a
npm run test:browser-phase2cb-b1b
npm test
npm run package:source
npm run package:phase2cb-b1b
```

See `project-docs/evidence/PHASE2CB_B1A_ACCEPTANCE.md` and `project-docs/evidence/PHASE2CB_B1B_PACKAGE_READINESS.md` for exact proof and boundaries.