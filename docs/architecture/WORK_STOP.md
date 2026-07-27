# Work boundary after Phase 2C-B1a corrected exact-tree gate

Accepted foundations: Phase 0, 1A, 2A, 2B, 2C-A, 2C-B0 and the B1 execution plan. B1a code is implemented on sanitized fixtures but not yet accepted.

## Allowed now

Only:

1. final repository-document synchronization for B1a;
2. exact private/public tree rerun and downloaded-artifact inspection;
3. merge PR #43 if the final gate remains green;
4. separate post-merge provenance and Drive readback.

## Still prohibited

- locating or opening the exact private SQLite source;
- B1b execution;
- real migration target creation or actual target-Mac migration;
- automatic retry after failure/reload/version change;
- Candidate 5/6, Qwen, DeepSeek or external model calls;
- legacy database write/repair;
- production runtime/UI integration;
- real thought import;
- claims of semantic success or product readiness.

Corrected B1a private head `df2570b6cfea74296248297b7000b29876036e95`, public exact head `76a6da518301fcddbcaa9c3e06fdeb46805dbf6c`, shared tree `8ef2603b85aef1e7f1ff055cce7579259e3ee659`. B1a acceptance requires merge and post-merge provenance; it does not automatically authorize B1b.
