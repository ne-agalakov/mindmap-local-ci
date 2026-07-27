# MindMap Local v0.6-alpha.19

MindMap is a local-first personal AI system intended to turn a stream of thoughts into understanding, connections, priorities, decisions, actions, results and durable memory.

## Current status

Alpha.19 remains a frozen research prototype and must not receive real personal thought data.

Accepted foundations:

- Phase 0 exact legacy evidence: merge `850a5fc60a154047eae1f6a5d4f63c7969ae8412`;
- Phase 1A pure state core: merge `e7b7593932614f8dfa843298f35eff0230c1e827`;
- Phase 2A transactional storage contract: merge `aa5eaaae08a3da4d0ff00ea03aea12b793137a21`;
- Phase 2B native IndexedDB run storage: merge `b4b35dcd7125c820f75f89387bc18ac3fa509cb0`;
- Phase 2C-A canonical graph/payload storage: merge `292634312ad04fa6e6cfc5a5ded311ac1020094d`.

## Accepted Phase 2C-A

Phase 2C-A adds:

- content-addressed payloads and thought records;
- typed area → direction → project hierarchy;
- exactly one placement or explicit `unresolved` per thought;
- proposed/confirmed/rejected link lifecycle;
- embeddings bound to exact text hash, model and dimensions;
- damaged references separate from unresolved;
- deterministic graph replay and canonical snapshot hashes;
- atomic graph events + materialized graph + idempotency receipt;
- stale-revision and idempotency-conflict rejection;
- workspace isolation, abort rollback and corruption refusal;
- coexistence with accepted run stores in a fresh unified database;
- refusal to silently upgrade an existing run-only database.

Exact provenance:

```text
final reviewed head: 29a317b58cbecaea13e4f21c02af2b945a6e6edc
squash merge:        292634312ad04fa6e6cfc5a5ded311ac1020094d
public CI head:      ee5401a4a2ca7763467562417b9c5c4aece01214
shared Git tree:     e81ae1b309a806f0078b5a8a2057f51d4c0e403d
```

Target-Mac real Chrome passed atomic commit, reopen, idempotency, isolation, run-adapter coexistence, abort rollback, run-only refusal, corruption refusal and link lifecycle.

Public-mirror final gates:

- verify `30198811851` — Linux lint/full tests, actual Chrome run/graph storage, GitHub-hosted macOS: passed;
- package-source `30198811852` — tests, source/exporter packaging and upload: passed.

Downloaded final artifacts:

- outer source: `2184324939c12db0af27ad913904d953b0ee5b5f73b1c7e85c580f020263688c`;
- inner source ZIP: `81d469a6eb53908b1c863c8643598a1953bffa8392174d9e1292b3a1e2058c3b`;
- inner exporter ZIP: `1388fbc608d27c6d446646c84fd7c29ab59a76ed3e587a4b41f803b901b32109`;
- browser proof: `5c63ffa99679b9cff87d8c82b16d7d4f31080e3bbbc6c7c1a218e8cbe1ddb755`;
- browser log: `0bf055b8ed72d24debe8d4579d98051cc4956f6175c84b28f1a024f80ebe352a`.

External inspection found no database, `.env`, credentials, concrete local user-home path, runtime cache or personal thought/database payload. Google Drive was updated after merge and reverse-read.

The target-Mac and GitHub harnesses used different deterministic fixtures. Their absolute hashes therefore are not one cross-environment state:

```text
target-Mac fixture: ee7f14540dbc394654b81e1724dc35b0b01f8d13f303ab03a157e5c1079b4fc1
GitHub fixture:     bc59236e3ce7173c3f91176fb163f808a99de6f2343afcdc6eea8b12bdca5a54
```

Each fixture passed close/reopen equality. Same-fixture cross-environment hash equality remains uncovered.

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

## Phase 2C-B0 — implemented, not accepted

A separate branch implements `phase2cb-mapping-v1` using sanitized fixtures only. It freezes exact source/target gates, graph mapping, quarantined run-history preservation, typed stops and the B1 rollback/diagnostic contract. It does not open SQLite or create a target. See `docs/architecture/PHASE2CB_MAPPING_CONTRACT.md`.

## Phase 2C-B0 exact-head evidence

The pre-documentation head `69429ee80d7be0425501054ed54f3052867c9968` was reproduced in the history-free public CI mirror as commit `8fc83312f71a29ec50fd57659fb39ff9ae5c0784`. Both repositories had the exact tree `ada806f53d27c83a3375aa4fd01879d0dca48881`.

