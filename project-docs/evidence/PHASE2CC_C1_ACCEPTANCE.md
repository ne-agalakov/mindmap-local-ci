# Phase 2C-C1 — acceptance candidate evidence

Date: 2026-07-29
Status: candidate; not accepted before final documentation tree and factual merge

## Candidate identity

```text
private head: ac639e625b6d0ced665c748c2c58f6b3753c4ffc
public head:  0eeb9fea5792b7fbf33db0061abc2f271db3b17f
shared tree:  2a536a54779634647eff8ebf2476840c257b2813
verify run:   30442139981
package run:  30442139989
```

## Proven on sanitized fixtures

1. Manifest binds artifact, source, backup, registry, generation and detached authorization identities.
2. Attempt state is a closed union with monotonic append-only event history.
3. Commands use expected revision, deterministic fingerprint and idempotency receipts.
4. Authorization is consumed once; retry/resume is never automatic.
5. Promotion requires exact registry revision and previous pointer and produces only a pointer plan.
6. Rollback is explicit and restores the prior pointer without payload mutation.
7. Pre-promotion interruption becomes terminal blocked recovery.
8. Post-promotion failure requires rollback.
9. Replay/state/evidence hashes are deterministic for identical injected inputs.
10. Sanitized evidence contains no raw thought text, source bytes, local path or model payload.
11. Structural test excludes browser, IndexedDB, filesystem, network, model service, exact-source, wall-clock and randomness paths.

## Initial CI and artifacts

All 9 C1 tests passed in the public exact tree. Full Linux/macOS/Chrome/package regression passed. Downloaded hashes:

```text
outer:   48919301a47dd46a93c1daaef89813bada64884d695c830b7d8cd8b54c560fae
browser: fd77e95f0f9ee15a9e6226018fee2b6b53980d295931b6d27007a1c56ca12167
source:  76a769a14310347ba144b7ac71ab05f682384889ce24ca2f9623817333f6bd5a2
exporter:e54b4ab03944d7aca63b310b9595963d9a8b28e1c8ac0618d087b47601d1c723
B1b:     346381787d9174a231aa8507f80d567932464ee6a25a0c77f0726932e0412013
```

## Proof limits

C1 does not prove native IndexedDB persistence, cross-database crash behavior, packaged runtime resolution, filesystem backup, exact-source migration or semantic quality. It performed no actual migration or production write.

## Acceptance condition

This document is not an acceptance claim. Acceptance requires a final exact documentation tree, rerun CI/artifact inspection, expected-head merge of PR #52 and factual post-merge provenance.
