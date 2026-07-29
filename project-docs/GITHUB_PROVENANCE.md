# GitHub provenance and source-artifact verification

## Technical source of truth

The technical version is identified by `repository + commit SHA`. A local directory, version label, green build or downloaded ZIP without exact commit provenance is not a source of truth.

Primary repository: `ne-agalakov/mindmap-local`.

Public history-free CI mirror: `ne-agalakov/mindmap-local-ci`.

## Mandatory artifact invariant

A green workflow is necessary but insufficient. Before merge or handoff, the exact generated artifact is downloaded and checked outside the runner without editing:

- portable checksum manifests verify from another directory;
- embedded repository and commit belong to the actual checkout that produced the artifact;
- required inventory and executable modes are correct;
- user databases, exact evidence, `.env`, credentials, logs, caches, generated dependencies and personal payloads are absent;
- documentation examples of hashes or paths are distinguished from actual private files;
- any failure blocks merge and requires a regression scenario.

This invariant originated after a green artifact contained an absolute runner path. A later B1b package regression additionally proved that repository/commit provenance must be internally consistent in public-mirror builds.

## Accepted technical foundations

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

## Phase 2C-B1b exact-source acceptance

The one authorized exact-source dry run was executed once and consumed.

```text
run ID:             b1b-20260728115431-22839
package repository: ne-agalakov/mindmap-local-ci
package commit:     982cadbc62c42659aa567b803574e3e04066babc
package tree:       9b2d2588ba678f5c2bc5737687049be75c2ece96
source size:        5,070,848 bytes
source SHA-256:     356b943275cce292d0e14f8a7fbe95af07e79de73f06d3e361874d342aa2f918
portable plan hash: d8a1289c6f1865db940f65e46aec569400b630aec3cc53bdfd897f223d2436a8
target snapshot:    6319ee79284b0ca1afc5fe93d53ef37b4a9c5f85c0c9634976afa1a4979f5689
```

Confirmed from sanitized evidence:

- source opened read-only/query-only and remained byte-identical;
- quick_check/integrity_check passed;
- counts `96/30/0/133/96/3/0`, one unresolved and zero damaged references;
- two clean native IndexedDB targets produced equal portable-plan and target hashes;
- injected rollback left no graph, target or receipt;
- temporary targets were deleted;
- network/model calls were zero;
- actual migration was false.

Final acceptance gate:

```text
reviewed private head: 3e9660f2be6b57c8c0547c1fc4052d54ba8d0486
public CI head:        b69d41a580b1b9eee1c920836911eb6b12aa1e3b
shared reviewed tree:  0305705240750d2b2a8d687611261b8fd39c2610
verify:                30357519192
package:               30357516712
squash merge:          4fd14e515d2c4234f70effa475381f47bbb50e8b
post-merge docs:       e6bd47011fad2dab5a8617f5f754739de1915fd9
```

B1b acceptance does not authorize another B1b run or actual migration.

## Phase 2C-C0 provenance rule

C0 is architecture and release-metadata synchronization only. It introduces no migration executor or target.

Private branch: `phase2cc/c0-actual-migration-design`, PR #49.

Public exact-tree branch: `phase2cc-c0-design-exact`, PR #12.

The first C0 public CI run was rejected because README removed the exact accepted B1a release-gate heading. Root cause: documentation simplification weakened a machine-checked historical invariant. The heading was restored; no runtime or migration code was involved.

C0 also found a real provenance defect in the generic source packager: it always embedded the private repository name, even when a history-free public mirror commit produced the artifact. C0 must fix the packager and its regression test so repository and commit always identify the same checkout before the C0 tree can be accepted.

## C0 architecture boundary

ADR-0002 selects immutable generation databases and an atomic control registry:

```text
control registry:  mindmap-state-core-control-v1
generation prefix: mindmap-state-core-v1-generation-
```

C0 proves only the documented contract, failure matrix and staged release plan. Exact source reopening, backup creation, registry/generation creation, actual migration, promotion, model calls and personal data remain prohibited.

## Google Drive C0 readback

Canonical Google Docs were updated under revision guards and reverse-read:

- instruction revision `AIroW36ZcWf_JfFt7lK5XDAm_EdJkxW3yXl7wQnfTToXePFL68CY6a_X3hKsPoNG0TgPjKbmlzRIZvvBQMFpJgOW19KCPufzQS_DfhD68hU`, marker `PHASE2CC-C0-GENERATION-REGISTRY`;
- status revision `AIroW34l1sBtHBG5ZUYUU2SwNRaYFkstTjjtij-ToqQygfDwhmKl9ToxveQyp_2jXaa3thobaQFYELKCMNlYg7bOeMf852cnLvyDRZ-QmaA`, marker `PHASE2CC-C0-STATUS-GENERATION-REGISTRY`;
- recovery revision `AIroW37oAXT98v14qVvTmdfUH492jkIdla-LdeGCrmHK4Q0P7KGX3FnpZBfRVeWF2VSegDdqdnZf0kUitkbRev0IbdjUHAM-KWMSKhjfr5Y`, marker `PHASE2CC-C0-RECOVERY-GENERATION-REGISTRY`.

## Current acceptance boundary

C0 is not accepted until:

- repository release metadata and Drive revisions are synchronized;
- source-packager provenance is corrected and regression-tested;
- private/public exact tree equality is re-established;
- final Linux/macOS/full/actual-Chrome/package gates pass;
- the exact downloaded artifact is inspected outside the runner;
- PR #49 is merged with expected-head protection.

After C0 acceptance, only C1 pure registry/generation contracts on sanitized fixtures are allowed.