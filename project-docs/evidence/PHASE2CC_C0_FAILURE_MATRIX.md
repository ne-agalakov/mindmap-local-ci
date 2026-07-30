# Phase 2C-C0 — failure and recovery matrix

Date: 2026-07-29
Status: required design evidence; execution prohibited

Every failure below must produce a typed stop, sanitized evidence and zero automatic retry. The source, backup, prior active generation and prior active pointer must remain unchanged unless a row explicitly describes a committed promotion followed by recorded rollback.

| ID | Failure point | Required detection | Required persisted state | Required recovery | Mutation allowed before stop |
|---|---|---|---|---|---|
| AUTH-001 | authorization missing | detached authorization absent | no attempt | stop before source open | none |
| AUTH-002 | package repository/commit/tree/archive mismatch | manifest comparison | `stopped_prewrite`, authorization consumed only when an attempt was actually frozen | offline diagnosis; new package and confirmation | control attempt record only |
| AUTH-003 | authorization already consumed | control registry lookup | prior attempt unchanged | no retry; new explicit authorization | none |
| AUTH-004 | another non-terminal attempt exists | registry attempt scan | conflicting attempt preserved | explicit abandonment or recovery decision | none |
| SRC-001 | source missing/unreadable | preflight file open | `stopped_prewrite` | preserve evidence; no retry | attempt record only |
| SRC-002 | source size/SHA mismatch | byte hash before backup | `stopped_prewrite` | identify correct source; new confirmation | attempt record only |
| SRC-003 | SQLite header, quick check or integrity check fails | read-only inspection | `stopped_prewrite` | offline source diagnosis | attempt record only |
| SRC-004 | source modification timestamp changes during run | compare frozen metadata and final hash | `stopped_generation` or `rollback_required` if promotion occurred | do not trust result; preserve generation and evidence | generation may exist but not activate |
| BAK-001 | backup destination already exists with different identity | exclusive create + hash | `stopped_prewrite` | choose a new backup identity after diagnosis | no generation write |
| BAK-002 | backup copy interrupted | incomplete file marker/hash mismatch | `stopped_prewrite` | retain or explicitly delete incomplete copy; new confirmation | backup bytes only |
| BAK-003 | backup size/SHA/integrity mismatch | independent verification | `stopped_prewrite` | do not overwrite; offline diagnosis | backup bytes only |
| REG-001 | registry schema/version mismatch | open without upgrade and inspect | `stopped_prewrite` | migration/version design required | none |
| REG-002 | registry open triggers upgrade | `onupgradeneeded` guard | `stopped_prewrite` | abort; separate migration of registry contract | none |
| REG-003 | expected registry revision or active pointer differs | preflight compare | `stopped_prewrite` | inspect newer state; no stale overwrite | none |
| GEN-001 | generation name invalid, legacy-like or temporary-like | validation before open | `stopped_prewrite` | regenerate manifest/package | none |
| GEN-002 | generation database already exists | `indexedDB.databases()` and open guard | `stopped_prewrite` | inspect collision; never reuse automatically | none |
| GEN-003 | generation schema creation aborts | upgrade transaction result | `stopped_generation` | retain evidence; explicit cleanup later | incomplete generation only |
| IMP-001 | failure before first run commit | injected/runtime error | `stopped_generation` | inactive generation retained or explicitly deleted | empty generation metadata only |
| IMP-002 | run commit rejected/aborted | typed storage rejection | `stopped_generation` | no continuation; inspect receipt/state | partial inactive generation possible |
| IMP-003 | crash between run commits | next launch sees non-terminal attempt | blocked recovery state | no implicit resume; new decision after inspection | partial inactive generation possible |
| IMP-004 | graph commit rejected/aborted | typed graph rejection | `stopped_generation` | no promotion; preserve evidence | run records may exist in inactive generation |
| IMP-005 | idempotency receipt conflicts | receipt fingerprint check | `stopped_generation` | classify payload/identity conflict | no additional commit |
| VER-001 | exact counts differ | canonical snapshot validation | `stopped_generation` | no sealing or promotion | inactive generation only |
| VER-002 | reference/hierarchy/unresolved invariant fails | complete-state validator | `stopped_generation` | no repair by model; code/data diagnosis | inactive generation only |
| VER-003 | portable plan hash differs | canonical hash comparison | `stopped_generation` | prove mapping difference before new attempt | inactive generation only |
| VER-004 | target snapshot hash differs | persisted snapshot hash | `stopped_generation` | prove persistence/mapping cause | inactive generation only |
| VER-005 | reopen cannot reproduce snapshots | close/reopen verification | `stopped_generation` | no sealing or promotion | inactive generation only |
| VER-006 | network/model counter non-zero | structural guard and counters | `stopped_generation` | security/root-cause investigation | no promotion |
| SEAL-001 | seal transaction aborts | generation metadata transaction result | `stopped_generation` | generation remains unsealed and inactive | no promotion |
| SEAL-002 | write attempted after seal | sealed-write guard | `stopped_generation` | treat as contract violation | rejected write only |
| PRO-001 | runtime resolver version not proven/compatible | manifest/runtime gate | `stopped_generation` | finish sanitized runtime gate first | no promotion |
| PRO-002 | promotion lock already active | registry transaction precondition | `promotion_aborted` | inspect competing attempt | no pointer change |
| PRO-003 | stale registry revision during promotion | transaction compare | `promotion_aborted` | preserve old pointer; no retry | no pointer change |
| PRO-004 | promotion transaction aborts | IndexedDB transaction abort | `promotion_aborted` | old pointer remains authoritative | no pointer change |
| PRO-005 | process terminates immediately before promotion commit | absence of activation receipt | prior pointer remains active | blocked non-terminal attempt; no resume | none |
| PRO-006 | process terminates immediately after promotion commit | activation receipt and non-terminal attempt visible | `promotion_committed` persisted atomically | runtime/recovery UI blocks automatic continuation; explicit resolver verification | new pointer committed |
| RES-001 | registry resolver cannot open active generation | resolver verification | `rollback_required` | explicit rollback transaction | pointer may have changed |
| RES-002 | resolver snapshot/hash mismatch | resolver canonical verification | `rollback_required` | explicit rollback transaction | pointer may have changed |
| RBK-001 | prior pointer identity missing/mismatch | activation receipt validation | `rollback_conflict` | stop; do not guess | none |
| RBK-002 | registry revision advanced after promotion | stale revision guard | `rollback_conflict` | inspect later activation | none |
| RBK-003 | rollback transaction aborts | IndexedDB transaction abort | `rollback_required` remains | preserve evidence; explicit follow-up | pointer unchanged from pre-rollback state |
| RBK-004 | rollback commits | atomic receipt/pointer update | `rolled_back` | verify previous generation through resolver | prior pointer restored |
| OBS-001 | heartbeat/progress becomes stale | inactivity threshold | operation state `possibly_hung` | user may download diagnostics; no auto restart | current transaction semantics only |
| OBS-002 | Terminal/browser closes | persisted attempt inspection on next start | blocked recovery state | explicit diagnosis and decision | no implicit writes |
| EVD-001 | evidence write fails before promotion | evidence checkpoint failure | stop before promotion | preserve local state; no retry | inactive generation only |
| EVD-002 | final evidence write fails after promotion | attempt remains `promotion_committed` or `resolver_verified` | blocked recovery state | regenerate only from persisted sanitized control data after explicit action | no data mutation |

## Crash checkpoints required in tests

The implementation must expose deterministic injected stops at least at:

1. before authorization consume;
2. after authorization consume;
3. during backup copy;
4. after backup verification;
5. after generation schema creation;
6. before first run commit;
7. after each run commit;
8. before and after graph commit;
9. after import verification;
10. before and after seal;
11. before promotion transaction;
12. inside promotion transaction before pointer write;
13. after pointer/receipt requests but before transaction completion;
14. immediately after promotion completion;
15. during resolver verification;
16. before and after rollback transaction.

For each checkpoint, tests must prove the exact persisted attempt state, active pointer, generation visibility, receipt set, source/backup identity, retry prohibition and zero network/model calls.

## Cleanup boundary

Automatic deletion is allowed only for a newly created unsealed generation when the same currently running attempt can prove that no promotion receipt exists and deletion itself succeeds before terminal evidence is finalized. Because deletion may be blocked or diagnostics may require the partial target, the default is retain-and-report.

Legacy source, backup, sealed generation, active generation and prior active generation are never deleted by the migration package. Garbage collection is a later independent feature.