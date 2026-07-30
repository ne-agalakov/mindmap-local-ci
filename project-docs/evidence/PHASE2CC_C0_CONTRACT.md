# Phase 2C-C0 — actual-migration gate contract

Date: 2026-07-29
Status: design contract; execution prohibited
Issue: #48

## Scope

C0 defines the production migration and activation contract. It does not open the exact SQLite, create an IndexedDB target, execute migration, call a model or use personal data.

Accepted baseline:

```text
B1b merge:            4fd14e515d2c4234f70effa475381f47bbb50e8b
post-merge docs:      e6bd47011fad2dab5a8617f5f754739de1915fd9
source size:           5,070,848 bytes
source SHA-256:        356b943275cce292d0e14f8a7fbe95af07e79de73f06d3e361874d342aa2f918
thoughts/nodes/links:  96 / 30 / 0
decisions/embeddings: 133 / 96
runs/personal:         3 / 0
unresolved/damaged:    1 / 0
portable plan hash:    d8a1289c6f1865db940f65e46aec569400b630aec3cc53bdfd897f223d2436a8
target snapshot hash:  6319ee79284b0ca1afc5fe93d53ef37b4a9c5f85c0c9634976afa1a4979f5689
```

## Immutable identities

An execution manifest freezes before source opening:

- repository, commit and Git tree;
- package archive SHA-256;
- application/storage/mapping versions;
- migration attempt ID;
- detached authorization ID;
- source size and SHA-256;
- local backup identity;
- control registry name and expected revision;
- generation ID and exact generation database name;
- workspace `synthetic`;
- expected counts;
- expected portable plan and target snapshot hashes;
- previous active generation identity, if any;
- retry policy `new-explicit-confirmation-required`;
- model mode `без AI`;
- actual migration allowed only for this manifest.

A mismatch in any immutable identity stops before mutation.

## Database roles

### Legacy source

- opened only read-only/query-only;
- never repaired, replaced, deleted or used as target;
- SHA-256 and modification timestamp checked before backup, after backup and after migration.

### Backup

- local private copy created with exclusive-create semantics;
- exact size, SHA-256, quick check and integrity check must match;
- never overwritten;
- never included in evidence or Git;
- required before generation creation.

### Generation

- exact name starts with `mindmap-state-core-v1-generation-`;
- does not exist before the attempt;
- contains unified run/graph stores and generation metadata;
- remains inactive until imported, verified and sealed;
- is immutable after sealing.

### Control registry

- exact name `mindmap-state-core-control-v1`;
- contains control metadata only;
- activation pointer update is one atomic IndexedDB transaction;
- registry revision guards stale writers;
- no control record contains raw product payloads.

## Attempt state machine

Allowed forward states:

```text
planned
→ authorization_consumed
→ source_verified
→ backup_verified
→ generation_created
→ importing
→ imported
→ verified
→ sealed
→ promotion_ready
→ promotion_committed
→ resolver_verified
→ completed
```

Allowed explicit recovery states:

```text
stopped_prewrite
stopped_generation
promotion_aborted
rollback_required
rolled_back
abandoned
```

Rules:

- state transitions are append-only and monotonic;
- each transition contains attempt ID, registry revision, package identity, timestamp and reason;
- reload/termination never creates a transition automatically;
- a non-terminal persisted attempt blocks another attempt with the same source/generation identity;
- any stop consumes the authorization and forbids automatic retry;
- `completed` requires source unchanged, backup verified, generation sealed, active pointer correct and resolver verification passed.

## Import invariants

The generation import must preserve the accepted B1b mapping contract:

- exactly three historical runs with immutable identities;
- continuous run event sequences and canonical replay;
- atomic per-run event/aggregate/artifact commits with idempotency receipts;
- one atomic graph aggregate commit with its receipt;
- 96 thoughts and 96 valid embeddings;
- 30 nodes, zero links and zero damaged references;
- one explicit unresolved thought, not a fabricated node;
- synthetic workspace only;
- no personal thought records;
- no write to legacy source;
- zero network and model calls.

The target-independent portable plan hash and persisted target snapshot hash must equal the accepted B1b values. A database-name-dependent mapping hash is recorded but is not the cross-generation equality gate.

## Verification and sealing

Before sealing, the package must:

1. close and reopen both run and graph adapters;
2. export canonical run and graph snapshots;
3. verify schema and required stores;
4. verify exact counts and all reference invariants;
5. verify receipts and idempotency identities;
6. verify portable plan and target snapshot hashes;
7. re-hash source and backup;
8. verify network/model counters remain zero.

Sealing is a transaction that writes immutable generation metadata only after all checks pass. A sealed generation cannot accept migration writes.

## Promotion contract

Promotion is permitted only when:

- authorization is consumed by this attempt;
- attempt state is `promotion_ready`;
- generation is sealed and its stored identity matches the manifest;
- registry revision and previous active pointer match the manifest;
- no other promotion lock is active;
- runtime resolver version is compatible and already proven on sanitized fixtures.

One registry transaction writes:

- new active pointer;
- incremented registry revision/activation epoch;
- activation receipt containing previous and next identities;
- attempt state `promotion_committed`.

Transaction abort leaves the old pointer unchanged.

After commit, the package resolves the active generation through the same registry resolver used by the runtime and verifies the target snapshot. Only then may the attempt become `resolver_verified` and `completed`.

## Rollback contract

Rollback never edits generation payloads. It atomically restores the prior active pointer using the activation receipt and records a rollback receipt.

Rollback is allowed only when:

- the prior pointer is still present and its expected identity matches;
- the registry revision is the expected post-promotion revision;
- no later activation has occurred;
- the rollback authorization is explicit for this attempt.

If these conditions do not hold, the system stops with `rollback_conflict`; it does not guess.

## Evidence contract

Permanent evidence may contain:

- package/source/backup/generation hashes and sizes;
- redacted database identities or stable non-path IDs;
- counts, versions and states;
- timestamps, progress and heartbeat;
- stop codes and sanitized reasons;
- registry revisions and activation/rollback receipts;
- network/model counters.

Permanent evidence must not contain:

- SQLite bytes or backup bytes;
- raw thought text or node labels;
- embeddings;
- model prompts/responses;
- local absolute paths;
- secrets or environment values.

## Authorization boundary

C0 authorizes only architecture, contracts, failure matrices and sanitized future implementation. Exact-source reopening, backup creation, generation creation, promotion, actual migration and runtime use remain prohibited until all later gates pass and Artyom gives a new explicit confirmation immediately before execution.