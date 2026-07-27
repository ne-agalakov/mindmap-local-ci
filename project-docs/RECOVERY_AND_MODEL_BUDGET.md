# MindMap — восстановление и бюджет локальной модели

Статус: обязательный инженерный протокол для v0.6-alpha.19 и нового state-core.

## Основное правило

Локальная модель не компенсирует ошибки кода, миграции или восстановления. Повторный AI-запрос допустим только после доказательства отсутствия нужного ответа в сохранённых данных и отдельного подтверждения пользователя. Для deterministic-code и storage/migration ошибок сначала выполняется read-only диагностика.

## Принятый legacy-источник

- size `5 070 848` bytes;
- SHA-256 `356b943275cce292d0e14f8a7fbe95af07e79de73f06d3e361874d342aa2f918`;
- export/inspection `readonly`;
- bytes modified false;
- integrity `ok`;
- 96 synthetic, 0 personal thoughts.

Raw source остаётся private и вне Git.

## Принятые storage/recovery основания

- Phase 1A `e7b7593932614f8dfa843298f35eff0230c1e827`;
- Phase 2A `aa5eaaae08a3da4d0ff00ea03aea12b793137a21`;
- Phase 2B `b4b35dcd7125c820f75f89387bc18ac3fa509cb0`;
- Phase 2C-A `292634312ad04fa6e6cfc5a5ded311ac1020094d`;
- Phase 2C-B0 `dbf2484c78e4eedcbb2efb3f0b61394b79a6d216`;
- Phase 2C-B1a `aec5edaca877cec5d769f4ce4efff674a9c92a7d`.

Приняты transaction completion as commit, append-only replay, revision/idempotency guards, workspace isolation, abort rollback, corruption refusal, deterministic graph/payload mapping и explicit unresolved/damaged-reference distinction.

## Phase 2C-B1a — accepted recovery boundary

B1a принята только как sanitized executor/harness.

```text
final private head: c1237b9ba012d60dc720bf940082c7d8e88f4e1e
public exact head:  667b218b8bf863c45ae074db65a314e77786f8d0
shared tree:        58d2bb0e9b7edebb3d3d830064406feffbff5181
merge:              aec5edaca877cec5d769f4ce4efff674a9c92a7d
verify:             30245125059
package:            30245125058
```

Proven on sanitized fixtures:

- physical SQLite open in read-only mode;
- source before/after identity;
- deterministic two-clean-run plan and target hashes;
- actual Chrome IndexedDB isolated temporary targets;
- injected failure leaves no partial target or receipt;
- typed stops and no automatic retry;
- heartbeat, inactivity, possibly-hung state and downloadable diagnostics;
- model mode «без AI»;
- network/model calls = 0.

Portable plan hash: `16f82826ae2846136ba2d4f561c0116f17433ce4ab6aa5c3c2c2ab8a4681c52d`.

Target snapshot hash: `6399e23e713214da1574113739e25ea86a220cec8990963c955aeea0a4e73fbf`.

Exact source was not opened, actual migration was not performed, and no real migration target was created.

## Google Drive post-merge readback

- instruction `AIroW35Y1U0r_r73mOrdrwqiiIOSGsKbah6EXtyEdM28wfo8egtsiBsD4Q7EsKr-QYPnXd-gsFEUqO3zDx_PYYnk2Q8D_i_ZQYAdo164AXc`;
- status `AIroW34oLCkzUN9QtOSaR-ptpPWPh03tV5RVUAHyxOwfyzbSH58we1dihjmRUsrfLq0ucd3w5FGbmSYZBjrmNZ0rAJJ1S_K9mpKNwBlQe6c`;
- recovery `AIroW35wmk74YOmnEwaipn2u_530U4qTtSsbRFFwsWmmhc4rvNmhnYFc7rdz-9F1XRDcG_C1VdWIhe0q_dFxBfsOZH3i5BXOrmyenwcuudk`.

Acceptance-маркеры найдены после записи.

## REQ-OBS-001

Каждая длительная операция показывает name/type, elapsed time and volume, last progress/heartbeat, state, model или «без AI» и downloadable diagnostics. Timer freezes on pause/error/completion. Stale activity означает «возможно, процесс завис», но не доказывает зависание и не разрешает автоматический restart/retry.

## B1b recovery contract — пока только будущий gate

B1b можно запускать только после нового явного подтверждения Артёма ровно на один dry run. До подтверждения запрещено даже искать или открывать exact source.

Обязательные условия будущего B1b:

- exact accepted source path/hash и strict read-only open;
- source bytes/hash before and after equal;
- synthetic workspace, personal thoughts = 0;
- fresh empty isolated temporary target;
- deterministic versioned mapping and repeat-run target hash;
- typed stop on source/schema/count/workspace/reference/ambiguity mismatch;
- injected failure deletes target and leaves no partial receipt/state;
- network/model/Ollama/Qwen/DeepSeek = 0;
- no automatic retry after failure/reload/version change.

No automatic retry, model call or B1b execution is authorized.

Даже успешный B1b dry run не разрешает actual target-Mac migration. Actual migration требует отдельного последующего подтверждения, backup/rollback plan и production REQ-OBS-001 proof.
