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

Final gates:

- verify `30245125059` — Linux lint/full suite, actual Chrome run storage, graph storage and B1a IndexedDB, plus macOS launcher tests;
- package `30245125058` — tests and source/exporter packaging;
- source artifact `db61f1e92639e3320062977f5d4f949442ba9ffbeac0e8678a10ee473251477d`;
- inner source `264503b2394d0d58a842e26030d4a555892bd7ec73d8c96ff569b85b699d963b`;
- inner exporter `9ba8213c8146467d87f0ed5c1512c62722feb1ebaf4b989e60da7ba2908241ef`;
- browser proof `482fc377d64de16e6927998e3f8ad087a383ed118f802f7cf4d605b4c4f77ac2`;
- browser log `f5ab869cab617275d3d5d44762ab6c5bf0337240e00fadb6fb976564f905db87`.

Proven behavior on sanitized fixtures:

- physical read-only SQLite source;
- source bytes unchanged;
- deterministic two-run plan and target hashes;
- native IndexedDB isolated temporary targets in actual Chrome;
- injected rollback with no partial target or idempotency receipt;
- typed stops and no automatic retry;
- REQ-OBS trace, inactivity/possibly-hung state and diagnostics;
- zero network and model calls.

The initial implementation head was rejected because exact-tree comparison found invalid Chrome-runner syntax and an invalid macOS checkout action. Only those two files were corrected; the remaining 17 B1a files were byte-identical.

## Preserved boundary

B1a acceptance does **not** authorize B1b.

Still prohibited:

- locating or opening the exact private SQLite source;
- B1b execution;
- creating a real migration target or performing actual target-Mac migration;
- automatic retry after failure, reload or version change;
- Candidate 5/6, Qwen, DeepSeek or other model execution;
- legacy database write/repair;
- production runtime/UI integration;
- semantic claims and real personal thoughts.

A later B1b attempt requires a new explicit user confirmation for exactly one read-only exact-source dry run against a fresh isolated temporary target. Actual migration remains a separate later gate.

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
npm test
npm run package:source
```

See `project-docs/evidence/PHASE2CB_B1A_ACCEPTANCE.md` and `project-docs/GITHUB_PROVENANCE.md` for the exact acceptance proof and boundaries.
