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
- Phase 2C-B1a sanitized executor/harness: `aec5edaca877cec5d769f4ce4efff674a9c92a7d`;
- Phase 2C-B1b exact-source read-only dry run: `4fd14e515d2c4234f70effa475381f47bbb50e8b`;
- Phase 2C-C0 architecture/release gate: `31657e218cd5891e9e915f698febf8ac72942ed3`.

## B1b — принята и израсходована

Единственная разрешённая B1b-попытка выполнена один раз. Повтор запрещён.

```text
run ID:               b1b-20260728115431-22839
source size:          5 070 848 bytes
source SHA-256:       356b943275cce292d0e14f8a7fbe95af07e79de73f06d3e361874d342aa2f918
portable plan hash:   d8a1289c6f1865db940f65e46aec569400b630aec3cc53bdfd897f223d2436a8
target snapshot hash: 6319ee79284b0ca1afc5fe93d53ef37b4a9c5f85c0c9634976afa1a4979f5689
```

Подтверждено: read-only/query-only; quick_check/integrity_check ok; source неизменён; counts `96/30/0/133/96/3/0`; один unresolved; ноль damaged references; два clean target дали одинаковые hashes; injected rollback не оставил graph/target/receipt; temporary targets удалены; network/model calls = 0; actual migration = false.

## Phase 2C-C0 — принята

Actual migration не выполняется in-place и не пишет в фиксированную mutable production-базу.

```text
control registry:  mindmap-state-core-control-v1
generation prefix: mindmap-state-core-v1-generation-
```

Каждый import создаёт отдельную inactive immutable generation. До activation она проходит import, close/reopen, полную проверку и seal. Promotion — одна atomic control-registry transaction с expected revision и activation receipt. Abort сохраняет прежний active pointer.

Rollback не редактирует payload: отдельная явная transaction восстанавливает previous pointer. Скрытый fallback запрещён. Legacy source, private backup и sealed/active/previous generations migration package не удаляет.

Порядок: C1 pure contracts → C2 native IndexedDB promotion/rollback/crash → C3 packaged resolver → C4 exact-source package → новое подтверждение Артёма → actual migration.

## Финальное доказательство C0

```text
private head: af8f3c55d9e352c1f25d7aa8f720a7e55c6611b5
public head:  9bb65ab0bfdc1631c93d3de42dd97be6f2b23dc6
shared tree:  a8523316e16273f633fac8caac95e96a5fec1080
verify run:   30425727226
package run:  30425727235
merge:        31657e218cd5891e9e915f698febf8ac72942ed3
```

Повторное открытие public PR независимо дало ещё два зелёных run: verify `30427050113`, package `30427050043`.

```text
outer artifact: f2de7f3961c5b720a35e2cbc8987e3a5216304bf8bc8513432c4d8ddb800ff1f
browser proof:  1e0c1aa3f2fd5004699ce6162b20f19e99933ed574ea1e142b7265d9507e1d45
source ZIP:     636c80a35b04f3ab7b7995c2d0cbd7cb804098b69ce67bcd3b6d1031a3099f0f
exporter ZIP:   41c693e46916d9f41d76a2efc615a37a831c39e571fc9152b43e61c3cfce7104
B1b ZIP:        24af33670975e87ce61944955de56303d15c81a0ceb81ceb0433c0bf82b877a0
```

Linux/macOS/full/actual-Chrome/package gates прошли. Downloaded artifacts подтвердили portable checksums, truthful repository/commit/tree provenance, executable launchers и отсутствие exact SQLite/evidence bytes, secrets, generated dependencies и personal payloads.

## Исправленные release-дефекты

1. README ослабил machine-checked accepted B1a marker.
2. Generic source package сочетал private repository с public-mirror commit.
3. Compact exporter имел тот же независимый provenance defect.
4. В canonical Drive была преждевременно записана неподтверждённая merge identity `69a9fc703a79f3aaa4bd44fc372f0cc8c9cb59f4`; после повторной сверки GitHub API она удалена и не считается коммитом проекта.

Каждая доказанная первопричина зафиксирована; упаковочные дефекты имеют регрессии.

## C0 boundary

- exact SQLite reopened: false;
- B1b repeated: false;
- backup created: false;
- control registry/generation created: false;
- actual migration/promotion: false;
- network/model calls: 0;
- personal data: 0.

## Следующий проверяемый шаг

Artifact revision 12 и исправленные Google Drive revisions прошли reverse-read. Разрешён только отдельный C1: pure registry/generation contracts и attempt state machine на sanitized fixtures без IndexedDB, browser, filesystem, exact source, backup, network или model paths.

C2–C4, exact-source reopening, actual migration, production write, model calls и реальные личные данные остаются запрещены.
