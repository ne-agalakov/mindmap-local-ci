# Phase 2C-C4 — exact-source one-shot execution contract

Status: planning candidate only. This document does not authorize implementation or execution.

## Accepted baseline

```text
C3 merge:         38b0e3fb9542174328396ae19bff76f18d637f21
C3 closure:       dd5e3ba57d0f5ce17254569625ab9bc93b149a55
C3 final tree:    9bee67d28fe5979fb64b2992710aa4e6bcf2fbba
source size:      5 070 848 bytes
source SHA-256:   356b943275cce292d0e14f8a7fbe95af07e79de73f06d3e361874d342aa2f918
portable plan:    d8a1289c6f1865db940f65e46aec569400b630aec3cc53bdfd897f223d2436a8
target snapshot:  6319ee79284b0ca1afc5fe93d53ef37b4a9c5f85c0c9634976afa1a4979f5689
registry:         mindmap-state-core-control-v1
generation prefix: mindmap-state-core-v1-generation-
```

B1b is consumed and may not be repeated. Actual migration remains prohibited until a later implementation/package gate and a new explicit confirmation from Артём immediately before launch.

## Immutable identities

A future C4 attempt is valid only when one detached manifest binds all of the following:

- repository, commit SHA and Git tree;
- outer archive SHA-256 and inner portable checksum manifest;
- package format/version and executable inventory;
- exact source size/SHA-256;
- expected backup size/SHA-256, equal to the source identity;
- control-registry name and schema version;
- exact generation database name;
- workspace ID, attempt ID and authorization ID;
- expected portable-plan and target-snapshot hashes;
- permitted operations and prohibited operations;
- authorization issue/expiry timestamps and one-shot consumption location.

Any mismatch is terminal and occurs before source open whenever technically possible.

## Detached one-shot authorization

The authorization file is outside the package and is created only after the package has passed exact-tree CI, downloaded-artifact inspection and user confirmation.

Required fields:

```text
authorizationId
attemptId
generationName
repository
commit
tree
archiveSha256
sourceSize
sourceSha256
backupExpectedSize
backupExpectedSha256
registryName
expectedPortablePlanHash
expectedTargetSnapshotHash
allowedOperations
rollbackAuthorized = false
issuedAt
expiresAt
```

Rules:

1. The authorization is consumed atomically before the first source open.
2. A consumed, expired, mismatched or previously seen authorization is rejected.
3. Crash/failure after consumption never permits automatic resume or retry.
4. A replacement attempt requires offline root-cause proof, a regression, a newly accepted package and a new explicit confirmation.
5. Migration authorization never authorizes rollback. Rollback requires a separate detached authorization bound to the observed current pointer, previous pointer, registry revision and failure evidence.

## Source and backup contract

The future runner must:

1. verify package and authorization identities offline;
2. consume authorization before source open;
3. open the source read-only/query-only;
4. verify source size, SHA-256, SQLite integrity and expected sanitized counts;
5. create a new backup at a predetermined authorization-bound destination without overwrite;
6. fsync/close/reopen the backup and verify byte identity, size, SHA-256 and SQLite integrity;
7. preserve source and backup unchanged before and after the attempt.

Expected backup SHA-256 equals the accepted source SHA-256. A pre-existing backup destination, partial copy, hash mismatch or integrity failure is terminal. No automatic deletion or overwrite is allowed.

## Production target gates

C4 is the first production activation. Therefore the future execution is allowed only in strict bootstrap-empty mode:

- the generation name is predetermined and absent;
- no database with the same generation name exists;
- the control registry is absent, or exists only in an explicitly accepted empty bootstrap state;
- no unknown generation with the accepted prefix exists;
- no active pointer, seal, activation receipt or rollback receipt conflicts with the attempt;
- no database is deleted, renamed, repaired or overwritten.

Any collision or unknown state returns `target_collision` and performs no target mutation.

## Future execution sequence

```text
P00 package self-verification
P01 authorization validation
P02 authorization consumed
P03 source opened read-only and verified
P04 backup copied and verified
P05 target collision/empty-bootstrap gate
P06 isolated generation created
P07 deterministic import checkpoints
P08 generation closed/reopened
P09 portable plan and snapshot verified
P10 immutable generation sealed
P11 registry bootstrap/expected revision verified
P12 atomic pointer promotion
P13 C3 resolver readback verification
P14 sanitized evidence finalized
P15 completed
```

Promotion is a single registry transaction. Generation payload is never copied during promotion.

## Promotion and rollback

Before P12, failure must leave the active pointer unchanged. A partial or sealed inactive generation remains quarantined evidence and is not automatically deleted or activated.

After a committed P12 failure, the attempt enters `rollback_required`. The runner may generate a rollback plan but may not execute it automatically. A separate rollback authorization must bind:

- package/attempt identity;
- current registry revision;
- failed active generation;
- previous active pointer, including `null` for first activation;
- activation receipt;
- observed failure code and evidence hash.

Rollback changes only the registry pointer and appends a rollback receipt. It never mutates source, backup or generation payload.

## Runtime verification

P13 must use the accepted C3 resolver, not a private migration-only read path. Success requires the resolver to reopen the active generation through the registry and reproduce the accepted workspace/snapshot identity. Missing, corrupt, stale or replaced pointer state fails closed.

## Explicit user-confirmation point

Immediately before any future exact-source launch, present Артём with:

- package repository/commit/tree/archive SHA-256;
- source and expected backup identities;
- attempt ID and generation name;
- registry/bootstrap state;
- permitted operations;
- statement that authorization is one-shot and consumed before source open;
- statement that failure will not auto-resume/retry;
- statement that rollback is not authorized.

Execution starts only after an explicit confirmation referencing that exact package and attempt. Earlier project approvals do not satisfy this gate.

## Permanent prohibitions

- in-place source writes;
- B1b replay;
- fallback to legacy, previous, inactive or guessed generations;
- automatic repair, resume, retry, cleanup, promotion or rollback;
- model/network calls;
- raw thoughts, source bytes, local paths or personal data in diagnostics;
- treating package proof as proof of actual migration success.
