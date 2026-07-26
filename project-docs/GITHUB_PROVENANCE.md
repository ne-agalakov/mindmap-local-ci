# GitHub provenance and source-artifact verification

Status: mandatory release protocol for MindMap beginning with Alpha.19 candidate 5.

## Technical source of truth

The technical version is identified by `repository + commit SHA`.

- Repository: `ne-agalakov/mindmap-local`.
- Candidate 5 source baseline: `f01508059abc1bd99f9a05527f16bb52e6a667ee`.
- Initial verification and packaging gates: `2c498d84007c8ba5c011cec881ba732de5721bc4`.
- Exact-commit packaging and portability merge: `82fc0691274b4b32070723e3da31b48ddcd39398`.

A local directory, version label, downloaded ZIP, or successful build without a
commit SHA is not a source of truth.

## PR #4 incident

PR #4 first made `package-source` run against the exact same-repository pull
request head. The workflow and the full verification workflow were green.

A mandatory reverse check then downloaded the generated artifact and found a
separate deterministic packaging defect: the `.sha256` manifest contained an
absolute GitHub runner path under `/home/runner/...`. The archive bytes were not
corrupt, but standard checksum verification failed after the files were moved to
a normal download directory.

Root cause: `scripts/package-source.sh` passed an absolute output path to
`sha256sum`.

## Correction

The packaging script now:

1. changes into `release-artifacts` before writing the checksum manifest;
2. writes only the archive basename;
3. supports Linux `sha256sum` and macOS `shasum -a 256`;
4. refuses a dirty Git worktree;
5. injects the exact repository and commit SHA into `ARTIFACT_REVISION.json`;
6. packages the exact pull-request head and every commit pushed to `main`.

`tests/source-packaging.test.mjs` is an integration regression. It creates a
temporary clean Git repository, runs the real package script, verifies that the
manifest contains no path separator or runner path, and independently
recomputes the archive SHA-256.

## Downloaded artifact proof

The corrected artifact for commit
`58621f6fd84adae68f1dd5f416c4a9d7500e6623` was downloaded from GitHub Actions
and inspected outside the runner.

- GitHub Actions artifact digest:
  `ec7057326f3bde662fe4adfee5db40f08581b23146569f5f6f5bc6a60840d627`.
- Inner source ZIP SHA-256:
  `bce19a8c25d933b5ad8ddfe7e2046b9107af376a21c52af781370099a78eced0`.
- The unmodified relative manifest verified successfully from another directory.
- `ARTIFACT_REVISION.json` named the exact repository and commit.
- The archive contained no user database, diagnostics, logs, `.env*`, `.git`,
  `.next`, `node_modules`, runtime cache, or nested release artifacts.

The final reviewed PR head
`e20bcf71a12a3f5c1f45732414430a8e6de73832` passed Linux full CI, macOS targeted
CI, and source packaging. PR #4 merged as
`82fc0691274b4b32070723e3da31b48ddcd39398`. GitHub comparison reported no file
differences between the reviewed head and merge commit; the additional commit is
merge metadata only.

## Mandatory release invariant

A green workflow is necessary but insufficient. Before merge or handoff, the
exact generated artifact must be downloaded and checked without editing:

- checksum verification succeeds from a different directory;
- the manifest contains only a relative archive filename;
- the embedded repository and commit match the reviewed source;
- forbidden user and runtime files are absent;
- any failure blocks merge and requires a regression test.

These checks do not call Ollama, Qwen, or DeepSeek and do not start or continue a
semantic run.

## Remaining product boundary

GitHub provenance and source-artifact portability are closed for this stage.
Candidate 5 remains a test candidate until its persisted model-mismatch block,
disabled incompatible continuation, and separate clean DeepSeek-run action are
visually checked on the target Mac. Semantic stability across the 96-thought
orders remains unproven. Real personal thoughts remain prohibited.
