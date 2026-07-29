# Phase 2C-B1a final pre-merge gate

Date: 2026-07-27
Status: implementation proven on sanitized fixtures; final documentation-tree rerun and merge pending.

## Exact corrected tree

- private PR #43 head: `df2570b6cfea74296248297b7000b29876036e95`;
- public exact head: `76a6da518301fcddbcaa9c3e06fdeb46805dbf6c`;
- shared tree: `8ef2603b85aef1e7f1ff055cce7579259e3ee659`.

The initial head `42644037d2b4d66d3e92cff4a591d5b3ea58078f` was not accepted. Exact-tree comparison proved two delivery defects: invalid Chrome runner syntax and invalid macOS checkout action. Only those two files were corrected; the other 17 B1a files were byte-identical.

## Passed gates

- verify `30239528354`: Linux npm ci/lint/full suite, actual Chrome run storage, graph storage and B1a IndexedDB; release-document check; macOS npm ci and launcher regressions;
- package `30239528365`: full tests and source/exporter packaging;
- local B1a core/read-only SQLite: 9/9;
- downloaded source and browser artifacts inspected externally.

## Artifacts

- GitHub source artifact digest: `9ccc881ad9f80c7a519a7d468dafb0797678b454631aaa63e8cc42854d19024a`;
- downloaded source artifact: `9cccf89719947caeda2e8aa607321ed2dc6fff8e66fb501e6e32971b989acdf5`;
- inner source: `2aa6ce72815af3c9a934fa64b9ed98442dac3aa3496a8a1beb6db87542296fb0`;
- inner exporter: `b66b4949d0109e4a0379957cef027601377ea37062b164a13bee469169e6b699`;
- GitHub browser artifact digest: `8bff5ba4e1599a776466d9a3a3536169e304dd5755195740175735d0c3a918e2`;
- downloaded browser artifact: `8bfffb51c89766147f83268fd881982f209270726c1a4372b15c0212161b22c6`;
- browser log: `c8132cc36f5c508c3ffde7244d5e30888d707287af1aa7e6d6f96a99903dc202`.

No SQLite/DB, `.env`, private key/token, concrete `/Users/...` path or personal thought payload was found.

## Browser proof

- portable plan hash: `16f82826ae2846136ba2d4f561c0116f17433ce4ab6aa5c3c2c2ab8a4681c52d`;
- target snapshot hash: `6399e23e713214da1574113739e25ea86a220cec8990963c955aeea0a4e73fbf`;
- two plan hashes equal: true;
- two target hashes equal: true;
- rollback target empty: true;
- source unchanged: true;
- actual Chrome IndexedDB: true;
- REQ-OBS trace/live rendering/diagnostics: true;
- exact source opened: false;
- actual migration performed: false;
- network/model calls: 0.

## Drive readback

- instruction: `AIroW36K3Iq8m6dAwSPcI4bropFE55ZTLVgSokZFkI5D1eGMWY-8HJtPorCQSTN0sOD2p0h7QKcTctQCrDMGPon05gtLxQa2sgoiV7JRsag`;
- status: `AIroW37cSu7nj57SJ8uA8jXXqE-pcObCMunZA_ge4NCFtX6KJq4lD8H_lE_ZuDaBa7LEdC0cfAC_2eWEEg2Of3PiDU9tc4EmJ4az9k_1OPA`;
- recovery: `AIroW35eVrOsCHSJux6s5j-t-JgF0RDkttXKMgfgRYeCwgMEhov29RRtxs80LUk-jJ7wVvnRb6_GTrUS75nIu888QFqb2GkzvD_XkA0XGRU`.

All three B1a markers were found after write.

## Proof boundary

B1a remains unaccepted until this documentation tree passes a new exact-tree CI/artifact gate, PR #43 is merged and post-merge provenance is recorded. B1b and actual migration are not authorized.
