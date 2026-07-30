# MindMap — инструкция проекта

## Цель

MindMap — local-first AI-система: мысль → понимание → связи → приоритет → решение → действие → результат → память. Различай факт, гипотезу, реализацию и эксперимент. Fixture не является реальной базой, сборка не является успехом.

## Текущее состояние

Alpha.19 заморожена; реальные мысли не загружать. Exact SQLite private и immutable. B1b one-shot принят и израсходован; повтор запрещён. C0–C3 и C4 planning приняты. C4 planning merge: `2c1f476685007a8c2fa52288ac00dfff188edb06`.

## Модель данных

Иерархия: область → направление → проект → мысль. Корни — только области. Неверные вложения, циклы и повторяющиеся пути запрещены. Ноль кандидатов допустим. `Unresolved` хранится во «Входящих» и не считается ошибкой. AI рекомендует; важные внешние действия требуют подтверждения.

## Принятая migration architecture

Каждый import создаёт отдельную immutable generation. Registry `mindmap-state-core-control-v1` выбирает active generation только после reopen, verification и seal. C3 resolver читает только registry-selected generation и fail closed без fallback, repair, mutation или automatic retry.

Future C4 authorization связывает exact package repository/commit/tree/archive, source/backup, registry/generation, workspace/attempt и expected B1b hashes. Она создаётся после package acceptance и явного подтверждения Артёма, расходуется до первого source open, одноразовая и не разрешает rollback.

Rollback требует отдельной authorization, связанной с factual pointer/revision/activation receipt/failure evidence, и меняет только pointer/receipt.

Future execution sequence: package verify → authorization consume → source read-only verify → new backup/reopen/hash/integrity → bootstrap-empty target gate → isolated generation → deterministic import/checkpoints → reopen → portable-plan/snapshot verify → seal → atomic promotion → accepted C3 resolver → sanitized evidence.

## REQ-OBS-001

Каждая длительная local/offline operation показывает work/stage, elapsed, processed/total, last progress, heartbeat, state, model `без AI`, zero-call counters и downloadable diagnostics. `possibly_hung` после `max(15 s, 5 × heartbeat interval)` не запускает restart/resume/retry/cleanup/promotion/rollback.

## Current implementation gate

Разрешена только C4 implementation на isolated sanitized fixtures: pure runner/state machine, fixture backup, collisions, import/reopen/hash/seal/promotion/resolver, interruption/reload, separate rollback authorization, actual Chrome/macOS и sanitized diagnostics.

Запрещены exact SQLite/private backup access, B1b repeat, filesystem search, target-Mac production namespace, exact execution package/authorization, actual migration/promotion/rollback, model/network calls и personal data.

Перед будущим exact-source launch требуется новый package gate и явное подтверждение Артёма для конкретного package/attempt. На Mac сейчас ничего запускать не нужно.
