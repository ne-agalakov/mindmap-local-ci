# Known gaps after Phase 2C-C2 acceptance

## Closed in C2

- native IndexedDB registry and immutable generation seal;
- deterministic persisted attempt/event replay;
- atomic promotion and explicit rollback;
- revision/pointer/identity/hash/receipt/idempotency guards;
- promotion and rollback abort with no partial mutation;
- deterministic close/reopen;
- persisted recovery states without automatic resume/retry;
- actual Chrome REQ-OBS-001 and sanitized diagnostics;
- exact-tree, downloaded-artifact and factual merge gates.

## Open in C3

- packaged runtime resolver reads only the active pointer;
- complete registry/pointer/generation/seal/schema/workspace/hash verification;
- fail-closed handling for missing, corrupt, stale and mismatched state;
- no legacy/inactive fallback or hidden migration/repair;
- packaged cold start, reload and actual-Chrome REQ-OBS proof.

## Still prohibited or unproved

- private backup filesystem behavior;
- C4 exact-source one-shot package;
- target-Mac production storage and actual migration/activation/rollback;
- production REQ-OBS-001;
- semantic quality, multi-order stability and real-data safety.
