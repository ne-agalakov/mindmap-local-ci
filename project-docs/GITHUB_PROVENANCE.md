# GitHub provenance and source-artifact verification

## Technical source of truth

Technical identity is `repository + commit SHA + Git tree`. A label, directory or green workflow alone is not evidence. Primary: `ne-agalakov/mindmap-local`; public CI mirror: `ne-agalakov/mindmap-local-ci`.

## Phase 2C-C2 accepted provenance

```text
issue:        #53 closed completed
private PR:   #54 merged
public PR:    #15 CI mirror
private head: f3986e2905d34bbd56c8ccd3686c8e5cfab44e45
public head:  f7b43c7ddec69be304d15aaa0bdd0eb714081085
shared tree:  e6d0c0793ca6f5d20352d79e03fd12ca70f961bc
verify:       30517144927
package:      30517144960
merge:        2ce6230f537baf71715ca9e2dccf23a5e4f9e0b1
```

Downloaded hashes:

```text
outer source:  3f5bc2a8c781483c8a218287acc240897de9d8a640c4bab44b9beb0081de3d58
browser proof: 8be977709e13605d634db94950fda78c823818dd348947e6e115a6a25ed77f9c
source ZIP:    f35da2df4c0e38a6131c1b15ed6f45c9aa4d37af1e73727f29283a40abc834e9
exporter ZIP:  1ecba0b67b3c80ce14d444d304596ff594778edabe2195ff972f40cfc0e00ba8
B1b ZIP:       ceb0569e3a35b9664aedfc34b2c2c0530065f59cb95d0daae7c00586ea4221b5
```

The source artifact declared public commit `f7b43c7ddec69be304d15aaa0bdd0eb714081085`. Replacing package-time metadata with repository placeholders reconstructed exactly tree `e6d0c0793ca6f5d20352d79e03fd12ca70f961bc`. Portable checksums, release-doc gate, inventory, dedicated launcher modes and privacy scans passed. Private database/evidence bytes, secrets, generated dependencies and personal payloads were absent.

The actual-Chrome proof passed seal, promotion, rollback, transaction-abort, reopen, recovery, idempotency, REQ-OBS and diagnostic checks; exact-source/backup/production/migration paths were false and network/model calls were zero.

GitHub returned `merged=true` for PR #54 using `expected_head_sha=f3986e2905d34bbd56c8ccd3686c8e5cfab44e45` and merge commit `2ce6230f537baf71715ca9e2dccf23a5e4f9e0b1`.

## Next provenance gate

C3 packaged runtime resolver must use a fresh private/public exact tree, full CI, actual Chrome packaged-runtime proof and downloaded-artifact inspection. C3 cannot inherit authorization for C4 or actual migration.
