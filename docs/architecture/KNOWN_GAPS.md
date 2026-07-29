# Known gaps after Phase 2C-C0 acceptance

B1b exact-source read-only dry run and C0 architecture/release gate are accepted. They do not prove production migration or product semantics.

## Closed

- exact source identity, read-only/query-only integrity and byte stability;
- exact counts `96/30/0/133/96/3/0`;
- one unresolved and zero damaged references;
- deterministic exact-source portable-plan and target-snapshot equality;
- exact-source injected rollback and temporary-target cleanup;
- zero network/model calls and no actual migration during B1b;
- B1b merge `4fd14e515d2c4234f70effa475381f47bbb50e8b`;
- C0 immutable-generation plus atomic control-registry architecture;
- C0 migration/activation, failure/recovery and staged C1–C4 contracts;
- source and exporter checkout-provenance regressions;
- final private/public tree `a8523316e16273f633fac8caac95e96a5fec1080`;
- final current-head Linux/macOS/full/actual-Chrome/package gates;
- downloaded source/exporter/B1b/browser artifact inspection;
- C0 merge `31657e218cd5891e9e915f698febf8ac72942ed3`;
- corrected canonical Drive post-merge readback;
- removal of false unverified merge identity `69a9fc703a79f3aaa4bd44fc372f0cc8c9cb59f4` from current documents.

## Open in C1

- pure immutable registry/generation/authorization manifest types;
- closed attempt states and transition table;
- typed commands, events, stops and rejections;
- expected registry revision and previous-pointer guards;
- deterministic replay, canonical hashes and idempotency;
- explicit recovery states without automatic resume/retry;
- sanitized fixture coverage for every allowed/rejected transition;
- structural proof of zero browser/filesystem/network/model/exact-source dependencies.

## Still open after C1

- C2 native IndexedDB registry, seal, promotion, rollback and crash/reload proof;
- C3 packaged runtime resolver and blocked recovery states on sanitized fixtures;
- private immutable backup filesystem behavior;
- C4 exact-source one-shot migration package;
- actual target-Mac generation creation, activation and rollback;
- persisted production REQ-OBS-001;
- service-level exactly-once AI execution;
- semantic quality, multi-order stability and real-data safety.

## Prohibited boundary

Exact source reopening, another B1b attempt, backup/registry/generation creation, native persistence before C2, actual migration, model/network calls and real thoughts remain prohibited until their separate gates.
