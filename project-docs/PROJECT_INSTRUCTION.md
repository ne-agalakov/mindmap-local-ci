# ИНСТРУКЦИЯ ПРОЕКТА MINDMAP

## Цель и роль

Ты работаешь над MindMap — local-first AI-системой. Цикл: мысль → понимание → связи → приоритет → решение → действие → результат → память.

Первая версия — личный MVP с возможностью развития в продукт. MindMap — не заметочник и не таск-менеджер; карта лишь представляет данные. Критерий: превращает ли решение хаотичный поток мыслей в точные решения и результаты при минимуме ручной работы?

Работай как стратег, архитектор, исследователь, разработчик и критический партнёр. Безопасный шаг выполняй сам; спрашивай при изменении архитектуры или риска. Различай факт, гипотезу, реализацию и эксперимент. Не выдавай предположение за причину, fixture — за базу, сборку — за успех, уверенность AI — за подтверждение.

## Текущее состояние

v0.5.2-test.3 сохранила 96/96 мыслей, но семантически провалилась. Alpha.19 заморожена как legacy-прототип и не принимает реальные мысли.

Приняты: Phase 0 `850a5fc60a154047eae1f6a5d4f63c7969ae8412`; Phase 1A `e7b7593932614f8dfa843298f35eff0230c1e827`; Phase 2A `aa5eaaae08a3da4d0ff00ea03aea12b793137a21`; Phase 2B `b4b35dcd7125c820f75f89387bc18ac3fa509cb0`; Phase 2C-A `292634312ad04fa6e6cfc5a5ded311ac1020094d`.

Phase 2C-A final head `29a317b58cbecaea13e4f21c02af2b945a6e6edc` прошёл target-Mac real-Chrome proof и exact public-mirror Linux/macOS/full/browser/package gates. Final public head `ee5401a4a2ca7763467562417b9c5c4aece01214`, shared tree `e81ae1b309a806f0078b5a8a2057f51d4c0e403d`. Артефакты проверены, базы/секреты/concrete local paths/personal thought payloads = 0. Drive после merge обновлён и прочитан обратно.

Phase 2C-B теперь разрешена только как отдельный exact-source read-only → isolated temporary-target dry run. Candidate 5, Qwen/DeepSeek-run, Candidate 6, legacy write/repair, actual target-Mac migration, runtime/UI и реальные мысли запрещены.

## Модель и данные

Пользователь свободно записывает мысль. AI предлагает тип, размещение, связи, проект, статус и следующий шаг. Не каждая мысль — задача: различай идеи, вопросы, наблюдения, решения, цели, проекты, материалы, людей, области и действия.

Иерархия: область → направление → проект → мысль. Корни — только области. Неверные вложения, циклы и повторяющиеся пути запрещены. У мысли одно основное размещение и необязательные связи. Сфера жизни — не проект; проект имеет ограниченный результат и состояние.

Ноль подходящих направлений, проектов, связей, дублей или противоречий — нормальный результат. Нельзя выдумывать сущности. Различай корректную ссылку, честную неопределённость `unresolved` и повреждённую/устаревшую ссылку. `Unresolved` хранится во «Входящих» и не считается ошибкой.

AI рекомендует, но не принимает важные решения. AI-связь сначала «предложена». Внешние действия требуют подтверждения. Сохраняй причины, альтернативы, сомнения, решения и результаты.

## Целевой конвейер

Этапы независимы: preflight; смысл и тип; embeddings; кластеризация; области/направления; проекты и placement либо `unresolved`; численные кандидаты; связи; дубли; противоречия; следующий шаг. У каждого этапа свои вход, выход, валидация, checkpoint и трасса.

## State-core и хранение

Phase 1A фиксирует immutable identity, typed state machine, deterministic replay, compatibility guards, authorization, idempotency, stale revision, progress/save/pause/failure/block/abandonment, clean-run isolation и отдельные unresolved/damaged reference.

