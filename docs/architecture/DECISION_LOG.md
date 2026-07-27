# Architecture decision log

## ADR-001 — Freeze Alpha.19 orchestration

Date: 2026-07-25

Decision: do not create another candidate on top of the current `app/page.tsx` orchestration. Preserve it as read-only legacy evidence and migration input.

Consequences: no Candidate 5 continuation, no DeepSeek run, no Candidate 6 from legacy orchestration, new state-core/storage namespaces only.

## ADR-002 — Repository-native agent workflow

Date: 2026-07-25

Decision: durable coding instructions live in short `AGENTS.md`; architecture facts and plans live in linked repository documents. Every implementation phase is a bounded issue and PR.

Consequences: GitHub is the technical source of truth; evidence precedes code; PR acceptance names exact scenarios, hashes and proof limits.

## ADR-003 — Accept the exact browser database as Phase 0 source

Date: 2026-07-25

Decision: accept the private target-Mac SQLite blob with SHA-256 `356b943275cce292d0e14f8a7fbe95af07e79de73f06d3e361874d342aa2f918` as immutable legacy source.

Evidence: source hash unchanged, integrity `ok`, 96 synthetic and zero personal thoughts, zero write/migration/network/model calls.

Consequences: legacy writes and actual migration remain prohibited; later migration must use a new namespace and preserve source bytes.

## ADR-004 — Run state is an explicit pure aggregate

Date: 2026-07-25

Decision: authoritative run behavior is defined by immutable identity, a closed state machine, typed commands/events/rejections, deterministic replay and derived compatibility guards. React, storage, browser APIs and model services are outside this boundary.

Consequences: model mismatch blocks before action; inspection emits no event; authorization and attempt are explicit/idempotent; Phase 2 persists the same contract transactionally.

## ADR-005 — Native IndexedDB behind the accepted Phase 2 contract

Date: 2026-07-25

Decision: implement the Phase 2B production-candidate adapter with native IndexedDB against `storage/contracts.ts`, not against the competing contract from closed PR #17.

Reason:

- explicit control of transaction completion, abort and version upgrades is a release invariant;
- `fake-indexeddb` already provides fast deterministic coverage;
- a thin adapter avoids a new production dependency;
- compound keys and object-store transactions are sufficient for the bounded state volume;
- direct browser execution can verify the same adapter without framework/runtime integration.

Consequences:

- database names must start with `mindmap-state-core-v1`;
- legacy `mindmap-local-semantic-v060` is rejected before `indexedDB.open`;
- events, aggregate, artifacts and receipt share one readwrite transaction;
- request success is not commit; transaction completion is authoritative;
- persisted revision/contentHash are rechecked inside the write transaction;
- idempotency receipts survive reopen;
- synthetic/personal workspaces use compound keys;
- actual migration and runtime/UI integration remain separate gates.

## ADR-006 — Real Chrome IndexedDB is required for Phase 2B acceptance

Date: 2026-07-25

Decision: `fake-indexeddb` tests are necessary but insufficient. The same Vite-built adapter must execute in headless Chrome against actual browser IndexedDB.

Required browser scenarios:

- atomic commit;
- close/reopen;
- idempotent retry;
- workspace isolation;
- abort rollback after queued writes;
- failed schema upgrade preserving the previous readable version;
- stable snapshot content hash.

Evidence on code head `2ced13b72d1f582028348bedc2ca6a7ef0e57246`:

```text
atomicCommit: true
reopen: true
idempotency: true
workspaceIsolation: true
abortRollback: true
upgradeRollback: true
snapshotHash: 23c72cfd4768f5c76f0f376646fcbbd8a7630fb973e85704f460f19af6b27409
```

The first browser job exposed a harness cleanup race only after all storage assertions passed. Root cause: Chrome still held its temporary profile during deletion. The runner now awaits process exit before cleanup; the repeated full gate passed.

Consequences: browser-storage evidence is explicit and reusable, but it does not prove target-Mac migration, production UI/runtime, REQ-OBS-001 or semantic quality.

## ADR-007 — Accept canonical graph/payload storage before migration

Date: 2026-07-26

Decision: accept Phase 2C-A as merge `292634312ad04fa6e6cfc5a5ded311ac1020094d`. Migration cannot proceed with run history alone; the canonical graph aggregate must preserve payloads, thoughts, typed hierarchy, placement/unresolved, links, embeddings and damaged references transactionally.

Evidence:

