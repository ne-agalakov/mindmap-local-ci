# Phase 2C-A verification record

Date: 2026-07-26

Status: accepted and merged.

## Exact provenance

- private repository: `ne-agalakov/mindmap-local`;
- PR: `#38`;
- implementation code head: `02df8758a7c42b33b22b397dae74445cd6a5f7ac`;
- final reviewed head: `29a317b58cbecaea13e4f21c02af2b945a6e6edc`;
- squash merge: `292634312ad04fa6e6cfc5a5ded311ac1020094d`;
- final public CI head: `ee5401a4a2ca7763467562417b9c5c4aece01214`;
- shared exact tree: `e81ae1b309a806f0078b5a8a2057f51d4c0e403d`.

## Target-Mac proof

- proof JSON `5b47e3681a23474d21ee2f703c93a94a8f79d2b93c11e65642667ce8283b97bc`;
- runner ZIP `aef0111128e2182218081ef2fa5536e24bde3bc4383961455e5150c5ba559419`;
- harness `ecfee87cac41410a2d1f5b71f3c1a90303f53f42afcf3007c11dd33b6ba2231a`;
- local fixture `ee7f14540dbc394654b81e1724dc35b0b01f8d13f303ab03a157e5c1079b4fc1`.

Passed atomic commit, reopen, idempotency, workspace isolation, run-adapter coexistence, abort rollback, run-only refusal, schema metadata, corruption refusal and link lifecycle.

The macOS application-management warning remains an unexplained environmental anomaly; no application-bundle write path exists in runner source.

## Final public CI

- verify `30198811851` — success;
- package `30198811852` — success;
- Linux lint/full tests — success;
- actual Chrome run/graph storage — success;
- GitHub-hosted macOS — success;
- source/exporter packaging — success.

## Final downloaded artifacts

- outer source `2184324939c12db0af27ad913904d953b0ee5b5f73b1c7e85c580f020263688c`;
- inner source `81d469a6eb53908b1c863c8643598a1953bffa8392174d9e1292b3a1e2058c3b`;
- inner exporter `1388fbc608d27c6d446646c84fd7c29ab59a76ed3e587a4b41f803b901b32109`;
- browser proof `5c63ffa99679b9cff87d8c82b16d7d4f31080e3bbbc6c7c1a218e8cbe1ddb755`;
- browser log `0bf055b8ed72d24debe8d4579d98051cc4956f6175c84b28f1a024f80ebe352a`;
- embedded public commit `ee5401a4a2ca7763467562417b9c5c4aece01214`.

Required files and checksums passed. DB, `.env`, credentials, private keys, concrete local user-home paths, runtime cache and personal thought/database payload findings: `0`.

## Fixed gate regressions

1. A case-sensitive release-doc marker expected lowercase sentence text. Root cause was the gate marker, not graph storage. The marker was corrected and rerun.
2. A privacy regex first matched generic path examples in documentation. Wording was corrected; final scan produced zero concrete local user-home findings.

## Snapshot-hash boundary

- target-Mac fixture `ee7f14540dbc394654b81e1724dc35b0b01f8d13f303ab03a157e5c1079b4fc1`;
- GitHub fixture `bc59236e3ce7173c3f91176fb163f808a99de6f2343afcdc6eea8b12bdca5a54`.

Fixtures differ by text/IDs/timestamps. Each passed close/reopen equality. Same-fixture cross-environment equality is not covered.

## Drive readback

Post-merge revisions:

- instruction `AIroW37ZYyE_aMLJxvUodCy1o2WnLjd_tUMJTp94Bzpm6pz-hhRp9RqMXgiZ2WRefBFDz1TGrQG6CsmnkGHpnTuyEq1c-1duUZCUDvaop3E`;
- status `AIroW36BDxK0THdoc-SlGQ3zq2CtBoPdpwJ7zjGcXzvKZKrrIqU_baZXfnNi1ZqFIlT8oRYmJDKor_N-MhawbIZjEhEkCCC9RWkXs4cIoF0`;
- recovery `AIroW35Q8r2B6M35cMS0OBUjGWp2HtXfscrHknyRRLjwcTgYoBC4lub293D009ujIgGpodrxiTPn0kaCZAm1DpdfU3YwWwji8BA-DUVZSXU`.

## Covered

- graph/payload contract and transactional storage;
- target-Mac focused browser scenarios;
- GitHub-hosted Linux/macOS/full/browser tests;
- packaging and external artifact inspection;
- Drive synchronization/readback;
- exact merge provenance;
- zero model/migration/private-thought use.

## Not covered

- same-fixture cross-environment equality;
- Phase 2C-B exact-source dry run;
- actual target-Mac migration;
- production runtime/UI and REQ-OBS-001;
- service-level exactly-once model POST;
- semantic quality and multi-order stability;
- real-data safety.

## Next gate

Phase 2C-B may freeze a deterministic migration mapping and implement only an exact-source read-only → isolated temporary-target dry run. Actual migration remains prohibited.
