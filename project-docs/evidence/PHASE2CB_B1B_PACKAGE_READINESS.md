# Phase 2C-B1b package readiness

Date: 2026-07-27
Status: package gate prepared; one authorized local exact-source dry run pending

## Authorization

Artyom authorized exactly one B1b read-only dry run against the accepted exact SQLite source. The authorization does not permit actual migration, production namespace use, model calls, network calls, automatic retry or a second attempt.

## Exact source identity

```text
size:   5,070,848 bytes
sha256: 356b943275cce292d0e14f8a7fbe95af07e79de73f06d3e361874d342aa2f918
```

The source has not been opened by B1b and is not contained in Git or any artifact.

## Implemented gate

- freeze manifest before SQLite open;
- physical `DatabaseSync` read-only open;
- `PRAGMA query_only = ON`;
- exact schema/count/integrity checks;
- sanitized candidate extraction in memory;
- two fresh isolated IndexedDB target passes;
- one injected rollback pass;
- deterministic plan and target hashes;
- source SHA-256 before/after equality;
- deletion of temporary targets after evidence capture;
- REQ-OBS trace, live state, heartbeat/inactivity handling and diagnostics download;
- persistent one-shot lock and no automatic retry;
- standalone macOS launcher and seven-file package.

## Code-head identity before documentation head

```text
private head: d477203bbdf226e3252f741b31c9d45acf1b1499
public head:  47876e8b35a8b7c93903f82022a28eab64f02d53
shared tree:  ad431eaed0945039371011df1be0c989a634b050
```

## Proven regressions and fixes

### Outer pull-request SHA was not checkout provenance

Symptom: packaging fixture attempted to resolve a `GITHUB_SHA` merge commit unavailable in its temporary repository.

Root cause: the packager trusted CI environment provenance instead of the actual checked-out repository.

Fix: derive commit and tree from `git rev-parse HEAD`; an optional requested commit is accepted only when it resolves to that HEAD.

Regression: fixture supplies a stale all-zero `GITHUB_SHA` and must still package its actual checkout.

### Repository and commit could identify different repositories

Symptom: an otherwise valid public package could state the private repository while embedding a public-mirror commit.

Root cause: repository metadata and commit metadata came from independent implicit sources.

Fix: repository identity follows the active repository unless an explicit controlled override is supplied; commit always follows actual checkout HEAD.

Regression: fixture runs under the public mirror environment and explicitly asserts the intended private fixture identity.

### Browser harness entry did not exist

Symptom: Vite could not resolve `/src/page.ts`.

Root cause: the harness file is at `/page.ts`, not `/src/page.ts`.

Fix: `index.html` now references `/page.ts`.

Regression: the source path is extracted from HTML and required to resolve inside the harness root.

## Exact-tree CI evidence

Public head `47876e8b35a8b7c93903f82022a28eab64f02d53` and tree `ad431eaed0945039371011df1be0c989a634b050`:

- verify run `30281649255`: success;
- package-source run `30281649234`: success;
- Linux lint/full suite: passed;
- macOS launchers/tests: passed;
- actual Chrome run-storage: passed;
- actual Chrome graph-storage: passed;
- actual Chrome Phase 2C-B1a: passed;
- actual Chrome Phase 2C-B1b rehearsal: passed.

Sanitized B1b rehearsal proved:

- native browser IndexedDB;
- repeat plan hashes equal;
- repeat target hashes equal;
- rollback target empty;
- source unchanged across harness;
- network calls = 0;
- model calls = 0;
- exact source opened = false;
- actual migration performed = false;
- automatic retry allowed = false;
- REQ-OBS trace and live observability rendered;
- sanitized diagnostics download available.

## Downloaded artifact review

```text
outer artifact sha256: f245504d04948671343c4552d7a1da24edc2cf72f99a6980e3fcdcd64263b172
one-shot ZIP sha256:   f00e402fdd0e14ff559046d4a9911be97464d5e44d653cafa84a58fb3109b144
browser proof sha256:  6891d5ee2cb1cade845ae77e7d9a52aba9736c7e7ae1070f0010188ad52e562e
```

Inspection results:

- exactly seven package files;
- launcher mode `0755`;
- checksum manifest matches unchanged;
- package repository/commit/tree provenance is internally consistent;
- SQLite, diagnostics, `node_modules`, `.env`, secrets and private payload strings absent.

## Current boundary

Facts:

- exact source opened: false;
- authorized local attempt consumed: false;
- actual migration: false;
- production target: false;
- model/network calls: 0.

The code-head package is not the final handoff artifact because this evidence and README change the exact Git tree. The final documentation head must be mirrored, rerun through all gates and downloaded again before handoff.

## Next verified step

1. Mirror the final documentation tree to the public CI repository.
2. Prove exact tree equality.
3. Run verify and package-source on the final head.
4. Download and inspect the final package and B1b browser proof.
5. Run the package exactly once on the target Mac.
6. On any failure, do not retry; inspect sanitized evidence first.

Actual migration remains a separate later authorization.