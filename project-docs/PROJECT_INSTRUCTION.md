# MindMap — инструкция проекта

## Цель

MindMap — local-first AI-система: мысль → понимание → связи → приоритет → решение → действие → результат → память. Карта представляет данные; продукт не является обычным заметочником или таск-менеджером.

Критерий: превращает ли решение хаотичный поток мыслей в точные решения и результаты при минимуме ручной работы? Различай факт, гипотезу, реализацию и эксперимент. Fixture не является реальной базой, сборка не является успехом, уверенность AI не является подтверждением.

## Текущее состояние

Alpha.19 заморожена как legacy research runtime; реальные мысли не загружать. B1b exact-source one-shot выполнен, принят и израсходован. Exact SQLite сохраняется неизменным, B1b повторно не запускается.

C0 принята: immutable generation databases `mindmap-state-core-v1-generation-` и atomic active pointer в `mindmap-state-core-control-v1`. C1 принята merge-коммитом `f8ac03fbb24493dbeac7385687b3f4a93eb10bf8`.

C2 native IndexedDB final proof завершён: private `83eb9a06610ff737676b002837beadf6807926dd`, public `cdd6939409d8bbb33da20c9875dc082cd2c39bd3`, tree `158527376a989b304f097006ba39488d79a04c8f`, verify/package `30516236010` / `30516236013`, private PR #54. C2 ещё не принята до последнего metadata-tree gate и factual expected-head merge.

## Модель данных

Иерархия: область → направление → проект → мысль. Корни — только области. Неверные вложения, циклы и повторяющиеся пути запрещены. У мысли одно основное размещение и необязательные связи. Сфера жизни — не проект; проект имеет ограниченный результат и состояние.

Ноль подходящих направлений, проектов, связей, дублей или противоречий — нормальный результат. Нельзя создавать сущности для заполнения схемы. Различай корректную ссылку, honest `unresolved` и damaged/stale reference. `Unresolved` хранится во «Входящих» и не считается ошибкой.

AI рекомендует, но не принимает важные решения. Внешние действия требуют подтверждения.

## Хранение и миграция

Legacy source остаётся private, immutable и read-only. Диагностика, backup, migration и recovery выполняются без AI.

Безопасный порядок:

1. C2 — native IndexedDB registry/seal/promotion/rollback/crash proof.
2. C3 — packaged runtime resolver на sanitized fixtures.
3. C4 — отдельный exact-source one-shot package.
4. Новое явное подтверждение Артёма непосредственно перед запуском.
5. Actual migration и activation.

Actual execution authorization привязывается к repository, commit, tree, archive SHA-256, source SHA-256, generation name и attempt ID и расходуется до source open. Failure запрещает retry; сначала offline root-cause proof, regression и новый package gate.

## Phase 2C-C2

C2 использует только physical IndexedDB names с prefix `mindmap-state-core-v1-phase2cc-c2-fixture-`; production и legacy names отклоняются до open.

Доказано на sanitized fixtures:

- immutable generation seal и seal attestation;
- persisted aggregate + append-only events с deterministic replay;
- atomic promotion и explicit rollback;
- revision, current/previous pointer, identity/hash/receipt guards;
- idempotent repeat и typed fingerprint conflict;
- abort promotion/rollback без partial mutation;
- terminal `blocked_recovery` без automatic resume/retry;
- post-promotion `rollback_required`;
- actual Chrome, sanitized evidence, REQ-OBS-001 и diagnostics download.

Downloaded final artifacts восстановили exact tree `158527376a989b304f097006ba39488d79a04c8f`; exact source/backup/production namespace/actual migration/network/model/personal paths отсутствуют.

C2 не доказывает packaged resolver, private backup, production namespace, exact-source execution, actual migration или semantic quality.

## REQ-OBS-001

Любая длительная операция показывает name/type, elapsed/volume, last progress/heartbeat, state, model либо «без AI» и downloadable diagnostics. Stale heartbeat означает «возможно, процесс завис», но не разрешает restart/retry.

## Документация и release gate

Google Drive — источник продуктовых документов; GitHub — кода и технической истории. Документы считаются обновлёнными только после reverse-read. Зелёный CI недостаточен: exact private/public tree и downloaded artifact проверяются отдельно. Merge SHA записывается только после фактического `merged=true` и GitHub API readback.

## Текущая стоп-линия

Разрешены только запись final C2 proof в metadata, последний exact-tree контроль, factual merge PR #54 и post-merge closure.

Запрещены: C3/C4; B1b retry; exact SQLite/backup access; production registry/generation; actual migration/promotion/rollback; model/network calls; personal data. На Mac действий не требуется.
