# Phase 1A result — pure run state core

Date: 2026-07-25

Status: accepted and merged. Phase 2 design is the next allowed boundary.

## Objective

Create the first new bounded core after freezing Alpha.19. Run compatibility and valid actions derive from explicit immutable state, not React effects or raw legacy event arrays.

## Accepted implementation

### Domain contracts

`domain/run.ts` defines closed contracts for workspace, run status, pipeline stage, AI-attempt status, immutable run identity, runtime compatibility, progress, blocks, aggregate state, command metadata, and one authoritative transition table.

Immutable identity contains run ID, workspace, dataset/order, semantic/embedding model, pipeline version, build ID, and storage schema.

`domain/references.ts` distinguishes:

- resolved direction/project;
- honest `unresolved` from `null` or `__unmatched__`;
- damaged reference from missing target or invalid target type.

### Pure state core

`state-core/` implements:

- `createRun` and deterministic event replay;
- compatibility inspection before action;
- attempt request, explicit authorization, start, progress, completion and save;
- pause, failure, block and abandonment;
- clean run from persisted or derived compatibility guard;
- typed events and typed rejections;
- stale-revision and idempotency guards.

IDs, timestamps, expected revision and hashes are supplied by the caller. The core creates no time, randomness, storage write, network request, browser access, or model call.

## Compatibility and AI safety

Inspection derives `blocked` for storage schema, semantic model, embedding model, pipeline version, build, or explicit-block mismatch. Inspection emits no event and does not mutate the aggregate.

AI is projected as allowed only when:

1. runtime identity is compatible;
2. run is `running`;
3. active attempt is `running`;
4. persisted user authorization exists.

Request and authorization are distinct events. Repeated identical request/authorization is a no-op; an idempotency key bound to different data is rejected.

## Exact historical proof

Accepted Alpha.19 fixture:

- run `v06-run-03-1784797750173`;
- dataset/order `approved-96-v1` / `original`;
- run model `qwen3:8b`;
- configured model `deepseek-r1:8b`;
- persisted `paused` at `candidates`;
- no persisted `batch_continuation_blocked`.

Phase 1A projection:

```text
persistedStatus: paused
effectiveStatus: blocked
reason: run_model_mismatch
requiresContinuationClick: false
aiCallAllowed: false
```

Second inspection is identical and leaves source state unchanged. Clean-run creation uses a new run ID, preserves workspace/dataset/order, must match current runtime identity, and leaves Qwen history unchanged.

## Behavioral coverage

Tests cover:

- exact Qwen-to-DeepSeek guard;
- request → authorization → run → progress → save;
- deterministic replay;
- idempotency and stale revision;
- wrong model and missing authorization;
- pause, failure, block and abandonment;
- clean run from persisted and derived block;
- unresolved versus damaged references;
- forbidden dependency scan.

Commands:

```bash
npm run test:state-core
npm test
```

## Acceptance evidence

PR #14 final reviewed head:

```text
53e6b25075d6777c152a809156d69caabde82a90
```

- Linux full: passed;
- macOS targeted: passed;
- source and compact-exporter packaging: passed;
- downloaded Actions artifact SHA-256: `6082cf8d90322ce45c5ef3164f231c0466006454ceeb9c000e0109e10d002fb1`;
- inner source ZIP SHA-256: `01da03fc247c5f798ee366ea4bbbdef3e7be7b2db84f4dcd8f15f51f02fec262`;
- portable manifests, embedded commit, required-file inventory, privacy scan, and forbidden-dependency scan passed.

PR #14 was squash-merged as:

```text
e7b7593932614f8dfa843298f35eff0230c1e827
```

Google Drive was updated with the merge and read back. No Ollama, Qwen, DeepSeek, migration, legacy write, or personal-data action occurred.

## Preserved boundary

Phase 1A did not modify `app/page.tsx`, Alpha.19 orchestration, IndexedDB/sql.js, runtime/model routes, the accepted legacy database, or personal data.

## Proof limits

Phase 1A does not prove:

- transactional persistence;
- crash/concurrent-write behavior;
- actual migration;
- production runtime or browser UI;
- REQ-OBS-001 rendering;
- service-level exactly-once POST;
- semantic quality or stability across orders.

## Next gate

Phase 2 must be a separate issue/PR for versioned transactional storage, one serialized writer, append-only monotonic events, revision guards, atomic event/aggregate updates, rollback, workspace isolation, and read-only migration tests against the accepted source hash. Actual migration and model execution remain prohibited.
