# Phase 2C-A verification record

Date: 2026-07-26

Status: the exact Phase 2C-A code head passed an offline real-Chrome IndexedDB proof on the target Mac. PR #38 is **not accepted** because GitHub Actions, downloaded-artifact, Drive synchronization and merge-provenance gates remain open.

## Exact source binding

- repository: `ne-agalakov/mindmap-local`;
- PR: `#38`;
- verified code head: `02df8758a7c42b33b22b397dae74445cd6a5f7ac`;
- uploaded proof JSON SHA-256: `5b47e3681a23474d21ee2f703c93a94a8f79d2b93c11e65642667ce8283b97bc`;
- offline runner ZIP SHA-256: `aef0111128e2182218081ef2fa5536e24bde3bc4383961455e5150c5ba559419`;
- executed browser harness SHA-256: `ecfee87cac41410a2d1f5b71f3c1a90303f53f42afcf3007c11dd33b6ba2231a`;
- compile manifest SHA-256: `7af9f964a6d09dc18a6336930218e3f17ea5ed34ddc73490e9ce7b8ab0607914`.

The committed JSON is an unmodified copy of the returned proof file.

## Passed actual-browser assertions

The proof used Google Chrome `150.0.7871.184`, Node.js `v24.18.0`, real browser IndexedDB and an isolated temporary Chrome profile.

Passed:

- atomic graph commit;
- close/reopen persistence;
- reopen-stable idempotency;
- synthetic/personal workspace isolation;
- accepted run-adapter compatibility in the unified database;
- transaction abort rollback;
- refusal to silently extend an existing run-only database;
- schema metadata verification;
- persisted corruption detection by replay/hash mismatch;
- follow-up write rejection with `integrity_mismatch` after corruption;
- link lifecycle: initial confirmed link rejected, proposed → confirmed accepted, confirmed → proposed rejected;
- deterministic 64-character snapshot hash: `ee7f14540dbc394654b81e1724dc35b0b01f8d13f303ab03a157e5c1079b4fc1`.

## Safety boundary

The runner reported:

- local loopback only;
- no required network access;
- no npm or Vite use;
- no private data;
- zero model calls;
- no migration;
- isolated temporary browser profile removed after the run.

The source audit of `run.mjs` found no write path into `/Applications`: it only reads browser metadata, starts the browser executable, creates/removes a temporary profile and writes the proof JSON beside the runner.

## macOS privacy warning

During the run macOS displayed a privacy notification stating that Terminal was blocked while attempting to make changes to applications on the Mac.

Facts:

- the proof completed successfully immediately before the notification was captured;
- the runner source does not request modification of the Chrome application bundle;
- the notification origin is not proven.

Therefore the warning does not invalidate the recorded IndexedDB assertions, but it remains an unresolved environmental anomaly. No claim is made that all operating-system side effects are explained. The test must not be repeated solely to investigate this warning unless a later gate requires it.

## GitHub Actions blocker

The original and manually repeated workflow runs failed before executing their first step:

- `verify` run `30173090094`;
- `package-source` run `30173090107`.

The latest jobs contain no step records, downloadable logs or artifacts. This is not evidence that tests failed. It is also not a green gate. The exact infrastructure cause remains unproven.

## Covered by this evidence

- actual macOS Chrome IndexedDB behavior for the focused Phase 2C-A scenarios;
- graph/run store coexistence in a fresh unified database;
- atomicity, rollback, idempotency, isolation and corruption refusal;
- no model, migration or private-data use by the proof runner.

## Not covered

- full `npm test` and lint on the exact final PR head;
- Linux and GitHub-hosted macOS jobs;
- GitHub-hosted browser-harness artifact;
- source-package and exporter-package artifact review;
- Google Drive update and reverse read;
- merge provenance;
- Phase 2C-B exact-source dry run;
- actual target-Mac migration, runtime/UI integration, REQ-OBS-001 or semantic quality.

## Next gate

Restore a runnable GitHub Actions gate, then run verification and packaging on the exact final PR head. Download and inspect the generated artifact, synchronize Drive and reverse-read it, merge PR #38 with exact provenance, and only then unblock Phase 2C-B. Actual target-Mac migration remains prohibited.
