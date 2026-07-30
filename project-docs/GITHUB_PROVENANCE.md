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

B1b merge `4fd14e515d2c4234f70effa475381f47bbb50e8b`; C0 merge `31657e218cd5891e9e915f698febf8ac72942ed3`; C1 merge `f8ac03fbb24493dbeac7385687b3f4a93eb10bf8`.

## Phase 2C-C1 accepted provenance

```text
private PR:   #52
public PR:    #14
private head: 6fe3b07c5a2cb0ba8a42528799f74569bbea885a
public head:  dede561068650d9302c0570c22286f3cc3bb6da2
shared tree:  9ad59159129eab08e77d4f435f40dd410754a81a
verify:       30443877441
package:      30443877425
merge:        f8ac03fbb24493dbeac7385687b3f4a93eb10bf8
```

Downloaded C1 final artifacts passed checksums, checkout provenance, executable-mode and privacy review.

## Phase 2C-C2 implementation proof

```text
issue:        #53
public PR:    #15
private head: 57472ea9b54f1f967b064ff305e187222a29ba30
public head:  b58bfbaa8c535c3bcfb73f135263906e9a2c7777
shared tree:  088cdf17babc38f559559aa794360f2b1a4a9344
verify:       30455093681
package:      30455093613
```

Candidate downloaded hashes:

```text
outer source:  50b3b75eb1d67d044dcf5e39ee545c68fba0ab91370df2ad74570cdd6066bcaf
browser proof: c4bf10a309479f1a921a0c4445dc2e2437e404a7c04f91b403a9a394a5af6d37
source ZIP:    17654a4f866171f705216dd9825bb6d759a1c52a668bc10865fac33b853c065c
exporter ZIP:  c63f6e83e38a26507f8ed7932400d4026b82b5845b6120fac9e85c63e40099eb
B1b ZIP:       87e18e4c67eeb9b16d72a51250fe33e8f9ccdc832f998b48133634f4cb4c54e0
```

The implementation tree passed Linux/macOS/full tests, all prior Chrome harnesses and the C2 actual-Chrome harness. The browser proof reports seal/promotion/rollback/abort/reopen/recovery/idempotency/REQ-OBS checks true and exact-source/backup/production/migration/network/model/personal paths false or zero.

## Current acceptance state

C2 is a verified implementation candidate, not an accepted merge. Canonical Drive documents were updated and reverse-read on 2026-07-30. Repository documentation/release metadata must now form a new exact private/public tree, rerun CI/package gates and pass downloaded-artifact inspection. Only then may a private PR be factually merged with expected-head protection.
