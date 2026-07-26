# Alpha.19 — verification report

## Inputs

- User archive: `mindmap-local-v0.6-alpha.18 2.zip`.
- User diagnostics: `mindmap-diagnostics-2026-07-23.json`, embedded version
  `0.6.0-alpha.18`, 133 journal events.

## Proven facts

1. The saved run is `v06-run-03-1784797750173` and historically belongs to
   `qwen3:8b`.
2. Events 131–132 are offline candidate calculation and an intentional pause:
   `engine: offline`, `zeroModelCalls: true`, candidate count 2.
3. After reload Alpha.18 displayed `modelLabel: qwen3:8b` for that offline stage.
4. Root cause in Alpha.18: startup restoration called `latestRunModel(...)` and
   passed the last historical Ollama model into every restored checkpoint.
   `observationFromCheckpoint(...)` also hard-coded `workKind: local`.
5. A run started with Qwen cannot be continued under DeepSeek without mixing
   models. Alpha.18 checked the mismatch only after the next AI response, so one
   model call could be wasted before stopping.

## Changes in Alpha.19

- Restored checkpoint work type and model label are derived from stage and
  checkpoint semantics.
- Offline hierarchy and candidates show `local` / `без AI`.
- Embeddings show `embeddinggemma`; AI stages show the saved run model.
- A local GET endpoint reports the configured launcher model without calling
  Ollama.
- Candidate continuation compares configured model with the saved run model
  before any AI POST. Mismatch stops with `AI-вызов не выполнен`.
- Normal AI-stage failures preserve their AI work type instead of being
  mislabeled as local merely because the journal terminal event is offline.
- `npm test` explicitly enables Node type stripping for the declared Node 22.13+
  engine range.

## Automated evidence

- Exact replay of the user diagnostics through Alpha.19 restoration returns:
  `stage: candidates`, `status: paused`, `workKind: local`, `modelLabel: без AI`.
- Focused regression set: 65/65 passed.
- Full source test set before production build: 100/101 passed. The only failure
  was `rendered-html.test.mjs` because `dist/server/index.js` is created by the
  production build.
- Production build was not completed in this Linux sandbox because the uploaded
  `node_modules` contains the Mac ARM64 Rolldown binding, while Linux requires
  `@rolldown/binding-linux-x64-gnu`. The dependency installer then received HTTP
  503. This is an environment limitation, not evidence of a successful build.

## Release blockers

- No production build on the target Mac yet.
- No visual REQ-OBS-001 verification on the user's preserved IndexedDB.
- The DeepSeek-launcher mismatch block has not yet been observed in the real UI.
- Google Drive Markdown replacement was rejected because the connector required
  a connector-file reference; Drive remains synced to Alpha.18.
- The supplied archive contains no `.git` history, so the package cannot be tied
  to a verified commit.

Alpha.19 is therefore a test candidate, not a released version.

## Packaging regression found on the target Mac

The first Alpha.19 candidate did not start on the user's Mac. The archive
contained `@rolldown/binding-darwin-arm64/rolldown-binding.darwin-arm64.node`,
but macOS Gatekeeper blocked that downloaded native file because it inherited
the browser quarantine attribute. Rolldown then reported fallback
`MODULE_NOT_FOUND` errors.

Candidate 2 fixes the launcher rather than asking the user to run Terminal
commands. Before Node loads Vite, the launcher removes `com.apple.quarantine`
only from `.node` and `.dylib` files inside this project's `node_modules`, then
performs an explicit Mac ARM64 Rolldown load check. This launch check does not
call Ollama or the semantic pipeline.

Regression coverage: `tests/macos-launcher.test.mjs` checks that quarantine
removal is scoped to native dependencies, occurs before `npm run dev`, and that
the Rolldown preflight is present.

## Candidate 2 automated evidence

- Launcher regression tests: 2/2 passed.
- Full source test invocation: 102/103 passed. The single failure remains the
  production-render test because `dist/server/index.js` has not been built in
  the Linux sandbox.
- Shell syntax validation for both launchers passed.
- The corrected archive preserves executable permissions on both `.command`
  files.
## Candidate 4 — модель лаунчера не доходила до server route

На целевом Mac candidate 3 восстановил checkpoint корректно, но при попытке
продолжения показал подтверждение отправки в `qwen3:8b`, хотя был запущен
`start-mindmap-deepseek.command`. Нажатие `OK` не выполнялось.

