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

## Accepted C0/C1 contract

C0 merge `31657e218cd5891e9e915f698febf8ac72942ed3` фиксирует immutable generations и atomic registry. C1 merge `f8ac03fbb24493dbeac7385687b3f4a93eb10bf8` фиксирует one-shot authorization, deterministic replay, terminal `blocked_recovery` до promotion и explicit `rollback_required` после promotion.

## Phase 2C-C2 final recovery proof

```text
private head: 83eb9a06610ff737676b002837beadf6807926dd
public head:  cdd6939409d8bbb33da20c9875dc082cd2c39bd3
shared tree:  158527376a989b304f097006ba39488d79a04c8f
verify/package: 30516236010 / 30516236013
```

Доказано на sanitized fixture namespaces:

- generation seal immutable;
- registry сохраняет attempts, append-only events, attestations и receipts;
- deterministic replay до persisted transition;
- promotion/rollback atomic;
- stale revision, wrong pointer, identity/hash/receipt mismatch блокируют mutation;
- injected abort оставляет pointer, attempt, events и receipts неизменными;
- identical operation idempotent; changed fingerprint конфликтует;
- pre-promotion interruption persisted как terminal `blocked_recovery`;
- post-promotion interruption persisted как `rollback_required`;
- close/reopen canonical snapshot identical;
- automatic resume/retry false.

Final Chrome proof SHA-256 `9610fe23de063eb3ee17d10cc19972a57532650b75d5abbbebd04fd134caef7e` подтвердил REQ-OBS-001, diagnostics download, network guards и snapshot `3194c2f0b23788a422c91ab4873be3a63194c2f0b23788a422c91ab4873be3a6`. exactSourceOpened/backupAccessed/productionNamespaceUsed/actualMigrationPerformed false; calls 0.

## Текущая граница

C2 final proof complete, но acceptance требует factual expected-head merge PR #54 и post-merge closure. На target Mac recovery action не требуется.

C3/C4, exact-source reopening, private backup, production registry/generation, actual migration/promotion/rollback, model/network calls и personal data запрещены.
