# MindMap — решения и статус

Дата актуализации: 2026-07-30.

## Принятые основания

Phase 0, 1A, 2A, 2B, 2C-A, 2C-B0, B1a, B1b, C0 и C1 приняты. Alpha.19 остаётся замороженным legacy-прототипом и не принимает реальные мысли.

B1b one-shot израсходован. Exact source: `5 070 848` bytes, SHA-256 `356b943275cce292d0e14f8a7fbe95af07e79de73f06d3e361874d342aa2f918`; source unchanged; actual migration false.

C0 architecture: registry `mindmap-state-core-control-v1`, immutable generation prefix `mindmap-state-core-v1-generation-`, atomic pointer promotion и explicit pointer rollback.

## Phase 2C-C1 — принята

C1 factual merge: `f8ac03fbb24493dbeac7385687b3f4a93eb10bf8`.

```text
private head: 6fe3b07c5a2cb0ba8a42528799f74569bbea885a
public head:  dede561068650d9302c0570c22286f3cc3bb6da2
shared tree:  9ad59159129eab08e77d4f435f40dd410754a81a
verify:       30443877441
package:      30443877425
```

C1 принята только как pure deterministic generation registry contracts/state machine на sanitized in-memory fixtures. Native persistence и actual migration этим не доказаны.

## Phase 2C-C2 — реализация проверена

Issue #53 и public PR #15 реализуют принятый C1 contract в isolated native IndexedDB fixture namespaces.

Доказано:

- separate immutable generation seal store и registry seal attestation;
- attempts + append-only events с replay verification;
- atomic promotion с expected revision и previous-pointer guard;
- explicit rollback с current pointer/revision guard;
- idempotent repeat и typed fingerprint conflict;
- active-pointer conflict и stale rollback revision блокируются до mutation;
- injected abort promotion и rollback не оставляет partial pointer, attempt, events или receipts;
- close/reopen даёт идентичный canonical snapshot;
- interruption до promotion сохраняет terminal `blocked_recovery` без resume/retry;
- interruption после promotion сохраняет `rollback_required`;
- actual Chrome IndexedDB, sanitized evidence, live REQ-OBS-001 и diagnostics download;
- network/model calls 0; exact source/backup/production namespace/personal data не использовались.

Candidate identity:

```text
private head: 57472ea9b54f1f967b064ff305e187222a29ba30
public head:  b58bfbaa8c535c3bcfb73f135263906e9a2c7777
shared tree:  088cdf17babc38f559559aa794360f2b1a4a9344
verify:       30455093681
package:      30455093613
```

Downloaded candidate proof:

```text
outer source artifact: 50b3b75eb1d67d044dcf5e39ee545c68fba0ab91370df2ad74570cdd6066bcaf
browser proof:         c4bf10a309479f1a921a0c4445dc2e2437e404a7c04f91b403a9a394a5af6d37
source ZIP:            17654a4f866171f705216dd9825bb6d759a1c52a668bc10865fac33b853c065c
exporter ZIP:          c63f6e83e38a26507f8ed7932400d4026b82b5845b6120fac9e85c63e40099eb
B1b ZIP:               87e18e4c67eeb9b16d72a51250fe33e8f9ccdc832f998b48133634f4cb4c54e0
```

Browser final snapshot hash: `3194c2f0b23788a422c91ab4873be3a63194c2f0b23788a422c91ab4873be3a6`.

## Подтверждённые дефекты и первопричины

1. `modelCalls` был объявлен через `let`, хотя не менялся; lint остановил gate.
2. Safety regression запрещала exact legacy filename даже в централизованном deny-list guard; тест уточнён, runtime guard сохранён.
3. Chrome harness сравнивал canonicalized IndexedDB output через insertion-order `JSON.stringify`; заменено canonical equality.

Каждый новый запуск выполнялся только после доказанной причины и узкой коррекции. Слепого rerun не было.

## Граница доказательства

C2 пока не принята. Не доказаны C3 packaged resolver, C4 exact-source package, target-Mac production storage, private backup, actual migration, semantic quality и real-data readiness.

Следующий проверяемый шаг: синхронизировать repository docs/release metadata с Drive revisions, создать final exact private/public tree, повторить CI, проверить скачанный финальный artifact, открыть private PR и выполнить factual expected-head merge. C3 до этого запрещена.
