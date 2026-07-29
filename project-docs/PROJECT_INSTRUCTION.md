# MindMap — инструкция проекта

## Цель и роль

MindMap — local-first AI-система. Цикл: мысль → понимание → связи → приоритет → решение → действие → результат → память. Первая версия — личный MVP Артёма с возможностью будущего продукта. Карта представляет данные; MindMap не является обычным заметочником или таск-менеджером.

Критерий решения: помогает ли оно превращать хаотичный поток мыслей в точные решения и результаты при минимуме ручной работы?

Работай как стратег, архитектор, исследователь, разработчик и критический партнёр. Не соглашайся автоматически. Безопасный шаг выполняй сам; спрашивай при изменении архитектуры или риска. Различай факт, гипотезу, реализацию и эксперимент. Не выдавай fixture за базу, сборку за успех или уверенность AI за подтверждение.

## Текущее состояние

Alpha.19 заморожена как legacy-прототип. Реальные мысли в неё не загружать.

Приняты Phase 0, 1A, 2A, 2B, 2C-A, 2C-B0, B1 plan, B1a и B1b. B1b merge: `4fd14e515d2c4234f70effa475381f47bbb50e8b`; post-merge docs: `e6bd47011fad2dab5a8617f5f754739de1915fd9`.

Единственный B1b exact-source read-only dry run выполнен и израсходован. Source `5 070 848` bytes / SHA-256 `356b943275cce292d0e14f8a7fbe95af07e79de73f06d3e361874d342aa2f918` остался неизменным. Counts `96/30/0/133/96/3/0`, один unresolved, ноль damaged references. Два clean target дали одинаковые portable plan/target snapshot hashes; injected rollback не оставил target/receipt; network/model calls = 0; actual migration = false.

Активный этап — Phase 2C-C0. Архитектура, failure matrix, release metadata и reviewed artifact gate готовы; финальный documentation-tree rerun и merge PR #49 ещё требуются.

## Модель данных

Пользователь свободно записывает мысль. AI предлагает тип, размещение, связи, проект, статус и следующий шаг. Не каждая мысль — задача: различай идеи, вопросы, наблюдения, решения, цели, проекты, материалы, людей, области и действия.

Иерархия: область → направление → проект → мысль. Корни — только области. Тип уровня обязателен. Неверные вложения, циклы и повторяющиеся пути запрещены. У мысли одно основное размещение и необязательные связи. Сфера жизни — не проект; проект имеет ограниченный результат и состояние.

Ноль подходящих направлений, проектов, связей, дублей или противоречий — нормальный результат. Нельзя заполнять схему выдуманными сущностями.

Различай корректную ссылку, честную неопределённость unresolved и повреждённую/устаревшую ссылку. Unresolved хранится во «Входящих» и не считается ошибкой. AI рекомендует, но не принимает важные решения. Внешние действия требуют подтверждения.

## Хранение и actual migration

Legacy source остаётся private, immutable и read-only. Диагностика, backup, migration и recovery выполняются без AI.

Actual migration не выполняется in-place и не пишет в фиксированную mutable production-базу. Она создаёт отдельную immutable generation database с prefix `mindmap-state-core-v1-generation-`. Control registry `mindmap-state-core-control-v1` хранит только управляющие записи и атомарно переключает active pointer после полного reopen, validation и seal generation.

Rollback восстанавливает previous pointer отдельной recorded transaction и не изменяет payload. Скрытый fallback запрещён. Legacy source, private backup, active/sealed/previous generations migration package не удаляет.

Поскольку IndexedDB не имеет atomic database rename, runtime resolver через control registry обязан быть доказан на sanitized fixtures до exact-source execution.

Безопасный порядок:

1. C0 — ADR, contract, failure matrix, release gate.
2. C1 — pure registry/generation contracts и state machine на sanitized fixtures.
3. C2 — native IndexedDB registry, promotion, rollback, crash/reload proof.
4. C3 — packaged runtime resolver на sanitized fixtures.
5. C4 — отдельный exact-source one-shot package.
6. Новое явное подтверждение Артёма непосредственно перед запуском.
7. Actual migration и activation.

Actual execution требует one-shot authorization, привязанной к repository, commit, tree, archive SHA-256, source SHA-256, generation name и attempt ID. Она расходуется до source open. Любой failure запрещает автоматический retry и требует offline root-cause proof, regression и нового package gate.

## C0 reviewed gate

```text
private head: 1e13024eeef8cec8ec05f721bf9ce703f884bc91
public head:  189e86ae8a92912d399196bed15d8ece849a58e9
shared tree:  c09d95579292970a851cf0c1a43abce13a800d3a
verify:       30424595380
package:      30424595384
```

Linux/macOS/full/actual-Chrome/package gates и downloaded-artifact review прошли. Исправлены три release-gate дефекта: ослабленный B1a README marker, неверная source-package provenance и неверная exporter-package provenance. Оба packager теперь regression-test actual checkout repository/commit.

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

Разрешены только финальный exact mirror C0-документации, CI/artifact review и merge PR #49.

Запрещены: повтор B1b; открытие exact SQLite; создание real backup/control registry/production generation; actual migration/promotion; source write/repair/delete; model calls; exact-data runtime use; реальные личные мысли.

После C0 merge разрешён только отдельный C1 на sanitized fixtures. Actual migration требует прохождения C1–C4 и нового явного подтверждения непосредственно перед exact final package.