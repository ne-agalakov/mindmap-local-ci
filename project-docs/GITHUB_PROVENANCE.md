# GitHub provenance and source-artifact verification

Technical identity is `repository + commit SHA + Git tree`. Green CI alone is not acceptance.

## Phase 2C-C3 accepted provenance

```text
issue:        #56 closed completed
private PR:   #57 merged
public PR:    #16 closed CI mirror
private head: cec6c0ef1c0ce4eea5ab69ef172df060e9df5d2e
public head:  61602480f505c133df8257cc494852b43e9d3fa0
shared tree:  9bee67d28fe5979fb64b2992710aa4e6bcf2fbba
verify:       30540259921
package:      30540260040
merge:        38b0e3fb9542174328396ae19bff76f18d637f21
```

Downloaded final hashes:

```text
outer source:  1d9db6cb1e09d4133893a23a54dcd64ba08d3f14c0b5248a2a0f5d86281940a2
browser proof: d593b233490a87da9d7132759cf4c14f1c6ca359a271564c0c0836e86ebd7843
source ZIP:    18beb6f0ef045b3c388a615a2a2db60657e557bba81db5dc6c7ed0117ad281b1
exporter ZIP:  cf00ad8eb2ebb76aee2c138f5182d15dc9b25e434e98d97470aa0ab2a47dcd72
B1b ZIP:       6a50e9491fa4357a97fcb050a321e0e930b224186dd20d7d590a6a30e160bcac
```

The source artifact identified `ne-agalakov/mindmap-local-ci` commit `61602480f505c133df8257cc494852b43e9d3fa0`. Restoring package-time placeholders reconstructed exact tree `9bee67d28fe5979fb64b2992710aa4e6bcf2fbba`. Checksums, inventory, required files, executable modes, release-doc gate, privacy and credential scans passed.

Actual Chrome passed active generation resolution, registry/pointer/attestation/generation/schema/workspace/seal/hash validation, deterministic reload, stale-pointer rejection, missing-registry no-create behavior, no fallback/mutation, REQ-OBS-001 and zero external calls.

GitHub returned `merged=true` for PR #57 using expected head `cec6c0ef1c0ce4eea5ab69ef172df060e9df5d2e` and merge commit `38b0e3fb9542174328396ae19bff76f18d637f21`.

## Next provenance gate

C4 is planning-only. No implementation or exact-source execution may begin until a separate contract/failure matrix is reviewed and a new explicit execution authorization is provided by Артём.
