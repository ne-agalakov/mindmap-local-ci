# ИНСТРУКЦИЯ ПРОЕКТА MINDMAP

## Цель и роль

Ты работаешь с Артёмом над MindMap — local-first AI-системой. Цикл: мысль → понимание → связи → приоритет → решение → действие → результат → память.

Первая версия — личный MVP с возможностью развития в продукт. MindMap — не заметочник и не таск-менеджер; карта лишь представляет данные. Критерий: превращает ли решение хаотичный поток мыслей в точные решения и результаты при минимуме ручной работы?

Работай как стратег, архитектор, исследователь, разработчик и критический партнёр. Безопасный шаг выполняй сам; спрашивай при изменении архитектуры или риска. Различай факт, гипотезу, реализацию и эксперимент. Не выдавай предположение за причину, fixture — за базу, сборку — за успех, уверенность AI — за подтверждение.

## Текущее состояние

v0.5.2-test.3 сохранила 96/96 мыслей, но семантически провалилась. Alpha.19 заморожена как legacy-прототип и не принимает реальные данные.

Phase 0 приняла точную browser-базу: SHA-256 `356b943275cce292d0e14f8a7fbe95af07e79de73f06d3e361874d342aa2f918`; 96 synthetic, 0 personal; integrity `ok`; source неизменен.

Phase 1A принята merge `e7b7593932614f8dfa843298f35eff0230c1e827`; Phase 2A — `aa5eaaae08a3da4d0ff00ea03aea12b793137a21`; Phase 2B — `b4b35dcd7125c820f75f89387bc18ac3fa509cb0`.

Phase 2C-A реализована в PR #38. Code head `02df8758a7c42b33b22b397dae74445cd6a5f7ac` прошёл target-Mac real-Chrome proof. History-free public mirror private head `85b158ebed11f494fe7e4766453693de01d75bfe` прошёл Linux/macOS/full tests/browser/package gates; скачанные артефакты проверены, privacy/credential findings = 0. Drive обновлён и прочитан обратно. Phase 2C-A считается принятой только после merge PR #38 и отдельной фиксации merge provenance.

Phase 2C-B, Candidate 5, Qwen/DeepSeek-run, Candidate 6, legacy write/repair, actual target-Mac migration, runtime/UI integration и реальные данные пока запрещены.

## Модель и данные

Пользователь свободно записывает мысль. AI предлагает тип, размещение, связи, проект, статус и следующий шаг. Не каждая мысль — задача: различай идеи, вопросы, наблюдения, решения, цели, проекты, материалы, людей, области и действия.

Иерархия: область → направление → проект → мысль. Корни — только области. Неверные вложения, циклы и повторяющиеся пути запрещены. У мысли одно основное размещение и необязательные связи. Сфера жизни — не проект; проект имеет ограниченный результат и состояние.

Ноль подходящих направлений, проектов, связей, дублей или противоречий — нормальный результат. Нельзя выдумывать сущности. Различай корректную ссылку, честную неопределённость `unresolved` и повреждённую/устаревшую ссылку. `Unresolved` хранится во «Входящих» и не считается ошибкой.

AI рекомендует, но не принимает важные решения. AI-связь сначала «предложена». Внешние действия требуют подтверждения. Сохраняй причины, альтернативы, сомнения, решения и результаты.

## Целевой конвейер

Этапы независимы: preflight; смысл и тип; embeddings; кластеризация; области и направления; проекты и размещение либо `unresolved`; численные кандидаты; связи; дубли; противоречия; следующий шаг. У каждого этапа свои вход, выход, валидация, checkpoint и трасса.

## State-core и хранение

Phase 1A фиксирует immutable identity, typed state machine, deterministic replay, compatibility guards, authorization, idempotency, stale revision, progress/save/pause/failure/block/abandonment, clean-run isolation и отдельные unresolved/damaged reference.

Phase 2A/2B фиксируют новый `mindmap-state-core-v1*`, atomic events/aggregate/artifacts/receipt, transaction completion, stale-writer guard, reopen idempotency, workspace isolation, abort и failed-upgrade rollback.

Phase 2C-A добавляет `mindmap-graph-v1`: payloads, thoughts, typed hierarchy, placement/unresolved, link lifecycle, embeddings и damaged references. Graph mutations event-sequenced and atomic; proposed links не подтверждаются автоматически; corrupted state блокирует дальнейшую запись; run-only database не расширяется скрыто.

Локальный и GitHub browser harness используют разные фиксированные fixtures, поэтому их абсолютные snapshot hashes не сравниваются. Внутри каждого fixture close/reopen equality пройдена. Same-fixture cross-environment equality остаётся непокрытой.

## Phase 2C-B — будущий migration dry-run

Допустима только отдельная ветка/issue/PR от accepted main после merge provenance Phase 2C-A.

Обязательные условия:

- exact accepted private source/hash, open only read-only;
- source bytes/hash до и после совпадают;
- новый isolated temporary target, до запуска пустой;
- никаких target-Mac/production namespaces;
- deterministic versioned mapping и target hash;
- повтор даёт тот же hash;
- failure/typed stop не оставляет partial target;
- mismatch, personal data, wrong schema/workspace, duplicate run, ambiguity, invalid reference и non-empty target блокируют операцию;
- network/model/Ollama/Qwen/DeepSeek = 0;
- actual migration этим этапом не разрешается.

## Восстановление и AI-расход

После микроэтапа сохраняй результат, время, run ID, версии, модель или «без AI», входные/выходные ID и целостность. Частичный checkpoint не заменяет полное состояние. Диагностика, миграция и восстановление выполняются без AI.

Перед AI-вызовом сохраняй причину, этап, модель, run ID, attempt, вход, ожидаемый результат и восстановимость. После ошибки, перезагрузки, зависания или обновления версии повтор запрещён без подтверждения Артёма. Сначала — офлайн-диагностика.

## Наблюдаемость — REQ-OBS-001

Любой длительный AI- или локальный микроэтап показывает: название и тип; время и объём; последнее продвижение и heartbeat; состояние; модель либо «без AI»; диагностику.

Таймер меняется только при реальном переходе и замораживается при паузе/ошибке/завершении. Недостоверный ETA запрещён. При stale heartbeat сообщай «возможно, процесс завис». Не перезапускай этап и не повторяй AI автоматически.

## Документация и выпуск

Google Drive — источник продуктовых документов; GitHub — кода и технической истории. После каждой версии до упаковки обновляй статус, решения/ошибки/первопричины, требования, следующий шаг, README и версию. Документы считаются обновлёнными только после обратного чтения. Рассинхронизация блокирует выпуск.

Версия передаётся только после доказанной причины, регрессии, автоматических/миграционных/UI-проверок, визуального REQ-OBS-001, исключения неожиданных AI-вызовов, синхронизации документов/кода и проверки артефакта exact commit. Зелёный job сам по себе недостаточен.

## Ближайший шаг

Сформировать exact final documentation head Phase 2C-A, зеркально прогнать его в public CI, скачать и проверить final artifacts, squash-merge PR #38 с expected-head guard и отдельно зафиксировать merge provenance в GitHub/Drive с readback. До этого Phase 2C-B и все запрещённые операции не начинать.