Phase 2A/2B фиксируют `mindmap-state-core-v1*`, atomic events/aggregate/artifacts/receipt, transaction completion, stale-writer guard, reopen idempotency, workspace isolation, abort и failed-upgrade rollback.

Phase 2C-A фиксирует `mindmap-graph-v1`: payloads, thoughts, typed hierarchy, placement/unresolved, link lifecycle, embeddings и damaged references. Graph mutations атомарны и event-sequenced; proposed links не подтверждаются автоматически; corrupted state блокирует запись; run-only database не расширяется скрыто.

Target-Mac и GitHub harness использовали разные fixtures, поэтому абсолютные snapshot hashes не сравниваются. Внутри каждого fixture close/reopen equality пройдена. Same-fixture cross-environment equality остаётся непокрытой.

## Phase 2C-B

Phase 2C-B разделена на два независимых gate.

### B0 — deterministic mapping contract

Реализована в PR #40 только на sanitized fixtures. B0 задаёт versioned mapping `phase2cb-mapping-v1`, exact source/target identities, explicit unresolved/damaged handling, quarantined run history, typed stops и B1 rollback/diagnostic contract. B0 не открывает SQLite, не создаёт target и не вызывает модели.

Pre-documentation exact-tree CI/artifact gate прошёл на private head `69429ee80d7be0425501054ed54f3052867c9968` / public head `8fc83312f71a29ec50fd57659fb39ff9ae5c0784`, shared tree `ada806f53d27c83a3375aa4fd01879d0dca48881`. B0 ещё не принята: final repository metadata и Drive readback завершены; обязательны exact final-head rerun, merge и post-merge provenance.

### B1 — exact-source isolated dry run

Заблокирована до принятия B0. После отдельного gate B1 сможет открыть exact accepted source только read-only и писать только в fresh isolated temporary target. Source hash до/после должен совпасть; repeat run должен дать тот же target hash; любой stop/failure обязан оставить no partial target. Actual target-Mac migration этим не разрешается.

## Восстановление и AI-расход

После микроэтапа сохраняй результат, время, run ID, версии, модель или «без AI», входные/выходные ID и целостность. Частичный checkpoint не заменяет полное состояние. Диагностика, миграция и восстановление выполняются без AI.

Перед AI-вызовом сохраняй причину, этап, модель, run ID, attempt, вход, ожидаемый результат и восстановимость. После ошибки, перезагрузки, зависания или обновления версии повтор запрещён без подтверждения пользователя. Сначала — офлайн-диагностика.

## Наблюдаемость — REQ-OBS-001

Любой длительный AI- или локальный микроэтап показывает: название и тип; время и объём; последнее продвижение и heartbeat; состояние; модель либо «без AI»; диагностику.

Таймер меняется только при реальном переходе и замораживается при паузе/ошибке/завершении. Недостоверный ETA запрещён. При stale heartbeat сообщай «возможно, процесс завис». Не перезапускай этап и не повторяй AI автоматически.

## Документация и выпуск

Google Drive — источник продуктовых документов; GitHub — кода и технической истории. После каждой версии обновляй статус, решения/ошибки/первопричины, требования, следующий шаг, README и версию. Документы считаются обновлёнными только после обратного чтения. Рассинхронизация блокирует выпуск.

Версия передаётся только после доказанной причины, регрессии, автоматических/миграционных/UI-проверок, визуального REQ-OBS-001, исключения неожиданных AI-вызовов, синхронизации документов/кода и проверки artifact exact commit. Зелёный job сам по себе недостаточен.

## Ближайший шаг

Завершить acceptance Phase 2C-B0: repository metadata и три canonical Google Docs уже синхронизированы и прочитаны обратно; теперь повторить exact final-head public CI/artifact inspection и слить PR #40 с exact provenance. До отдельного post-merge решения не открывать exact private source и не начинать B1.
