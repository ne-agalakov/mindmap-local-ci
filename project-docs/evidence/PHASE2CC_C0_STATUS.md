# Phase 2C-C0 — current status

Date: 2026-07-29
Status: reviewed gate passed; final documentation tree rerun and merge pending
Issue: #48
PR: #49

## Architecture completed

- ADR-0002 selects immutable generation databases and a separate atomic activation registry.
- The migration/activation contract defines source, private backup, generation, registry, sealing, promotion, resolver verification, rollback, evidence and one-shot authorization invariants.
- The failure matrix defines typed stops and recovery for authorization, source, backup, registry, generation, import, verification, sealing, promotion, resolver, rollback, observability and evidence failures.
- Runtime resolver integration on sanitized fixtures is a prerequisite to exact-source actual migration.

```text
control registry:  mindmap-state-core-control-v1
generation prefix: mindmap-state-core-v1-generation-
```

## Reviewed exact-tree gate

```text
private head: 1e13024eeef8cec8ec05f721bf9ce703f884bc91
public head:  189e86ae8a92912d399196bed15d8ece849a58e9
shared tree:  c09d95579292970a851cf0c1a43abce13a800d3a
verify run:   30424595380
package run:  30424595384
```

Linux lint/full suite, macOS launcher/tests, actual Chrome run-storage/graph-storage/B1a/B1b harnesses and source/exporter/B1b packaging passed.

Downloaded review:

```text
outer artifact: 6e63c8d4bace4f5350713ca64dc983fde2f81808e64798c1089539a30985c720
browser proof:  9ec160607e1517f6a27e3c7ed36441dfd1a4ed2a9d4ffb634083d04014d51160
source ZIP:     7ae424491bdb82c18bb8cf46ebcf09fb2cc9f187870d4454b1c2c2d6e947cdd5
exporter ZIP:   7ede5c196249dcbb8084856cd62763cf179c1a7600e53e174efca9425fc45a98
B1b ZIP:        6de9eb5d15fea1c31cc2e99d98d52e734eb20d5a4e28889bb9b7c5575339bd83
```

Source and exporter package metadata both identify the actual public checkout. Portable checksums passed, user launchers are executable, and exact database/evidence bytes, secrets, dependencies and personal payloads were absent. Sanitized fixtures and source identity metadata remain intentionally present.

## Release-gate findings fixed

1. README had removed the exact accepted B1a heading required by the historical release gate. The heading was restored.
2. Generic source packaging paired the private repository with a public-mirror commit. Repository identity is now derived from the actual checkout or an explicit override; regression added.
3. Compact exporter packaging had the same independent provenance defect. It now follows the same rule; regression added.

Earlier green runs are historical evidence only and are not used as the final C0 gate.

## C0 boundary

- exact SQLite reopened: false;
- B1b repeated: false;
- backup created: false;
- IndexedDB registry/generation created: false;
- actual migration/promotion: false;
- network/model calls: 0;
- personal data used: false.

## Next verified step

The reviewed gate evidence and final Google Drive revisions are now synchronized into artifact revision 11. Mirror this final documentation tree exactly, rerun Linux/macOS/full/actual-Chrome/package gates, inspect the downloaded artifact, then merge PR #49 with expected-head protection.

After merge, only C1 pure registry/generation contracts and state machine on sanitized fixtures are allowed. Exact-source reopening and actual migration remain prohibited.