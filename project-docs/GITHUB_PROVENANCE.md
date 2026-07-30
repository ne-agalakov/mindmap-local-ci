# GitHub provenance and source-artifact verification

Technical identity is `repository + commit SHA + Git tree`.

## Phase 2C-C4 planning accepted provenance

```text
issue:        #59 closed completed
private PR:   #60 merged
public PR:    #18 closed CI mirror
private head: c291429e666c02fb909b7a4e46b6dd5f623f97ef
public head:  28ffeb3266b4886cb3931632a8f5130ae0542205
shared tree:  7d653175805e39eea9c50c5f76e401f285d07976
verify:       30551648816
package:      30551649021
merge:        2c1f476685007a8c2fa52288ac00dfff188edb06
```

Downloaded hashes:

```text
outer source:  f3a4745941d38ec98822e35005f20b97ca733b230130a448e9c8dd86aeee1f30
browser proof: f4b134d5f0fe80d49a50bd825a101b020c3e1bd885a50ed73b7011b0b4143ffb
source ZIP:    bd0e433169cfcb144d1ba79c06d3c21eb35ee5c9a1b41d2c9ea8c5fb770941d0
exporter ZIP:  557d9522f55ad74ca50da4c7ec513f4aa74a86b89e8571f03d8e09374bf386e3
B1b ZIP:       255659f714ee2e05f829a54e297e57c7d0cafa425fa5ddf84835470c634c9583
```

After normalizing declared package-time fields, source reconstructed tree `7d653175805e39eea9c50c5f76e401f285d07976`. Checksums, modes, inventory, privacy and forbidden-content checks passed. No database, private evidence bytes, authorization, credentials, dependencies or personal payload were included.

Planning acceptance authorizes only a separate sanitized-fixture implementation issue. Exact-source execution remains a later gate.