Первопричина: `OLLAMA_MODEL` экспортировалась shell-лаунчером, однако
Cloudflare/Vite server route читал `process.env.OLLAMA_MODEL` в отдельной worker-
среде и получал fallback `qwen3:8b`. Поэтому предварительная проверка сравнивала
Qwen-run с Qwen и не блокировала продолжение.

Исправление candidate 4: до запуска Vite лаунчер детерминированно записывает
выбранную модель в `app/lib/runtime-config.ts`. И GET-проверка, и оба AI-route
импортируют один и тот же модуль; `process.env.OLLAMA_MODEL` из route удалён.
Следовательно, DeepSeek-лаунчер обязан вернуть `deepseek-r1:8b` до любого AI POST
и заблокировать продолжение исторического Qwen-run.

Проверка: 40/40 целевых тестов и 103/103 исходных тестов без production-render
прошли. Production-render по-прежнему не засчитан в Linux без подходящего
нативного Rolldown binding; необходима визуальная проверка на Mac.

## Candidate 4 — фактическая проверка на целевом Mac

Проверено 25 июля 2026 года на сохранённой пользовательской IndexedDB без
очистки базы:

1. Candidate 4 запустился через `start-mindmap-deepseek.command`.
2. Восстановленный этап `candidates` показал `локальный расчёт`, состояние
   `приостановлен`, модель `без AI`, 96/96 мыслей и 2 локальных кандидата.
3. После единственного нажатия продолжения приложение сравнило историческую
   модель `qwen3:8b` с текущей `deepseek-r1:8b` и остановилось до AI POST.
4. Интерфейс явно сообщил `AI-вызов не выполнен`. Окно подтверждения отправки в
   Qwen, наблюдавшееся в candidate 3, не появилось.

Этим визуально подтверждены исправление ложной подписи модели, передача модели
лаунчера в server route и защита от смешивания моделей до AI-вызова. Семантика
связей при этом не проверялась: модель не вызывалась.

## Candidate 5 — закрепление защитного состояния

После успешной блокировки candidate 4 оставлял активной ту же кнопку
продолжения и предлагал начать чистый run только текстом. Это не приводило к
AI-вызову, но создавало повторяемое тупиковое действие и не давало безопасного
пути продолжения.

Candidate 5:

- сохраняет событие `batch_continuation_blocked` с обеими моделями, причиной и
  `zeroModelCalls: true`;
- восстанавливает блокировку после перезагрузки;
- отключает повторное продолжение несовместимого run;
- показывает отдельную кнопку чистого run на текущей модели в том же порядке;
- перед новым run повторно читает конфигурацию и требует подтверждение, прямо
  сообщая, что история прежнего run сохранится и новый AI-прогон начнётся только
  после подтверждения.

Автоматическая проверка candidate 5: 105/105 исходных тестов без
`rendered-html.test.mjs` прошли. Production-render не засчитан: в Linux-среде
нет полного набора устанавливаемых зависимостей и целевого Mac ARM runtime.
Требуется короткая визуальная проверка candidate 5 на Mac до запуска чистого
DeepSeek-run.

## Актуальный следующий шаг

Запустить candidate 5 в том же профиле Chrome. Убедиться, что сохранённая
блокировка восстанавливается, кнопка несовместимого продолжения отключена, а
доступен отдельный чистый run на `deepseek-r1:8b` в порядке `original`. После
явного подтверждения начать этот отдельный run. Старый Qwen-run сохранить как
контрольный; реальные личные мысли не загружать.

## Google Drive documentation sync

Candidate 5 переводит три актуальных продукта документа в нативные Google Docs,
поскольку connector не поддержал замену raw Markdown из локального sandbox.
Старые Alpha.18 Markdown-файлы сохраняются как архивы. Актуальные document ID
записаны в `DRIVE_SYNC.json`. Обратное чтение выполнено. Проверены маркеры candidate 5 во всех трёх
актуальных Google Docs, включая финальную строку статуса и защитные правила
`batch_continuation_blocked` / `zeroModelCalls: true`.

## GitHub baseline proof

Private repository `ne-agalakov/mindmap-local` is connected. Exact source
baseline commit: `f01508059abc1bd99f9a05527f16bb52e6a667ee`. CI and packaging
gate commit: `2c498d84007c8ba5c011cec881ba732de5721bc4`.

PR #2 passed Ubuntu install/lint/full tests and macOS launcher plus targeted
recovery/model-mismatch tests. The first Linux failure was traced to a
non-portable `rg` dependency in the release documentation gate; replacing it
with `grep -Fq` made the rerun green. No Ollama call or semantic run occurred.
GitHub provenance is therefore closed; runtime candidate 5 and semantic
stability remain separate unproven gates.

