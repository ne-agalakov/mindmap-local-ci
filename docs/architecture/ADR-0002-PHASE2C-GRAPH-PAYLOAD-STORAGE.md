# ADR-0002 — canonical MindMap graph and payload storage

Date: 2026-07-25  
Accepted: 2026-07-26

Status: accepted as Phase 2C-A merge `292634312ad04fa6e6cfc5a5ded311ac1020094d`.

## Context

The accepted Phase 2B adapter persists run aggregates, events and artifact metadata. It cannot represent thought text, embeddings, typed hierarchy, placement, unresolved state, links or damaged references. A run-history-only import would lose the knowledge graph.

## Decision

Use a separate event-sourced graph aggregate under namespace `mindmap-graph-v1`, stored transactionally alongside the run aggregate.

It contains:

- content-addressed payloads;
- thought records;
- typed area/direction/project nodes;
- exactly one placement or unresolved record per thought;
- proposed/confirmed/rejected links;
- embeddings bound to exact text hash, model and dimensions;
- damaged references separate from unresolved;
- deterministic revision and canonical snapshot hash.

A fresh unified database contains accepted run and graph stores. A run-only database is refused rather than silently upgraded.

## Invariants

- roots are areas only;
- direction parent is area; project parent is direction;
- thought placement parent is direction or project;
- every thought has one placement or unresolved record;
- no cycles or duplicate typed paths;
- payload hash matches content;
- embedding bytes equal `dimensions × 4` and bind to current text;
- synthetic/personal workspaces are isolated;
- proposed links are never silently confirmed;
- graph mutations are event-sequenced and atomic;
- stale revision, identity/payload conflict and invalid references reject before mutation;
- replay/hash are deterministic for the same canonical state;
- abort leaves no partial graph, payload or receipt.

## Acceptance evidence

```text
reviewed head: 29a317b58cbecaea13e4f21c02af2b945a6e6edc
merge:         292634312ad04fa6e6cfc5a5ded311ac1020094d
public head:   ee5401a4a2ca7763467562417b9c5c4aece01214
shared tree:   e81ae1b309a806f0078b5a8a2057f51d4c0e403d
```

Target-Mac real Chrome, public Linux/macOS/full/browser CI, packaging, external artifact inspection and Drive readback passed. Final runs: `30198811851` and `30198811852`.

Same-fixture cross-environment equality remains uncovered because local and GitHub proofs used different fixed fixtures.

## Consequences

- Phase 2C-B may be planned and implemented as a separate isolated dry-run gate;
- private source payloads remain outside Git;
- run-only databases are not silently upgraded;
- actual target-Mac migration requires a later explicit user-confirmed gate;
- runtime/UI, REQ-OBS-001, model execution and semantic quality remain outside this ADR.
