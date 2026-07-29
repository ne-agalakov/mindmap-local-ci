# MindMap — инструкция проекта

## Цель

MindMap — local-first AI-система: мысль → понимание → связи → приоритет → решение → действие → результат → память. Карта представляет данные; продукт не является обычным заметочником или таск-менеджером.

Критерий: превращает ли решение хаотичный поток мыслей в точные решения и результаты при минимуме ручной работы?

Различай факт, гипотезу, реализацию и эксперимент. Не выдавай fixture за базу, сборку за успех или уверенность AI за подтверждение. Безопасный внутренний шаг выполняй самостоятельно; спрашивай при изменении архитектуры, риска или перед внешним действием.

## Текущее состояние

Alpha.19 заморожена как legacy research runtime; реальные мысли в неё не загружать.

Приняты Phase 0, 1A, 2A, 2B, 2C-A, B0, B1a, B1b и C0. B1b exact-source one-shot выполнен и израсходован; exact SQLite сохраняется неизменным и повторно не открывается.

C0 merge: `31657e218cd5891e9e915f698febf8ac72942ed3`. Архитектура actual migration: immutable generation database с prefix `mindmap-state-core-v1-generation-` и atomic active pointer в registry `mindmap-state-core-control-v1`. Rollback меняет pointer и не редактирует payload.

C1 pure contracts/state machine реализованы на head `ac639e625b6d0ced665c748c2c58f6b3753c4ffc` и exact public head `0eeb9fea5792b7fbf33db0061abc2f271db3b17f`, tree `2a536a54779634647eff8ebf2476840c257b2813`. CI прошёл, но C1 ещё не принята до final documentation tree и factual merge PR #52.

## Модель данных

Иерархия: область → направление → проект → мысль. Корни — только области. Неверные вложения, циклы и повторяющиеся пути запрещены. У мысли одно основное размещение и необязательные связи. Сфера жизни — не проект; проект имеет ограниченный результат и состояние.

Ноль подходящих направлений, проектов, связей, дублей или противоречий — нормальный результат. Нельзя создавать сущности для заполнения схемы.

Различай корректную ссылку, honest `unresolved` и damaged/stale reference. `Unresolved` хранится во «Входящих» и не считается ошибкой.

AI рекомендует, но не принимает важные решения. Внешние действия требуют подтверждения.

## Хранение и миграция

Legacy source остаётся private, immutable и read-only. Диагностика, backup, migration и recovery выполняются без AI.

Безопасный порядок:

1. C1 — pure contracts/state machine.
2. C2 — native IndexedDB registry/promotion/rollback/crash proof.
3. C3 — packaged runtime resolver на sanitized fixtures.
4. C4 — отдельный exact-source one-shot package.
5. Новое явное подтверждение Артёма непосредственно перед запуском.
6. Actual migration и activation.

Actual execution требует authorization, привязанной к repository, commit, tree, archive SHA-256, source SHA-256, generation name и attempt ID. Она расходуется до source open. Failure запрещает retry; сначала offline root-cause proof, regression и новый package gate.

## Phase 2C-C1

C1 содержит только pure TypeScript contracts и sanitized fixtures. Запрещены зависимости от IndexedDB, browser APIs, filesystem, exact SQLite, backup files, network, model services, wall clock и randomness.

C1 фиксирует:

- immutable manifest/authorization/generation/registry identities;
- closed attempt states and transitions;
- typed commands, events, stops and rejections;
- expected registry revision и previous-pointer guards;
- deterministic replay, canonical hashing и idempotency;
- terminal blocked recovery без автоматического resume/retry;
- pure promotion/rollback plans без выполнения storage writes;
- sanitized evidence и structural dependency gate.

C1 не доказывает native persistence, crash behavior, packaged resolver или actual migration. Это отдельные C2–C4.

## REQ-OBS-001

Любая длительная операция показывает name/type, elapsed time и volume, last progress/heartbeat, state, model либо «без AI» и downloadable diagnostics. Таймер меняется только при реальном переходе. Stale heartbeat означает «возможно, процесс завис», но не разрешает restart/retry.

REQ-OBS-001 действует для анализа, embeddings, clustering, hierarchy, links, duplicates, contradictions, save, backup, migration, verification, seal, promotion, resolver verification, rollback, recovery и export.

## Документация и release gate

Google Drive — источник продуктовых документов; GitHub — кода и технической истории. До принятия обновляются статус, решения/ошибки/первопричины, требования, следующий проверяемый шаг, README, release metadata и версия. Документы считаются обновлёнными только после reverse-read.

Зелёный CI недостаточен: exact private/public tree и downloaded artifact проверяются отдельно, включая provenance, checksums, inventory, executable modes и отсутствие database/evidence bytes, secrets, dependencies и personal payloads.

Merge SHA записывается только после фактического `merged=true` и readback GitHub API. Предсказанный SHA не является evidence.

## Текущая стоп-линия

Разрешены только финальная синхронизация C1 docs/release metadata, exact-tree CI/artifact review и merge PR #52.

Запрещены: C2 implementation до принятия C1; B1b retry; exact SQLite/backup access; real registry/generation creation; actual migration/promotion/rollback; model/network calls; personal data.
