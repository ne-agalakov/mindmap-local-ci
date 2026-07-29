# Phase 2C-C0 — acceptance evidence

Date: 2026-07-29
Status: accepted
Issue: #48
Private PR: #49
Public CI PR: #12

## Accepted decision

Actual migration uses immutable generation databases and one atomic control-registry pointer transaction. It does not write in place and does not copy staged payload during promotion.

```text
control registry:  mindmap-state-core-control-v1
generation prefix: mindmap-state-core-v1-generation-
```

A generation remains inactive until import, close/reopen, exact verification and seal have passed. Rollback restores the previous pointer through an explicit registry transaction and does not mutate payload.

## Final identity

```text
private head: af8f3c55d9e352c1f25d7aa8f720a7e55c6611b5
public head:  9bb65ab0bfdc1631c93d3de42dd97be6f2b23dc6
shared tree:  a8523316e16273f633fac8caac95e96a5fec1080
squash merge: 31657e218cd5891e9e915f698febf8ac72942ed3
```

Private/public tree equality was established from a previously exact common tree plus matching nine-file deltas and equal final blob identities. The public B1b package independently recorded the same current tree.

## Final CI

```text
verify:            30425727226
package:           30425727235
duplicate verify:  30427050113
duplicate package: 30427050043
```

Passed:

- Linux lint and full suite;
- macOS launcher and targeted tests;
- actual Chrome run-storage, graph-storage, B1a and B1b sanitized harnesses;
- source, compact exporter and B1b packaging.

## Downloaded artifact review

```text
outer artifact: f2de7f3961c5b720a35e2cbc8987e3a5216304bf8bc8513432c4d8ddb800ff1f
browser proof:  1e0c1aa3f2fd5004699ce6162b20f19e99933ed574ea1e142b7265d9507e1d45
source ZIP:     636c80a35b04f3ab7b7995c2d0cbd7cb804098b69ce67bcd3b6d1031a3099f0f
exporter ZIP:   41c693e46916d9f41d76a2efc615a37a831c39e571fc9152b43e61c3cfce7104
B1b ZIP:        24af33670975e87ce61944955de56303d15c81a0ceb81ceb0433c0bf82b877a0
```

Confirmed outside the runner:

- portable checksum manifests;
- source/exporter repository and commit match the public checkout;
- B1b package records the same commit and tree;
- exporter and B1b launchers are executable;
- no SQLite/database bytes, exact evidence, `.env`, credentials, private keys, generated dependencies or personal payloads;
- browser proof remains sanitized, with exact source opened false, actual migration false, zero network/model calls and no automatic retry.

## Root causes closed

1. Historical B1a README release marker had been weakened.
2. Generic source package embedded private repository identity with a public-mirror commit.
3. Compact exporter contained the same independent provenance defect.
4. Canonical Drive documents recorded unverified merge identity `69a9fc703a79f3aaa4bd44fc372f0cc8c9cb59f4` before factual merge. GitHub verification proved it was not the accepted merge; the false tail blocks were replaced and reverse-read.

The first three defects have regressions. The fourth is protected by requiring factual PR/merge retrieval before post-merge document markers are written.

## Corrected Google Drive readback

```text
instruction revision: AIroW35OjMtTyfnm5LU17ZlydzD_h22m0llDyXiCAgoj37sdxwIAS1Tlv7DA4AOmnrbtFLyTPmrst0KL9YVj9lWW_stFBgSES-F9yo2f_cA
instruction marker:   PHASE2CC-C1-ALLOWED-31657E21
status revision:      AIroW34GQdFUh8mkRAY2DgpG_71_WpS6qX-fsXKDLlLiEaj5E-yIzDkmhkSRlaSImJJyuLHbSRiDsHV14J_8WVxRNzjwu2Hl8jqPpUvJuqA
status marker:        PHASE2CC-C0-ACCEPTED-31657E21
recovery revision:    AIroW36j3OBZcn7wI6LhqlqOLAUvQFGIZMQaEBcHqw9aUUmJK6pOx4JrReih9jb5lhWs1izG5xvhnYsfM5oIZORcHhxAEq1AJIrjm5Kif3U
recovery marker:      PHASE2CC-C0-MERGE-RECOVERY-31657E21
```

## Boundary of proof

During C0:

- exact SQLite reopened: false;
- B1b repeated: false;
- backup created: false;
- registry/generation created: false;
- actual migration/promotion/rollback executed: false;
- network/model calls: 0;
- personal data: 0.

C0 proves architecture, contracts, failure/recovery semantics and release provenance. It does not prove native persistence, packaged runtime resolution, exact-source actual migration, semantic quality or real-data safety.

## Next gate

Only C1 pure registry/generation contracts and attempt state machine on sanitized fixtures are allowed. C1 must have no IndexedDB, browser, filesystem, exact-source, backup, network, model, clock or randomness path.
