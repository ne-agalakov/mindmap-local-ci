# MindMap — решения и статус

Дата актуализации: 2026-07-30.

## Phase 2C-C3 — принята

Phase 2C-C3 принята factual merge `38b0e3fb9542174328396ae19bff76f18d637f21`; post-merge closure — `dd5e3ba57d0f5ce17254569625ab9bc93b149a55`.

```text
private head: cec6c0ef1c0ce4eea5ab69ef172df060e9df5d2e
public head:  61602480f505c133df8257cc494852b43e9d3fa0
shared tree:  9bee67d28fe5979fb64b2992710aa4e6bcf2fbba
verify:       30540259921
package:      30540260040
```

C3 доказала read-only registry-authoritative resolver, full fail-closed matrix, stale-pointer guard, deterministic reload, actual Chrome, REQ-OBS-001 и sanitized diagnostics. Exact source/backup/production/migration paths false; fallback/automatic resume/retry false; network/model calls и personal data — 0.

## Phase 2C-C4 — planning candidate

Issue #59 реализована только как документационный контракт. Добавлены:

1. exact-source one-shot execution contract;
2. checkpoint failure/recovery matrix;
3. target-Mac package inventory/provenance;
4. planning/implementation/package/execution/migration acceptance gates.

Ключевые решения кандидата:

- detached authorization привязана к package/source/backup/registry/generation/attempt identity;
- authorization расходуется атомарно до первого source open;
- expected backup byte-identical source и не перезаписывается;
- первый production target допускается только в strict bootstrap-empty mode;
- deterministic import обязан воспроизвести portable-plan и target-snapshot hashes B1b;
- promotion — одна registry pointer transaction после reopen/verification/seal;
- P13 использует принятый C3 resolver;
- migration authorization не разрешает rollback;
- rollback требует отдельной authorization и меняет только pointer;
- interruption/reload никогда не возобновляет write автоматически;
- `possibly_hung` информирует, но не перезапускает операцию;
- planning proof, implementation proof, package proof и actual success разделены.

## Граница доказательства

C4 planning candidate не содержит runner/launcher и не открывала exact SQLite/private backup. Registry/generation не создавались; actual migration/promotion/rollback не выполнялись; network/model calls и personal data — 0.

## Следующий проверяемый шаг

Сначала принять planning contract через exact private/public tree, CI/package, downloaded-artifact inspection, Drive reverse-read и factual merge Issue #59. Только после этого может быть создан отдельный C4 implementation issue на sanitized fixtures.

До отдельного gate запрещены C4 implementation/execution, exact-source access, B1b repeat, production namespace и actual migration. Перед будущим exact-source запуском требуется новое явное подтверждение Артёма для конкретного package/attempt.
