# ADR-0002 — immutable generations and atomic activation registry

Date: 2026-07-29
Status: proposed for Phase 2C-C0
Issue: #48

## Context

Phase 2C-B1b proved that the accepted legacy SQLite can be read without mutation and deterministically mapped into fresh temporary native IndexedDB targets. It did not prove or authorize a working production migration.

IndexedDB has no atomic database rename. Writing directly into a fixed production database would create a partial-visibility and recovery problem: a crash can leave an incomplete database under the same name that the runtime expects to open.

The accepted source remains immutable:

```text
size:   5,070,848 bytes
sha256: 356b943275cce292d0e14f8a7fbe95af07e79de73f06d3e361874d342aa2f918
workspace: synthetic
personal thoughts: 0
```

The accepted deterministic target projection is:

```text
portable plan hash:   d8a1289c6f1865db940f65e46aec569400b630aec3cc53bdfd897f223d2436a8
target snapshot hash: 6319ee79284b0ca1afc5fe93d53ef37b4a9c5f85c0c9634976afa1a4979f5689
```

## Decision

MindMap will not migrate in place and will not use a mutable fixed production database as the migration target.

Each successful migration creates an immutable generation database. A separate control registry atomically selects the active generation.

### Namespaces

```text
control registry:  mindmap-state-core-control-v1
generation prefix: mindmap-state-core-v1-generation-
legacy source:     mindmap-local-semantic-v060
B1b temporary:     mindmap-state-core-v1-phase2cb-...
```

The control registry and generation prefixes must be validated before `indexedDB.open`. Legacy and B1b temporary names are never valid production-generation names.

### Generation database

A generation database contains the accepted unified run and graph stores plus immutable generation metadata:

- generation ID and database name;
- migration attempt ID;
- exact source size and SHA-256;
- package repository, commit, tree and archive SHA-256;
- storage schema and mapping version;
- portable plan hash and target snapshot hash;
- exact counts and workspace identity;
- sealed state and seal timestamp;
- zero-network and zero-model counters.

A generation is written only while unsealed. After verification, it is sealed and never modified by the migration package.

### Control registry

The control registry contains no thought text, node labels, source bytes, embeddings or model payloads. It stores only control metadata.

Required records:

1. `activePointers` — one active generation pointer per workspace.
2. `migrationAttempts` — append-only attempt state and immutable identity.
3. `authorizations` — one-shot authorization receipt and consumed state.
4. `activationReceipts` — previous and next generation identities, registry revision and activation result.

The active pointer record includes:

- workspace;
- generation ID and database name;
- target snapshot hash;
- source SHA-256;
- migration attempt ID;
- activation epoch and registry revision;
- previous generation ID, if any;
- state `active`.

### Atomic promotion

Promotion is one read-write transaction in the control registry. The transaction must:

1. verify the expected registry revision;
2. verify that the attempt is sealed and promotion-ready;
3. verify that the one-shot authorization is consumed by this exact attempt;
4. preserve the previous active pointer in the activation receipt;
5. write the new active pointer and activation receipt atomically.

The generation database is fully imported, reopened, verified and sealed before this transaction. No runtime may observe an unsealed generation as active.

### Runtime prerequisite

The runtime must resolve the active generation through the control registry. Therefore sanitized runtime resolver integration and its blocked recovery states must be proven before any real actual-migration execution.

This changes the safe sequence from “migrate, then connect runtime” to:

```text
C0 architecture and failure matrix
C1 registry/generation contracts on sanitized fixtures
C2 native IndexedDB registry, crash/reload and promotion tests
C3 runtime resolver integration on sanitized fixtures
C4 exact-source one-shot package and explicit authorization
actual migration and activation
```

### Backup

Before any generation write, the package creates a local immutable backup copy of the exact SQLite using exclusive creation. It then verifies size, SHA-256 and SQLite integrity independently.

The backup is never uploaded or included in sanitized evidence. A pre-existing backup path is accepted only when its bytes and identity match exactly; it is never overwritten.

Existing active generations are retained. Rollback changes the registry pointer; it does not reconstruct or mutate the previous database.

### Recovery

No stage automatically retries or resumes a write.

- Before promotion: an incomplete generation remains inactive and is either retained for diagnostics or deleted only by a separately confirmed cleanup action.
- During registry transaction: IndexedDB transaction abort leaves the old active pointer unchanged.
- After promotion: if resolver verification fails, a separate rollback transaction restores the prior pointer and records a rollback receipt.
- On reload with a non-terminal attempt: runtime shows a blocked recovery state and sanitized diagnostics. It does not continue migration.

No previous generation, legacy source or backup is deleted by the migration package.

### Authorization

Actual execution requires a detached one-shot authorization bound to:

- repository;
- commit;
- Git tree;
- package archive SHA-256;
- source size and SHA-256;
- generation database name;
- expected portable plan and target snapshot hashes;
- migration attempt ID.

The authorization is persisted as consumed before source opening. Any failure, termination, reload or version change requires a new explicit user decision after offline root-cause analysis.

### Observability

REQ-OBS-001 applies to authorization freeze, backup, source verification, target creation, import, verification, sealing, promotion, resolver verification, rollback and cleanup.

Every stage reports work type, elapsed time, processed/total, last progress, heartbeat, state, `без AI`, inactivity warning and diagnostics download. No ETA is fabricated.

## Rejected alternatives

### Fixed production database with in-place writes

Rejected because partial data can become visible under the runtime's expected name and rollback cannot be reduced to a pointer transaction.

### Copy verified staging data into a second production database

Rejected because the second copy is another long write requiring its own complete transactional and crash proof. The verified generation itself should become active.

### Database deletion and rename emulation

Rejected because IndexedDB offers neither atomic rename nor safe cross-database transaction semantics.

### Automatic fallback to the previous generation

Rejected as a hidden state change. A resolver failure must be explicit and diagnosable; rollback is a recorded operation.

### Deleting legacy or previous generations after success

Rejected from the migration gate. Retention and garbage collection require a later independent policy and confirmation.

## Consequences

- A small control registry and runtime resolver are required.
- Multiple immutable generations may remain on disk.
- Promotion becomes an atomic metadata operation rather than a data-copy operation.
- Rollback can restore the previous active pointer without mutating data.
- Actual migration is blocked until sanitized registry, recovery and runtime resolver scenarios are proven.
- This ADR authorizes design and sanitized implementation only. It does not authorize exact-source reopening, a production generation or actual migration.