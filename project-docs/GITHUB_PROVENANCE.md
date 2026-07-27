# GitHub provenance and source-artifact verification

## Technical source of truth

The technical version is identified by `repository + commit SHA`. A local directory, version label, green build or downloaded ZIP without exact commit provenance is not a source of truth.

Repository: `ne-agalakov/mindmap-local`.

## Mandatory artifact invariant

A green workflow is necessary but insufficient. Before merge or handoff, the exact generated artifact is downloaded and checked outside the runner without editing:

- portable checksum manifests verify from another directory;
- embedded repository/commit matches the reviewed source;
- required inventory and executable modes are correct;
- user databases, `.env`, credentials, logs, caches, generated dependencies and personal payloads are absent;
- any failure blocks merge and requires a regression scenario.

This invariant was introduced after a green artifact contained an absolute runner path in its checksum manifest. The packaging regression now enforces relative manifests and independently recomputes SHA-256.

## Accepted technical foundations

- Phase 0: `850a5fc60a154047eae1f6a5d4f63c7969ae8412`;
- Phase 1A: `e7b7593932614f8dfa843298f35eff0230c1e827`;
- Phase 2A: `aa5eaaae08a3da4d0ff00ea03aea12b793137a21`;
- Phase 2B: `b4b35dcd7125c820f75f89387bc18ac3fa509cb0`;
- Phase 2C-A: `292634312ad04fa6e6cfc5a5ded311ac1020094d`;
- Phase 2C-B0: `dbf2484c78e4eedcbb2efb3f0b61394b79a6d216`;
- B1 execution plan: `8a8c0eb522fb9d7646f4e6c4c4e0da2fcdf24b8b`;
- Phase 2C-B1a: `aec5edaca877cec5d769f4ce4efff674a9c92a7d`.

Private Actions minutes were exhausted during later phases. History-free public snapshots were used only after exact Git-tree equality was proven. Carrier workflows and their jobs were never treated as final evidence; only materialized exact-tree commits and their downloaded artifacts were accepted.

## Phase 2C-B1a initial rejection and root cause

Initial implementation head: `42644037d2b4d66d3e92cff4a591d5b3ea58078f`.

Exact-tree comparison proved two delivery defects:

1. invalid Chrome runner syntax `throw new Error, ...`;
2. invalid macOS action `actions/checkout4`.

The remaining 17 B1a files were byte-identical to the tested implementation. Only the two defective delivery files were corrected before acceptance.

Corrected code head: `df2570b6cfea74296248297b7000b29876036e95`.

## Phase 2C-B1a final exact-tree evidence

```text
private final head: c1237b9ba012d60dc720bf940082c7d8e88f4e1e
public exact head:  667b218b8bf863c45ae074db65a314e77786f8d0
shared Git tree:    58d2bb0e9b7edebb3d3d830064406feffbff5181
```

Final public runs:

- verify `30245125059` — Linux npm ci/lint/full suite, actual Chrome run storage, graph storage and B1a IndexedDB, release-document gate, macOS npm ci and launcher regressions;
- package `30245125058` — full tests and source/exporter packaging.

Downloaded outside the runner:

- source artifact `db61f1e92639e3320062977f5d4f949442ba9ffbeac0e8678a10ee473251477d`;
- inner source `264503b2394d0d58a842e26030d4a555892bd7ec73d8c96ff569b85b699d963b`;
- inner exporter `9ba8213c8146467d87f0ed5c1512c62722feb1ebaf4b989e60da7ba2908241ef`;
- browser artifact `482fc377d64de16e6927998e3f8ad087a383ed118f802f7cf4d605b4c4f77ac2`;
- browser log `f5ab869cab617275d3d5d44762ab6c5bf0337240e00fadb6fb976564f905db87`.

Portable manifests, embedded exact public commit, required files, source/exporter inventory and B1a browser result were checked outside the runner. No SQLite/database file, `.env`, credential/private key, runtime cache, generated dependency tree, carrier file or personal thought payload was found. Literal documentation examples of runner/user paths were not misclassified as real paths.

Browser proof:

- native IndexedDB true;
- repeated plan hashes equal;
- repeated target hashes equal;
- rollback target empty;
- source unchanged;
- REQ-OBS trace/live state/diagnostics true;
- exact source opened false;
- actual migration false;
- network/model calls 0.

Portable plan hash: `16f82826ae2846136ba2d4f561c0116f17433ce4ab6aa5c3c2c2ab8a4681c52d`.

Target snapshot hash: `6399e23e713214da1574113739e25ea86a220cec8990963c955aeea0a4e73fbf`.

## Phase 2C-B1a merge and post-merge Drive provenance

PR #43 was marked ready only after the final exact-tree artifact review and was squash-merged with expected head `c1237b9ba012d60dc720bf940082c7d8e88f4e1e` as:

`aec5edaca877cec5d769f4ce4efff674a9c92a7d`.

Canonical Google Docs were then updated under revision guards and reverse-read:

- instruction `AIroW35Y1U0r_r73mOrdrwqiiIOSGsKbah6EXtyEdM28wfo8egtsiBsD4Q7EsKr-QYPnXd-gsFEUqO3zDx_PYYnk2Q8D_i_ZQYAdo164AXc`;
- status `AIroW34oLCkzUN9QtOSaR-ptpPWPh03tV5RVUAHyxOwfyzbSH58we1dihjmRUsrfLq0ucd3w5FGbmSYZBjrmNZ0rAJJ1S_K9mpKNwBlQe6c`;
- recovery `AIroW35wmk74YOmnEwaipn2u_530U4qTtSsbRFFwsWmmhc4rvNmhnYFc7rdz-9F1XRDcG_C1VdWIhe0q_dFxBfsOZH3i5BXOrmyenwcuudk`.

Exact acceptance markers were found after write.

## Accepted boundary

B1a is accepted only for sanitized executor/harness behavior. It does not authorize B1b, exact-source access, a real migration target, actual migration, runtime/UI, model execution or real thoughts.

A later B1b attempt requires a new explicit user confirmation for exactly one read-only exact-source dry run against a fresh isolated temporary target. Actual migration remains a later independent gate.
