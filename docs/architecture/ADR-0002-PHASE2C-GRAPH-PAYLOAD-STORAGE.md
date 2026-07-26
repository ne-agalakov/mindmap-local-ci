# ADR-0002 — canonical MindMap graph and payload storage

Date: 2026-07-25

Status: implemented in Phase 2C-A code head `02df8758a7c42b33b22b397dae74445cd6a5f7ac`; focused actual-macOS-Chrome IndexedDB proof passed. Acceptance still requires green full CI, downloaded-artifact verification, Drive synchronization, merge and exact provenance.

## Context

The accepted Phase 2B adapter persists run aggregates, events and artifact metadata. Exact-source preflight proved that it cannot represent the actual MindMap data: thought text, embeddings, hierarchy nodes, primary placement, unresolved state, links or damaged references. A run-history-only import would lose the personal knowledge graph and cannot be called migration.

## Decision

Add a separate event-sourced graph aggregate under namespace `mindmap-graph-v1`, stored transactionally alongside but not inside the run aggregate.

The graph aggregate contains:

- content-addressed payloads;
- thought records;
- typed area/direction/project nodes;
- exactly one current placement or unresolved record per thought;
- proposed/confirmed/rejected graph links;
- embeddings bound to exact thought-text content hash, model and dimensions;
- damaged references separate from unresolved;
- deterministic workspace revision and snapshot hash.

Phase 2C-A freezes the pure contract first and then implements a separate native IndexedDB graph adapter. A fresh unified database contains both accepted run stores and graph stores. An existing run-only database is refused rather than silently upgraded; any future upgrade path requires a separate explicit migration decision and tests.

## Invariants

- root nodes are areas only;
- direction parent is area; project parent is direction;
- thought placement parent is direction or project;
- every thought has exactly one placement or unresolved record;
- no hierarchy cycles or duplicate typed paths;
- content-addressed payload hash matches content;
- embedding bytes equal `dimensions × 4` and bind to current thought text;
- synthetic and personal workspaces are mechanically isolated;
- proposed links are never silently confirmed;
- graph mutations are event-sequenced and atomic;
- stale revision, identity conflict, payload conflict and invalid references reject before mutation;
- replay and snapshot hash are deterministic;
- abort before commit leaves no partial graph, payload or receipt.

## Verification status

The focused target-Mac proof used real Chrome IndexedDB and passed atomic commit, reopen, idempotency, workspace isolation, run-adapter compatibility, abort rollback, run-only refusal, schema metadata, corruption refusal and link lifecycle assertions.

Exact evidence and proof limits are recorded in `PHASE2CA_VERIFICATION.md` and `../evidence/phase2ca-macos-indexeddb-proof.json`.

GitHub Actions currently fail before their first step and provide no logs or artifacts. This is an unresolved infrastructure blocker. It is neither a green gate nor evidence of a test failure.

## Consequences

- Phase 2C-B exact-source dry run remains blocked until Phase 2C-A is accepted and merged with exact provenance;
- private source payloads remain outside Git;
- existing run-only databases are not silently upgraded;
- actual target-Mac migration remains a later explicit gate;
- runtime/UI, model execution and semantic quality are outside this ADR.
