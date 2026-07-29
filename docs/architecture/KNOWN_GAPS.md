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
- documented failure matrix and staged C1–C4 plan;
- artifact revision 10 and exact Google Drive revisions/readback synchronized;
- release documentation gate advanced from B1a-only state to accepted B1b / active C0;
- generic source package repository/commit provenance fixed and regression-tested;
- compact exporter repository/commit provenance fixed and regression-tested.

## Still open before C0 acceptance

- final private/public exact Git-tree equality after all provenance fixes;
- final Linux/macOS/full/actual-Chrome/package gates on that exact tree;
- downloaded source/exporter/B1b artifact inspection on the final tree;
- final acceptance documentation with exact heads, tree, runs and hashes;
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