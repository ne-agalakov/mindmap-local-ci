# Phase 2C-C0 — implementation and release plan

Date: 2026-07-29
Status: planning only; actual migration prohibited
Issue: #48

## Architectural correction

A production generation cannot be safely activated before the runtime knows how to resolve and validate the control registry. Therefore runtime resolver integration must precede exact-source execution.

## Phase sequence

### C0 — architecture and contracts

Deliverables:

- ADR-0002 immutable generations and atomic activation registry;
- exact migration/activation contract;
- failure and crash matrix;
- implementation/release plan;
- README, project status and Drive synchronization.

Prohibited:

- exact SQLite opening;
- backup or IndexedDB creation;
- executor, launcher or actual-migration package;
- model/network calls;
- personal data.

Acceptance:

- documents are internally consistent;
- previous B1b boundary remains unchanged;
- exact-tree public CI and downloaded source artifact checks pass;
- documents are reverse-read from GitHub and Google Drive.

### C1 — pure registry and generation contracts

Implement without browser/filesystem/network/model dependencies:

- immutable manifest and detached authorization types;
- generation identity and name validators;
- attempt state machine and legal transitions;
- registry revision and activation receipt contracts;
- promotion and rollback planners;
- evidence redaction schema;
- in-memory reference registry;
- deterministic sanitized fixture.

Mandatory tests:

- every legal/illegal state transition;
- one-shot authorization consume and conflict;
- stale revision and competing attempt rejection;
- generation/legacy/temporary namespace rejection;
- promotion/rollback planning;
- canonical hashes and sanitized evidence;
- structural zero network/model paths.

No IndexedDB, exact source or target Mac action.

### C2 — native IndexedDB registry and generation lifecycle

Implement on synthetic fixtures:

- control registry native IndexedDB adapter;
- unified generation metadata and seal guard;
- atomic promotion and rollback transactions;
- active-generation resolver;
- persisted blocked states for non-terminal attempts;
- REQ-OBS trace and diagnostic export.

Mandatory proof:

- fake-indexeddb and actual Chrome parity;
- transaction completion/abort semantics;
- all crash checkpoints from the failure matrix;
- close/reopen and browser reload;
- old pointer unchanged after failed promotion;
- rollback restores the exact prior pointer;
- sealed generation rejects migration writes;
- no automatic continuation or retry.

### C3 — sanitized runtime resolver integration

Integrate only the registry resolver and blocked recovery projection into a packaged runtime using synthetic data.

Mandatory scenarios:

1. no active pointer → explicit empty/not-migrated state;
2. valid active pointer → exact generation opens and hash verifies;
3. missing/corrupt generation → blocked, no fallback mutation;
4. non-terminal migration attempt → blocked recovery state;
5. promotion committed but final evidence incomplete → explicit recovery state;
6. rolled-back attempt → previous generation loads;
7. reload preserves all states;
8. runtime never opens legacy source and never calls a model.

This phase does not use the exact SQLite or create the real production generation.

### C4 — exact-source one-shot implementation package

Only after C0–C3 acceptance:

- implement local backup and exact read-only source adapter;
- bind package to exact repository/commit/tree/archive/source/generation identities;
- use a new one-shot authorization ID;
- create the real immutable generation;
- verify and seal;
- atomically activate through the proven registry;
- verify through the proven runtime resolver;
- generate sanitized evidence.

Before delivery:

- private/public exact-tree gate;
- Linux, macOS and actual Chrome suites;
- packaged entrypoint smoke;
- downloaded artifact checksum, executable mode, provenance and privacy scan;
- Google Drive reverse-read;
- explicit list of covered and uncovered scenarios.

### C5 — explicit execution decision

Immediately before execution, Artyom must explicitly confirm the exact final package identity and target generation.

The authorization does not permit:

- a second attempt;
- source deletion;
- model calls;
- personal data import;
- semantic reruns.

Any failure consumes the authorization and stops. Root-cause proof, regression and a new package gate are required before another decision.

## Exact final-package manifest requirements

```text
repository
commit SHA
tree SHA
archive SHA-256
application/storage/mapping/registry versions
migration attempt ID
authorization ID
source size and SHA-256
backup file identity and SHA-256
generation ID and exact database name
control registry name and expected revision
previous active pointer identity
expected counts
expected portable plan hash
expected target snapshot hash
retryPolicy = new-explicit-confirmation-required
modelMode = без AI
networkAllowed = false
modelAllowed = false
```

## Release gate checklist

The actual package is blocked unless all are true:

- [ ] C0 ADR/contract/failure matrix accepted.
- [ ] C1 pure contracts and state machine accepted.
- [ ] C2 native registry, promotion, rollback and crash proof accepted.
- [ ] C3 packaged runtime resolver scenarios accepted.
- [ ] Exact source identity remains unchanged.
- [ ] Local immutable backup process proven on sanitized files.
- [ ] Every failure point emits a typed stop and no automatic retry.
- [ ] REQ-OBS-001 visually verified for all long stages.
- [ ] Zero structural path to external network or model services.
- [ ] Evidence redaction tests exclude private payload and paths.
- [ ] Private/public exact Git tree equality proven.
- [ ] Final CI and actual Chrome jobs passed.
- [ ] Final downloaded artifact independently inspected.
- [ ] README, project status, recovery protocol and Drive documents agree.
- [ ] Explicit user confirmation recorded for the exact final artifact.

## Uncovered until later phases

C0 does not prove:

- native registry transactions;
- runtime resolver behavior;
- backup filesystem behavior;
- actual source migration;
- production activation or rollback;
- semantic quality or order stability;
- personal workspace readiness.

These boundaries must remain visible in every C0 handoff.