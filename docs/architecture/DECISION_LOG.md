# Architecture decision log

## ADR-001 — Freeze Alpha.19 orchestration

Date: 2026-07-25.

Decision: preserve Alpha.19 as read-only legacy evidence and migration input. Do not create Candidate 6 on top of its monolithic orchestration.

## ADR-002 — Repository-native evidence workflow

Date: 2026-07-25.

Decision: GitHub commit/tree/artifacts are the technical source of truth; Google Drive contains canonical product documents. Every phase is a bounded issue/branch/PR and evidence precedes acceptance.

## ADR-003 — Accept immutable legacy source

Date: 2026-07-25.

Decision: accept the private SQLite blob with SHA-256 `356b943275cce292d0e14f8a7fbe95af07e79de73f06d3e361874d342aa2f918`, size `5 070 848`, 96 synthetic and 0 personal thoughts as immutable source. Legacy write remains prohibited.

## ADR-004 — Run state is a pure aggregate

Date: 2026-07-25.

Decision: authoritative run behavior uses immutable identity, closed transitions, typed commands/events/rejections, deterministic replay and derived compatibility guards outside React/browser/model services.

## ADR-005 — Native IndexedDB behind the accepted contract

Date: 2026-07-25.

Decision: use native IndexedDB through a thin repository-owned adapter. Transaction completion, abort, version upgrade, compound workspace keys, receipt persistence and revision/contentHash recheck are explicit invariants.

## ADR-006 — Actual Chrome is required

Date: 2026-07-25.

Decision: `fake-indexeddb` tests are necessary but insufficient. The same adapter must run in real Chrome and prove commit, reopen, idempotency, isolation, rollback, upgrade rollback and stable snapshot hash.

## ADR-007 — Accept graph/payload storage before migration

Date: 2026-07-26.

Decision: accept Phase 2C-A merge `292634312ad04fa6e6cfc5a5ded311ac1020094d`. Migration requires canonical payloads, thoughts, typed hierarchy, placement/unresolved, links, embeddings and damaged references transactionally.

## ADR-008 — Freeze B0 mapping before source access

Date: 2026-07-26.

Decision: split Phase 2C-B into pure B0 mapping/typed-stop planning and later execution. B0 uses sanitized fixtures only and freezes source/target gates, deterministic mapping and rollback/diagnostic requirements before exact-source access.

## ADR-009 — Drive readback before final rerun

Date: 2026-07-26.

Decision: repository metadata and canonical Google Docs must be synchronized and reverse-read before the exact final-tree CI/artifact rerun. Earlier green trees remain historical evidence only.

## ADR-010 — Accept B0, keep B1 separate

Date: 2026-07-26.

Decision: accept B0 merge `dbf2484c78e4eedcbb2efb3f0b61394b79a6d216`. Exact source, target and models remained untouched.

## ADR-011 — Reject and correct B1a delivery defects

Date: 2026-07-27.

Decision: reject initial B1a head because exact-tree comparison proved invalid Chrome runner syntax and invalid macOS checkout action. Correct only those files and require a full exact-tree rerun.

## ADR-012 — Accept B1a and keep B1b behind a new explicit gate

Date: 2026-07-27.

Decision: accept Phase 2C-B1a merge `aec5edaca877cec5d769f4ce4efff674a9c92a7d` only for sanitized executor/harness behavior. B1b requires a separate one-shot authorization.

## ADR-013 — Accept one exact-source B1b dry run, not actual migration

Date: 2026-07-28.

Decision: accept B1b merge `4fd14e515d2c4234f70effa475381f47bbb50e8b` after the one authorized target-Mac run proved exact source integrity, repeatable deterministic target snapshots, rollback cleanup, REQ-OBS trace and zero network/model calls.

Evidence:

- run `b1b-20260728115431-22839`;
- source SHA-256 `356b943275cce292d0e14f8a7fbe95af07e79de73f06d3e361874d342aa2f918` unchanged;
- portable plan hash `d8a1289c6f1865db940f65e46aec569400b630aec3cc53bdfd897f223d2436a8`;
- target snapshot hash `6319ee79284b0ca1afc5fe93d53ef37b4a9c5f85c0c9634976afa1a4979f5689`;
- actual migration false.

Consequence: B1b authorization is consumed and cannot be reused. Actual migration remains a separate gate.

## ADR-014 — Immutable generations and atomic activation registry

Date: 2026-07-29.

Decision: actual migration must not write in place or into a fixed mutable production database. Each successful import creates a fully verified and sealed immutable generation. Control registry `mindmap-state-core-control-v1` atomically selects the active generation from prefix `mindmap-state-core-v1-generation-`.

Rationale: IndexedDB has no atomic database rename or cross-database transaction. Promotion must therefore be a small atomic pointer transaction after generation verification, not another data copy.

Consequences:

- runtime resolver through the registry is required before exact-source execution;
- rollback restores the previous pointer and does not mutate payload;
- old source, backup and previous/sealed generations are retained;
- reload or failure never resumes writes automatically;
- C1 pure contracts, C2 native registry/crash proof and C3 packaged resolver must precede C4 exact-source package;
- actual execution still requires a new exact artifact-bound one-shot confirmation.

## ADR-015 — Source artifact provenance must identify the actual checkout

Date: 2026-07-29.

Decision: the generic source packager must derive or explicitly receive the repository identity of the actual checkout. It may not pair `ne-agalakov/mindmap-local` with a public-mirror commit. A regression must package a fixture with a remote and verify repository/commit consistency.

Reason: the first C0 artifact review found that source packaging still hard-coded the private repository even in history-free public CI. Green CI did not make that metadata truthful.

## ADR-016 — Exporter artifact provenance follows the same checkout rule

Date: 2026-07-29.

Decision: the compact legacy-exporter packager must also derive or explicitly receive the repository identity of the actual checkout and regression-test it. The second C0 artifact review proved that `EXPORTER_REVISION.json` still paired the private repository with a public-mirror commit after the generic source package was corrected.

Consequence: both source and exporter packages are rejected unless repository and commit identify the same checkout. The B1b package already follows this rule.