# MindMap — восстановление и бюджет локальной модели

Статус: обязательный инженерный протокол для v0.6-alpha.19 и нового state-core.

## Основное правило

Локальная модель не исправляет ошибки кода, хранения или миграции. Для deterministic/storage/migration failure сначала выполняется offline read-only диагностика. Повтор AI-вызова или migration attempt допустим только после root-cause proof, regression, нового exact package gate и отдельного подтверждения пользователя.

## Exact legacy source

```text
size:       5 070 848 bytes
SHA-256:    356b943275cce292d0e14f8a7fbe95af07e79de73f06d3e361874d342aa2f918
workspace:  synthetic
personal:   0
```

B1b one-shot выполнен и израсходован. Source byte-identical; actual migration false. B1b не повторять.

## Phase 2C-C2 — recovery contract принят

C2 accepted merge: `2ce6230f537baf71715ca9e2dccf23a5e4f9e0b1`.

```text
final tree:    e6d0c0793ca6f5d20352d79e03fd12ca70f961bc
verify/package: 30517144927 / 30517144960
source artifact: 3f5bc2a8c781483c8a218287acc240897de9d8a640c4bab44b9beb0081de3d58
browser proof:   8be977709e13605d634db94950fda78c823818dd348947e6e115a6a25ed77f9c
```

Принятые semantics:

- immutable generation seal;
- persisted attempts/events с deterministic replay;
- atomic promotion и explicit rollback;
- stale revision, wrong pointer, identity/hash/receipt/fingerprint mismatch блокируют mutation;
- injected abort не меняет pointer, attempt, events или receipts;
- identical operation idempotent;
- pre-promotion interruption → terminal `blocked_recovery`;
- post-promotion interruption → `rollback_required`;
- close/reopen canonical state identical;
- automatic resume/retry false;
- actual Chrome REQ-OBS-001 и downloadable sanitized diagnostics.

C2 не открывала exact source/backup, не создавала production namespace и не выполняла actual migration; network/model calls и personal data = 0. На Mac recovery action не требуется.

## Phase 2C-C3 recovery boundary

Packaged runtime resolver на sanitized fixtures обязан fail closed при missing/corrupt/stale/mismatched registry, pointer, generation, seal, schema, workspace или snapshot hash. Запрещены legacy/inactive fallback, automatic repair/migration, promotion/rollback, resume/retry и external calls.

C3 должна проверить cold start, reload, reopened registry/generation, pointer replacement between reads, deleted generation, altered seal/hash/schema/workspace, malformed registry и diagnostics/REQ-OBS behavior.

## Текущая граница

C3 разрешена, но не начата. C4, exact-source reopening, private backup, target-Mac production storage, actual migration/promotion/rollback, model/network calls и personal data запрещены.

## Phase 2C-C3 recovery proof — реализация проверена

Resolver не восстанавливает и не меняет storage. Cold start, close/reopen, browser reload, explicit interruption и pointer replacement проверены на sanitized fixtures. Interrupted verification завершается typed rejection; automatic resume/retry false. Missing databases не создаются. Stale pointer не возвращает данные.

REQ-OBS-001 включает `possibly_hung`, elapsed/progress/heartbeat/inactivity, `без AI` и downloadable diagnostics. Проверенный tree `56e846d49a17f15bbbd1eedfc626f316e3a29a91`; verify/package `30535292820` / `30535292824`.

Первый CI failure был import-time Node strip-types incompatibility, а не recovery failure. Причина исправлена и покрыта regression guard.

До принятия C3 запрещены C4, exact-source/backup access, production namespace, repair/migration/promotion/rollback, automatic retry/resume, model/network calls и personal data.
