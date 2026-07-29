# Known gaps during Phase 2C-C1 final gate

## Closed in C1 implementation

- pure immutable manifest/authorization/registry/generation types;
- closed attempt transitions and typed commands/events/stops/rejections;
- deterministic replay, canonical hashes and idempotency;
- registry revision and previous-pointer guards;
- pure promotion/rollback plans;
- explicit recovery states without automatic resume/retry;
- sanitized evidence and prohibited-dependency proof.

## Still open

- final C1 documentation-tree acceptance and factual merge;
- C2 native IndexedDB registry/seal/promotion/rollback/crash/reload proof;
- C3 packaged runtime resolver;
- private backup filesystem behavior;
- C4 exact-source one-shot migration package;
- actual target-Mac migration/activation/rollback;
- persisted production REQ-OBS-001;
- semantic quality, multi-order stability and real-data safety.

Exact source, native persistence, actual migration, model/network calls and personal data remain prohibited.
