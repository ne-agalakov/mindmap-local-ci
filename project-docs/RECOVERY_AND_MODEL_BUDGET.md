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

B1b one-shot выполнен и израсходован. Source остался byte-identical; actual migration false. Exact SQLite и sanitized evidence сохранять неизменными. B1b не повторять.

## Accepted C0/C1 recovery contract

C0 merge `31657e218cd5891e9e915f698febf8ac72942ed3` фиксирует immutable generations и atomic registry. C1 merge `f8ac03fbb24493dbeac7385687b3f4a93eb10bf8` фиксирует one-shot authorization, deterministic transition/replay, terminal `blocked_recovery` до promotion и explicit `rollback_required` после promotion.

## Phase 2C-C2 native recovery proof

Candidate exact tree:

```text
private head: 57472ea9b54f1f967b064ff305e187222a29ba30
public head:  b58bfbaa8c535c3bcfb73f135263906e9a2c7777
shared tree:  088cdf17babc38f559559aa794360f2b1a4a9344
verify/package: 30455093681 / 30455093613
```

Доказано на sanitized fixture namespaces:

- generation seal хранится отдельно и immutable после первой записи;
- registry сохраняет attempts, append-only events, seal attestations и receipts;
- deterministic replay проверяется до persisted transition;
- promotion и rollback являются отдельными atomic transactions;
- stale revision, wrong active/previous pointer, generation/seal/hash/receipt mismatch блокируют mutation;
- injected abort promotion и rollback оставляет pointer, attempt, events и receipts неизменными;
- repeated identical operation idempotent; different fingerprint конфликтует;
- pre-promotion interruption persisted как terminal `blocked_recovery`;
- post-promotion interruption persisted как `rollback_required`;
- close/reopen сохраняет canonical snapshot;
- automatic resume/retry отсутствуют.

Actual Chrome proof подтвердил REQ-OBS-001, downloadable sanitized diagnostics, exactSourceOpened=false, backupAccessed=false, productionNamespaceUsed=false, actualMigrationPerformed=false, network/model calls 0.

## Ошибки gate

Три причины были доказаны до нового запуска: lint `prefer-const`; чрезмерный structural test вокруг deny-list literal; order-sensitive `JSON.stringify` в browser proof. Исправления узкие и не ослабляют runtime safety.

## REQ-OBS-001

Каждая длительная операция показывает name/type, elapsed/volume, last progress/heartbeat, state, model или «без AI» и downloadable diagnostics. Stale activity сообщает «возможно, процесс завис», но не разрешает restart/retry.

## Текущая граница

C2 ещё не принята: требуется final repository documentation tree, exact-tree CI, downloaded-artifact review и factual merge. На target Mac recovery action не требуется.

C3/C4, exact-source reopening, private backup access, production registry/generation, actual migration/promotion/rollback, model/network calls и personal data запрещены.
