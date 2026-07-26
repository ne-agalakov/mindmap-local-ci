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
