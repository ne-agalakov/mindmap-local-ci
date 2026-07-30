# Phase 2C-C4 — failure and recovery matrix

Status: planning candidate only. No runner or exact-source action is authorized.

## State classes

- `rejected_preflight`: no authorization consumed; no source or target access.
- `authorization_consumed`: one-shot token spent; no automatic retry.
- `blocked_recovery`: pre-promotion attempt stopped; active pointer unchanged.
- `sealed_inactive`: verified generation exists but is not active.
- `rollback_required`: promotion committed, later verification failed.
- `completed`: source/backup/generation/registry/runtime evidence all verified.

A failure never returns to a writable state automatically.

## Matrix

| Checkpoint | Failure examples | Required persisted result | Pointer effect | Permitted next action |
|---|---|---|---|---|
| P00 package self-check | checksum, inventory, mode, repository/commit/tree mismatch | `rejected_preflight` + sanitized package evidence | none | rebuild/review package; no source open |
| P01 authorization validation | missing, expired, wrong archive/source/generation/attempt | `rejected_preflight` | none | issue a corrected authorization only after package identity is stable |
| P02 authorization consume | receipt collision, consumed ID, atomic write failure | typed rejection; no uncertain consumption accepted | none | offline receipt inspection; no retry until consumption state is proven |
| P03 source verification | size/hash/integrity/count mismatch, write-capable open | `blocked_recovery`; authorization remains consumed | none | preserve source; diagnose offline; new package/auth only after root cause |
| P04 backup copy/verify | destination exists, partial copy, hash/integrity/fsync mismatch | `blocked_recovery`; preserve all bytes and diagnostics | none | no overwrite/delete; separate cleanup decision if required |
| P05 target gate | registry/generation collision, unknown prefix DB, non-empty bootstrap | `blocked_recovery` with inventory hashes only | none | inspect target offline; no automatic repair or deletion |
| P06 generation create | open/version/transaction failure | `blocked_recovery`; partial generation quarantined | none | no automatic deletion/reuse; new generation name in a future attempt |
| P07 import | mapping stop, integrity error, checkpoint write failure, interruption | `blocked_recovery`; last durable checkpoint and counts | none | no resume/retry; root cause + regression + new package/auth |
| P08 reopen | database missing, schema/store mismatch, incomplete transaction | `blocked_recovery` | none | preserve generation as evidence |
| P09 deterministic verify | portable-plan or snapshot hash mismatch | `blocked_recovery`; expected/actual hashes | none | semantic/mapping investigation; actual migration not claimed |
| P10 seal | content changed, seal conflict, receipt mismatch | `blocked_recovery` or `sealed_inactive` only when seal commit is proven | none | never mutate sealed payload; no auto promotion |
| P11 registry gate | stale revision, unexpected pointer, bootstrap conflict | `sealed_inactive` + typed rejection | unchanged | inspect registry; future explicit attempt only |
| P12 promotion transaction | transaction abort/timeout/unknown completion | readback determines either unchanged pointer or committed receipt; uncertainty is terminal | unchanged or exact committed pointer only | no second promotion call; read-only proof first |
| P13 C3 resolver verification | missing/corrupt/stale/replaced pointer, generation mismatch | `rollback_required` when promotion is proven committed | failed generation remains active until explicit rollback | produce rollback plan; request separate authorization |
| P14 evidence finalize | diagnostic serialization/download failure after successful runtime verification | migration state remains unchanged; evidence finalization marked failed | committed pointer retained | reconstruct evidence read-only; never repeat migration |
| P15 completion | post-completion duplicate invocation | idempotent completed receipt returned | unchanged | no write |

## Interruption and reload rules

1. Reload reads only durable attempt state, authorization receipt, generation seal and registry receipts.
2. Reload never invokes the next command automatically.
3. Any state between P02 and P12 reopens as `blocked_recovery` unless a fully committed seal is proven; a proven seal may reopen as `sealed_inactive`.
4. Any uncertain P12 result requires registry and receipt readback. The runner must not repeat promotion.
5. A committed P12 followed by incomplete P13 reopens as `rollback_required`, not as success and not as automatic rollback.
6. A completed receipt is immutable and idempotent.

## Collision policy

- Existing source backup destination: fail.
- Existing generation name: fail, even when contents appear identical.
- Existing registry with unknown schema/state: fail.
- Existing unknown generation prefix database: fail.
- Existing authorization or attempt ID: fail or return the exact immutable prior receipt; never create a second execution.

No collision is solved by deletion, overwrite, rename, repair or fallback.

## Rollback matrix

Rollback is a separate one-shot operation.

| Rollback precondition | Result |
|---|---|
| no committed activation receipt | reject: `promotion_not_proven` |
| registry revision changed | reject: `stale_registry_revision` |
| active pointer is not failed generation | reject: `active_pointer_changed` |
| previous pointer differs from authorization | reject: `previous_pointer_mismatch` |
| rollback authorization absent/expired/consumed | reject without mutation |
| rollback transaction aborts | read back registry; never repeat automatically |
| rollback commits | append receipt, verify pointer through C3 resolver or explicit empty-state resolver |

Rollback never deletes or modifies either generation.

## REQ-OBS-001 thresholds

Every future local stage exposes:

```text
workName
workType = local/offline
stageId
elapsedMs
processed/total
lastProgressAt
heartbeatAt
state
model = без AI
networkCalls = 0
modelCalls = 0
diagnosticsAvailable
```

Heartbeat target: at least once per second during active local work. `possibly_hung` is shown after no heartbeat and no progress for `max(15 seconds, 5 × configured heartbeat interval)`. It reports uncertainty and elapsed inactivity; it never triggers restart, resume, retry, cleanup, promotion or rollback. ETA is omitted unless derived from measured deterministic work, and is not required.

## Sanitized diagnostics

Allowed:

- package/commit/tree/archive identities;
- source/backup size and SHA-256;
- attempt/authorization/generation/registry identifiers;
- typed stages, counters, hashes, receipts and error codes;
- zero-call counters and observability trace.

Forbidden:

- raw thoughts, SQLite bytes or records;
- source/backup local paths, usernames or environment secrets;
- model prompts/responses;
- unredacted exception payloads containing personal data.
