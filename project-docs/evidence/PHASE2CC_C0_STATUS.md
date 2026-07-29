# Phase 2C-C0 — current status

Date: 2026-07-29
Status: design implemented in documentation; review and exact-tree gate pending
Issue: #48
Branch: `phase2cc/c0-actual-migration-design`

## Completed in this branch

- ADR-0002 selects immutable generation databases and a separate atomic activation registry.
- The production migration/activation contract defines source, backup, generation, registry, sealing, promotion, resolver verification, rollback, evidence and one-shot authorization invariants.
- The failure matrix defines typed stops and recovery for authorization, source, backup, registry, generation, import, verification, sealing, promotion, resolver, rollback, observability and evidence failures.
- The implementation plan corrects the phase order: sanitized runtime resolver integration must pass before exact-source actual migration.

## Architecture decision

Actual migration will not write into a fixed mutable production database. It will create and verify an immutable generation, then atomically change a control-registry pointer. The runtime must resolve that pointer and block on incomplete or invalid migration state.

```text
control registry:  mindmap-state-core-control-v1
generation prefix: mindmap-state-core-v1-generation-
```

## Current boundary

During C0:

- exact SQLite opened: false;
- B1b repeated: false;
- backup created: false;
- IndexedDB registry/generation created: false;
- actual migration/promotion: false;
- network/model calls: 0;
- personal data used: false.

## Next verified step

Review C0 documents for internal consistency, mirror the exact tree to the public CI repository, run full Linux/macOS/actual-Chrome/package gates, inspect the downloaded artifact, update and reverse-read Google Drive, then merge the C0 documentation PR.

After C0 acceptance, the next separately scoped phase is C1: pure registry/generation contracts and state machine on sanitized fixtures only. Exact-source reopening and actual migration remain prohibited.