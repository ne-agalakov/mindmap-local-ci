# MindMap — решения и статус

Дата актуализации: 2026-07-29.

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
- Phase 2C-B1a sanitized executor/harness: `aec5edaca877cec5d769f4ce4efff674a9c92a7d`;
- Phase 2C-B1b exact-source read-only dry run: принят и слит как `4fd14e515d2c4234f70effa475381f47bbb50e8b` 28 июля 2026 года;
- post-merge documentation: `e6bd47011fad2dab5a8617f5f754739de1915fd9`.

Legacy exact source остаётся private и immutable: `5 070 848` bytes, SHA-256 `356b943275cce292d0e14f8a7fbe95af07e79de73f06d3e361874d342aa2f918`, 96 synthetic и 0 personal thoughts.

## Phase 2C-B1a — принята

PR #43 squash-merged как `aec5edaca877cec5d769f4ce4efff674a9c92a7d`.

```text
final private head: c1237b9ba012d60dc720bf940082c7d8e88f4e1e
public exact head:  667b218b8bf863c45ae074db65a314e77786f8d0
shared tree:        58d2bb0e9b7edebb3d3d830064406feffbff5181
```

Доказано на sanitized fixtures: physical read-only SQLite, source byte stability, repeat plan/target hash equality, actual Chrome IndexedDB temporary targets, injected rollback, typed stops, no automatic retry, REQ-OBS и ноль network/model calls.

## Phase 2C-B1b — exact-source dry run принят

Единственная разрешённая попытка выполнена один раз на целевом Mac 28 июля 2026 года. Попытка израсходована; повтор запрещён без нового отдельного решения.

Пакет и run:

```text
package repository: ne-agalakov/mindmap-local-ci
package commit:     982cadbc62c42659aa567b803574e3e04066babc
package tree:       9b2d2588ba678f5c2bc5737687049be75c2ece96
authorization:      artem-2026-07-27-b1b-once
run ID:             b1b-20260728115431-22839
```

Санитизированные evidence-файлы:

```text
mindmap-phase2cb-b1b-evidence.json
size:   33 054 bytes
sha256: bcd8a88469b627591eea15c430539a2ca95307655b528364b96ab9c3fc0bc6b0

mindmap-phase2cb-b1b-run-manifest.json
size:   1 076 bytes
sha256: fcd3220fe64814d9a83171cc1ececcc7433d2b6fe5c848477d469afce3f202c7
```

Точная проверка source:

- размер до/после `5 070 848` bytes;
- SHA-256 до/после `356b943275cce292d0e14f8a7fbe95af07e79de73f06d3e361874d342aa2f918`;
- open mode `readonly`, `query_only = true`;
- `quick_check = ok`, `integrity_check = ok`;
- modification timestamp не изменился;
- source write performed = false.

Counts совпали с принятым контрактом:

```text
thoughts:          96
nodes:             30
links:              0
decisions:        133
embeddings:        96
runs:               3
personalThoughts:   0
unresolved:         1
damaged references: 0
```

Детерминированность двух чистых прогонов:

```text
portable plan hash:   d8a1289c6f1865db940f65e46aec569400b630aec3cc53bdfd897f223d2436a8
target snapshot hash: 6319ee79284b0ca1afc5fe93d53ef37b4a9c5f85c0c9634976afa1a4979f5689
```

Оба clean target записали три run и graph aggregate, получили одинаковые portable plan/target snapshot hashes и были удалены после evidence capture.

`mappingContentHash` у first/second/rollback различается ожидаемо: он включает различный isolated target database name. Межпрогонные gates — target-independent `portablePlanHash` и итоговый `targetSnapshotHash`; оба совпали.

Injected rollback:

- остановка `transaction_failure` после первого run commit attempt;
- `runCountCommitted = 1` до stop;
- `graphCommitted = false`;
- partial target/receipt отсутствуют;
- `rollbackTargetEmpty = true`;
- temporary namespace удалён.

REQ-OBS trace содержит freeze manifest, preflight hash, read-only extraction, planning, target freshness/creation, transactional progress, verification, source re-hash, cleanup и terminal state. На всех этапах `model = без AI`.

Границы B1b:

- external network calls = 0;
- model calls = 0;
- actual migration = false;
- production namespace = false;
- automatic retry = false;
- source bytes/raw thought text/node labels/source path/model payloads в evidence отсутствуют.

## Решение о принятии B1b

