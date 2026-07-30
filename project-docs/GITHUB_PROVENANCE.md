# GitHub provenance and source-artifact verification

Technical identity is `repository + commit SHA + Git tree`. Green CI alone is not acceptance.

## Accepted Phase 2C-C3 provenance

```text
private PR:   #57 merged
public PR:    #16 closed CI mirror
private head: cec6c0ef1c0ce4eea5ab69ef172df060e9df5d2e
public head:  61602480f505c133df8257cc494852b43e9d3fa0
shared tree:  9bee67d28fe5979fb64b2992710aa4e6bcf2fbba
verify:       30540259921
package:      30540260040
merge:        38b0e3fb9542174328396ae19bff76f18d637f21
closure:      dd5e3ba57d0f5ce17254569625ab9bc93b149a55
```

C3 artifacts passed checksums, reconstructed-tree provenance, inventory, executable modes, release-doc, privacy and credential scans.

## Phase 2C-C4 planning candidate

Issue #59 is documentation/architecture only. Working branches:

```text
private: phase2cc/c4-planning-contract
public:  phase2cc-c4-planning-contract-exact
```

Candidate files define:

- exact execution/authorization contract;
- checkpoint failure and recovery matrix;
- package inventory/provenance;
- planning through actual-migration acceptance gates.

No C4 runner, launcher or package exists. Exact source/private backup were not opened; B1b was not repeated; production registry/generation were not created; actual migration/promotion/rollback were not executed; network/model calls and personal data are 0.

## Planning acceptance provenance gate

C4 planning may be accepted only after:

1. identical private/public Git tree;
2. full public CI/package on that tree;
3. downloaded artifact inventory/checksum/privacy inspection;
4. canonical Drive update and reverse-read;
5. separate final documentation tree if Drive revisions change;
6. expected-head merge of the private planning PR;
7. GitHub `merged=true` readback and post-merge closure.

The planning merge authorizes only a later implementation issue on sanitized fixtures. It does not authorize C4 code, exact package creation or exact-source execution.

## Future exact package provenance

A future C4 archive must record the repository/commit/tree of its actual checkout, portable checksums, workflow identities, required modes and forbidden inventory. Its outer archive SHA-256 is recorded after download and bound into the detached one-shot authorization. The archive cannot self-prove its own final outer hash.

A green runner or package is never evidence of actual migration success.
