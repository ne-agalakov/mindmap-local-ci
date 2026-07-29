# GitHub provenance and source-artifact verification

## Technical source of truth

The technical version is identified by `repository + commit SHA`. A local directory, version label, green build or downloaded ZIP without exact commit provenance is not a source of truth.

Primary repository: `ne-agalakov/mindmap-local`.

Public history-free CI mirror: `ne-agalakov/mindmap-local-ci`.

## Mandatory artifact invariant

A green workflow is necessary but insufficient. Before merge or handoff, the exact generated artifact is downloaded and checked outside the runner without editing:

- portable checksum manifests verify from another directory;
- embedded repository and commit identify the actual checkout;
- required inventory and executable modes are correct;
- exact databases/evidence bytes, `.env`, credentials, logs, caches, generated dependencies and personal payloads are absent;
- sanitized fixtures/metadata are distinguished from exact private evidence;
- any failure blocks merge and requires a regression scenario.

## Accepted foundations

- Phase 0: `850a5fc60a154047eae1f6a5d4f63c7969ae8412`;
- Phase 1A: `e7b7593932614f8dfa843298f35eff0230c1e827`;
- Phase 2A: `aa5eaaae08a3da4d0ff00ea03aea12b793137a21`;
- Phase 2B: `b4b35dcd7125c820f75f89387bc18ac3fa509cb0`;
- Phase 2C-A: `292634312ad04fa6e6cfc5a5ded311ac1020094d`;
- Phase 2C-B0: `dbf2484c78e4eedcbb2efb3f0b61394b79a6d216`;
- Phase 2C-B1a: `aec5edaca877cec5d769f4ce4efff674a9c92a7d`;
- Phase 2C-B1b: `4fd14e515d2c4234f70effa475381f47bbb50e8b`;
- Phase 2C-C0: `31657e218cd5891e9e915f698febf8ac72942ed3`.

## B1b accepted exact-source boundary

The one authorized exact-source dry run was executed once and consumed.

```text
run ID:             b1b-20260728115431-22839
source size:        5,070,848 bytes
source SHA-256:     356b943275cce292d0e14f8a7fbe95af07e79de73f06d3e361874d342aa2f918
portable plan hash: d8a1289c6f1865db940f65e46aec569400b630aec3cc53bdfd897f223d2436a8
target snapshot:    6319ee79284b0ca1afc5fe93d53ef37b4a9c5f85c0c9634976afa1a4979f5689
```

Source remained byte-identical; two clean native IndexedDB targets produced equal hashes; injected rollback left no graph/target/receipt; temporary targets were deleted; network/model calls were zero; actual migration was false.

B1b acceptance does not authorize another B1b run or actual migration.

## Phase 2C-C0 accepted provenance

C0 introduced architecture and release-infrastructure only. It did not introduce an exact-source executor or create a production target.

```text
private PR:    #49
public PR:     #12
private head:  af8f3c55d9e352c1f25d7aa8f720a7e55c6611b5
public head:   9bb65ab0bfdc1631c93d3de42dd97be6f2b23dc6
shared tree:   a8523316e16273f633fac8caac95e96a5fec1080
squash merge:  31657e218cd5891e9e915f698febf8ac72942ed3
```

Exact-tree proof was reconstructed from a reviewed exact base and equal nine-file deltas; the public B1b package independently records the same current tree.

## Final current-head gates

```text
verify run:            30425727226
package run:           30425727235
duplicate verify run:  30427050113
duplicate package run: 30427050043
```

Linux lint/full suite, macOS launchers/tests, actual Chrome run-storage/graph-storage/B1a/B1b harnesses and source/exporter/B1b packaging passed.

Downloaded review from package run `30425727235`:

```text
outer artifact: f2de7f3961c5b720a35e2cbc8987e3a5216304bf8bc8513432c4d8ddb800ff1f
browser proof:  1e0c1aa3f2fd5004699ce6162b20f19e99933ed574ea1e142b7265d9507e1d45
source ZIP:     636c80a35b04f3ab7b7995c2d0cbd7cb804098b69ce67bcd3b6d1031a3099f0f
exporter ZIP:   41c693e46916d9f41d76a2efc615a37a831c39e571fc9152b43e61c3cfce7104
B1b ZIP:        24af33670975e87ce61944955de56303d15c81a0ceb81ceb0433c0bf82b877a0
```

Source and exporter metadata identify `ne-agalakov/mindmap-local-ci` plus public head `9bb65ab0bfdc1631c93d3de42dd97be6f2b23dc6`. B1b metadata also records tree `a8523316e16273f633fac8caac95e96a5fec1080`, `actualMigrationAllowed=false`, `automaticRetryAllowed=false` and `rawSourceIncluded=false`.

Portable checksums passed. User-facing exporter and B1b launchers were executable. Exact SQLite/evidence bytes, secrets, generated dependencies and personal payloads were absent. Sanitized fixtures and source-identity metadata were intentionally retained.

## Release-gate defects proved and corrected

1. README removed the exact accepted B1a heading required by the historical release gate. The heading was restored.
2. Generic source packaging paired `ne-agalakov/mindmap-local` with a public-mirror commit. It now derives the actual checkout repository or uses an explicit override; regression added.
3. Compact exporter packaging had the same independent provenance defect. It now follows the same checkout rule; regression added.
4. Canonical Drive documents were prematurely updated with unverified merge identity `69a9fc703a79f3aaa4bd44fc372f0cc8c9cb59f4`. GitHub API verification proved it was not the accepted merge. The false tail blocks were replaced and reverse-read after actual merge `31657e218cd5891e9e915f698febf8ac72942ed3`.

Earlier green runs and false document identities are historical failure evidence only and are not used for acceptance.

## Google Drive corrected post-merge readback

- instruction revision `AIroW35OjMtTyfnm5LU17ZlydzD_h22m0llDyXiCAgoj37sdxwIAS1Tlv7DA4AOmnrbtFLyTPmrst0KL9YVj9lWW_stFBgSES-F9yo2f_cA`, marker `PHASE2CC-C1-ALLOWED-31657E21`;
- status revision `AIroW34GQdFUh8mkRAY2DgpG_71_WpS6qX-fsXKDLlLiEaj5E-yIzDkmhkSRlaSImJJyuLHbSRiDsHV14J_8WVxRNzjwu2Hl8jqPpUvJuqA`, marker `PHASE2CC-C0-ACCEPTED-31657E21`;
- recovery revision `AIroW36j3OBZcn7wI6LhqlqOLAUvQFGIZMQaEBcHqw9aUUmJK6pOx4JrReih9jb5lhWs1izG5xvhnYsfM5oIZORcHhxAEq1AJIrjm5Kif3U`, marker `PHASE2CC-C0-MERGE-RECOVERY-31657E21`.

## Current acceptance boundary

C0 is accepted. Only C1 pure registry/generation contracts and attempt state machine on sanitized fixtures are allowed.

Exact-source reopening, B1b retry, backup/registry/production-generation creation, native persistence, actual migration, model/network calls and personal data remain prohibited until their separate gates.
