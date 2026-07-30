# Phase 2C-C4 — planning and acceptance gates

Date: 2026-07-30
Status: planning candidate
Issue: #59

## Principle

C4 planning, implementation proof, exact package acceptance, execution authorization and actual migration acceptance are five separate gates. Evidence from an earlier gate cannot be promoted into a later claim.

## Gate A — planning contract

Required before any C4 code issue may open:

- exact execution contract reviewed;
- failure/recovery matrix covers every checkpoint;
- package inventory and provenance contract reviewed;
- source/backup/target/authorization identities are immutable and compatible;
- rollback is explicitly separate from migration authorization;
- REQ-OBS-001 and sanitized evidence schema are complete;
- exact SQLite/private backup remain unopened;
- no registry/generation or runner is created;
- canonical Drive docs are updated and reverse-read;
- private/public documentation tree, CI and downloaded artifact pass;
- factual expected-head merge closes Issue #59.

Gate A acceptance authorizes only a later implementation issue on sanitized fixtures.

## Gate B — implementation on sanitized fixtures

Required before an exact package may be built:

- runner/state machine implements the accepted contract without weakening it;
- package verifier and execution launcher are separate;
- detached authorization is consumed before fixture-source open;
- backup, collision, import, reopen, hash, seal, promotion and resolver paths pass;
- every failure checkpoint persists the correct terminal state;
- promotion uncertainty is resolved by readback, never by repeat;
- rollback requires separate authorization and changes only the pointer;
- reload never resumes work automatically;
- actual Chrome and macOS launcher tests pass;
- structural/runtime guards prove zero network/model calls and no personal data;
- no exact SQLite/private backup is opened.

Gate B does not authorize target-Mac execution.

## Gate C — exact package acceptance

Required before requesting user confirmation:

- exact private/public tree equality;
- full CI, macOS, actual Chrome and packaging success;
- downloaded archive outer SHA-256 recorded;
- inner checksums, inventory and executable modes independently verified;
- reconstructed source tree matches the accepted Git tree after declared metadata normalization;
- package contains no source, backup, B1b evidence, authorization, credentials, dependencies or personal payload;
- manifest binds accepted source size/hash, expected backup identity, portable-plan hash, target-snapshot hash, registry and generation prefix;
- Drive docs reverse-read;
- factual merge and post-merge closure complete.

Gate C proves the package, not the migration.

## Gate D — explicit one-shot execution confirmation

Immediately before launch, Артём must receive the exact summary and explicitly confirm:

```text
package repository/commit/tree/archive SHA-256
attempt ID
generation name
source size/SHA-256
expected backup size/SHA-256
registry/bootstrap state
allowed operations
one-shot consumption before source open
no automatic resume/retry
rollbackAuthorized = false
```

The confirmation must reference that exact package and attempt. A general “continue”, earlier approval or approval of Gate A–C is insufficient.

After confirmation, one detached authorization is created. It expires and may be consumed once. Any failure after consumption requires a new root-cause/package/confirmation cycle.

## Gate E — actual migration acceptance

Actual migration is accepted only when one sanitized evidence set proves:

- authorization consumed exactly once;
- source identity verified before and after;
- independently reopened backup is byte-identical and intact;
- target bootstrap/collision gates passed;
- deterministic import completed with no loss;
- portable-plan hash equals `d8a1289c6f1865db940f65e46aec569400b630aec3cc53bdfd897f223d2436a8`;
- target snapshot hash equals `6319ee79284b0ca1afc5fe93d53ef37b4a9c5f85c0c9634976afa1a4979f5689`;
- generation close/reopen and immutable seal passed;
- atomic promotion receipt is committed once;
- accepted C3 resolver reopens the active generation successfully;
- registry/generation/source/backup identities remain consistent;
- network/model calls are 0;
- no fallback, auto-resume, auto-retry, auto-cleanup or auto-rollback occurred;
- documents are updated and reverse-read after factual evidence review.

Green tests, generation existence or pointer promotion alone do not prove Gate E.

## Gate F — semantic validation after migration

Even Gate E proves storage/migration integrity only. Personal usability remains blocked until the same 96 synthetic thoughts pass multiple input orders with measured:

- zero losses;
- duplicate node/path rates;
- placement and hierarchy quality;
- project extraction quality;
- false links/duplicates/contradictions;
- unresolved correctness;
- order stability;
- crash/reload/checkpoint behavior;
- absence of hidden AI repeats.

Only after synthetic stability may a small real-data pilot occur with a complete reset option.

## Threat model

The plan explicitly defends against:

- wrong package or stale branch;
- source substitution or write-capable open;
- backup overwrite or incomplete copy;
- target namespace collision;
- duplicate authorization/attempt;
- partial import and reload;
- hash/seal mismatch;
- stale registry revision or replaced pointer;
- uncertain promotion completion;
- hidden fallback, repair, retry or rollback;
- leaking raw thoughts, paths, secrets or personal data;
- claiming migration success from package/CI evidence.

## Current decision boundary

While this document is a candidate:

```text
C4 planning allowed:        true
C4 implementation allowed: false
C4 execution allowed:      false
actual migration allowed:  false
```

No action is required on the Mac.
