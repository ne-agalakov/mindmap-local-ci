# MindMap — решения и статус

Дата актуализации: 2026-07-27.

## Назначение

Персональная local-first AI-система: мысль → понимание → связи → приоритет → решение → действие → результат → память.

Alpha.19 остаётся замороженным legacy-прототипом и не принимает реальные мысли.

## Принятые основания

- Phase 0 exact source: `850a5fc60a154047eae1f6a5d4f63c7969ae8412`;
- Phase 1A pure state-core: `e7b7593932614f8dfa843298f35eff0230c1e827`;
- Phase 2A storage contract: `aa5eaaae08a3da4d0ff00ea03aea12b793137a21`;
- Phase 2B native IndexedDB storage: `b4b35dcd7125c820f75f89387bc18ac3fa509cb0`;
- Phase 2C-A graph/payload storage: `292634312ad04fa6e6cfc5a5ded311ac1020094d`;
- Phase 2C-B0 deterministic mapping: `dbf2484c78e4eedcbb2efb3f0b61394b79a6d216`;
- B1 execution plan: `8a8c0eb522fb9d7646f4e6c4c4e0da2fcdf24b8b`;
- Phase 2C-B1a sanitized executor/harness: `aec5edaca877cec5d769f4ce4efff674a9c92a7d`.

Legacy exact source остаётся private и immutable: `5 070 848` bytes, SHA-256 `356b943275cce292d0e14f8a7fbe95af07e79de73f06d3e361874d342aa2f918`, 96 synthetic и 0 personal thoughts.

## Phase 2C-B1a — принята

PR #43 squash-merged как `aec5edaca877cec5d769f4ce4efff674a9c92a7d`.

```text
final private head: c1237b9ba012d60dc720bf940082c7d8e88f4e1e
public exact head:  667b218b8bf863c45ae074db65a314e77786f8d0
shared tree:        58d2bb0e9b7edebb3d3d830064406feffbff5181
```

Доказано на sanitized fixtures: physical read-only SQLite, source byte stability, repeat plan/target hash equality, actual Chrome IndexedDB temporary targets, injected rollback, typed stops, no automatic retry, REQ-OBS и ноль network/model calls.

## Phase 2C-B1b — package gate выполнен, локальный запуск не выполнен

Артём 27 июля 2026 года явно разрешил ровно один exact-source read-only B1b dry run. Разрешение не включает actual migration и пока не израсходовано.

Code-head до финального документационного коммита:

```text
private implementation head: d477203bbdf226e3252f741b31c9d45acf1b1499
public exact-tree head:       47876e8b35a8b7c93903f82022a28eab64f02d53
shared implementation tree:   ad431eaed0945039371011df1be0c989a634b050
```

Проверочные run:

- verify `30281649255` — success;
- package-source `30281649234` — success;
- Linux lint/full suite — passed;
- macOS launchers/tests — passed;
- actual Chrome run-storage, graph-storage, B1a и B1b rehearsal — passed.

Проверенные артефакты code-head:

- outer package artifact `f245504d04948671343c4552d7a1da24edc2cf72f99a6980e3fcdcd64263b172`;
- one-shot ZIP `f00e402fdd0e14ff559046d4a9911be97464d5e44d653cafa84a58fb3109b144`;
- B1b browser proof `6891d5ee2cb1cade845ae77e7d9a52aba9736c7e7ae1070f0010188ad52e562e`.

Внешняя проверка package подтвердила семь ожидаемых файлов, launcher `0755`, portable SHA-256, отсутствие `.sqlite`, diagnostic payload, dependencies, secrets и private strings. Встроенные repository, commit и tree согласованы.

## Журнал решений, ошибок и первопричин B1b

1. Package script использовал outer-PR `GITHUB_SHA`; в fixture это мог быть недоступный merge commit. Исправление: commit/tree выводятся из фактического checkout HEAD, явное несовпадение блокируется.
2. Metadata могла сочетать private repository с public-mirror commit. Исправление: repository/commit provenance формируется согласованно, fixture использует явный override.
3. Vite harness ссылался на `/src/page.ts`, хотя entry находится в `/page.ts`. Исправление и отдельная regression добавлены.
4. Ни один из этих дефектов не касался exact SQLite, migration semantics или модели: exact source не открывался, targets не создавались, network/model calls = 0.

## Требования и инварианты текущего gate

- принимается только source размером `5 070 848` bytes и SHA-256 `356b943275cce292d0e14f8a7fbe95af07e79de73f06d3e361874d342aa2f918`;
- SQLite открывается только read-only/query-only после freeze manifest;
- создаются только fresh isolated temporary targets с pattern `mindmap-state-core-v1-phase2cb-b1-<run-id>-{first|second|rollback}`;
- выполняются два чистых прохода и один injected rollback;
- source hash до/после обязан совпасть;
- automatic retry запрещён;
- external network и model calls запрещены;
- actual migration и production namespace запрещены;
- exact source и raw payload никогда не входят в Git или artifact.

## Граница доказательства

Подготовка package и sanitized rehearsal доказаны. Не доказаны и не выполнены:

- локальный exact-source B1b dry run на целевом Mac;
- source read/result against the exact private SQLite;
- actual target-Mac migration;
- production runtime/UI integration;
- service-level exactly-once model execution;
- semantic quality, multi-order stability и real-data readiness.

## Следующий проверяемый шаг

Завершить exact-tree CI и внешний artifact review финального documentation head. После этого запустить проверенный package ровно один раз на целевом Mac, выбрать только exact SQLite и скачать sanitized evidence. При ошибке повтор не выполнять. Сначала определить первопричину по evidence. Actual migration остаётся отдельным последующим gate.