# MindMap — восстановление и бюджет локальной модели

Статус: обязательный инженерный протокол для v0.6-alpha.19 и нового state-core.

## Основное правило

Локальная модель не компенсирует ошибки кода, миграции или восстановления. Повторный AI-запрос допустим только после доказательства отсутствия нужного ответа в сохранённых данных и отдельного подтверждения пользователя. Для deterministic-code и storage/migration ошибок сначала выполняется read-only диагностика.

## Принятый legacy-источник

- size `5 070 848` bytes;
- SHA-256 `356b943275cce292d0e14f8a7fbe95af07e79de73f06d3e361874d342aa2f918`;
- export/inspection `readonly` + `query_only`;
- quick_check/integrity_check `ok`;
- bytes modified false;
- 96 synthetic, 0 personal thoughts.

Raw source остаётся private и вне Git/Drive artifacts.

## Принятые storage/recovery основания

- Phase 1A `e7b7593932614f8dfa843298f35eff0230c1e827`;
- Phase 2A `aa5eaaae08a3da4d0ff00ea03aea12b793137a21`;
- Phase 2B `b4b35dcd7125c820f75f89387bc18ac3fa509cb0`;
- Phase 2C-A `292634312ad04fa6e6cfc5a5ded311ac1020094d`;
- Phase 2C-B0 `dbf2484c78e4eedcbb2efb3f0b61394b79a6d216`;
- Phase 2C-B1a `aec5edaca877cec5d769f4ce4efff674a9c92a7d`;
- Phase 2C-B1b `4fd14e515d2c4234f70effa475381f47bbb50e8b`.

Приняты transaction completion as commit, append-only replay, revision/idempotency guards, workspace isolation, abort rollback, corruption refusal, deterministic graph/payload mapping и explicit unresolved/damaged-reference distinction.

## Phase 2C-B1b — accepted exact-source recovery boundary

Единственная разрешённая B1b попытка выполнена и израсходована.

```text
run:                 b1b-20260728115431-22839
package commit:      982cadbc62c42659aa567b803574e3e04066babc
package tree:        9b2d2588ba678f5c2bc5737687049be75c2ece96
B1b merge:           4fd14e515d2c4234f70effa475381f47bbb50e8b
post-merge docs:     e6bd47011fad2dab5a8617f5f754739de1915fd9
portable plan hash:  d8a1289c6f1865db940f65e46aec569400b630aec3cc53bdfd897f223d2436a8
target snapshot:     6319ee79284b0ca1afc5fe93d53ef37b4a9c5f85c0c9634976afa1a4979f5689
```

Подтверждено:

- exact source size/SHA/timestamp unchanged before and after;
- counts `96/30/0/133/96/3/0`;
- one unresolved, zero damaged references;
- two clean temporary targets produced equal portable-plan/target hashes;
- injected transaction failure committed no graph and left no target/receipt;
- all temporary targets deleted;
- REQ-OBS trace and diagnostics present;
- network/model calls = 0;
- actual migration = false.

B1b не повторять. Exact source и оба sanitized JSON evidence хранить неизменными.

## Phase 2C-C0 — immutable-generation recovery architecture

Actual migration не выполняется in-place и не пишет в фиксированную mutable production database.

```text
control registry:  mindmap-state-core-control-v1
generation prefix: mindmap-state-core-v1-generation-
```

Каждый import создаёт новую inactive generation. До activation она обязана пройти import, close/reopen, exact validation и seal. Control registry атомарно меняет active pointer одной transaction с expected revision и activation receipt. Transaction abort сохраняет прежний pointer.

Rollback не изменяет generation payload. Он отдельной явной registry transaction восстанавливает previous pointer по activation receipt. При revision/identity conflict система останавливается и не угадывает. Скрытый fallback запрещён.

Legacy source, backup, sealed generation, active generation и previous active generation migration package не удаляет.

## Backup contract

Перед generation write требуется private immutable backup exact SQLite:

- destination создаётся exclusive-create и не перезаписывается;
- size/SHA-256 проверяются независимо;
- quick_check и integrity_check обязаны быть `ok`;
- existing path с другим содержимым блокирует attempt;
- backup bytes/path не попадают в Git, Drive или sanitized evidence;
- generation creation запрещена до `backup_verified`.

## Attempt and reload recovery

One-shot authorization привязана к repository, commit, tree, package archive SHA-256, source size/SHA, generation name и attempt ID. Она расходуется до source open.

Forward states:

```text
planned → authorization_consumed → source_verified → backup_verified
→ generation_created → importing → imported → verified → sealed
→ promotion_ready → promotion_committed → resolver_verified → completed
```

Reload, Terminal/browser close, exception или stale heartbeat не продолжают write автоматически. Persisted non-terminal attempt показывает blocked recovery state и diagnostics. Любой stop запрещает retry. Новая попытка возможна только после offline root-cause proof, regression, нового exact package gate и нового подтверждения.

До promotion incomplete generation остаётся inactive. После committed promotion ошибка resolver переводит attempt в `rollback_required`; rollback требует отдельного явного действия. Runtime resolver обязан быть доказан на sanitized fixtures до exact-source execution.

## Failure boundary

Обязательны typed stops для:

- authorization/package/source/backup mismatch;
- registry version/revision/active-pointer mismatch;
- generation collision или invalid namespace;
- transaction abort, idempotency conflict, partial import;
- counts/reference/unresolved/hash/reopen mismatch;
- seal/promotion/resolver/rollback failure;
- evidence write failure;
- non-zero network/model counters.

Автоматический repair через AI запрещён.

## REQ-OBS-001

Каждая длительная операция показывает name/type, elapsed time/volume, last progress/heartbeat, state, model либо «без AI» и downloadable diagnostics. Timer freezes on pause/error/completion. Stale activity означает «возможно, процесс завис», но не доказывает зависание и не разрешает restart/retry.

REQ-OBS-001 применяется к authorization freeze, source verification, backup, generation creation, import, verification, seal, promotion, resolver verification, rollback, cleanup и evidence capture.

## Текущая стоп-линия

C0 — только architecture/contracts/failure matrix/release metadata/CI/artifact/Drive synchronization.

На C0 exact source не открывался; B1b не повторялась; backup/registry/generation не создавались; migration/promotion не выполнялись; network/model calls = 0; personal data = 0.

После принятия C0 разрешён только C1 pure contracts на sanitized fixtures. Actual migration требует C1–C4 и отдельного явного подтверждения Артёма непосредственно перед exact final package.