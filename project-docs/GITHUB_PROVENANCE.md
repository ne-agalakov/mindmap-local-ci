# GitHub provenance and source-artifact verification

## Technical source of truth

Technical identity is `repository + commit SHA + Git tree`. A label, directory or green workflow alone is not evidence. Primary: `ne-agalakov/mindmap-local`; public CI mirror: `ne-agalakov/mindmap-local-ci`.

## Accepted foundations

B1b merge `4fd14e515d2c4234f70effa475381f47bbb50e8b`; C0 merge `31657e218cd5891e9e915f698febf8ac72942ed3`; C1 merge `f8ac03fbb24493dbeac7385687b3f4a93eb10bf8`.

## Phase 2C-C2 final pre-merge provenance

```text
issue:        #53
private PR:   #54
public PR:    #15
private head: 83eb9a06610ff737676b002837beadf6807926dd
public head:  cdd6939409d8bbb33da20c9875dc082cd2c39bd3
shared tree:  158527376a989b304f097006ba39488d79a04c8f
verify:       30516236010
package:      30516236013
```

Downloaded hashes:

```text
outer source:  34a6874bf92ae92a0be894587363bebe7b0f48df0e8c6f3bff47ee8b1ffca515
browser proof: 9610fe23de063eb3ee17d10cc19972a57532650b75d5abbbebd04fd134caef7e
source ZIP:    9521dcabc0f0c2a95cdf31522f18e2e228a3192481e36147341283edbe50dea3
exporter ZIP:  97e971600327c12f9495d668d5b62102d19ab6509711c9e8893cf0de37b22c48
B1b ZIP:       2c34325a68dda1f27c194e7441af5abd30cea71c6e5a420923b4a2ba3823314e
```

The source artifact declared public commit `cdd6939409d8bbb33da20c9875dc082cd2c39bd3`; replacing package-time metadata with repository placeholders reconstructed exactly tree `158527376a989b304f097006ba39488d79a04c8f`. Portable checksums, inventory, dedicated launcher modes and privacy scans passed. Historical sanitized provenance is allowed; private database/evidence bytes, secrets, generated dependencies and personal payloads are absent.

The final browser proof reports all seal/promotion/rollback/abort/reopen/recovery/idempotency/REQ-OBS checks true and exact-source/backup/production/migration paths false, with zero network/model calls.

## Current state

C2 final proof is complete but not accepted. Canonical Drive docs were reverse-read at final-proof revisions. The next repository tree may change documentation/metadata only, must be exact across private/public and must pass the final control before PR #54 is merged with expected-head protection. Merge SHA is recorded only after GitHub returns `merged=true`.
