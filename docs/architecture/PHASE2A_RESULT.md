# Phase 2A result — storage decision and transactional contract

Date: 2026-07-25

Status: accepted and merged. Phase 2B Issue #19 is the next allowed boundary.

Issues: #16 and #18. Pull request: #31.

## Objective

Freeze the persistence contract before implementing a browser database adapter. Phase 2A proves transaction semantics without touching IndexedDB, the Alpha.19 source, React, the runtime or any model.

## Adapter decision

ADR-0001 selects native IndexedDB behind a thin typed adapter for Phase 2B. The decision is based on explicit transaction control, no new production dependency, existing `fake-indexeddb` test support, transparent version/abort behavior and easier provenance auditing. Dexie remains a reconsideration option only if the native implementation cannot meet the required invariants without substantial custom infrastructure.

## Accepted contract

`storage/contracts.ts` defines:

- fixed target namespace `mindmap-state-core-v1`;
- run, event and artifact records scoped by workspace and run;
- atomic commit request for event batch + aggregate + optional artifacts;
- typed commit receipt and rejection codes;
- transactional storage port;
- canonical content hasher boundary;
- read-only migration source, run plan and typed stop contracts.

`storage/canonical-json.ts` provides deterministic JSON serialization with sorted object keys, preserved array order, omitted `undefined`, normalized negative zero and rejection of non-finite/non-JSON values.

`storage/in-memory-reference-storage.ts` is a reference model, not the production adapter. It proves:

- one serialized writer;
- atomic validation before mutation;
- exact contiguous event sequence;
- stale expected-revision rejection;
- deterministic replay equality between event batch and supplied aggregate;
- immutable identity and workspace isolation;
- append-only event and artifact records;
- idempotent retry and conflicting-key rejection;
- simulated failure before commit leaves no partial state;
- deterministic snapshot/content-hash projection.

`storage/migration-plan.ts` binds planning to the accepted Phase 0 database hash and size. It rejects hash/size mismatch, personal data, wrong workspace/schema, duplicate runs, ambiguity, invalid references and non-empty targets. Planning performs no source or target write and allows no network/model call.

## Parallel spike reconciliation

Before merge, draft PR #17 was discovered. It predates ADR-0001 and contains a native IndexedDB spike with a different storage API.

- head: `821d4b9874cb1ad5f080db343ecf65173ec4750c`;
- macOS checks passed, but Linux and package workflows failed;
- it was never documentation/artifact accepted;
- merging it would create two competing storage contracts.

PR #17 is closed unmerged. Its branch remains research evidence only. Phase 2B must start from accepted `main` and selectively port or rewrite useful native IndexedDB behavior against the accepted `storage/contracts.ts` API. All transaction, abort, schema, replay, artifact/hash and browser gates must be rerun.

## Test coverage

`tests/storage-contract-phase2a.test.mjs` covers:

- deterministic canonical serialization;
- create transaction;
- atomic multi-event append and aggregate revision;
- idempotent retry and conflicting retry;
- concurrent stale writers serialized in arrival order;
- rollback on simulated crash before commit;
- synthetic/personal workspace isolation;
- deterministic export snapshot;
- exact accepted-source migration plan and typed stops;
- forbidden browser/UI/network/model/legacy-write dependency scan.

Focused command:

```bash
npm run test:storage-contract
```

## Acceptance evidence

Code head:

```text
5cac8f96b777e173e1335cb690b29ead1e53190a
```

Final reviewed head:

```text
18335b2d9a259b5e0c8e5188001efdc530dd2d20
```

PR #31 was squash-merged as:

```text
aa5eaaae08a3da4d0ff00ea03aea12b793137a21
```

Final proof:

- Linux full: passed;
- macOS targeted: passed;
- source and compact-exporter packaging: passed;
- GitHub Actions artifact SHA-256: `f47bcb22af64094838c6ab0ed69dd7e1ee75cf5b6882f46d44c32e38c80e8fbb`;
- inner source ZIP SHA-256: `822dbc1f6376b3b38e8ec1a5bbea4deb86ff165ec73dbece8b2670c836b0044e`;
- inner exporter ZIP SHA-256: `86eb8073b8a2a87a25c5e7dbe16609e4d1290b5d14badf3fa5307c52976dcae2`;
- portable checksums, embedded commit, required files, privacy, secret and forbidden-dependency scans passed;
- changes after the code head were documentation/provenance/release-gate only;
- Google Drive was updated after merge and reverse-read.

No database write, migration, network, Ollama, Qwen or DeepSeek call occurred.

## Preserved boundaries

Phase 2A does not:

- implement production native IndexedDB or Dexie;
- open or modify the Alpha.19 database;
- execute an actual migration;
- modify `app/page.tsx` or runtime/model routes;
- persist personal data;
- prove browser transaction lifetime, schema upgrades or packaged runtime behavior;
- prove REQ-OBS-001, model exactly-once execution or semantic quality.

## Next gate

Phase 2B (#19) may implement the selected native IndexedDB adapter in a separate branch/PR from accepted `main`, using `fake-indexeddb` plus browser integration tests. Actual target migration remains blocked behind a later separate gate.