Passed:

- public `verify` run `30205617026`;
- public `package-source` run `30205616954`;
- Linux lint/full suite;
- GitHub-hosted macOS tests;
- actual Chrome run-storage and graph-storage harnesses;
- source/exporter packaging;
- downloaded source/exporter/browser-proof inspection;
- database, credential, concrete local-path and forbidden B0 dependency findings: 0.

Downloaded artifacts:

- outer source artifact `66d641699fd1d11f3e8745890bfa5dc7a4325b57f67d9cad78ebd72fdbc967a2`;
- inner source ZIP `54505aab1fc45048f6ebbe6050b9eefec945be29a7652cb01a06a719bfc30efa`;
- inner exporter ZIP `e8ae3b3e2870e89062eacc404cfcb75689a08006188b1765beb88582adef6b3c`;
- browser proof artifact `86a800ba525d188a35934cc4f40f62b896d3483f43cbf951b959aba54e200b36`.

This closes the code/CI/artifact execution gate for that exact tree. B0 remains unaccepted until final repository metadata, Google Drive readback, exact-head rerun and merge provenance are complete.

## Preserved boundary

Only Phase 2C-B0 review and acceptance are currently allowed. The exact-source B1 dry run remains blocked until B0 passes final CI, artifact, documentation, Drive and merge-provenance gates.

Still prohibited:

- Candidate 5 continuation;
- Qwen or DeepSeek execution;
- Candidate 6;
- legacy database write/repair;
- actual target-Mac migration or production-storage change;
- runtime/UI integration and REQ-OBS-001 claims;
- semantic claims and real personal thoughts.

## Next verified step

Review and accept the Phase 2C-B0 deterministic mapping/typed-stop contract. Only after that merge provenance may B1 open the exact accepted source read-only and write a fresh isolated temporary target. Actual migration remains a later explicit user-confirmed gate.

## Phase 2C-B0 — accepted

PR #40 was merged as `dbf2484c78e4eedcbb2efb3f0b61394b79a6d216` after the exact private head `2e0719c68813d61171b70a1ab98081febdb6ea01` was reproduced in the public CI mirror as `cbbd0bb629eea56082e7da54f439c50ca96e56cc` with the identical tree `10b0cd7fea77fdff04cf2e072be9604d2a5c05cb`.

Final evidence:

- public verify `30208230376` — passed Linux full, actual Chrome storage harnesses and macOS launcher tests;
- public package `30208230352` — passed tests and source/exporter packaging;
- downloaded source artifact `e13780b4a53b9ebbbd3d2d356e70e42812eb0fcb7a6e71687c012019c88a4069`;
- inner source `1ac13430d4e28456f4f29aec0061a4789b45449a415da6caa1a4886acbfd974b`;
- inner exporter `c86a24da9ba268992046045ba250c2ac27c8316205f19453e687f20fbf192941`;
- browser proof artifact `beec9c5a333960cf05befb418bc50d8124ba6e3bbd5cee93b7469f386ff971c3`;
- database, secret, personal-data and concrete local-path findings: 0;
- private source opened, target created, migration executed and model calls: 0.

B0 acceptance covers only deterministic mapping and typed stops on sanitized fixtures. B1 remains blocked until a separate exact-source read-only → isolated temporary-target plan and explicit gate are accepted. Actual migration is not authorized.

## Phase 2C-B1a — implemented, final documentation gate pending

B1a is implemented on sanitized fixtures only. The corrected private head `df2570b6cfea74296248297b7000b29876036e95` and public exact head `76a6da518301fcddbcaa9c3e06fdeb46805dbf6c` share tree `8ef2603b85aef1e7f1ff055cce7579259e3ee659`.

The exact-tree gate found and corrected two delivery defects before merge: invalid Chrome-runner syntax and an invalid macOS checkout action. The other 17 B1a files were byte-identical to the already tested implementation.

Passed on the corrected exact tree:

- verify `30239528354`: Linux lint/full suite, actual Chrome run/graph storage, actual Chrome B1a IndexedDB and macOS launchers;
- package `30239528365`: source/exporter packaging;
- downloaded source/exporter/browser artifact inventory, credential, database, personal-data and local-path inspection;
- deterministic repeated plan/target hashes and injected rollback;
- source unchanged, exact source unopened, actual migration false, network/model calls zero.

B1a is not accepted until the final repository-document tree is re-run as an exact public mirror, artifacts are re-inspected, PR #43 is merged and post-merge provenance is recorded. B1b and actual migration remain blocked.
