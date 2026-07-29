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
- Phase 2C-B1b exact-source read-only dry run: `4fd14e515d2c4234f70effa475381f47bbb50e8b`;
- B1b post-merge docs: `e6bd47011fad2dab5a8617f5f754739de1915fd9`.

## B1b — принята и израсходована

Единственная разрешённая B1b-попытка выполнена один раз. Повтор запрещён.

```text
run ID:               b1b-20260728115431-22839
source size:          5 070 848 bytes
source SHA-256:       356b943275cce292d0e14f8a7fbe95af07e79de73f06d3e361874d342aa2f918
portable plan hash:   d8a1289c6f1865db940f65e46aec569400b630aec3cc53bdfd897f223d2436a8
target snapshot hash: 6319ee79284b0ca1afc5fe93d53ef37b4a9c5f85c0c9634976afa1a4979f5689
```

Подтверждено: read-only/query-only; quick_check/integrity_check ok; source size/SHA/timestamp неизменны; counts `96/30/0/133/96/3/0`; один unresolved; ноль damaged references; два clean target дали одинаковые hashes; injected rollback не оставил graph/target/receipt; temporary targets удалены; network/model calls = 0; actual migration = false.

## Phase 2C-C0 — архитектурное решение

Actual migration не выполняется in-place и не пишет в фиксированную mutable production-базу.

```text
control registry:  mindmap-state-core-control-v1
generation prefix: mindmap-state-core-v1-generation-
```

Каждый import создаёт отдельную inactive immutable generation. До activation она проходит import, close/reopen, полную проверку и seal. Promotion — одна atomic control-registry transaction с expected revision и activation receipt. Abort сохраняет прежний active pointer.

Rollback не редактирует payload: отдельная явная transaction восстанавливает previous pointer по activation receipt. Скрытый fallback запрещён. Legacy source, private backup, sealed/active/previous generations migration package не удаляет.

Поскольку IndexedDB не поддерживает atomic database rename, packaged runtime resolver должен быть доказан на sanitized fixtures до exact-source execution.

Порядок:

```text
C0 architecture/failure matrix
C1 pure registry/generation contracts
C2 native IndexedDB promotion/rollback/crash/reload
C3 packaged runtime resolver on sanitized fixtures
C4 exact-source one-shot package
новое явное подтверждение Артёма
actual migration and activation
```

## Failure и recovery contract

Typed stops определены для authorization, source, backup, registry, generation, import, verification, seal, promotion, resolver, rollback, observability и evidence failures. Reload/закрытие/ошибка не продолжают write автоматически. Любой stop расходует authorization и требует offline root-cause proof, regression, нового package gate и нового подтверждения.

REQ-OBS-001 действует для authorization freeze, source verification, backup, generation creation, import, verification, seal, promotion, resolver verification, rollback, cleanup и evidence capture.

## Release-gate дефекты C0

До финального принятия обнаружены и исправлены:

1. README удалил exact accepted B1a heading, ослабив machine-checked historical invariant.
2. Generic source package сочетал private repository с public-mirror commit.
3. Compact exporter package имел тот же независимый provenance defect.

Оба packager теперь определяют repository фактического checkout либо используют явный override; regressions проверяют repository/commit consistency. Ранние зелёные CI не считаются финальным доказательством.

## Reviewed C0 gate

```text
private head: 1e13024eeef8cec8ec05f721bf9ce703f884bc91
public head:  189e86ae8a92912d399196bed15d8ece849a58e9
shared tree:  c09d95579292970a851cf0c1a43abce13a800d3a
verify run:   30424595380
package run:  30424595384
```

Linux lint/full suite, macOS launchers/tests, actual Chrome run-storage/graph-storage/B1a/B1b harnesses и source/exporter/B1b packaging прошли.

```text
outer artifact: 6e63c8d4bace4f5350713ca64dc983fde2f81808e64798c1089539a30985c720
browser proof:  9ec160607e1517f6a27e3c7ed36441dfd1a4ed2a9d4ffb634083d04014d51160
source ZIP:     7ae424491bdb82c18bb8cf46ebcf09fb2cc9f187870d4454b1c2c2d6e947cdd5
exporter ZIP:   7ede5c196249dcbb8084856cd62763cf179c1a7600e53e174efca9425fc45a98
B1b ZIP:        6de9eb5d15fea1c31cc2e99d98d52e734eb20d5a4e28889bb9b7c5575339bd83
```

Downloaded artifacts подтвердили portable checksums, truthful source/exporter/B1b repository/commit/tree provenance, executable user launchers и отсутствие exact SQLite/evidence bytes, secrets, generated dependencies и personal payloads. Присутствуют только допустимые sanitized fixtures и source-identity metadata.

## C0 boundary

- exact SQLite reopened: false;
- B1b repeated: false;
- backup created: false;
- control registry/generation created: false;
- actual migration/promotion: false;
- network/model calls: 0;
- personal data: 0.

## Следующий проверяемый шаг

Artifact revision 11 и финальные Google Drive revisions прошли reverse-read. Требуется exact mirror финального documentation tree, повторный Linux/macOS/full/actual-Chrome/package gate, downloaded-artifact inspection и merge PR #49 с expected-head protection.

После merge разрешён только отдельный C1 на sanitized fixtures. Exact-source reopening, actual migration, production write, model calls и реальные личные данные остаются запрещены.