# Phase 2C-A verification record

Date: 2026-07-26

Status: implementation, target-Mac focused browser proof, public-mirror full CI, downloaded-artifact inspection and Drive readback passed. PR #38 is **not accepted until merge and exact merge provenance are complete**.

## Exact source binding

- private repository: `ne-agalakov/mindmap-local`;
- PR: `#38`;
- verified code head: `02df8758a7c42b33b22b397dae74445cd6a5f7ac`;
- private documentation head used for the first public snapshot: `85b158ebed11f494fe7e4766453693de01d75bfe`;
- public snapshot commit: `f4f7d3a127fd0ed3c09431f24ade3acd73b78810`;
- public tree: `5c7dc8a0cf607ce24f591ba91c4431d30f035f51`;
- snapshot digest: `7fa3dc7f0fedcd8b6f96d309fecb178a1e6d1a3b7919eec928809be5ea6988f4`.

## Target-Mac proof

- proof JSON: `5b47e3681a23474d21ee2f703c93a94a8f79d2b93c11e65642667ce8283b97bc`;
- offline runner ZIP: `aef0111128e2182218081ef2fa5536e24bde3bc4383961455e5150c5ba559419`;
- harness: `ecfee87cac41410a2d1f5b71f3c1a90303f53f42afcf3007c11dd33b6ba2231a`;
- compile manifest: `7af9f964a6d09dc18a6336930218e3f17ea5ed34ddc73490e9ce7b8ab0607914`;
- Chrome `150.0.7871.184`, Node `v24.18.0`, real IndexedDB, isolated profile.

Passed:

- atomic graph commit;
- close/reopen persistence;
- reopen-stable idempotency;
- workspace isolation;
- run-adapter coexistence;
- abort rollback;
- run-only database refusal;
- schema metadata;
- persisted corruption detection and `integrity_mismatch`;
- proposed → confirmed link lifecycle;
- local fixture snapshot `ee7f14540dbc394654b81e1724dc35b0b01f8d13f303ab03a157e5c1079b4fc1`.

The macOS application-management warning remains unexplained. Source audit found no write path into `/Applications`; it is recorded as an environmental anomaly.

## Private Actions root cause

The original private jobs did not execute any step because private Actions minutes were exhausted. This explains the pre-step failures; it is not a code/test failure.

## Public mirror CI

The public mirror contains a history-free snapshot only. No old commits, private PRs, Issues, Actions history, deleted files, database or personal data were transferred.

Final repeated runs on the unchanged snapshot tree:

- verify `30196934408`: Linux full, lint, complete test suite, actual Chrome run-storage, actual Chrome graph-storage and macOS launchers — success;
- package-source `30196934411`: tests, source package, compact exporter package and upload — success.

## Downloaded-artifact inspection

- outer source artifact: `c26b5d16138713b69eba3aedba1d84512cac8e0c9429a598921a8ead8fab1c67`;
- inner source ZIP: `ce8dded192e282a15faf652e2dd9b68aec4fd045403ef5a6027c4e25f155c45b`;
- inner exporter ZIP: `fcc1c4522d3151b4884df2cf32bde6dc0c34279ced4bf0c22266216414d431c8`;
- browser graph proof artifact: `bdb578601f74b7214b8a51c0d3a3c1b1d8b6bab47f79a555d554ec7a504dbb31`;
- browser log: `ca1315e9f561da019ba219e195185375b3f5b0ff25e2569818acff4d9a3f40e1`.

Required files and embedded public commit passed. Findings for DB, `.env`, credentials, private keys, concrete local user-home paths, runtime cache and personal data: `0`.

## Snapshot-hash boundary

GitHub browser fixture snapshot: `bc59236e3ce7173c3f91176fb163f808a99de6f2343afcdc6eea8b12bdca5a54`.

It differs from the offline snapshot because the harnesses use different fixed thought text, IDs and timestamps. They are not the same canonical state. Both harnesses prove close/reopen equality for their own fixture. Same-fixture cross-environment hash equality is not covered and must not be inferred.

## Drive readback

Updated and reverse-read revisions:

- instruction: `AIroW379xc8qrT6UxiJg722b6cW5MN6sLIh1gK6Lnm3V4AKoq-8Co7w_hg0xuuz--a0HDeLlgo3iLE0Slrw-CxIab5qrmJZiU1iaqJmzEE8`;
- status: `AIroW36MA-FzprvDJ93NZDney89F4rNOr_Lj-0l-DxgpxPf-ZMDMd2AmuyIYvueFBb0yb3utGjeeO5EkfoeWpXn3NCsnoJNsVSotZZdtg-Y`;
- recovery: `AIroW35fvugGJYnXlnAUOruMPEUqNQ8RXTw83EFnefU8YXp8kd3peGkkYBd9XzB2raJ9EwuEHZL_tDW8Q92ppCJ3izgavGiBTYhqoWt1T9E`.

## Final documentation gate regression

The first exact final-tree PR runs failed:

- verify `30198335321`;
- package-source `30198335318`.

`macos-launchers` passed. Linux/full and packaging stopped during `npm test` before browser execution because `check-release-docs.sh` required lowercase `same-fixture...`, while README intentionally used sentence-initial `Same-fixture...`. Root cause: a case-sensitive exact-marker mismatch in the release documentation gate, not graph storage or application code. The expected marker was corrected to the actual required text; the release-doc test remains the regression guard.

The first external privacy scan of the corrected artifact matched only two documentation-only generic user-home-pattern examples, not a concrete username or filesystem path. The wording was corrected so the machine scan and the claim both resolve to zero findings.

## Covered

- Phase 2C-A graph/payload contract and storage behavior;
- target-Mac focused Chrome scenarios;
- GitHub-hosted Linux/macOS/full tests/browser tests;
- source/exporter packaging and external artifact inspection;
- Drive synchronization/readback;
- zero model/migration/private-data use in evidence workflows.

## Not covered

- merge provenance;
- same-fixture cross-environment snapshot equality;
- Phase 2C-B exact-source dry run;
- actual target-Mac migration;
- production runtime/UI and REQ-OBS-001;
- service-level exactly-once model POST;
- semantic quality and multi-order stability;
- personal-data safety.

## Next gate

Mirror the exact final documentation head, rerun public CI and external artifact inspection, merge PR #38 with expected-head protection, then record merge provenance in a separate GitHub/Drive update. Actual migration remains prohibited.
