# MindMap — решения и статус

Дата актуализации: 2026-07-26.

## Назначение

Персональная local-first AI-система: мысль → понимание → связи → приоритет → решение → действие → результат → память.

Alpha.19 остаётся замороженным legacy-прототипом и не принимает реальные мысли.

## Принятые этапы

- Phase 0 exact source: `850a5fc60a154047eae1f6a5d4f63c7969ae8412`;
- Phase 1A pure state-core: `e7b7593932614f8dfa843298f35eff0230c1e827`;
- Phase 2A storage contract: `aa5eaaae08a3da4d0ff00ea03aea12b793137a21`;
- Phase 2B native IndexedDB run storage: `b4b35dcd7125c820f75f89387bc18ac3fa509cb0`;
- Phase 2C-A graph/payload storage: `292634312ad04fa6e6cfc5a5ded311ac1020094d`.

Legacy source remains private and immutable:

- size `5 070 848` bytes;
- SHA-256 `356b943275cce292d0e14f8a7fbe95af07e79de73f06d3e361874d342aa2f918`;
- 96 synthetic, 0 personal thoughts;
- integrity `ok`;
- write/migration/network/model calls — 0.

## Phase 2C-A — принята

PR #38 squash-merged from exact reviewed head:

```text
reviewed head: 29a317b58cbecaea13e4f21c02af2b945a6e6edc
merge:         292634312ad04fa6e6cfc5a5ded311ac1020094d
```

Приняты canonical graph/payload contracts и native IndexedDB graph storage:

- payloads, thoughts, typed hierarchy;
- placement либо explicit `unresolved`;
- proposed/confirmed/rejected links;
- embeddings bound to exact text;
- damaged references separately;
- atomic event/materialized-state/receipt transaction;
- deterministic replay and reopen-stable hash;
- stale/idempotency guards;
- workspace isolation, abort rollback and corruption refusal;
- fresh unified run+graph database;
- run-only database refusal.

### Финальная проверка

Exact public counterpart:

```text
public head: ee5401a4a2ca7763467562417b9c5c4aece01214
shared tree: e81ae1b309a806f0078b5a8a2057f51d4c0e403d
```

- verify `30198811851` — success;
- package `30198811852` — success;
- Linux/macOS/full tests/actual Chrome/package — passed;
- outer artifact `2184324939c12db0af27ad913904d953b0ee5b5f73b1c7e85c580f020263688c`;
- inner source `81d469a6eb53908b1c863c8643598a1953bffa8392174d9e1292b3a1e2058c3b`;
- inner exporter `1388fbc608d27c6d446646c84fd7c29ab59a76ed3e587a4b41f803b901b32109`;
- browser proof `5c63ffa99679b9cff87d8c82b16d7d4f31080e3bbbc6c7c1a218e8cbe1ddb755`;
- privacy/credential/data findings — 0.

Drive после merge обновлён и прочитан обратно:

- instruction `AIroW37ZYyE_aMLJxvUodCy1o2WnLjd_tUMJTp94Bzpm6pz-hhRp9RqMXgiZ2WRefBFDz1TGrQG6CsmnkGHpnTuyEq1c-1duUZCUDvaop3E`;
- status `AIroW36BDxK0THdoc-SlGQ3zq2CtBoPdpwJ7zjGcXzvKZKrrIqU_baZXfnNi1ZqFIlT8oRYmJDKor_N-MhawbIZjEhEkCCC9RWkXs4cIoF0`;
- recovery `AIroW35Q8r2B6M35cMS0OBUjGWp2HtXfscrHknyRRLjwcTgYoBC4lub293D009ujIgGpodrxiTPn0kaCZAm1DpdfU3YwWwji8BA-DUVZSXU`.

### Исправленные причины финального gate

1. Release-doc marker был регистрозависим: ожидал `same-fixture`, README начинал предложение с `Same-fixture`. Исправлен сам gate; storage-код не падал.
2. Первый внешний privacy regex сопоставил два документационных шаблона пути, а не реальные пути. Формулировки уточнены; повторный scan дал ноль concrete local user-home findings.

## Границы доказательства

Не доказаны:

- same-fixture cross-environment snapshot equality;
- Phase 2C-B migration dry run;
- source byte-stability и deterministic migrated target;
- actual target-Mac migration;
- production runtime/UI и REQ-OBS-001;
- service-level exactly-once model execution;
- semantic quality, multi-order stability и personal-data safety.

## Стоп-линия

Разрешены только planning/implementation Phase 2C-B в отдельном issue/branch/PR и тесты на exact read-only source package + isolated temporary target.

Запрещены Candidate 5, Qwen/DeepSeek, Candidate 6, legacy write/repair, actual target-Mac migration, runtime/UI integration и реальные мысли.

## Следующий проверяемый шаг

Открыть Phase 2C-B от accepted `main`. Сначала зафиксировать versioned deterministic mapping и typed stops; затем доказать isolated dry run, source byte-stability, repeatability, deterministic target hash и full rollback. Успех dry run не разрешает actual migration автоматически.
