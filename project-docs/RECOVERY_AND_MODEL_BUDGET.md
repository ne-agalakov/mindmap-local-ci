# MindMap — восстановление и бюджет локальной модели

## Неподвижный источник

```text
size:       5 070 848 bytes
SHA-256:    356b943275cce292d0e14f8a7fbe95af07e79de73f06d3e361874d342aa2f918
workspace:  synthetic
personal:   0
```

B1b one-shot израсходован; source byte-identical; actual migration false. B1b не повторять.

## C3 recovery accepted

C3 merge `38b0e3fb9542174328396ae19bff76f18d637f21`, closure `dd5e3ba57d0f5ce17254569625ab9bc93b149a55`. Resolver read-only, fail-closed, deterministic after reopen/reload, detects pointer replacement and never repairs/resumes/retries.

## C4 planning recovery contract

Future authorization is one-shot and consumed before first source open. Failure after consumption cannot resume or retry automatically.

Checkpoint states:

```text
rejected_preflight
authorization_consumed
blocked_recovery
sealed_inactive
rollback_required
completed
```

Before promotion, failure leaves active pointer unchanged. Partial or sealed inactive generation is quarantined and never deleted, reused or activated automatically.

Uncertain promotion completion is resolved by registry/receipt readback. Promotion is never called a second time automatically.

After committed promotion, failed C3 resolver verification produces `rollback_required`. Migration authorization has `rollbackAuthorized=false`. Rollback requires a separate one-shot authorization bound to current/previous pointer, registry revision, activation receipt and failure evidence. Rollback changes only pointer and receipt; source, backup and generation payload remain immutable.

## Backup rule

Expected backup identity equals source identity. Future runner may create only a new authorization-bound backup destination without overwrite, then fsync/close/reopen and verify size, SHA-256 and SQLite integrity. Existing destination, partial copy or mismatch is terminal. No automatic cleanup.

## REQ-OBS-001

Every long local/offline stage reports work/stage, elapsed, processed/total, last progress, heartbeat, state, model `без AI`, network/model counters 0 and downloadable sanitized diagnostics.

`possibly_hung` appears after no heartbeat and no progress for `max(15 seconds, 5 × heartbeat interval)`. It never triggers restart, resume, retry, cleanup, promotion or rollback.

## Правило failure

Сохранить symptom/evidence → offline root-cause proof → regression → новый exact package → reverse-read docs → новое явное подтверждение Артёма для конкретного package/attempt.

## Текущая граница

Разрешено только принятие C4 planning contract. Runner/launcher, exact SQLite/private backup access, production namespace, actual migration/promotion/rollback, model/network calls и personal data запрещены. На Mac действий не требуется.
