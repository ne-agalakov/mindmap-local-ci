# ADR-0019 — C2 native IndexedDB uses isolated physical fixture namespaces

Date: 2026-07-30.

## Decision

Implement the accepted C1 registry/recovery contract in native IndexedDB only under physical names prefixed `mindmap-state-core-v1-phase2cc-c2-fixture-`. Logical production registry/generation identities remain data inside sanitized metadata; production and legacy physical names are rejected before `indexedDB.open`.

Promotion and rollback each use one registry transaction and wait for transaction completion. Generation seal is stored separately and becomes immutable. Persisted attempts/events must replay deterministically. Equality in browser proof uses canonical JSON rather than insertion-order `JSON.stringify`. Any interruption persists `blocked_recovery` or `rollback_required`; automatic resume/retry is prohibited.

## Evidence and boundary

Candidate identity: private `57472ea9b54f1f967b064ff305e187222a29ba30`, public `b58bfbaa8c535c3bcfb73f135263906e9a2c7777`, tree `088cdf17babc38f559559aa794360f2b1a4a9344`.

C2 is not accepted until Drive/repository docs, final exact-tree CI, downloaded-artifact inspection and factual merge are complete. C3/C4, exact-source reopening, backup access, production namespace and actual migration remain blocked.
