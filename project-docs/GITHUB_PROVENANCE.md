# GitHub provenance and source-artifact verification

## Technical source of truth

Technical identity is `repository + commit SHA + Git tree`. A label, local directory or green workflow alone is not evidence.

Primary: `ne-agalakov/mindmap-local`. Public history-free CI mirror: `ne-agalakov/mindmap-local-ci`.

## Mandatory artifact invariant

Before merge/handoff, the exact artifact is downloaded and checked outside the runner:

- portable checksum manifests;
- repository/commit/tree match the actual checkout;
- required inventory and executable modes;
- no exact databases/evidence, `.env`, credentials, caches, generated dependencies or personal payloads;
- failure blocks merge and requires a regression.

## Accepted foundations

B1b merge `4fd14e515d2c4234f70effa475381f47bbb50e8b`; C0 merge `31657e218cd5891e9e915f698febf8ac72942ed3`; C0 post-merge docs `091d2e6cac82455f504299d9c81ab78ee8f193fd`.

## Phase 2C-C1 implementation proof

```text
private PR:   #52
public PR:    #14
private head: ac639e625b6d0ced665c748c2c58f6b3753c4ffc
public head:  0eeb9fea5792b7fbf33db0061abc2f271db3b17f
shared tree:  2a536a54779634647eff8ebf2476840c257b2813
verify:       30442139981
package:      30442139989
```

Public exact-tree Linux/macOS/full/actual-Chrome/package gates passed. Private Actions failed before steps because private runner capacity/minutes were unavailable; this is infrastructure evidence, not a test failure.

Downloaded artifact review:

```text
outer artifact: 48919301a47dd46a93c1daaef89813bada64884d695c830b7d8cd8b54c560fae
browser proof:  fd77e95f0f9ee15a9e6226018fee2b6b53980d295931b6d27007a1c56ca12167
source ZIP:     76a769a14310347ba144b7ac71ab05f682384889ce24ca2f9623817333f6bd5a2
exporter ZIP:   e54b4ab03944d7aca63b310b9595963d9a8b28e1c8ac0618d087b47601d1c723
B1b ZIP:        346381787d9174a231aa8507f80d567932464ee6a25a0c77f0726932e0412013
```

Portable checksums passed. Source/exporter/B1b metadata identify the public checkout; B1b records tree `2a536a54779634647eff8ebf2476840c257b2813`. Launchers are executable. No SQLite/database bytes, exact evidence, secrets, generated dependencies or personal payloads were found. Browser proof remained sanitized with exact source opened false, actual migration false, network/model calls 0 and no automatic retry.

C1 tests passed 9/9 and structurally exclude browser, IndexedDB, filesystem, network, model, exact-source, clock and randomness dependencies.

## Drive reverse-read for final C1 candidate

- instruction revision `AIroW34tzLmd8HTP9DN3NKmMSV7HCSbwHUe5cJGk4IWBFlh2so6uYEVZgV1_wjpy-txngVwmDthuCPru5ji_sC01ETSxjj_-ar4Y1nC6Psc`, marker `PHASE2CC-C1-FINAL-GATE-PENDING-AC639E62`;
- status revision `AIroW36QEfxjBIgX4eBpJDs417UedU1tntDvR1xAYGfNV7gineBxkpqBaGcxUshjJVDgReUTZ8zJID5UtoKSFv6XAKlGIg1iEBtFuSXQX6A`, marker `PHASE2CC-C1-IMPLEMENTATION-VERIFIED-AC639E62`;
- recovery revision `AIroW3622GpJz2bexdL7ckeGOfb_y23IwvozDlSrHcFSSvG9TAiau8_3pEEMy1Pb0bUq7orYWGtPfFXUYBKbr6TX6XNgApvxoY-qLsVDNO0`, marker `PHASE2CC-C1-NO-EXECUTION-AC639E62`.

## Current boundary

C1 is implemented and initially verified, but not accepted until this documentation tree receives a new exact-tree CI/artifact gate and PR #52 is factually merged. No merge SHA is predicted.

C2–C4, exact-source access, backup/registry/generation creation, actual migration, model/network calls and personal data remain prohibited.