B1b принят строго как exact-source read-only dry-run gate. Доказаны точная идентичность и целостность source, неизменность source, два одинаковых детерминированных target результата, cleanup после injected failure, удаление временных target, REQ-OBS, ноль network/model calls и отсутствие actual migration.

Не доказаны и не разрешены:

- actual target-Mac migration;
- production namespace и promotion в рабочую базу;
- rollback production migration;
- runtime/UI integration;
- service-level exactly-once model execution;
- semantic quality, multi-order stability и real-data readiness;
- повтор B1b.

## Журнал решений, ошибок и первопричин B1b

1. Package script использовал outer-PR `GITHUB_SHA`; в fixture это мог быть недоступный merge commit. Исправление: commit/tree выводятся из фактического checkout HEAD, явное несовпадение блокируется.
2. Metadata могла сочетать private repository с public-mirror commit. Исправление: repository/commit provenance формируется согласованно, fixture использует явный override.
3. Vite harness ссылался на `/src/page.ts`, хотя entry находится в `/page.ts`. Исправление и отдельная regression добавлены.
4. Exact-source run подтвердил, что эти delivery-фиксы не скрывали ошибку migration semantics: source contract, repeatability, rollback cleanup и zero-call boundary прошли на точной базе.

## Финальное принятие B1b и merge provenance

```text
reviewed private head: 3e9660f2be6b57c8c0547c1fc4052d54ba8d0486
public CI head:        b69d41a580b1b9eee1c920836911eb6b12aa1e3b
shared reviewed tree:  0305705240750d2b2a8d687611261b8fd39c2610
squash merge:          4fd14e515d2c4234f70effa475381f47bbb50e8b
post-merge docs:       e6bd47011fad2dab5a8617f5f754739de1915fd9
```

Final public verify `30357519192` и package-source `30357516712` прошли Linux, macOS, full tests, actual Chrome и packaging. Downloaded outer artifact SHA-256 `7ca49574e1bba78c10d87cae8e9907d8ce0641f711c7ee957a4533bcd99f9747`; one-shot package SHA-256 `9eb330e45f6544471e4e65eceda0e2fc60c74a585f238fffab7b7e9434a75d8f`; B1b browser proof SHA-256 `224e38f3bcc160e256024e6308c4fe685f001a9d2f7cdf1b80bbdb74b9c43171`.

Google Drive status, project instruction и recovery protocol обновлены и прошли обратное чтение. Issue #45 закрыта как completed.

## Phase 2C-C0 — активный design gate

Issue #48 и draft PR #49 создают архитектуру actual migration без выполнения.

Созданы:

- `project-docs/architecture/ADR-0002_PHASE2CC_GENERATION_REGISTRY.md`;
- `project-docs/evidence/PHASE2CC_C0_CONTRACT.md`;
- `project-docs/evidence/PHASE2CC_C0_FAILURE_MATRIX.md`;
- `project-docs/evidence/PHASE2CC_C0_IMPLEMENTATION_PLAN.md`;
- `project-docs/evidence/PHASE2CC_C0_STATUS.md`.

### Архитектурное решение

Actual migration не пишет в фиксированную mutable production-базу и не выполняется in-place. Она создаёт отдельную immutable generation database. После полного reopen/verification/seal только control registry атомарно переключает active pointer.

```text
control registry:  mindmap-state-core-control-v1
generation prefix: mindmap-state-core-v1-generation-
```

IndexedDB не поддерживает atomic database rename, поэтому runtime resolver обязан быть реализован и доказан на sanitized fixtures до exact-source execution. Это меняет безопасный порядок:

```text
C0 architecture/failure matrix
C1 pure registry and generation contracts
C2 native IndexedDB promotion/rollback/crash proof
C3 packaged runtime resolver on sanitized fixtures
C4 exact-source one-shot package
new explicit confirmation
actual migration and activation
```

### C0 boundary

- exact SQLite reopened: false;
- B1b repeated: false;
- backup created: false;
- registry/generation IndexedDB created: false;
- actual migration/promotion: false;
- network/model calls: 0;
- personal data used: false.

## Следующий проверяемый шаг

Провести внутреннюю проверку C0-документов, exact-tree public CI, downloaded-artifact inspection и Drive reverse-read, затем принять PR #49.

После принятия C0 разрешён только отдельный C1: pure registry/generation contracts и state machine на sanitized fixtures. Exact-source reopening, actual migration, production write, model calls и реальные личные данные остаются запрещены.