# MindMap — решения и статус

Дата актуализации: 2026-07-26.

## Назначение

Персональная local-first AI-система: мысль → понимание → связи → приоритет → решение → действие → результат → память.

Alpha.19 остаётся замороженным legacy-прототипом и не принимает реальные данные.

## Принятые этапы

- Phase 0 exact source: merge `850a5fc60a154047eae1f6a5d4f63c7969ae8412`;
- Phase 1A pure state-core: merge `e7b7593932614f8dfa843298f35eff0230c1e827`;
- Phase 2A storage contract/ADR: merge `aa5eaaae08a3da4d0ff00ea03aea12b793137a21`;
- Phase 2B native IndexedDB adapter: merge `b4b35dcd7125c820f75f89387bc18ac3fa509cb0`.

Legacy source остаётся приватным и неизменным:

- size `5 070 848` bytes;
- SHA-256 `356b943275cce292d0e14f8a7fbe95af07e79de73f06d3e361874d342aa2f918`;
- 96 synthetic, 0 personal thoughts;
- integrity `ok`;
- write/migration/network/model calls — 0.

## Phase 2B — принята

Final reviewed head:

```text
5a8b4f6a418b465da7383d7c999485bae1f9a900
```

Code head:

```text
2ced13b72d1f582028348bedc2ca6a7ef0e57246
```

Приняты:

- validated `mindmap-state-core-v1*` database names;
- legacy database refusal before `indexedDB.open`;
- atomic event batch + aggregate + artifacts + receipt transaction;
- transaction completion as commit signal;
- final revision/contentHash recheck across adapter instances;
- deterministic replay/content hash;
- reopen idempotency/conflict;
- synthetic/personal workspace isolation;
- abort rollback;
- failed schema-upgrade rollback;
- deterministic snapshot after reopen;
- одинаковый adapter в `fake-indexeddb` и actual Chrome.

Browser proof:

```text
atomicCommit: true
reopen: true
idempotency: true
workspaceIsolation: true
abortRollback: true
upgradeRollback: true
snapshotHash: 23c72cfd4768f5c76f0f376646fcbbd8a7630fb973e85704f460f19af6b27409
```

Первый browser failure был cleanup race после успешных assertions. Root cause: Chrome ещё удерживал temporary profile. Runner теперь ждёт завершения процессов; повторный gate прошёл.

Финальные доказательства:

- Linux, macOS, Chrome и packaging — passed;
- outer artifact `706a463af20e4cc1aaa956a8e0812376886e543e83f249aa1359b9ce673881c7`;
- inner source `9c338e5a3b4e13d8b81bdafcf592fab30fa9e7a41034b9c5e1a21fd25494e2c2`;
- inner exporter `e69444565228be51418a499f6d778fb91741b95f780f15c2fc8b3da850a2ebd9`;
- embedded commit exact;
- private/runtime/credential findings — 0;
- Drive после merge обновлён и прочитан обратно.

PR #17 остаётся закрытым unmerged research input.

## Phase 2C-A — реализована, но не принята

PR #38 реализует canonical graph/payload contract и native IndexedDB graph storage.

Проверенный code head:

```text
02df8758a7c42b33b22b397dae74445cd6a5f7ac
```

Реальный локальный Chrome на target Mac подтвердил:

```text
browserIndexedDb: true
atomicCommit: true
reopen: true
idempotency: true
workspaceIsolation: true
runAdapterCompatibility: true
abortRollback: true
runOnlyRefusal: true
corruption follow-up: integrity_mismatch
snapshotHash: ee7f14540dbc394654b81e1724dc35b0b01f8d13f303ab03a157e5c1079b4fc1
```

Привязка доказательства:

- proof JSON SHA-256 `5b47e3681a23474d21ee2f703c93a94a8f79d2b93c11e65642667ce8283b97bc`;
- offline runner ZIP `aef0111128e2182218081ef2fa5536e24bde3bc4383961455e5150c5ba559419`;
- harness `ecfee87cac41410a2d1f5b71f3c1a90303f53f42afcf3007c11dd33b6ba2231a`;
- npm/Vite/network/private data/model calls/migration — 0.

Во время запуска macOS показала предупреждение о блокировке попытки Terminal изменить приложения. В исходнике runner нет записи в `/Applications`; происхождение предупреждения не доказано. Оно зафиксировано как environmental anomaly и не превращено ни в доказанную ошибку кода, ни в проигнорированный факт.

GitHub Actions `verify` и `package-source`, включая ручной retry, завершились до первого шага. Step logs и artifacts отсутствуют. Причина инфраструктурного отказа не доказана. Поэтому GitHub gate остаётся красным, а локальное доказательство его не заменяет.

## Доказано Phase 2C-A

- focused actual-browser graph IndexedDB behavior на macOS;
- atomicity, reopen, idempotency, workspace isolation и rollback;
- совместимость run adapter с fresh unified database;
- corruption detection и запрет дальнейшей записи;
- link proposal lifecycle;
- отсутствие private/model/migration действий в proof runner.

## Не доказано

- full test/lint на exact final PR head в GitHub Actions;
- Linux и GitHub-hosted macOS gates;
- GitHub browser artifact;
- source/exporter packaging artifact review;
- Drive synchronization и reverse read для Phase 2C-A;
- merge provenance PR #38;
- Phase 2C-B exact-source dry run;
- target-Mac production migration;
- production runtime/UI integration;
- REQ-OBS-001;
- service-level exactly-once model POST;
- semantic quality, multi-order stability и personal-data safety.

## Стоп-линия

Запрещены Candidate 5, Qwen/DeepSeek, Candidate 6, legacy write/repair, Phase 2C-B до acceptance Phase 2C-A, actual target-Mac migration, runtime/UI integration и реальные данные.

## Следующий проверяемый шаг

Восстановить рабочий GitHub Actions gate для PR #38. На exact final head пройти full verification и packaging, скачать и проверить artifact, синхронизировать Drive и прочитать документы обратно, затем merge с точным provenance. Только после этого можно разблокировать отдельную Phase 2C-B. Actual target-Mac migration остаётся запрещённой.
