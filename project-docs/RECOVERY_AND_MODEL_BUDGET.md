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

B1b one-shot выполнен и израсходован. Source остался byte-identical; repeat hashes equal; injected rollback left no target/receipt; network/model calls 0; actual migration false. Exact SQLite и оба sanitized evidence JSON сохранять неизменными. B1b не повторять.

## Accepted C0 recovery architecture

C0 merge `31657e218cd5891e9e915f698febf8ac72942ed3` фиксирует immutable generations и atomic control registry:

```text
registry: mindmap-state-core-control-v1
generation prefix: mindmap-state-core-v1-generation-
```

Generation inactive до import, close/reopen, exact verification и seal. Promotion — одна registry transaction с expected revision и activation receipt. Abort сохраняет прежний pointer. Rollback — отдельная явная pointer transaction; payload не мутируется. Hidden fallback запрещён.

## C1 recovery contract

C1 pure implementation доказана на sanitized fixtures:

```text
private head: ac639e625b6d0ced665c748c2c58f6b3753c4ffc
public head:  0eeb9fea5792b7fbf33db0061abc2f271db3b17f
shared tree:  2a536a54779634647eff8ebf2476840c257b2813
verify/package: 30442139981 / 30442139989
```

- authorization является one-shot и immutable-bound;
- stale revision, wrong pointer, mismatched generation/hash/receipt отклоняются;
- interruption до promotion переводит attempt в terminal `blocked_recovery`;
- automatic resume/retry запрещены;
- failure после committed promotion переводит attempt в `rollback_required`;
- rollback plan изменяет только pointer и не мутирует generation payload;
- deterministic replay и sanitized evidence проверены;
- browser/IndexedDB/filesystem/network/model/exact-source paths отсутствуют.

No recovery action is required on the target Mac. C1 не открывала source/backup, не создавала registry/generation databases и не выполняла actual migration/promotion/rollback.

## REQ-OBS-001

Каждая длительная операция показывает name/type, elapsed/volume, last progress/heartbeat, state, model или «без AI» и downloadable diagnostics. Stale activity сообщает «возможно, процесс завис», но не разрешает restart/retry.

## Текущая граница

C1 ещё не принята: требуется final documentation exact-tree gate и factual merge PR #52. Native persistence/crash recovery относится к C2; packaged resolver — к C3; exact-source migration — к C4 и будущему явному подтверждению.

Actual migration, C2 implementation, exact-source reopening, model/network calls и personal data пока запрещены.
