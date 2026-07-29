# Known gaps during Phase 2C-C0

B1b exact-source read-only dry run is accepted. It proved deterministic temporary-target behavior, not production migration or product semantics.

## Closed

- exact source identity, read-only/query-only integrity and byte stability;
- exact counts `96/30/0/133/96/3/0`;
- one unresolved and zero damaged references;
- deterministic exact-source portable-plan and target-snapshot equality;
- exact-source injected rollback and temporary-target cleanup;
- zero network/model calls and no actual migration;
- B1b merge `4fd14e515d2c4234f70effa475381f47bbb50e8b` and post-merge docs;
- C0 architectural choice: immutable generation plus atomic control-registry pointer;
- documented failure matrix and staged C1–C4 plan.

## Still open before C0 acceptance

- generic source package repository/commit provenance is inconsistent in public-mirror builds;
- ARTIFACT_REVISION and DRIVE_SYNC still describe the old B1a/B1b-blocked boundary;
- release gate still enforces obsolete B1a-only markers;
- final C0 private/public exact-tree equality after those fixes;
- final C0 CI and downloaded-artifact inspection;
- C0 merge provenance.

## Still open after C0

- C1 pure registry/generation contracts and attempt state machine;
- C2 native IndexedDB registry, seal, promotion, rollback and crash/reload proof;
- C3 packaged runtime resolver and blocked recovery states on sanitized fixtures;
- private immutable backup filesystem behavior;
- C4 exact-source one-shot migration package;
- actual target-Mac generation creation, activation and rollback;
- persisted production REQ-OBS-001;
- service-level exactly-once AI execution;
- semantic quality, multi-order stability and real-data safety.

## Prohibited boundary

Exact source reopening, another B1b attempt, backup/registry/generation creation, actual migration, model calls and real thoughts remain prohibited until their separate gates.