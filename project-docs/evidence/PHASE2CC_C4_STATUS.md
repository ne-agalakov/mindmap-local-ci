# Phase 2C-C4 — planning status

Date: 2026-07-30
Status: acceptance candidate; final exact-tree and factual merge pending
Issue: #59
Private PR: #60
Public CI PR: #18

## Initial verified identity

```text
private head: e6d90735b0ac9d8dc9da85d5c7a4a1641e3b0d67
public head:  f5d1758f51aa6e693427a0579dd8c16e502bf66b
shared tree:  115554301ca88330ca44a89de72eadd44e24d9f1
verify:       30548925903 — success
package:      30548925878 — success
```

The tree is documentation/architecture only. It defines the exact execution contract, failure/recovery matrix, target-Mac package inventory and separate acceptance gates.

## Release-marker regressions

Two intermediate candidates were correctly rejected by the existing release gate:

1. `PROJECT_STATUS.md` no longer contained exact accepted-C3 marker `Phase 2C-C3 — принята`.
2. `GITHUB_PROVENANCE.md` no longer contained exact accepted-C3 marker `Phase 2C-C3 accepted provenance`.

Both root causes were corrected by restoring the stable markers. No architecture requirement was weakened and failed workflow runs were not blindly rerun.

## Drive reverse-read

```text
instruction marker: PHASE2CC-C4-PLANNING-VERIFIED-11555430
status marker:      PHASE2CC-C4-PLANNING-CANDIDATE-11555430
recovery marker:    PHASE2CC-C4-RECOVERY-CANDIDATE-11555430
```

All three markers were found in their current native Google Docs revisions.

## Proof boundary

```text
planning implemented:       true
planning accepted:          false
implementation allowed:     false
execution allowed:          false
exact SQLite opened:        false
private backup accessed:    false
B1b repeated:               false
runner/launcher created:    false
C4 package created:         false
authorization created:      false
production namespace used:  false
actual migration:           false
promotion/rollback:         false
network/model calls:        0
personal data:              0
automatic resume/retry:     false
```

## Remaining acceptance work

- artifact revision 18 and Drive revisions in the final exact tree;
- strengthened release-documentation gate;
- final private/public tree equality;
- final CI/package;
- downloaded-artifact checksum, inventory, mode, provenance and privacy inspection;
- factual expected-head merge and GitHub `merged=true` readback;
- post-merge documentation closure.

Planning acceptance may authorize only a separate implementation issue on sanitized fixtures. It cannot authorize exact-source execution.
