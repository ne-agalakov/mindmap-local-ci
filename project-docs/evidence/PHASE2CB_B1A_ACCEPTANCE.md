# Phase 2C-B1a acceptance provenance

Date: 2026-07-27
Status: accepted on sanitized fixtures only; B1b blocked.

## Accepted merge

- private PR: #43;
- final private head: `c1237b9ba012d60dc720bf940082c7d8e88f4e1e`;
- public exact head: `667b218b8bf863c45ae074db65a314e77786f8d0`;
- shared tree: `58d2bb0e9b7edebb3d3d830064406feffbff5181`;
- squash merge: `aec5edaca877cec5d769f4ce4efff674a9c92a7d`.

## Final CI

- verify `30245125059`: Linux npm ci/lint/full suite, actual Chrome run storage, graph storage and B1a IndexedDB, release-document gate, macOS npm ci and launcher regressions — passed;
- package `30245125058`: full tests and source/exporter packaging — passed.

## Downloaded artifacts

- source artifact SHA-256 `db61f1e92639e3320062977f5d4f949442ba9ffbeac0e8678a10ee473251477d`;
- inner source ZIP `264503b2394d0d58a842e26030d4a555892bd7ec73d8c96ff569b85b699d963b`;
- inner exporter ZIP `9ba8213c8146467d87f0ed5c1512c62722feb1ebaf4b989e60da7ba2908241ef`;
- browser artifact `482fc377d64de16e6927998e3f8ad087a383ed118f802f7cf4d605b4c4f77ac2`;
- browser log `f5ab869cab617275d3d5d44762ab6c5bf0337240e00fadb6fb976564f905db87`.

Portable manifests, exact embedded public commit, inventory and executable modes passed. No SQLite/database, `.env`, credential/private key, logs, caches, generated dependencies, carrier files or personal thought payloads were found.

## Proven sanitized behavior

- physical SQLite open in read-only mode;
- source before/after bytes equal;
- two plan hashes equal;
- two target hashes equal;
- actual Chrome IndexedDB isolated temporary targets;
- injected failure leaves target empty and no idempotency receipt;
- typed stops and no automatic retry;
- REQ-OBS trace, live state, inactivity/possibly-hung state and diagnostics;
- model mode `без AI`;
- network/model calls = 0.

Portable plan hash: `16f82826ae2846136ba2d4f561c0116f17433ce4ab6aa5c3c2c2ab8a4681c52d`.

Target snapshot hash: `6399e23e713214da1574113739e25ea86a220cec8990963c955aeea0a4e73fbf`.

## Root cause and correction

The initial implementation head contained invalid Chrome runner syntax and invalid `actions/checkout4`. Exact-tree comparison isolated those two delivery defects; the other 17 B1a files were byte-identical. The defects were corrected before final exact-tree acceptance.

## Post-merge Drive readback

- instruction revision `AIroW35Y1U0r_r73mOrdrwqiiIOSGsKbah6EXtyEdM28wfo8egtsiBsD4Q7EsKr-QYPnXd-gsFEUqO3zDx_PYYnk2Q8D_i_ZQYAdo164AXc`;
- status revision `AIroW34oLCkzUN9QtOSaR-ptpPWPh03tV5RVUAHyxOwfyzbSH58we1dihjmRUsrfLq0ucd3w5FGbmSYZBjrmNZ0rAJJ1S_K9mpKNwBlQe6c`;
- recovery revision `AIroW35wmk74YOmnEwaipn2u_530U4qTtSsbRFFwsWmmhc4rvNmhnYFc7rdz-9F1XRDcG_C1VdWIhe0q_dFxBfsOZH3i5BXOrmyenwcuudk`.

Acceptance markers were found after write.

## Proof boundary

Exact private source opened: false.
Real migration target created: false.
Actual migration performed: false.
Network/model calls: 0.

B1b is not authorized automatically. It requires a new explicit user confirmation for exactly one read-only exact-source dry run with a fresh isolated temporary target. Actual migration remains a separate later gate.
