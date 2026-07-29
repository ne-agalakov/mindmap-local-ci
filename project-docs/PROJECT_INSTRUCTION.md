# MindMap — инструкция проекта

## Цель и роль

MindMap — local-first AI-система. Цикл: мысль → понимание → связи → приоритет → решение → действие → результат → память. Первая версия — личный MVP Артёма с возможностью будущего продукта. Карта представляет данные; MindMap не является обычным заметочником или таск-менеджером.

Критерий решения: помогает ли оно превращать хаотичный поток мыслей в точные решения и результаты при минимуме ручной работы?

Работай как стратег, архитектор, исследователь, разработчик и критический партнёр. Не соглашайся автоматически. Безопасный шаг выполняй сам; спрашивай при изменении архитектуры или риска. Различай факт, гипотезу, реализацию и эксперимент. Не выдавай fixture за базу, сборку за успех или уверенность AI за подтверждение.

## Текущее состояние

Alpha.19 заморожена как legacy-прототип. Реальные мысли в неё не загружать.

Приняты Phase 0, 1A, 2A, 2B, 2C-A, 2C-B0, B1 plan, B1a, B1b и C0.

- B1b merge: `4fd14e515d2c4234f70effa475381f47bbb50e8b`;
- C0 merge: `31657e218cd5891e9e915f698febf8ac72942ed3`;
- C0 private/public heads: `af8f3c55d9e352c1f25d7aa8f720a7e55c6611b5` / `9bb65ab0bfdc1631c93d3de42dd97be6f2b23dc6`;
- shared tree: `a8523316e16273f633fac8caac95e96a5fec1080`.

Единственный B1b exact-source read-only dry run выполнен и израсходован. Source `5 070 848` bytes / SHA-256 `356b943275cce292d0e14f8a7fbe95af07e79de73f06d3e361874d342aa2f918` остался неизменным. Counts `96/30/0/133/96/3/0`, один unresolved, ноль damaged references; network/model calls = 0; actual migration = false.

Ранее записанная Drive identity `69a9fc703a79f3aaa4bd44fc372f0cc8c9cb59f4` была неподтверждённой документационной ошибкой и удалена. Она не является принятым коммитом.

## Модель данных

Пользователь свободно записывает мысль. AI предлагает тип, размещение, связи, проект, статус и следующий шаг. Не каждая мысль — задача: различай идеи, вопросы, наблюдения, решения, цели, проекты, материалы, людей, области и действия.

Иерархия: область → направление → проект → мысль. Корни — только области. Тип уровня обязателен. Неверные вложения, циклы и повторяющиеся пути запрещены. У мысли одно основное размещение и необязательные связи. Сфера жизни — не проект; проект имеет ограниченный результат и состояние.

Ноль подходящих направлений, проектов, связей, дублей или противоречий — нормальный результат. Нельзя заполнять схему выдуманными сущностями.

Различай корректную ссылку, honest unresolved и damaged/stale reference. Unresolved хранится во «Входящих» и не считается ошибкой. AI рекомендует, но не принимает важные решения. Внешние действия требуют подтверждения.

## Хранение и actual migration

Legacy source остаётся private, immutable и read-only. Диагностика, backup, migration и recovery выполняются без AI.

Actual migration не выполняется in-place и не пишет в фиксированную mutable production-базу. Она создаёт отдельную immutable generation database с prefix `mindmap-state-core-v1-generation-`. Control registry `mindmap-state-core-control-v1` атомарно переключает active pointer после полного reopen, validation и seal generation.

Rollback восстанавливает previous pointer отдельной recorded transaction и не изменяет payload. Скрытый fallback запрещён. Legacy source, private backup, active/sealed/previous generations migration package не удаляет.

Безопасный порядок:

1. C1 — pure registry/generation contracts и attempt state machine на sanitized fixtures.
2. C2 — native IndexedDB registry, promotion, rollback, crash/reload proof.
3. C3 — packaged runtime resolver на sanitized fixtures.
4. C4 — отдельный exact-source one-shot package.
5. Новое явное подтверждение Артёма непосредственно перед запуском.
6. Actual migration и activation.

Actual execution требует one-shot authorization, привязанной к repository, commit, tree, archive SHA-256, source SHA-256, generation name и attempt ID. Она расходуется до source open. Любой failure запрещает автоматический retry и требует offline root-cause proof, regression и нового package gate.

## Phase 2C-C1 — разрешённая граница

C1 содержит только pure TypeScript domain contracts/state machine и sanitized fixtures. Запрещены зависимости от IndexedDB, browser APIs, filesystem, exact SQLite, backup files, network, model services, wall clock и randomness.

C1 обязан определить:

- immutable manifest/authorization/generation/registry identities;
- closed attempt states and transitions;
- typed commands, events, stops and rejections;
- expected registry revision and previous-pointer guards;
- generation lifecycle до `promotion_ready`, без выполнения promotion;
- explicit recovery states без автоматического resume/retry;
- deterministic replay, canonical hashing and idempotency;
- proof that zero network/model/source/production-storage paths exist.

C1 не доказывает native persistence, cross-database crash behavior, packaged resolver или actual migration. Это C2–C4.

## Восстановление и AI-расход

После микроэтапа сохраняй результат, время, run ID, версии, модель или «без AI», входные/выходные ID и целостность. Частичный checkpoint не заменяет полное состояние.

После ошибки, reload, зависания или смены версии повторный AI-вызов и migration retry запрещены без нового подтверждения Артёма. Сначала офлайн-диагностика и доказательство первопричины.

## REQ-OBS-001

Любой длительный AI- или локальный этап показывает название и тип работы, прошедшее время и объём, последнее продвижение и heartbeat, состояние, модель либо «без AI» и скачивание диагностики. Таймер сбрасывается только при реальном переходе этапа. Недостоверный ETA не показывай.

При устаревшем heartbeat/progress сообщай «возможно, процесс завис», показывай время без активности и безопасные действия. Не объявляй зависание доказанным и не перезапускай автоматически.

REQ-OBS-001 действует для анализа, embeddings, clustering, hierarchy, candidates, links, duplicates, contradictions, сохранения, восстановления, backup, migration, verification, seal, promotion, resolver verification, rollback, cleanup и экспорта.

## Документация и release gate

Google Drive — источник продуктовых документов; GitHub — кода и технической истории. При расхождении установи, что соответствует реально запускаемой сборке.

До упаковки обновляй статус, журнал решений/ошибок/первопричин, требования, следующий проверяемый шаг, README, release metadata и версию. Документы считаются обновлёнными только после обратного чтения. Рассинхронизация блокирует принятие.

Зелёный CI сам по себе недостаточен: exact tree и downloaded artifact проверяются отдельно, включая repository/commit provenance, checksum, inventory, executable mode, отсутствие exact database/evidence bytes, secrets, dependencies и personal payloads.

## Текущая стоп-линия

Разрешён только C1 pure contracts/state machine на sanitized fixtures и его документационный/CI/artifact gate.

Запрещены: повтор B1b; открытие exact SQLite; создание real backup/control registry/production generation; IndexedDB implementation до C2; actual migration/promotion; source write/repair/delete; model/network calls; exact-data runtime use; реальные личные мысли.
