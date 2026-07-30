# Phase 2C-C2 — acceptance candidate evidence

Date: 2026-07-30
Status: candidate; not accepted before final documentation tree and factual merge

## Candidate proof

```text
private head: 57472ea9b54f1f967b064ff305e187222a29ba30
public head:  b58bfbaa8c535c3bcfb73f135263906e9a2c7777
shared tree:  088cdf17babc38f559559aa794360f2b1a4a9344
verify run:   30455093681
package run:  30455093613
outer artifact: 50b3b75eb1d67d044dcf5e39ee545c68fba0ab91370df2ad74570cdd6066bcaf
browser proof:  c4bf10a309479f1a921a0c4445dc2e2437e404a7c04f91b403a9a394a5af6d37
```

## Critical scenarios

1. Generation seal persists and is immutable.
2. Attempt/event state survives close/reopen and replay matches aggregate.
3. Promotion changes pointer/attempt/receipt atomically.
4. Promotion abort leaves all registry state unchanged.
5. Explicit rollback restores previous pointer and does not mutate payload.
6. Rollback abort leaves all registry state unchanged.
7. Wrong active pointer and stale registry revision stop before mutation.
8. Identical operation is idempotent; changed fingerprint conflicts.
9. Pre-promotion interruption persists terminal blocked recovery without resume/retry.
10. Post-promotion interruption requires explicit rollback.
11. Actual Chrome renders REQ-OBS-001 and exposes sanitized diagnostics.
12. Exact source, backup, production namespace, actual migration, network/model calls and personal data remain absent.

## Proof limits

No packaged runtime resolver, exact-source C4, target-Mac production storage, private backup, actual migration, semantic quality or real-data readiness is claimed.
