# MindMap Local v0.6-alpha.19

MindMap is a local-first personal AI system for turning thoughts into understanding, decisions, actions, results and durable memory.

## Current status

Alpha.19 remains a frozen legacy research runtime. Real personal thoughts must not be loaded.

Accepted foundations include Phase 0, Phase 1A, Phase 2A, Phase 2B, Phase 2C-A, Phase 2C-B0, B1a, the consumed B1b read-only dry run, C0, C1 and C2.

## Phase 2C-B1b — accepted and consumed

The single exact-source B1b read-only attempt passed and is permanently consumed. The source stayed byte-identical; actual migration was false. B1b must not be repeated.

## Phase 2C-C2 — accepted

C2 was accepted by factual squash merge:

```text
private head: f3986e2905d34bbd56c8ccd3686c8e5cfab44e45
public head:  f7b43c7ddec69be304d15aaa0bdd0eb714081085
shared tree:  e6d0c0793ca6f5d20352d79e03fd12ca70f961bc
verify:       30517144927
package:      30517144960
merge:        2ce6230f537baf71715ca9e2dccf23a5e4f9e0b1
```

Accepted C2 scope:

- isolated native IndexedDB generation registry and immutable seal;
- deterministic persisted attempt/event replay;
- atomic active-pointer promotion and explicit rollback;
- revision, pointer, identity, hash, receipt and idempotency guards;
- promotion and rollback abort without partial mutation;
- deterministic close/reopen and persisted recovery states;
- actual Chrome IndexedDB, REQ-OBS-001 and sanitized diagnostics.

Downloaded final control artifacts passed checksums, reconstructed-tree provenance, inventory, launcher-mode and privacy review.

## Phase 2C-C3 — implementation verified, acceptance pending

Exact implementation candidate:

```text
private head: 3f2325684ff617132307d4d9180326cb190e7a02
public head:  1513d26c09b096e2d80252a0b819a5da7af29fa9
shared tree:  56e846d49a17f15bbbd1eedfc626f316e3a29a91
verify:       30535292820
package:      30535292824
```

The packaged runtime resolves the active immutable generation only through the C2 control registry. It validates registry/revision/pointer/attestation/generation/schema/workspace/seal/snapshot identities, re-reads the registry to reject stale pointer replacement, and fails closed without fallback or mutation.

Focused tests and actual Chrome cover missing, malformed, corrupt, mismatched, stale and interrupted states, deterministic reload, REQ-OBS-001, possible-hang reporting and downloadable sanitized diagnostics.

The first CI candidate failed before resolver execution because Node strip-types rejected a TypeScript parameter property. The root cause was corrected with an explicit field and a regression guard; the failed workflow was not blindly rerun.

C3 is not accepted until final documentation-tree CI, downloaded-artifact inspection and factual expected-head merge of PR #57.

## Preserved boundary

C4 and actual migration remain prohibited. No action is required on the Mac.
