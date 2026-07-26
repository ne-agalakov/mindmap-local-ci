# MindMap — восстановление и бюджет локальной модели

Статус: обязательный инженерный протокол. Актуально для v0.6-alpha.19 и нового state-core.

## Основное правило

Локальная модель не компенсирует ошибки кода, миграции или восстановления. Повторный AI-запрос допустим только после доказательства, что нужного ответа нет в сохранённых данных, и после отдельного подтверждения Артёма.

Для deterministic-code и storage/migration ошибок повтор модели запрещён; сначала read-only диагностика.

## Принятый legacy-источник

- size `5 070 848` bytes;
- SHA-256 `356b943275cce292d0e14f8a7fbe95af07e79de73f06d3e361874d342aa2f918`;
- evidence SHA-256 `51e3d9563b09c91427716eee559745fed35d729e9ffd71f180afa91c3fc7aa2b`;
- export/inspection `readonly`;
- bytes modified false;
- write/migration/network/model calls 0;
- integrity `ok`;
- 96 synthetic, 0 personal thoughts.

Raw source остаётся приватным и не помещается в Git.

## Принятые этапы

- Phase 1A merge `e7b7593932614f8dfa843298f35eff0230c1e827` — pure state-core;
- Phase 2A merge `aa5eaaae08a3da4d0ff00ea03aea12b793137a21` — transactional storage contract;
- Phase 2B merge `b4b35dcd7125c820f75f89387bc18ac3fa509cb0` — native IndexedDB adapter.

## Принятые Phase 2B recovery invariants

- validated `mindmap-state-core-v1*` database names;
- legacy name отклоняется до open;
- event batch, aggregate, artifacts и receipt находятся в одной transaction boundary;
- commit успешен только после transaction completion;
- abort после queued requests не оставляет partial state/receipt;
- persisted revision и contentHash повторно проверяются внутри write transaction;
- stale concurrent writer блокируется;
- idempotency receipt переживает close/reopen;
- conflict с тем же key и другим payload блокируется;
- synthetic/personal workspace разделены compound keys;
- failed schema upgrade сохраняет previous readable version;
- snapshot hash стабилен после reopen.

Actual Chrome proof:

```text
atomicCommit: true
reopen: true
idempotency: true
workspaceIsolation: true
abortRollback: true
upgradeRollback: true
snapshotHash: 23c72cfd4768f5c76f0f376646fcbbd8a7630fb973e85704f460f19af6b27409
```

Первый browser failure был cleanup race после успешных assertions; runner теперь ждёт завершения Chrome/server перед cleanup.

Финальный reviewed head `5a8b4f6a418b465da7383d7c999485bae1f9a900`; outer artifact `706a463af20e4cc1aaa956a8e0812376886e543e83f249aa1359b9ce673881c7`; inner source `9c338e5a3b4e13d8b81bdafcf592fab30fa9e7a41034b9c5e1a21fd25494e2c2`; inner exporter `e69444565228be51418a499f6d778fb91741b95f780f15c2fc8b3da850a2ebd9`.

## Phase 2C — migration dry-run protocol

Разрешается только isolated temporary-target dry run.

Обязательные инварианты:

- source package соответствует exact accepted hash/size;
- source открывается read-only;
- source hash/bytes до и после идентичны;
- personalThoughtCount = 0 и workspace = synthetic;
- target namespace новый, временный и пустой;
- target не совпадает с production/target-Mac namespace;
- deterministic mapping фиксируется как versioned contract;
- target snapshot/content hash сохраняется;
- повторный dry-run даёт тот же target hash;
- source mismatch, personal data, wrong schema/workspace, duplicate run, ambiguity, invalid reference и non-empty target дают typed stop;
- injected failure откатывает target целиком;
- network/model/Ollama/Qwen/DeepSeek calls = 0;
- actual target-Mac migration не выполняется и не разрешается.

## Наблюдаемость — REQ-OBS-001

Любая длительная операция показывает название и тип, время и объём, последнее продвижение и heartbeat, состояние, модель или «без AI», скачивание диагностики. Таймер замораживается при паузе/ошибке/завершении. Автоматический перезапуск и AI-повтор запрещены.

## Минимальные dry-run регрессии

- exact source SHA mismatch блокирует planning/import;
- source остаётся byte-identical;
- target до запуска обязан быть пустым;
- event batch/aggregate/artifacts/receipt атомарны;
- failure не оставляет partial target;
- repeat dry-run даёт тот же target hash;
- synthetic не попадает в personal workspace;
- ambiguous/damaged references не маскируются;
- diagnostics/migration имеют zero model/network calls;
- dry-run не изменяет target-Mac storage.

## Стоп-линия

Запрещены Candidate 5, Qwen/DeepSeek, Candidate 6, legacy write/repair, actual target-Mac migration, runtime/UI integration и реальные данные.

## Выпуск

Phase 2C должна пройти отдельный issue/PR, exact fixture/hash, rollback/repeatability tests, Linux/macOS CI, downloaded-artifact review, Drive readback и merge provenance. Dry-run success не разрешает actual migration автоматически.
