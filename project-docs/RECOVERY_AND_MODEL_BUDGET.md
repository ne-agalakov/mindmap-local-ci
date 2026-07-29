# MindMap — восстановление и бюджет локальной модели

Статус: обязательный инженерный протокол для v0.6-alpha.19 и нового state-core.

## Основное правило

Локальная модель не компенсирует ошибки кода, миграции или восстановления. Для deterministic-code и storage/migration ошибок сначала выполняется read-only диагностика. Повторный AI-вызов или migration attempt допустим только после доказательства первопричины, regression, нового exact package gate и отдельного подтверждения пользователя.

## Принятый legacy-источник

```text
size:       5 070 848 bytes
SHA-256:    356b943275cce292d0e14f8a7fbe95af07e79de73f06d3e361874d342aa2f918
workspace:  synthetic
personal:   0
```

Export/inspection были `readonly` + `query_only`; quick_check/integrity_check `ok`; bytes modified false. Raw source остаётся private и вне Git/Drive artifacts.

## B1b — accepted exact-source recovery boundary

Единственная B1b-попытка выполнена и израсходована.

```text
run:                 b1b-20260728115431-22839
B1b merge:           4fd14e515d2c4234f70effa475381f47bbb50e8b
portable plan hash:  d8a1289c6f1865db940f65e46aec569400b630aec3cc53bdfd897f223d2436a8
target snapshot:     6319ee79284b0ca1afc5fe93d53ef37b4a9c5f85c0c9634976afa1a4979f5689
```

Подтверждено: exact source unchanged; counts `96/30/0/133/96/3/0`; one unresolved; zero damaged references; equal repeat hashes; injected rollback left no graph/target/receipt; temporary targets deleted; REQ-OBS present; network/model calls = 0; actual migration = false.

B1b не повторять. Exact source и оба sanitized JSON evidence хранить неизменными.

## Phase 2C-C0 — immutable-generation recovery architecture

Actual migration не выполняется in-place и не пишет в фиксированную mutable production database.

```text
control registry:  mindmap-state-core-control-v1
generation prefix: mindmap-state-core-v1-generation-
```

Каждый import создаёт новую inactive generation. До activation она проходит import, close/reopen, exact validation и seal. Control registry атомарно меняет active pointer одной transaction с expected revision и activation receipt. Abort сохраняет прежний pointer.

Rollback не изменяет generation payload. Он отдельной явной registry transaction восстанавливает previous pointer. При revision/identity conflict система останавливается и не угадывает. Скрытый fallback запрещён.

Legacy source, private backup, sealed generation, active generation и previous active generation migration package не удаляет.

## Backup contract

Перед generation write требуется private immutable backup exact SQLite:

- destination создаётся exclusive-create и не перезаписывается;
- size/SHA-256 проверяются независимо;
- quick_check и integrity_check обязаны быть `ok`;
- existing path с другим содержимым блокирует attempt;
- backup bytes/path не попадают в Git, Drive или sanitized evidence;
- generation creation запрещена до `backup_verified`.

## Attempt and reload recovery

One-shot authorization привязана к repository, commit, tree, archive SHA-256, source SHA-256, generation name и attempt ID. Она расходуется до source open.

```text
planned → authorization_consumed → source_verified → backup_verified
→ generation_created → importing → imported → verified → sealed
→ promotion_ready → promotion_committed → resolver_verified → completed
```

Reload, Terminal/browser close, exception или stale heartbeat не продолжают write автоматически. Persisted non-terminal attempt показывает blocked recovery state и diagnostics. Любой stop запрещает retry.

До promotion incomplete generation остаётся inactive. После committed promotion ошибка resolver переводит attempt в `rollback_required`; rollback требует отдельного явного действия. Runtime resolver обязан быть доказан на sanitized fixtures до exact-source execution.

## Reviewed C0 gate

```text
private head: 1e13024eeef8cec8ec05f721bf9ce703f884bc91
public head:  189e86ae8a92912d399196bed15d8ece849a58e9
shared tree:  c09d95579292970a851cf0c1a43abce13a800d3a
verify:       30424595380
package:      30424595384
```

Downloaded artifact review подтвердил truthful source/exporter/B1b repository/commit provenance, portable checksums, executable user launchers и отсутствие exact database/evidence bytes, secrets, dependencies и personal payloads.

Исправлены и regression-tested: ослабленный B1a README invariant, source-package repository mismatch и exporter-package repository mismatch.

## Failure boundary

Typed stops обязательны для authorization/package/source/backup mismatch; registry version/revision/pointer mismatch; invalid/colliding generation; transaction abort; idempotency conflict; partial import; counts/reference/unresolved/hash/reopen mismatch; seal/promotion/resolver/rollback/evidence failure; non-zero network/model counters. Автоматический repair через AI запрещён.

## REQ-OBS-001

Каждая длительная операция показывает name/type, elapsed time/volume, last progress/heartbeat, state, model либо «без AI» и downloadable diagnostics. Stale activity означает «возможно, процесс завис», но не разрешает restart/retry.

REQ-OBS-001 применяется к authorization freeze, source verification, backup, generation creation, import, verification, seal, promotion, resolver verification, rollback, cleanup и evidence capture.

## Текущая стоп-линия

Artifact revision 11 и финальные Drive revisions синхронизированы. Разрешены только final documentation exact-tree rerun, downloaded-artifact review и merge PR #49.

Exact source на C0 не открывался; B1b не повторялась; backup/registry/generation не создавались; migration/promotion не выполнялись; network/model calls = 0; personal data = 0.

После C0 merge разрешён только C1 pure contracts на sanitized fixtures. Actual migration требует C1–C4 и отдельного явного подтверждения Артёма непосредственно перед exact final package.