# ADR-0020 — C3 packaged runtime resolver

Status: implementation verified; acceptance pending.

## Decision

The packaged runtime resolves only the active immutable generation named by the accepted C2 control registry. It opens only pre-existing sanitized databases, uses readonly transactions and verifies registry identity/schema/revision, active pointer, seal attestation, physical/logical generation identity, storage schema, workspace, immutable seal and snapshot hash.

A second atomic registry read must equal the first before resolution succeeds. Any missing, malformed, corrupt, mismatched, interrupted or stale condition returns a typed fail-closed result.

## Forbidden behavior

No legacy/inactive/previous fallback, guessed generation, database creation, repair, migration, promotion, rollback, automatic resume/retry, model/network call or personal data path.

## Observability

REQ-OBS-001 must expose work/type/stage/state/elapsed/progress/heartbeat/last progress/inactivity, `без AI`, possible-hang status and downloadable sanitized diagnostics.

## Evidence

Implementation shared tree `56e846d49a17f15bbbd1eedfc626f316e3a29a91`; verify `30535292820`; package `30535292824`; actual Chrome passed. Final acceptance remains pending.
