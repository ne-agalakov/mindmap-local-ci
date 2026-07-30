# MindMap — инструкция проекта

## Цель

MindMap — local-first AI-система: мысль → понимание → связи → приоритет → решение → действие → результат → память. Карта представляет данные; продукт не является обычным заметочником или таск-менеджером.

Критерий: превращает ли решение хаотичный поток мыслей в точные решения и результаты при минимуме ручной работы? Различай факт, гипотезу, реализацию и эксперимент. Fixture не является реальной базой, сборка не является успехом, уверенность AI не является подтверждением.

## Текущее состояние

Alpha.19 заморожена как legacy research runtime; реальные мысли не загружать. Exact SQLite private и immutable. B1b one-shot выполнен, принят и израсходован; повтор запрещён.

C0–C3 приняты. C3 factual merge: `38b0e3fb9542174328396ae19bff76f18d637f21`. Финальная identity: private `cec6c0ef1c0ce4eea5ab69ef172df060e9df5d2e`, public `61602480f505c133df8257cc494852b43e9d3fa0`, tree `9bee67d28fe5979fb64b2992710aa4e6bcf2fbba`, verify/package `30540259921` / `30540260040`.

## Модель данных

Иерархия: область → направление → проект → мысль. Корни — только области. Неверные вложения, циклы и повторяющиеся пути запрещены. У мысли одно основное размещение и необязательные связи. Сфера жизни — не проект; проект имеет ограниченный результат и состояние.

Ноль направлений, проектов, связей, дублей или противоречий — допустимый результат. Не создавай сущности для заполнения схемы. Различай корректную ссылку, honest `unresolved` и damaged/stale reference. `Unresolved` хранится во «Входящих» и не считается ошибкой.

AI рекомендует, но не принимает важные решения. Внешние действия требуют подтверждения.

## Принятая migration architecture

Actual migration не пишет in-place. Каждый import создаёт отдельную immutable generation database. Control registry `mindmap-state-core-control-v1` атомарно выбирает active generation только после reopen, validation и seal. Rollback восстанавливает предыдущий pointer и не изменяет payload.

C3 доказала packaged resolver: active generation выбирается только через registry; проверяются revision, pointer, attestation, identity, schema, workspace, seal и snapshot hash; missing/corrupt/mismatched/stale/interrupted state fail closed; fallback, repair, migration, mutation, automatic resume/retry и external calls отсутствуют; REQ-OBS-001 и sanitized diagnostics работают в actual Chrome.

## Recovery и AI-расход

После failure запрещён blind retry. Сначала offline root-cause proof, regression, новый exact package gate и отдельное подтверждение. Диагностика, backup, migration и recovery выполняются без AI. Model/network calls для текущей линии — 0.

## Документация и release gate

Google Drive — продуктовый источник; GitHub — техническая история. Документы считаются обновлёнными только после reverse-read. Exact private/public tree, CI и downloaded artifact проверяются до merge. Merge SHA записывается только после `merged=true` readback.

## Текущая стоп-линия

Разрешено только отдельное планирование C4: issue, threat/failure matrix, package contract и тестовый план на sanitized fixtures. Запрещены C4 implementation/execution, exact SQLite/private backup, B1b repeat, target-Mac production registry/generation, actual migration/promotion/rollback, fallback, automatic resume/retry, model/network calls и personal data.

Перед будущим exact-source запуском требуется новое явное подтверждение Артёма непосредственно перед выполнением. На Mac сейчас ничего запускать не нужно.
