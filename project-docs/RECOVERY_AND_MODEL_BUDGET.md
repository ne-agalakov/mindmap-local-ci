# MindMap — восстановление и бюджет локальной модели

Статус: обязательный инженерный протокол. Актуально для v0.6-alpha.19 и нового state-core.

## Основное правило

Локальная модель не компенсирует ошибки кода, миграции или восстановления. Повторный AI-запрос допустим только после доказательства, что нужного ответа нет в сохранённых данных, и отдельного подтверждения Артёма. Для deterministic-code и storage/migration ошибок сначала выполняется read-only диагностика.

## Принятый legacy-источник

- size `5 070 848` bytes;
- SHA-256 `356b943275cce292d0e14f8a7fbe95af07e79de73f06d3e361874d342aa2f918`;
- evidence SHA-256 `51e3d9563b09c91427716eee559745fed35d729e9ffd71f180afa91c3fc7aa2b`;
- export/inspection `readonly`;
- bytes modified false;
- write/migration/network/model calls 0;
- integrity `ok`;
- 96 synthetic, 0 personal thoughts.

Raw source remains private and outside Git.

## Accepted storage foundations

- Phase 1A merge `e7b7593932614f8dfa843298f35eff0230c1e827`;
- Phase 2A merge `aa5eaaae08a3da4d0ff00ea03aea12b793137a21`;
- Phase 2B merge `b4b35dcd7125c820f75f89387bc18ac3fa509cb0`.

Accepted Phase 2B invariants: validated namespace, legacy-name refusal, atomic run transaction, transaction-completion commit signal, stale-writer rejection, reopen idempotency, workspace isolation, abort rollback, failed-upgrade rollback and deterministic snapshot.

## Phase 2C-A recovery/storage evidence

PR #38 code head `02df8758a7c42b33b22b397dae74445cd6a5f7ac` adds atomic graph/payload storage.

Target-Mac real-Chrome proof passed:

- graph atomic commit and close/reopen;
- idempotency and synthetic/personal isolation;
- coexistence with accepted run adapter;
- abort rollback;
- refusal of run-only database;
- schema metadata;
- corruption detection and follow-up `integrity_mismatch`;
- proposed → confirmed link lifecycle.

Offline proof snapshot: `ee7f14540dbc394654b81e1724dc35b0b01f8d13f303ab03a157e5c1079b4fc1`.

A public, history-free mirror of private head `85b158ebed11f494fe7e4766453693de01d75bfe` passed verify `30196934408` and package `30196934411`. Downloaded artifacts:

- outer source `c26b5d16138713b69eba3aedba1d84512cac8e0c9429a598921a8ead8fab1c67`;
- inner source `ce8dded192e282a15faf652e2dd9b68aec4fd045403ef5a6027c4e25f155c45b`;
- inner exporter `fcc1c4522d3151b4884df2cf32bde6dc0c34279ced4bf0c22266216414d431c8`;
- browser proof `bdb578601f74b7214b8a51c0d3a3c1b1d8b6bab47f79a555d554ec7a504dbb31`.

Database, secret, personal-data, local-path and runtime-cache findings = 0. Model/migration calls = 0.

The target-Mac and GitHub graph harnesses use different fixed records, so their absolute hashes differ by fixture. Each proves reopen equality independently. Same-fixture cross-environment equality remains an explicit missing regression.

## Future Phase 2C-B dry-run protocol

Allowed only after Phase 2C-A merge provenance:

- exact accepted source/hash and read-only open;
- source byte-stability before/after;
- synthetic workspace and zero personal thoughts;
- fresh empty temporary target, never production/target-Mac;
- deterministic versioned mapping and target hash;
- repeat run equality;
- typed stops for mismatch, personal data, wrong schema/workspace, duplicate run, ambiguity, invalid reference and non-empty target;
- injected failure rolls back target fully;
- network/model/Ollama/Qwen/DeepSeek = 0;
- actual target-Mac migration remains prohibited.

## REQ-OBS-001

Every long operation shows name/type, elapsed time and volume, last progress/heartbeat, state, model or «без AI», and downloadable diagnostics. Timer freezes on pause/error/completion. No automatic restart or AI retry.

## Current stop line

Candidate 5, Qwen/DeepSeek, Candidate 6, legacy write/repair, Phase 2C-B before Phase 2C-A acceptance, actual target-Mac migration, runtime/UI integration and real data are prohibited.

## Release gate

The exact final documentation head must pass Linux/macOS/browser/package CI in the public mirror and its artifacts must be independently inspected. Then PR #38 may be merged with an expected-head guard. The merge SHA must be recorded in a separate GitHub/Drive provenance update and reverse-read. A dry-run success never authorizes actual migration automatically.
