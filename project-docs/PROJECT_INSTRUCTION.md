# MindMap — инструкция проекта

## Цель

MindMap — local-first AI-система: мысль → понимание → связи → приоритет → решение → действие → результат → память. Карта представляет данные; продукт не является обычным заметочником или таск-менеджером.

Критерий: превращает ли решение хаотичный поток мыслей в точные решения и результаты при минимуме ручной работы? Различай факт, гипотезу, реализацию и эксперимент. Fixture не является реальной базой, сборка не является успехом, уверенность AI не является подтверждением.

## Текущее состояние

Alpha.19 заморожена как legacy research runtime; реальные мысли не загружать. Exact SQLite private и immutable. B1b one-shot выполнен, принят и израсходован; повтор запрещён.

C0–C3 приняты. C3 merge `38b0e3fb9542174328396ae19bff76f18d637f21`; closure `dd5e3ba57d0f5ce17254569625ab9bc93b149a55`.

Issue #59 содержит C4 planning candidate. Это документация и архитектура, не runner и не разрешение execution.

## Модель данных

Иерархия: область → направление → проект → мысль. Корни — только области. Неверные вложения, циклы и повторяющиеся пути запрещены. У мысли одно основное размещение и необязательные связи. Ноль направлений, проектов, связей, дублей или противоречий — допустимый результат. `Unresolved` хранится во «Входящих» и не считается ошибкой.

AI рекомендует, но не принимает важные решения. Внешние действия требуют подтверждения.

## Принятая migration architecture

Actual migration не пишет in-place. Каждый import создаёт отдельную immutable generation database. Control registry `mindmap-state-core-control-v1` атомарно выбирает active generation только после reopen, validation и seal. Rollback восстанавливает предыдущий pointer и не изменяет payload.

C3 доказала read-only resolver: active generation выбирается только через registry; missing/corrupt/mismatched/stale state fail closed; fallback, repair, mutation, automatic resume/retry и external calls отсутствуют.

## C4 planning candidate

Будущий exact-source attempt допустим только при immutable manifest, который связывает package repository/commit/tree/archive SHA-256, source/backup identities, registry, generation, workspace, attempt и authorization IDs, expected portable-plan и target-snapshot hashes.

Detached authorization:

- создаётся только после exact package acceptance и явного подтверждения Артёма;
- расходуется атомарно до первого source open;
- одноразовая и не разрешает automatic retry/resume;
- не разрешает rollback.

Rollback требует отдельной authorization, связанной с current/previous pointer, registry revision, activation receipt и failure evidence.

Первый production target допускается только в strict bootstrap-empty mode. Любой existing/unknown registry, generation или prefix collision останавливает attempt без удаления, overwrite, repair или fallback.

Future sequence: package verify → authorization consume → source read-only verify → new backup copy/reopen/hash/integrity → target gate → isolated generation → deterministic import/checkpoints → reopen → portable-plan/snapshot verify → seal → atomic pointer promotion → accepted C3 resolver verification → sanitized evidence.

Failure до promotion оставляет pointer неизменным. Partial/sealed inactive generation не удаляется и не активируется автоматически. Failure после committed promotion даёт `rollback_required`; rollback не выполняется автоматически.

## REQ-OBS-001

Каждая длительная local/offline operation показывает work/stage, elapsed, processed/total, last progress, heartbeat, state, model `без AI`, zero-call counters и downloadable diagnostics. `possibly_hung` появляется после отсутствия heartbeat/progress дольше `max(15 s, 5 × heartbeat interval)` и не запускает restart/resume/retry/cleanup/promotion/rollback. Недостоверный ETA не показывается.

Diagnostics содержат identities, hashes, counters, receipts, stages и typed errors; не содержат raw thoughts, SQLite bytes/records, local paths, credentials или personal data.

## Пять отдельных gates

1. Planning contract acceptance.
2. Implementation proof только на sanitized fixtures.
3. Exact package acceptance и downloaded-artifact inspection.
4. Новое явное one-shot подтверждение Артёма непосредственно перед launch.
5. Actual migration acceptance по factual evidence.

Ни один предыдущий gate не заменяет следующий. Storage migration success не доказывает semantic quality; после него обязательны 96 synthetic thoughts в нескольких порядках.

## Recovery и AI-расход

После failure запрещён blind retry. Сначала offline root-cause proof, regression, новый exact package, reverse-read docs и новое подтверждение. Диагностика, backup, migration и recovery выполняются без AI. Model/network calls текущей линии — 0.

## Документация и release gate

Google Drive — продуктовый источник; GitHub — техническая история. Документы считаются обновлёнными только после reverse-read. Exact private/public tree, CI и downloaded artifact проверяются до merge. Merge SHA записывается только после `merged=true` readback.

## Текущая стоп-линия

Разрешены только review, CI, artifact inspection, Drive reverse-read и factual acceptance planning contract Issue #59.

Запрещены: C4 implementation/execution; runner/launcher; exact SQLite/private backup access; B1b repeat; target-Mac production registry/generation; actual migration/promotion/rollback; fallback; automatic resume/retry/cleanup; model/network calls; personal data.

Перед будущим exact-source launch требуется новое явное подтверждение Артёма для конкретного package/attempt. На Mac сейчас ничего запускать не нужно.
