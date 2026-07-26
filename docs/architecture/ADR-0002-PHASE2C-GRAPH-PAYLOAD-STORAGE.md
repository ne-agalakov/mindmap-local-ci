# ADR-0002 — canonical MindMap graph and payload storage

Date: 2026-07-25  
Updated: 2026-07-26

Status: implemented in Phase 2C-A. Target-Mac proof, public-mirror full CI, downloaded-artifact inspection and Drive readback passed. Acceptance is pending PR #38 merge and exact merge provenance.

## Context

The accepted Phase 2B adapter persists run aggregates, events and artifact metadata. It cannot represent the actual MindMap graph: thought text, embeddings, typed hierarchy, primary placement, unresolved state, links or damaged references. A run-history-only import would lose the knowledge graph and cannot be called migration.

## Decision

Add a separate event-sourced graph aggregate under namespace `mindmap-graph-v1`, stored transactionally alongside but not inside the run aggregate.

It contains:

- content-addressed payloads;
- thought records;
- typed area/direction/project nodes;
- exactly one placement or unresolved record per thought;
- proposed/confirmed/rejected graph links;
- embeddings bound to exact thought-text hash, model and dimensions;
- damaged references separate from unresolved;
- deterministic workspace revision and canonical snapshot hash.

A fresh unified database contains accepted run stores and graph stores. An existing run-only database is refused rather than silently upgraded. Any upgrade/import path requires a separate explicit migration decision and tests.

## Invariants

- roots are areas only;
- direction parent is area; project parent is direction;
- thought placement parent is direction or project;
- every thought has exactly one placement or unresolved record;
- no cycles or duplicate typed paths;
- payload hash matches content;
- embedding bytes equal `dimensions × 4` and bind to current thought text;
- synthetic/personal workspaces are mechanically isolated;
- proposed links are never silently confirmed;
- graph mutations are event-sequenced and atomic;
- stale revision, identity conflict, payload conflict and invalid references reject before mutation;
- replay and snapshot hash are deterministic for the same canonical state;
- abort before commit leaves no partial graph, payload or receipt.

## Verification

Code head: `02df8758a7c42b33b22b397dae74445cd6a5f7ac`.

Target-Mac real Chrome passed atomic commit, reopen, idempotency, workspace isolation, run-adapter coexistence, abort rollback, run-only refusal, schema metadata, corruption refusal and link lifecycle.

The public history-free mirror of private head `85b158ebed11f494fe7e4766453693de01d75bfe` passed Linux full, lint, complete tests, macOS launchers, actual Chrome run/graph harnesses and packaging in runs `30196934408` and `30196934411`. Downloaded artifacts passed inventory, checksum, privacy and credential inspection.

Google Drive canonical documents were updated and reverse-read.

The offline and GitHub harnesses use different deterministic fixtures. Their absolute snapshot hashes therefore do not represent the same state. Each proves reopen equality; same-fixture cross-environment equality remains uncovered.

## Consequences

- Phase 2C-B remains blocked until PR #38 is merged and merge provenance is recorded;
- private source payloads remain outside Git;
- run-only databases are not silently upgraded;
- actual target-Mac migration remains a later explicit user-confirmed gate;
- runtime/UI, REQ-OBS-001 rendering, model execution and semantic quality are outside this ADR.
