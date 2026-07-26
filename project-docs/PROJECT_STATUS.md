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

Legacy source remains private and immutable:

- size `5 070 848` bytes;
- SHA-256 `356b943275cce292d0e14f8a7fbe95af07e79de73f06d3e361874d342aa2f918`;
- 96 synthetic, 0 personal thoughts;
- integrity `ok`;
- write/migration/network/model calls — 0.

## Phase 2C-A — final gates passed, merge pending

PR #38 implements canonical graph/payload contracts and native IndexedDB graph storage.

Verified code head:

```text
02df8758a7c42b33b22b397dae74445cd6a5f7ac
```

Private head before the final documentation update:

```text
85b158ebed11f494fe7e4766453693de01d75bfe
```

Accepted behavior within the current evidence boundary:

- content-addressed thought payloads;
- typed area → direction → project hierarchy;
- exactly one placement or explicit `unresolved` per thought;
- proposed/confirmed/rejected link lifecycle;
- embeddings bound to exact thought content hash/model/dimensions;
- damaged references separate from unresolved;
- atomic event batch + materialized graph + receipt;
- deterministic replay and reopen-stable snapshot hash;
- stale-revision/idempotency conflict rejection;
- workspace isolation, abort rollback and corruption refusal;
- coexistence with the accepted run adapter in a fresh unified database;
- refusal to silently upgrade a run-only database.

### Target-Mac proof

Real Chrome IndexedDB passed atomic commit, reopen, idempotency, workspace isolation, run-adapter compatibility, abort rollback, run-only refusal, schema metadata, corruption detection and link lifecycle.

Local snapshot hash:

```text
ee7f14540dbc394654b81e1724dc35b0b01f8d13f303ab03a157e5c1079b4fc1
```

The macOS privacy warning remains an unresolved environmental anomaly; no `/Applications` write path exists in the runner source.

### Public CI mirror

The private runner blocker was proven to be exhausted private Actions minutes, not a test failure. A separate public history-free snapshot passed:

- verify `30196934408`;
- package-source `30196934411`;
- Linux full, lint, complete tests;
- GitHub-hosted macOS launchers;
- actual Chrome run-storage and graph-storage;
- source/exporter packaging.

Snapshot provenance:

```text
private source: 85b158ebed11f494fe7e4766453693de01d75bfe
public commit:  f4f7d3a127fd0ed3c09431f24ade3acd73b78810
tree:           5c7dc8a0cf607ce24f591ba91c4431d30f035f51
digest:         7fa3dc7f0fedcd8b6f96d309fecb178a1e6d1a3b7919eec928809be5ea6988f4
```

Downloaded artifacts:

- outer source `c26b5d16138713b69eba3aedba1d84512cac8e0c9429a598921a8ead8fab1c67`;
- inner source `ce8dded192e282a15faf652e2dd9b68aec4fd045403ef5a6027c4e25f155c45b`;
- inner exporter `fcc1c4522d3151b4884df2cf32bde6dc0c34279ced4bf0c22266216414d431c8`;
- browser proof `bdb578601f74b7214b8a51c0d3a3c1b1d8b6bab47f79a555d554ec7a504dbb31`.

Privacy/credential findings: `0`.

The local and GitHub harnesses use different deterministic fixtures, so their absolute snapshot hashes are not expected to match. Reopen equality passed inside each fixture. Same-fixture cross-environment equality remains uncovered.

### Drive

Three canonical Drive documents were updated and reverse-read:

- instruction revision `AIroW379xc8qrT6UxiJg722b6cW5MN6sLIh1gK6Lnm3V4AKoq-8Co7w_hg0xuuz--a0HDeLlgo3iLE0Slrw-CxIab5qrmJZiU1iaqJmzEE8`;
- status revision `AIroW36MA-FzprvDJ93NZDney89F4rNOr_Lj-0l-DxgpxPf-ZMDMd2AmuyIYvueFBb0yb3utGjeeO5EkfoeWpXn3NCsnoJNsVSotZZdtg-Y`;
- recovery revision `AIroW35fvugGJYnXlnAUOruMPEUqNQ8RXTw83EFnefU8YXp8kd3peGkkYBd9XzB2raJ9EwuEHZL_tDW8Q92ppCJ3izgavGiBTYhqoWt1T9E`.

### Final documentation gate regression

Первый PR-trigger финального documentation tree (`verify` `30198335321`, `package-source` `30198335318`) остановился на release-doc check до browser harness. Хранилище и macOS-тесты не падали. Root cause: case-sensitive marker ожидал `same-fixture...`, а README содержал `Same-fixture...`. Проверка исправлена на фактический обязательный marker; этот же gate остаётся регрессией против повторной рассинхронизации.

## Не доказано

- merge provenance PR #38;
- same-fixture cross-environment snapshot equality;
- Phase 2C-B exact-source dry run;
- source byte-stability and deterministic migrated target;
- target-Mac production migration;
- production runtime/UI integration;
- REQ-OBS-001 in the new runtime;
- service-level exactly-once model execution;
- semantic quality, multi-order stability and personal-data safety.

## Стоп-линия

Запрещены Candidate 5, Qwen/DeepSeek, Candidate 6, legacy write/repair, Phase 2C-B до acceptance Phase 2C-A, actual target-Mac migration, runtime/UI integration и реальные данные.

## Следующий проверяемый шаг

Создать точный final documentation head, зеркально проверить его в public CI, скачать и проверить final artifacts, затем squash-merge PR #38 с expected-head guard. После merge отдельно записать merge provenance в GitHub и Drive и прочитать Drive обратно. Только после этого разрешается планирование Phase 2C-B; actual migration остаётся запрещённой.
