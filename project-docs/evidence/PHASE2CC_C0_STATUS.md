# Phase 2C-C0 — current status

Date: 2026-07-29
Status: accepted; post-merge documentation closure active
Issue: #48
PR: #49
Merge: `31657e218cd5891e9e915f698febf8ac72942ed3`

## Architecture accepted

- ADR-0002 selects immutable generation databases and a separate atomic activation registry.
- The migration/activation contract defines source, private backup, generation, registry, sealing, promotion, resolver verification, rollback, evidence and one-shot authorization invariants.
- The failure matrix defines typed stops and recovery for authorization, source, backup, registry, generation, import, verification, sealing, promotion, resolver, rollback, observability and evidence failures.
- Runtime resolver integration on sanitized fixtures is a prerequisite to exact-source actual migration.

```text
control registry:  mindmap-state-core-control-v1
generation prefix: mindmap-state-core-v1-generation-
```

## Final exact-tree gate

```text
private head: af8f3c55d9e352c1f25d7aa8f720a7e55c6611b5
public head:  9bb65ab0bfdc1631c93d3de42dd97be6f2b23dc6
shared tree:  a8523316e16273f633fac8caac95e96a5fec1080
verify run:   30425727226
package run:  30425727235
```

Reopening the public PR independently repeated the same current-head gate: verify `30427050113`, package `30427050043` — success.

Linux lint/full suite, macOS launcher/tests, actual Chrome run-storage/graph-storage/B1a/B1b harnesses and source/exporter/B1b packaging passed.

Downloaded review:

```text
outer artifact: f2de7f3961c5b720a35e2cbc8987e3a5216304bf8bc8513432c4d8ddb800ff1f
browser proof:  1e0c1aa3f2fd5004699ce6162b20f19e99933ed574ea1e142b7265d9507e1d45
source ZIP:     636c80a35b04f3ab7b7995c2d0cbd7cb804098b69ce67bcd3b6d1031a3099f0f
exporter ZIP:   41c693e46916d9f41d76a2efc615a37a831c39e571fc9152b43e61c3cfce7104
B1b ZIP:        24af33670975e87ce61944955de56303d15c81a0ceb81ceb0433c0bf82b877a0
```

Source/exporter/B1b package metadata identify the actual public checkout. Portable checksums passed, user launchers are executable, and exact database/evidence bytes, secrets, dependencies and personal payloads were absent.

## Release-gate findings fixed

1. README had removed the exact accepted B1a heading required by the historical release gate.
2. Generic source packaging paired the private repository with a public-mirror commit.
3. Compact exporter packaging had the same independent provenance defect.
4. Canonical Drive documents prematurely recorded unverified merge identity `69a9fc703a79f3aaa4bd44fc372f0cc8c9cb59f4`. It was replaced after factual GitHub merge and reverse-read.

Earlier green runs and false document identities are historical evidence only.

## C0 boundary

- exact SQLite reopened: false;
- B1b repeated: false;
- backup created: false;
- IndexedDB registry/generation created: false;
- actual migration/promotion: false;
- network/model calls: 0;
- personal data used: false.

## Next verified step

Artifact revision 12 and corrected Google Drive revisions are synchronized. Only C1 pure registry/generation contracts and attempt state machine on sanitized fixtures are allowed.

Exact-source reopening, native IndexedDB work, backup/registry/generation creation and actual migration remain prohibited.
