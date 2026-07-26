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

## Current stop line

Candidate 5, Qwen/DeepSeek, Candidate 6, legacy write/repair, actual target-Mac migration, runtime/UI integration and real thoughts are prohibited.

## Next gate

Freeze Phase 2C-B deterministic mapping and typed-stop contract, then prove an isolated dry run. Dry-run success never authorizes actual migration automatically.
