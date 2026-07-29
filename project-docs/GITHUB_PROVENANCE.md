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
- B1 execution plan: `8a8c0eb522fb9d7646f4e6c4c4e0da2fcdf24b8b`;
- Phase 2C-B1a: `aec5edaca877cec5d769f4ce4efff674a9c92a7d`;
- Phase 2C-B1b: `4fd14e515d2c4234f70effa475381f47bbb50e8b`;
- B1b post-merge docs: `e6bd47011fad2dab5a8617f5f754739de1915fd9`.

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

## Phase 2C-C0 provenance rule

C0 is architecture and release-infrastructure synchronization only. It introduces no exact-source executor or production target.

```text
private branch/PR: phase2cc/c0-actual-migration-design / #49
public branch/PR:  phase2cc-c0-design-exact / #12
control registry: mindmap-state-core-control-v1
generation prefix: mindmap-state-core-v1-generation-
```

## Release-gate defects proved and corrected

1. README removed the exact accepted B1a heading required by the historical release gate. The heading was restored.
2. Generic source packaging paired `ne-agalakov/mindmap-local` with a public-mirror commit. It now derives the actual checkout repository or uses an explicit override; regression added.
3. Compact exporter packaging had the same independent provenance defect. It now follows the same checkout rule; regression added.

Earlier green runs are historical evidence only and are not used for acceptance.

## Reviewed C0 exact-tree gate

```text
private head: 1e13024eeef8cec8ec05f721bf9ce703f884bc91
public head:  189e86ae8a92912d399196bed15d8ece849a58e9
shared tree:  c09d95579292970a851cf0c1a43abce13a800d3a
verify run:   30424595380
package run:  30424595384
```

Linux lint/full suite, macOS launchers/tests, actual Chrome run-storage/graph-storage/B1a/B1b harnesses and source/exporter/B1b packaging passed.

Downloaded review:

```text
outer artifact: 6e63c8d4bace4f5350713ca64dc983fde2f81808e64798c1089539a30985c720
browser proof:  9ec160607e1517f6a27e3c7ed36441dfd1a4ed2a9d4ffb634083d04014d51160
source ZIP:     7ae424491bdb82c18bb8cf46ebcf09fb2cc9f187870d4454b1c2c2d6e947cdd5
exporter ZIP:   7ede5c196249dcbb8084856cd62763cf179c1a7600e53e174efca9425fc45a98
B1b ZIP:        6de9eb5d15fea1c31cc2e99d98d52e734eb20d5a4e28889bb9b7c5575339bd83
```

Source `ARTIFACT_REVISION.json` and exporter `EXPORTER_REVISION.json` both identify `ne-agalakov/mindmap-local-ci` plus public head `189e86ae8a92912d399196bed15d8ece849a58e9`. B1b package also records exact tree `c09d95579292970a851cf0c1a43abce13a800d3a` and `actualMigrationAllowed=false`.

Portable checksums passed. User-facing exporter and B1b launchers were executable. Exact SQLite/evidence bytes, secrets, generated dependencies and personal payloads were absent. Sanitized fixtures and source-identity metadata were intentionally retained.

## Google Drive final pre-merge readback

- instruction revision `AIroW34fuCHCq9tq8qvYNgO6pqoB-UKQPgK-HRpQlfOP4loxTepfGrZzlaNhB9RcRFvKlaidlhaptmYm_cGehnx-I3z94DbfAVl8d_5xJZw`, marker `PHASE2CC-C0-FINAL-CURRENT-C09D9557`;
- status revision `AIroW34HfAFiHjD8Kvc4VA_cRE_J3_iBSTj3m3AcRytXKBVUfvAuwUww80TIHbAK7O89crfCwIib_0MQ2HnOFzwxssZeVgOpQbA3kNaFX9U`, marker `PHASE2CC-C0-FINAL-GATE-C09D9557`;
- recovery revision `AIroW342H5Owg2CWnnV57lXeLQ02veLZnDjUVD2msgpk619RNAOVXkkaRzzQ2QXU8TAZMy8VcSR1Et0ryWTCgpVbKzAZUXANFVbRKNr4Ghc`, marker `PHASE2CC-C0-FINAL-RECOVERY-C09D9557`.

## Current acceptance boundary

Artifact revision 11 contains the reviewed gate and final Drive revisions. C0 is not merged yet. Required next steps:

1. mirror this final documentation tree exactly to the public CI repository;
2. rerun Linux/macOS/full/actual-Chrome/package gates;
3. inspect the downloaded final artifact;
4. merge PR #49 with expected-head protection.

After C0 merge, only C1 pure registry/generation contracts on sanitized fixtures are allowed. Exact source reopening, backup/registry/generation creation, actual migration, model calls and personal data remain prohibited.