# MindMap — решения и статус

Дата актуализации: 2026-07-29.

## Принятые основания

Phase 0, 1A, 2A, 2B, 2C-A, 2C-B0, B1a, B1b, C0 и C1 приняты. Alpha.19 остаётся замороженным legacy-прототипом и не принимает реальные мысли.

B1b one-shot израсходован. Exact source: `5 070 848` bytes, SHA-256 `356b943275cce292d0e14f8a7fbe95af07e79de73f06d3e361874d342aa2f918`; source unchanged; counts `96/30/0/133/96/3/0`; unresolved 1; damaged references 0; network/model calls 0; actual migration false.

C0 принят merge-коммитом `31657e218cd5891e9e915f698febf8ac72942ed3`. Архитектура: immutable generation databases, registry `mindmap-state-core-control-v1`, prefix `mindmap-state-core-v1-generation-`, atomic pointer promotion и explicit pointer rollback.

## Phase 2C-C1 — принята

PR #52 фактически принят squash-merge `f8ac03fbb24493dbeac7385687b3f4a93eb10bf8`.

```text
private head: 6fe3b07c5a2cb0ba8a42528799f74569bbea885a
public head:  dede561068650d9302c0570c22286f3cc3bb6da2
shared tree:  9ad59159129eab08e77d4f435f40dd410754a81a
verify:       30443877441
package:      30443877425
```

Доказано на sanitized fixtures:

- immutable manifest привязан к repository/commit/tree/archive/source/backup/registry/generation/authorization identity;
- closed statuses и typed commands/events/rejections/stops;
- deterministic replay, canonical hashes, idempotency и stale-revision guard;
- one-shot authorization нельзя использовать повторно;
- registry revision и previous active pointer проверяются до promotion;
- promotion plan не копирует данные; rollback plan не мутирует payload;
- interruption до promotion даёт terminal `blocked_recovery` без resume/retry;
- ошибка после promotion требует explicit rollback;
- sanitized evidence не содержит source bytes, raw thoughts, paths или personal data;
- structural test исключает browser, IndexedDB, filesystem, network, models, clock, randomness и exact-source dependency.

Все 9 C1 tests и полный Linux/macOS/Chrome/package regression прошли.

Downloaded final proof:

```text
outer artifact: b755aeff6a9181a5f90b29abe0a46f6ef08c06f52dcbec73e271c2e3d1708ee5
browser proof:  410728655374a7ed9459c94b083bd641a457d462b83f9b41439271d4afc36da6
source ZIP:     62b2654bed7f04278a873acb8fd6fa0d41d8e205596c7691c9461dd635f465b7
exporter ZIP:   2d5e758b2990cba96c89bd859bdeeb2bd1a8be1ca5d2c6d4e6a07cf3e132a594
B1b ZIP:        89419a7a5c8f9b96522ee9225156b938d8e60bfab09ab5453071a67a97a7ed17
```

Portable checksums, repository/commit/tree provenance, executable launchers и privacy inventory прошли.

## Граница доказательства C1

Exact SQLite не открывался; B1b не повторялась; backup/registry/generation databases не создавались; IndexedDB/runtime integration отсутствует; actual migration/promotion/rollback не выполнялись; network/model calls и personal data = 0.

## Следующий проверяемый шаг

Разрешён только C2: native IndexedDB registry/seal/promotion/rollback/crash-reload proof на sanitized fixtures. C2 обязан сохранять C1 contracts без ослабления. C3–C4, exact-source reopening, actual migration, production write, model calls и реальные личные данные остаются запрещены.