- final reviewed head `29a317b58cbecaea13e4f21c02af2b945a6e6edc`;
- exact public tree `e81ae1b309a806f0078b5a8a2057f51d4c0e403d`;
- verify `30198811851` and package `30198811852`;
- target-Mac Chrome proof;
- downloaded source/exporter/browser inspection;
- post-merge Drive readback.

Consequences:

- Phase 2C-B may define and test an isolated exact-source dry run;
- same-fixture cross-environment equality remains open;
- no actual target-Mac migration, model execution, runtime/UI integration or real thought import is authorized;
- release-doc marker case and generic-path scan failures are recorded as gate regressions, not storage failures.

## ADR-008 — Freeze deterministic B0 mapping before exact-source access

Date: 2026-07-26

Decision: Phase 2C-B is split into B0 and B1. B0 is a pure deterministic planner tested only with sanitized fixtures. It freezes exact source/target identity checks, graph/run mapping, typed stops and B1 rollback/diagnostic requirements before any private SQLite source is opened.

Evidence:

- implementation commit `1020c958dc51b63a63cd503733c23b4654d966b5`;
- pre-documentation private/public exact tree `ada806f53d27c83a3375aa4fd01879d0dca48881`;
- public verify `30205617026`;
- public package `30205616954`;
- downloaded source/exporter/browser artifacts inspected;
- database, credential, concrete local-path and forbidden B0 dependency findings: 0;
- private source opened, target created and model calls: 0.

A documentation mismatch was found after the first exact-head artifact inspection: `ARTIFACT_REVISION.json` still represented only accepted Phase 2C-A. The code/CI gate passed, but B0 acceptance remains blocked until metadata, Drive, rerun and merge provenance are synchronized.

Consequences:

- B1 remains prohibited until B0 merge provenance is complete;
- no exact private source, native target or transaction rollback claim is inferred from B0;
- actual target-Mac migration remains a later explicit user-confirmed gate.

## ADR-009 — Drive readback precedes the exact final-head rerun

Date: 2026-07-26

Decision: after the stale Phase 2C-A-only artifact revision was found, B0 repository metadata and all three canonical Google Docs were synchronized and reverse-read before constructing the exact final-head CI mirror. CI evidence from the earlier tree remains historical evidence and is not substituted for the required final-tree rerun.

Consequences:

- release documentation gate validates B0 implemented/not-accepted, B1 blocked and zero source/target/model actions;
- a final CI/artifact rerun is mandatory after the documentation commit;
- no B1 or migration action is authorized by documentation synchronization.

## ADR-010 — Accept Phase 2C-B0 and keep B1 behind a separate gate

Date: 2026-07-26

Decision: accept the pure deterministic `phase2cb-mapping-v1` and typed-stop contract after exact final-tree public CI, independent downloaded-artifact inspection, merge `dbf2484c78e4eedcbb2efb3f0b61394b79a6d216` and canonical Drive post-merge readback.

Evidence: private `2e0719c68813d61171b70a1ab98081febdb6ea01`, public `cbbd0bb629eea56082e7da54f439c50ca96e56cc`, tree `10b0cd7fea77fdff04cf2e072be9604d2a5c05cb`, verify `30208230376`, package `30208230352`, source artifact `e13780b4a53b9ebbbd3d2d356e70e42812eb0fcb7a6e71687c012019c88a4069`, browser proof `beec9c5a333960cf05befb418bc50d8124ba6e3bbd5cee93b7469f386ff971c3`.

Consequences:

- B0 is accepted on sanitized fixtures only;
- B1 may be planned but not executed automatically;
- private source read, target creation, actual migration, runtime/UI and model execution require later separate gates;
- zero source/target/model actions during B0 acceptance is preserved.

## ADR-011 — Correct B1a delivery defects before acceptance

**Decision.** Keep the B1a executor/test design, but reject the initial exact tree because two delivery files differed from the code-equivalent tested overlay. Correct only `.github/workflows/ci.yml` and `scripts/run-browser-phase2cb-b1a-harness.mjs`, then require corrected private/public tree equality and full rerun.

**Evidence.** Initial head `42644037d2b4d66d3e92cff4a591d5b3ea58078f` contained invalid `actions/checkout4` and invalid `throw new Error, ...`. Seventeen other B1a files matched byte-for-byte. Corrected head `df2570b6cfea74296248297b7000b29876036e95` and public `76a6da518301fcddbcaa9c3e06fdeb46805dbf6c` share tree `8ef2603b85aef1e7f1ff055cce7579259e3ee659`; verify `30239528354` and package `30239528365` passed.

**Consequence.** B1a remains implemented but unaccepted until docs/merge provenance. B1b and exact-source access remain blocked.
