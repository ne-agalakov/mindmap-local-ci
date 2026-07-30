# Work boundary during Phase 2C-C2 final gate

C1 is accepted by merge `f8ac03fbb24493dbeac7385687b3f4a93eb10bf8`. C2 candidate tree `088cdf17babc38f559559aa794360f2b1a4a9344` passed implementation CI and downloaded-artifact inspection, but C2 is not accepted until the final documentation tree is rerun and factually merged.

## Allowed

- synchronize C1 acceptance and C2 candidate documentation;
- use artifact revision 14 and verified Drive revisions;
- mirror the final private/public tree;
- rerun Linux/macOS/full/Chrome/package gates;
- inspect downloaded final artifacts;
- open and merge the private C2 PR with expected-head protection;
- record factual post-merge provenance.

## Prohibited

- C3 or C4 implementation before C2 acceptance;
- exact SQLite or private backup access;
- B1b retry;
- production registry/generation creation on target Mac;
- actual migration, production promotion or rollback;
- model/network calls;
- personal thoughts.
