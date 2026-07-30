# Phase 2C-B1 — isolated exact-source dry-run execution plan

Date: 2026-07-26

Status: planning-only. This document does **not** authorize opening the private SQLite source, creating a target, executing migration, calling a model, changing runtime/UI, or importing real thoughts.

Parent issue: #37.

Accepted prerequisites:

- Phase 2C-B0 implementation merge: `dbf2484c78e4eedcbb2efb3f0b61394b79a6d216`;
- Phase 2C-B0 acceptance-provenance merge: `597ee0c78e1a49ff9d8a70d8e5f7f33a8e7e3642`;
- mapping contract: `phase2cb-mapping-v1`;
- B0 accepted only on sanitized fixtures;
- B1 exact-source access remains blocked until the explicit authorization gate at the end of this plan.

## Objective

Prove that the exact accepted synthetic legacy SQLite source can be read without modification and deterministically mapped into a fresh isolated temporary native target with complete rollback, repeatability, zero network/model calls, and no invented semantic entities.

Success in B1 does **not** authorize an actual target-Mac migration. Actual migration remains a later separately confirmed operation with backup, rollback and REQ-OBS-001.

## Split into two gates

### B1a — executor and harness on sanitized fixtures

Allowed before private-source authorization:

- implement the offline executor around the accepted B0 pure mapper;
- implement read-only source adapter behavior using sanitized SQLite fixtures;
- implement fresh isolated native target creation;
- implement transaction, rollback, repeat-run and diagnostic contracts;
- implement REQ-OBS-001 for every long local step;
- prove all stop conditions using sanitized fixtures;
- run focused/full/Linux/macOS/actual-browser/package gates.

B1a must not open the exact private source package.

### B1b — one exact-source dry run

Blocked until:

1. B1a is accepted and merged with provenance;
2. the exact source package location is resolved locally without copying it into Git;
3. the user explicitly confirms one read-only exact-source run;
4. the run manifest is written before opening the source;
5. automatic retry is disabled.

## Exact source identity

The only permitted B1b source is:

```text
size:             5,070,848 bytes
SHA-256:          356b943275cce292d0e14f8a7fbe95af07e79de73f06d3e361874d342aa2f918
workspace:        synthetic
thoughts:         96
nodes:            30
links:            0
decisions:        133
personal thoughts: 0
quick_check:      ok
```

Any mismatch is a typed stop before target creation.

## Source immutability contract

B1b must enforce all of the following:

- calculate source byte size and SHA-256 before opening SQLite;
- open SQLite read-only and immutable where supported;
- do not execute PRAGMA or statements that can write, checkpoint, vacuum, journal or mutate metadata;
- record file metadata before and after;
- calculate source SHA-256 again after the run;
- require the before/after hash and byte size to match exactly;
- never copy source bytes into Git, logs, diagnostics, artifacts or the public CI mirror;
- never expose raw thought text in sanitized diagnostics.

Failure to prove source immutability invalidates the run.

## Target isolation contract

The B1 target must be a new temporary namespace created for one run only:

```text
mindmap-state-core-v1-phase2cb-b1-<run-id>
```

Requirements:

- target must not exist before the run;
- production and target-Mac namespaces are forbidden;
- target identity is recorded before first mutation;
- all writes occur through the accepted transactional run/graph storage contracts;
- a failed transaction leaves no aggregate, event, payload, graph, receipt or partial namespace state;
- after verification the target remains isolated evidence and is not promoted automatically.

## Offline and AI boundary

Every B1 step is local and marked `без AI`.

Before execution, the harness must prove:

- network path disabled or unavailable;
- model-call adapter disabled;
- Ollama, Qwen, DeepSeek and external API paths unreachable from the executor;
- model-call counter starts and ends at `0`;
- no automatic retry after error, reload, interruption or version change.

## Execution sequence

1. **Freeze run manifest**
   - run ID;
   - app, schema, mapping and harness versions;
   - expected source identity;
   - expected target namespace;
   - expected counts and invariants;
   - model mode `без AI`;
   - retry policy `manual-confirmation-required`.

2. **Offline preflight**
   - source path exists locally;
   - byte size and SHA-256 match;
   - workspace is synthetic;
   - zero personal thoughts;
   - SQLite schema/integrity checks match the accepted source contract;
   - target namespace is absent;
   - diagnostics destination is writable and outside the source directory.

3. **Read-only extraction**
   - read only the fields required by `phase2cb-mapping-v1`;
   - preserve source identifiers and content bindings;
   - do not normalize away unresolved or damaged references;
   - do not infer projects, links, duplicates or contradictions.

