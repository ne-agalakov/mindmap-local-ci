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

## ADR-017 — Accept C0 only from factual merge identity

Date: 2026-07-29.

Decision: accept Phase 2C-C0 only as squash merge `31657e218cd5891e9e915f698febf8ac72942ed3`, built from private head `af8f3c55d9e352c1f25d7aa8f720a7e55c6611b5`, public counterpart `9bb65ab0bfdc1631c93d3de42dd97be6f2b23dc6` and shared tree `a8523316e16273f633fac8caac95e96a5fec1080`.

The canonical Drive documents had prematurely recorded unverified identity `69a9fc703a79f3aaa4bd44fc372f0cc8c9cb59f4`. GitHub API verification proved it was not the accepted merge. Those tail blocks were replaced and reverse-read after the factual merge.

Consequence: post-merge documentation may record a merge SHA only after the PR API returns `merged=true` and the returned merge commit is read back. A predicted, cached, PR-body or assistant-stated identity is not evidence.

C0 acceptance authorizes only C1 pure contracts/state machine on sanitized fixtures. Exact-source reopening, native persistence, backup/registry/generation creation, actual migration, network/model calls and personal data remain prohibited.

## ADR-018 — C1 acceptance requires a final documentation tree

Date: 2026-07-29.

Decision: Phase 2C-C1 implementation at private head `ac639e625b6d0ced665c748c2c58f6b3753c4ffc` / public head `0eeb9fea5792b7fbf33db0061abc2f271db3b17f` / tree `2a536a54779634647eff8ebf2476840c257b2813` is an acceptance candidate only. Initial CI and downloaded-artifact review prove the code tree, but C1 is accepted only after canonical Drive reverse-read, artifact revision 13, final exact private/public tree, rerun CI/artifact inspection and factual expected-head merge of PR #52.

Consequence: no predicted merge SHA may be written as accepted provenance. C2, exact-source access and actual migration remain blocked until factual C1 merge and post-merge documentation closure.

## ADR-020 — C3 resolver is read-only, fail-closed and registry-authoritative

Date: 2026-07-30.

Decision: packaged runtime may resolve a generation only through the accepted C2 control registry. It must prove the registry exists without creating it, validate registry/pointer/attestation/generation/schema/workspace/seal/hash, and re-read registry before returning to reject pointer replacement.

No legacy, previous, inactive or guessed-generation fallback is allowed. The resolver cannot repair, migrate, promote, roll back, automatically resume/retry or call external services. Missing or invalid state returns a typed rejection.

Acceptance: C3 was accepted by factual merge `38b0e3fb9542174328396ae19bff76f18d637f21` after final tree `9bee67d28fe5979fb64b2992710aa4e6bcf2fbba`, CI/package and downloaded-artifact review.

## ADR-021 — Proposed C4 one-shot execution and separate rollback authorization

Date: 2026-07-30.
Status: planning candidate; not yet accepted.

Decision candidate:

1. A future C4 migration authorization binds exact package/source/backup/registry/generation/attempt identities and is consumed atomically before first source open.
2. The authorization is one-shot; failure after consumption never resumes or retries automatically.
3. First production activation is allowed only in strict bootstrap-empty mode. Any collision is terminal and is not repaired or deleted automatically.
4. Generation import must reproduce the accepted portable-plan and target-snapshot hashes, then close/reopen, verify and seal before promotion.
5. Promotion is one atomic registry pointer transaction followed by the accepted C3 resolver.
6. Migration authorization has `rollbackAuthorized=false`. Rollback requires a separate detached authorization bound to the observed current/previous pointer, registry revision, activation receipt and failure evidence.
7. Planning, sanitized implementation, exact package, user authorization and actual migration acceptance remain separate gates.

Rationale: a migration permission must not silently include a second state-changing decision. Separating rollback prevents hidden recovery, preserves evidence and makes every active-pointer transition explicit and auditable.

Consequence while candidate: C4 implementation/execution, exact source/private backup access, production namespace and actual migration remain prohibited.
