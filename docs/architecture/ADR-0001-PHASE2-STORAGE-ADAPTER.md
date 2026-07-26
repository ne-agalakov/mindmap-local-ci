# ADR-0001 — Phase 2 browser storage adapter

Date: 2026-07-25

Status: proposed by Phase 2A; production implementation is blocked until this ADR and the storage contract are accepted.

Issue: #18, child of #16.

## Context

Phase 1A provides a pure deterministic state core. Phase 2 must persist its event batches and aggregate revisions atomically in a new namespace without touching the Alpha.19 sql.js/IndexedDB database.

The bounded choice is:

1. native IndexedDB behind a thin repository-owned adapter;
2. Dexie as an additional runtime dependency.

The current repository already uses `fake-indexeddb` for tests but does not depend on Dexie.

## Decision criteria

| Criterion | Native IndexedDB thin adapter | Dexie |
|---|---|---|
| Explicit atomic transaction boundary | Direct control over one transaction and exact object stores | Supported, but mediated by library transaction semantics |
| Serialized writer and revision guard | Implemented explicitly in repository code | Requires repository serialization and guards anyway |
| Deterministic error/retry policy | No automatic application retry unless explicitly written | Library behavior must be pinned and audited across upgrades |
| Versioned schema | Native `onupgradeneeded`; more verbose but fully explicit | More ergonomic version declarations |
| Testing with `fake-indexeddb` | Direct and already available | Supported, but adds another abstraction under test |
| Export/content-hash evidence | Repository owns canonical projection and hashing | Still requires repository-owned canonical projection |
| Bundle/runtime complexity | No new production dependency | Adds dependency and upgrade surface |
| Target-Mac offline reliability | Browser primitive only | Browser primitive plus package/runtime dependency |
| Migration source isolation | Easy to enforce by adapter API and fixed new namespace | Also possible |
| Implementation risk | More boilerplate; must test transaction completion/abort carefully | Less boilerplate; dependency semantics become part of release evidence |

## Decision

Use **native IndexedDB behind a thin, typed adapter** for the Phase 2 MVP.

Reasons:

- the most important requirement is explicit transaction and failure semantics, not query ergonomics;
- the data model is small and access patterns are known;
- one repository-owned serialized writer is required regardless of library choice;
- no new production dependency is needed;
- the exact stores, version changes, transaction completion, abort behavior and evidence projection remain visible in project code;
- `fake-indexeddb` is already available for fast integration tests.

## Required mitigation

Native IndexedDB is accepted only with the following tests before Phase 2B acceptance:

- transaction completion is awaited; request success alone is insufficient;
- abort after a successful request is treated as failure;
- event batch and aggregate revision commit in one transaction;
- stale expected revision rejects before write;
- one serialized writer defines command ordering;
- idempotent retry returns the original result; conflicting retry rejects;
- synthetic and personal workspace keys cannot cross;
- schema upgrade failure leaves the previous version usable;
- source migration reader has no write-capable handle to the legacy namespace;
- browser integration uses real IndexedDB semantics in packaged E2E, not only `fake-indexeddb`.

## Consequences

Positive:

- smaller production/runtime surface;
- exact control over safety-critical behavior;
- easier provenance and forbidden-dependency auditing.

Negative:

- more adapter code;
- cursor/index helpers must be implemented carefully;
- browser transaction lifetime rules require dedicated tests.

## Reconsideration trigger

Reconsider Dexie only if the native Phase 2B spike cannot meet the atomicity, testability or migration evidence requirements without substantial custom query/migration infrastructure. Convenience alone is not a trigger.

## Non-authorization

This ADR does not authorize target migration, legacy writes, UI integration, model execution, Candidate 6 or personal data.