4. **Pure deterministic planning**
   - run the accepted B0 mapper;
   - record canonical plan hash;
   - stop on ambiguity, collision, invalid reference or payload conflict;
   - do not create a target before planning validation succeeds.

5. **Atomic temporary-target write**
   - create the isolated namespace;
   - write run state, events, artifacts, payloads and graph aggregates transactionally;
   - persist one idempotency receipt bound to source hash, mapping version and plan hash;
   - on any failure, abort and prove the target is empty or absent.

6. **Verification**
   - all 96 thoughts and text payloads represented without fabrication;
   - all 96 embeddings represented with exact model, dimension and content bindings;
   - all 30 nodes and the valid hierarchy represented;
   - placement, unresolved and damaged references remain explicit and distinct;
   - relevant run history preserved without inventing modern attempts;
   - target snapshot hash recorded;
   - graph and run replay checks pass;
   - source bytes remain unchanged.

7. **Second clean run**
   - use a second fresh isolated namespace;
   - repeat from the same immutable source;
   - require the same plan hash and target snapshot hash;
   - require source bytes unchanged again.

8. **Injected-failure run**
   - use a third fresh namespace;
   - inject failure before final commit;
   - prove no partial target state and no idempotency receipt;
   - source remains unchanged.

9. **Sanitized evidence bundle**
   - store counts, hashes, versions, typed stops, timings and integrity results;
   - exclude raw private payloads and source bytes;
   - include exact before/after source hashes;
   - include target snapshot hashes for both clean runs;
   - include rollback proof;
   - include model/network counters equal to zero.

## Required typed stops

Each stop occurs before mutation unless it is the intentional injected rollback test:

- `source_not_found`;
- `source_size_mismatch`;
- `source_hash_mismatch`;
- `source_schema_mismatch`;
- `source_integrity_failure`;
- `wrong_workspace`;
- `personal_data_present`;
- `target_namespace_not_fresh`;
- `mapping_ambiguity`;
- `invalid_reference`;
- `duplicate_identity`;
- `payload_conflict`;
- `plan_hash_mismatch`;
- `transaction_failure`;
- `source_changed_during_run`;
- `network_path_detected`;
- `model_call_detected`.

No stop may trigger an automatic retry.

## REQ-OBS-001

For hashing, integrity checks, extraction, planning, target creation, transaction, verification, repeat run, rollback test and packaging, continuously show:

- step name and work type;
- elapsed time and processed volume;
- last progress and heartbeat time;
- state: working, saving, validating, stopped, or possibly hung;
- model: `без AI`;
- diagnostics download action.

The timer resets only on a real step transition. No invented ETA. If progress and heartbeat stop beyond the justified threshold, show `возможно, процесс завис`, inactivity duration and safe actions. Do not restart or repeat automatically.

## Evidence schema

The sanitized B1 evidence must include at least:

```text
runId
sourceExpectedSize
sourceActualSizeBefore
sourceActualSizeAfter
sourceExpectedSha256
sourceSha256Before
sourceSha256After
sourceSchemaVersion
sourceQuickCheck
workspace
personalThoughtCount
mappingVersion
planHash
firstTargetNamespace
firstTargetSnapshotHash
secondTargetNamespace
secondTargetSnapshotHash
repeatHashesEqual
rollbackTargetNamespace
rollbackTargetEmpty
modelCalls
networkCalls
stepTrace
stopCode
result
```

## Acceptance criteria

B1 is accepted only if:

- B1a executor/harness passed sanitized regression, rollback and actual-browser gates;
- one explicitly authorized B1b exact-source run passed all preflight checks;
- source byte size and SHA-256 were unchanged before/after every run;
- two clean isolated targets produced identical hashes;
- injected failure produced no partial target;
- zero network/model calls were proven;
- downloaded artifacts were inspected;
- Google Drive documents were synchronized and reverse-read;
- a separate merge-provenance PR was completed;
- uncovered risks and non-proven claims were listed explicitly.

## Explicit authorization gate

Before B1b opens the exact private source, present the user with:

- exact source path and identity to be checked;
- exact harness commit and package SHA-256;
- target namespace pattern;
- confirmation that source is opened read-only;
- confirmation that automatic retry is disabled;
- confirmation that network/model paths are disabled;
- rollback and diagnostic behavior;
- the precise command that will run once.

Only an explicit user confirmation authorizes that single B1b run. Confirmation does not authorize actual migration.

## Next safe implementation step

Implement B1a executor and harness against sanitized fixtures in a separate branch/PR. Do not resolve or open the exact private source package during B1a.