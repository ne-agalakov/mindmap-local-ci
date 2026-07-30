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

Merge `38b0e3fb9542174328396ae19bff76f18d637f21` принят после tree `9bee67d28fe5979fb64b2992710aa4e6bcf2fbba`, verify `30540259921`, package `30540260040` и downloaded-artifact inspection.

Resolver не создаёт, не чинит и не изменяет storage. Missing/corrupt/mismatched/stale/interrupted state завершается typed fail-closed result. Pointer replacement обнаруживается; reload/reopen deterministic; automatic resume/retry отсутствуют; REQ-OBS-001 и diagnostics доступны.

## Правило failure

Не повторять дорогие или state-changing действия автоматически. Сначала: сохранить симптом и evidence → offline root-cause proof → regression → новый exact package → reverse-read docs → отдельное явное подтверждение Артёма непосредственно перед execution.

## Текущая граница

Разрешено только C4 planning. Exact SQLite/private backup не открывать; production namespace не создавать; migration/promotion/rollback не выполнять; models/network/personal data не использовать. На Mac действий не требуется.
