# Work boundary after Phase 2C-C0 acceptance

Accepted C0 merge: `31657e218cd5891e9e915f698febf8ac72942ed3`.

B1b exact-source read-only dry run remains accepted and consumed. It must not be repeated.

## Allowed now

Only C1 pure registry/generation contracts and attempt state machine on sanitized fixtures:

1. immutable manifest, authorization, registry and generation identities;
2. closed attempt states and deterministic transitions;
3. typed commands, events, stops and rejections;
4. expected revision and previous-pointer guards;
5. deterministic replay, canonical hashes and idempotency;
6. explicit recovery states without resume/retry;
7. sanitized fixtures and pure TypeScript tests;
8. documentation, exact-tree CI and downloaded-artifact review for C1.

C1 may not depend on IndexedDB, browser APIs, filesystem, exact SQLite, backup files, network, models, wall clock or randomness.

## Still prohibited

- reopening the exact private SQLite source;
- repeating B1b;
- creating the real backup, control registry or production generation;
- native IndexedDB registry/promotion work before C2;
- actual migration, activation or rollback on the target Mac;
- automatic retry after failure/reload/version change;
- Candidate 5/6, Qwen, DeepSeek or any model call;
- legacy source write/repair/delete;
- exact-data runtime integration;
- real thought import;
- claims of semantic success or product readiness.

## Next boundaries

C2 contains native IndexedDB registry, promotion, rollback and crash/reload proof. C3 contains packaged runtime resolver integration on sanitized fixtures. C4 contains a new exact-source one-shot package and requires a new explicit user confirmation immediately before launch.
