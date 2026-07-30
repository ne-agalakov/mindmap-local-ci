# Work boundary during Phase 2C-C2 factual merge gate

C1 is accepted by merge `f8ac03fbb24493dbeac7385687b3f4a93eb10bf8`. C2 final proof tree `158527376a989b304f097006ba39488d79a04c8f` passed CI and downloaded-artifact inspection. C2 is not accepted until final metadata-tree control and factual expected-head merge of PR #54.

## Allowed

- synchronize final C2 proof and Drive revisions;
- create one exact private/public metadata tree;
- run the final control CI/package and inspect any changed artifact;
- merge PR #54 with expected-head protection;
- record factual post-merge provenance and reverse-read.

## Prohibited

- C3/C4 before C2 acceptance;
- exact SQLite/private backup access or B1b retry;
- production registry/generation on target Mac;
- actual migration, production promotion/rollback;
- model/network calls or personal data.
