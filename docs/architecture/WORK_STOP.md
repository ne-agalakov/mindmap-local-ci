# Work boundary during Phase 2C-C0 design

Accepted foundations include B1b exact-source read-only dry run merge `4fd14e515d2c4234f70effa475381f47bbb50e8b`. Its one-shot authorization is consumed.

## Allowed now

Only C0 architecture and acceptance work:

1. ADR, migration/activation contract and failure matrix;
2. immutable-generation/control-registry design;
3. release metadata and Google Drive synchronization;
4. source-packager provenance correction and regression;
5. exact private/public Git-tree comparison;
6. Linux/macOS/full/actual-Chrome/package regression gates;
7. downloaded-artifact inspection;
8. merge of the C0 documentation/infrastructure PR after all gates.

## Still prohibited

- reopening the exact private SQLite source;
- repeating B1b;
- creating the real backup, control registry or production generation;
- actual migration, activation or rollback on the target Mac;
- automatic retry after failure/reload/version change;
- Candidate 5/6, Qwen, DeepSeek or any model call;
- legacy source write/repair/delete;
- exact-data runtime integration;
- real thought import;
- claims of semantic success or product readiness.

## Next boundary

After C0 acceptance, only C1 pure registry/generation contracts and state machine on sanitized fixtures are allowed. Native IndexedDB work belongs to C2; packaged runtime resolver work belongs to C3; exact-source execution belongs to C4 plus a new explicit user confirmation immediately before launch.