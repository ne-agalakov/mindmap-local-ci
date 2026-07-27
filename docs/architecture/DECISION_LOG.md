# Architecture decision log

## ADR-001 — Freeze Alpha.19 orchestration

Date: 2026-07-25.

Decision: preserve Alpha.19 as read-only legacy evidence and migration input. Do not create Candidate 6 on top of its monolithic orchestration.

## ADR-002 — Repository-native evidence workflow

Date: 2026-07-25.

Decision: GitHub commit/tree/artifacts are the technical source of truth; Google Drive contains canonical product documents. Every phase is a bounded issue/branch/PR and evidence precedes acceptance.

## ADR-003 — Accept immutable legacy source

Date: 2026-07-25.

Decision: accept the private SQLite blob with SHA-256 `356b943275cce292d0e14f8a7fbe95af07e79de73f06d3e361874d342aa2f918`, size `5 070 848`, 96 synthetic and 0 personal thoughts as immutable source. Legacy write and actual migration remain prohibited.

## ADR-004 — Run state is a pure aggregate

Date: 2026-07-25.

Decision: authoritative run behavior uses immutable identity, closed transitions, typed commands/events/rejections, deterministic replay and derived compatibility guards outside React/browser/model services.

## ADR-005 — Native IndexedDB behind the accepted contract

Date: 2026-07-25.

Decision: use native IndexedDB through a thin repository-owned adapter against `storage/contracts.ts`. Transaction completion, abort, version upgrade, compound workspace keys, receipt persistence and revision/contentHash recheck are explicit invariants.

## ADR-006 — Actual Chrome is required

Date: 2026-07-25.

Decision: `fake-indexeddb` tests are necessary but insufficient. The same adapter must run in real headless Chrome and prove commit, reopen, idempotency, isolation, rollback, upgrade rollback and stable snapshot hash.

## ADR-007 — Accept graph/payload storage before migration

Date: 2026-07-26.

Decision: accept Phase 2C-A merge `292634312ad04fa6e6cfc5a5ded311ac1020094d`. Migration requires canonical payloads, thoughts, typed hierarchy, placement/unresolved, links, embeddings and damaged references transactionally.

## ADR-008 — Freeze B0 mapping before source access

Date: 2026-07-26.

Decision: split Phase 2C-B into pure B0 mapping/typed-stop planning and later execution. B0 uses sanitized fixtures only and freezes source/target gates, deterministic mapping and rollback/diagnostic requirements before any exact-source access.

## ADR-009 — Drive readback before final rerun

Date: 2026-07-26.

Decision: repository metadata and all canonical Google Docs must be synchronized and reverse-read before the exact final-tree CI/artifact rerun. Earlier green trees remain historical evidence only.

## ADR-010 — Accept B0, keep B1 separate

Date: 2026-07-26.

Decision: accept B0 merge `dbf2484c78e4eedcbb2efb3f0b61394b79a6d216` after exact tree `10b0cd7fea77fdff04cf2e072be9604d2a5c05cb`, verify `30208230376`, package `30208230352`, downloaded-artifact inspection and post-merge Drive readback. Exact source, target and models remained untouched.

## ADR-011 — Reject and correct B1a delivery defects

Date: 2026-07-27.

Decision: reject initial B1a head `42644037d2b4d66d3e92cff4a591d5b3ea58078f` because exact-tree comparison proved invalid Chrome runner syntax and invalid `actions/checkout4`. Correct only those two files and require full exact-tree rerun. The other 17 B1a files were byte-identical.

Evidence: corrected code head `df2570b6cfea74296248297b7000b29876036e95`; corrected tree `8ef2603b85aef1e7f1ff055cce7579259e3ee659`; verify `30239528354`; package `30239528365`.

## ADR-012 — Accept B1a and keep B1b behind a new explicit gate

Date: 2026-07-27.

Decision: accept Phase 2C-B1a squash merge `aec5edaca877cec5d769f4ce4efff674a9c92a7d` only for sanitized executor/harness behavior.

Final evidence:

- private final head `c1237b9ba012d60dc720bf940082c7d8e88f4e1e`;
- public exact head `667b218b8bf863c45ae074db65a314e77786f8d0`;
- shared tree `58d2bb0e9b7edebb3d3d830064406feffbff5181`;
- verify `30245125059`;
- package `30245125058`;
- downloaded source/browser artifacts and manifests independently verified;
- post-merge canonical Drive readback verified.

Accepted behavior: physical read-only sanitized SQLite; source byte identity; deterministic repeated plan/target hashes; actual Chrome IndexedDB temporary targets; injected rollback; typed stops; no automatic retry; REQ-OBS trace/live diagnostics; zero network/model calls.

Proof boundary: exact private source was not opened, no real migration target was created and actual migration was not performed.

Consequence: B1b is not authorized automatically. A B1b attempt requires a new explicit user confirmation for exactly one read-only exact-source dry run against a fresh isolated temporary target. Actual migration remains a separate later gate.
