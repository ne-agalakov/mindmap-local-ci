# MindMap — восстановление и бюджет локальной модели

Статус: обязательный инженерный протокол. Актуально для v0.6-alpha.19 и нового state-core.

## Основное правило

Локальная модель не компенсирует ошибки кода, миграции или восстановления. Повторный AI-запрос допустим только после доказательства отсутствия нужного ответа в сохранённых данных и отдельного подтверждения пользователя. Для deterministic-code и storage/migration ошибок сначала выполняется read-only диагностика.

## Принятый legacy-источник

- size `5 070 848` bytes;
- SHA-256 `356b943275cce292d0e14f8a7fbe95af07e79de73f06d3e361874d342aa2f918`;
- evidence `51e3d9563b09c91427716eee559745fed35d729e9ffd71f180afa91c3fc7aa2b`;
- export/inspection `readonly`;
- bytes modified false;
- write/migration/network/model calls 0;
- integrity `ok`;
- 96 synthetic, 0 personal thoughts.

Raw source remains private and outside Git.

## Accepted storage foundations

- Phase 1A `e7b7593932614f8dfa843298f35eff0230c1e827`;
- Phase 2A `aa5eaaae08a3da4d0ff00ea03aea12b793137a21`;
- Phase 2B `b4b35dcd7125c820f75f89387bc18ac3fa509cb0`;
- Phase 2C-A `292634312ad04fa6e6cfc5a5ded311ac1020094d`.

## Accepted Phase 2C-A recovery invariants

- atomic graph events/materialized state/receipt;
- transaction completion as commit;
- reopen idempotency;
- synthetic/personal workspace isolation;
- run+graph coexistence in a fresh database;
- abort rollback;
- run-only database refusal;
- corruption detection and follow-up `integrity_mismatch`;
- explicit proposed → confirmed link lifecycle.

Final reviewed head `29a317b58cbecaea13e4f21c02af2b945a6e6edc` and public exact tree `e81ae1b309a806f0078b5a8a2057f51d4c0e403d` passed verify `30198811851` and package `30198811852`.

Downloaded evidence:

- outer `2184324939c12db0af27ad913904d953b0ee5b5f73b1c7e85c580f020263688c`;
- source `81d469a6eb53908b1c863c8643598a1953bffa8392174d9e1292b3a1e2058c3b`;
- exporter `1388fbc608d27c6d446646c84fd7c29ab59a76ed3e587a4b41f803b901b32109`;
- browser `5c63ffa99679b9cff87d8c82b16d7d4f31080e3bbbc6c7c1a218e8cbe1ddb755`;
- browser log `0bf055b8ed72d24debe8d4579d98051cc4956f6175c84b28f1a024f80ebe352a`.

No database, secret, concrete local user-home path, runtime cache or personal thought/database payload was found. AI/model/migration calls = 0.

The two browser fixtures differ. Close/reopen equality passed within each; same-fixture cross-environment equality remains open.

## Phase 2C-B dry-run protocol

Allowed only in a separate issue/branch/PR:

- exact accepted source/hash and read-only open;
- source byte-stability before/after;
- synthetic workspace and zero personal thoughts;
- fresh empty temporary target, never production/target-Mac;
- deterministic versioned mapping and target hash;
- repeat-run equality;
- typed stops for mismatch, personal data, wrong schema/workspace, duplicate run, ambiguity, invalid reference and non-empty target;
- injected failure rolls back target fully;
- network/model/Ollama/Qwen/DeepSeek = 0;
- actual target-Mac migration remains prohibited.

## REQ-OBS-001

Every long operation shows name/type, elapsed time and volume, last progress/heartbeat, state, model or «без AI», and downloadable diagnostics. Timer freezes on pause/error/completion. No automatic restart or AI retry.

## Phase 2C-B0 recovery boundary

B0 is a pure planner. It passed sanitized-fixture tests and exact-tree public CI/artifact inspection without opening the private source, creating a target, writing migration state or calling a model. Its status is implemented but not accepted. Repository/Drive synchronization and reverse-read are complete; exact final-head rerun, merge and provenance remain required.

## Current stop line

Only Phase 2C-B0 final documentation, Drive, CI/artifact and merge-provenance work is allowed.

Exact private source opening, B1 target creation, Candidate 5, Qwen/DeepSeek, Candidate 6, legacy write/repair, actual target-Mac migration, runtime/UI integration and real thoughts are prohibited.

## Next gate

Complete B0 acceptance. B1 may start only after a separate post-merge authorization and must use read-only exact source → fresh isolated temporary target with source hash before/after, deterministic repeat hash, full rollback and zero model/network calls. Dry-run success never authorizes actual migration automatically.

## Phase 2C-B0 Drive readback

The canonical instruction, status and recovery documents were updated under revision guards and read back at `2026-07-26T14:35:01Z`. Revision IDs are stored in `project-docs/DRIVE_SYNC.json`. This documentation action opened no source, created no target and made no model call.

## Phase 2C-B0 — принятая recovery boundary

B0 принят merge-коммитом `dbf2484c78e4eedcbb2efb3f0b61394b79a6d216`. Финальный exact tree `10b0cd7fea77fdff04cf2e072be9604d2a5c05cb` прошёл verify `30208230376` и package `30208230352`; downloaded source/browser artifacts независимо проверены.

Принятие B0 не разрешает повторный AI-вызов, exact private source access или создание target. Следующий допустимый шаг — только отдельное проектирование B1 read-only source → isolated temporary target. До явного gate Ollama/Qwen/DeepSeek, migration и legacy write запрещены.

## Phase 2C-B1a — pre-merge recovery boundary

Corrected tree `8ef2603b85aef1e7f1ff055cce7579259e3ee659` доказал sanitized read-only source, deterministic two-run equality, native temporary targets, injected rollback, no partial receipt/state, heartbeat/possibly-hung trace and diagnostics download. Portable plan hash `16f82826ae2846136ba2d4f561c0116f17433ce4ab6aa5c3c2c2ab8a4681c52d`; target snapshot hash `6399e23e713214da1574113739e25ea86a220cec8990963c955aeea0a4e73fbf`.

Exact source opened: false. Actual migration performed: false. Real migration target created: false. Sanitized temporary targets used: true. Network/model calls: 0. Automatic retry: forbidden.

B1b нельзя запускать до принятия и post-merge provenance B1a и нового явного подтверждения Артёма на один exact-source read-only dry run.
