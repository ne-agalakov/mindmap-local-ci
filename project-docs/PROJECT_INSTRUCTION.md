# MindMap — инструкция проекта

## Цель

MindMap — local-first AI-система: мысль → понимание → связи → приоритет → решение → действие → результат → память. Карта представляет данные; продукт не является обычным заметочником или таск-менеджером.

Критерий: превращает ли решение хаотичный поток мыслей в точные решения и результаты при минимуме ручной работы? Различай факт, гипотезу, реализацию и эксперимент. Fixture не является реальной базой, сборка не является успехом, уверенность AI не является подтверждением.

## Текущее состояние

Alpha.19 заморожена как legacy research runtime; реальные мысли не загружать. B1b exact-source one-shot выполнен, принят и израсходован. Exact SQLite сохраняется неизменным; B1b не повторять.

C0 и C1 приняты. C2 native IndexedDB contract принят merge-коммитом `2ce6230f537baf71715ca9e2dccf23a5e4f9e0b1` после final tree `e6d0c0793ca6f5d20352d79e03fd12ca70f961bc`, verify `30517144927`, package `30517144960` и downloaded-artifact inspection.

## Модель данных

Иерархия: область → направление → проект → мысль. Корни — только области. Неверные вложения, циклы и повторяющиеся пути запрещены. У мысли одно основное размещение и необязательные связи. Сфера жизни — не проект; проект имеет ограниченный результат и состояние.

Ноль подходящих направлений, проектов, связей, дублей или противоречий — нормальный результат. Нельзя создавать сущности для заполнения схемы. Различай корректную ссылку, honest `unresolved` и damaged/stale reference. `Unresolved` хранится во «Входящих» и не считается ошибкой.

AI рекомендует, но не принимает важные решения. Внешние действия требуют подтверждения.

## Хранение и миграция

Legacy source остаётся private, immutable и read-only. Диагностика, backup, migration и recovery выполняются без AI.

Безопасный порядок:

1. C3 — packaged runtime resolver на sanitized fixtures.
2. C4 — отдельный exact-source one-shot package.
3. Новое явное подтверждение Артёма непосредственно перед запуском.
4. Actual migration и activation.

Failure запрещает automatic retry. Сначала offline root-cause proof, regression и новый exact package gate.

## Phase 2C-C2 — принятая граница

C2 доказала на isolated fixture namespaces:

- immutable generation seal и attestation;
- persisted aggregate + append-only events с deterministic replay;
- atomic promotion и explicit rollback;
- revision, current/previous pointer, identity/hash/receipt/idempotency guards;
- abort promotion/rollback без partial mutation;
- terminal `blocked_recovery` без automatic resume/retry;
- post-promotion `rollback_required`;
- actual Chrome, sanitized evidence, REQ-OBS-001 и diagnostics download.

C2 не разрешает exact-source/backup access, production namespace или actual migration.

## Phase 2C-C3 — разрешённая граница

C3 реализует только packaged runtime resolver на sanitized fixtures. Resolver обязан:

- получать active generation только через `mindmap-state-core-control-v1`;
- проверять registry schema/revision, pointer workspace/state, generation identity, storage schema, immutable seal и snapshot hash;
- fail closed при missing, corrupt, stale или mismatched состоянии;
- не использовать legacy, inactive generation или скрытый fallback;
- не выполнять repair, migration, promotion, rollback, resume/retry или external call;
- показывать REQ-OBS-001 и отдавать sanitized diagnostics.

## Документация и release gate

Google Drive — продуктовый источник; GitHub — техническая история. Документы считаются обновлёнными только после reverse-read. Exact private/public tree, CI и downloaded artifact проверяются до merge. Merge SHA записывается только после `merged=true` readback.

## Текущая стоп-линия

Разрешены C3 issue, дизайн, implementation и tests только в указанной sanitized boundary. Запрещены C4, B1b retry, exact SQLite/private backup, target-Mac production storage, actual migration/promotion/rollback, model/network calls и personal data. На Mac действий не требуется.

## Phase 2C-C3 — реализация проверена, acceptance pending

C3 resolver обязан оставаться read-only и fail-closed. Он открывает только существующие sanitized registry/generation databases, выбирает active generation только через control registry, проверяет revision, pointer, attestation, identity, schema, workspace, immutable seal и snapshot hash, затем повторно читает registry для stale-pointer guard.

Missing/corrupt/mismatched/stale/interrupted состояние не разрешает fallback, repair, migration, promotion, rollback, automatic resume/retry или external call. REQ-OBS-001 и sanitized diagnostics обязательны.

Текущая разрешённая работа: final repository documentation tree, CI/package, downloaded-artifact inspection и factual expected-head merge PR #57. C4, exact SQLite/private backup, B1b repeat, target-Mac production storage, actual migration и personal data запрещены.
