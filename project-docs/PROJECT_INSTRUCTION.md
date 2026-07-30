# MindMap — инструкция проекта

## Цель

MindMap — local-first AI-система: мысль → понимание → связи → приоритет → решение → действие → результат → память. Карта представляет данные; продукт не является обычным заметочником или таск-менеджером.

Критерий: превращает ли решение хаотичный поток мыслей в точные решения и результаты при минимуме ручной работы? Различай факт, гипотезу, реализацию и эксперимент. Fixture не является реальной базой, сборка не является успехом, уверенность AI не является подтверждением.

## Текущее состояние

Alpha.19 заморожена как legacy research runtime; реальные мысли в неё не загружать. B1b exact-source one-shot выполнен, принят и израсходован. Exact SQLite сохраняется неизменным и B1b повторно не запускается.

C0 принята: immutable generation databases с prefix `mindmap-state-core-v1-generation-` и atomic active pointer в `mindmap-state-core-control-v1`. Rollback меняет pointer и не редактирует payload.

C1 принята merge-коммитом `f8ac03fbb24493dbeac7385687b3f4a93eb10bf8`. C2 native IndexedDB implementation проверена на sanitized fixtures: private `57472ea9b54f1f967b064ff305e187222a29ba30`, public `b58bfbaa8c535c3bcfb73f135263906e9a2c7777`, tree `088cdf17babc38f559559aa794360f2b1a4a9344`, verify/package `30455093681` / `30455093613`. C2 ещё не принята до final docs/tree/artifact/merge gate.

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

C2 использует только физические IndexedDB namespaces с prefix `mindmap-state-core-v1-phase2cc-c2-fixture-`; production и legacy names отклоняются до open.

C2 фиксирует:

- immutable generation seal и seal attestation;
- persisted attempt aggregate + append-only events с deterministic replay;
- atomic active-pointer promotion и explicit rollback;
- expected registry revision, previous/current pointer и identity/hash/receipt guards;
- idempotent repeat и typed fingerprint conflict;
- abort promotion/rollback без partial pointer/attempt/event/receipt mutation;
- persisted terminal `blocked_recovery` без automatic resume/retry;
- post-promotion `rollback_required`;
- actual Chrome proof, sanitized evidence и REQ-OBS-001.

C2 не доказывает packaged resolver, private backup, production namespace, exact-source execution, actual migration или semantic quality.

## REQ-OBS-001

Любая длительная операция показывает name/type, elapsed time и volume, last progress/heartbeat, state, model либо «без AI» и downloadable diagnostics. Таймер меняется только при реальном переходе. Stale heartbeat означает «возможно, процесс завис», но не разрешает restart/retry.

REQ-OBS-001 действует для анализа, embeddings, clustering, hierarchy, links, save, backup, migration, verification, seal, promotion, resolver, rollback, recovery и export.

## Документация и release gate

Google Drive — источник продуктовых документов; GitHub — кода и технической истории. До принятия обновляются статус, решения/ошибки/первопричины, требования, следующий проверяемый шаг, README, release metadata и версия. Документы считаются обновлёнными только после reverse-read.

Зелёный CI недостаточен: exact private/public tree и downloaded artifact проверяются отдельно, включая provenance, checksums, inventory, executable modes и отсутствие database/evidence bytes, secrets, dependencies и personal payloads. Merge SHA записывается только после фактического `merged=true` и readback GitHub API.

## Текущая стоп-линия

Разрешены только синхронизация C2 docs/release metadata, final exact-tree CI/artifact review, private PR и factual merge.

Запрещены: C3/C4; B1b retry; exact SQLite/backup access; production registry/generation; actual migration/promotion/rollback; model/network calls; personal data. На Mac действий не требуется.
