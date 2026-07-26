# MindMap state-core refoundation plan

Status: proposed implementation plan. No semantic run is authorized by this document.

## Objective

Replace the unstable state, persistence, runtime, and verification foundation while preserving validated domain rules and semantic research.

The refoundation is not a visual rewrite and not a complete product restart. It creates a new bounded core and treats Alpha.19 as a read-only legacy source for migration and regression fixtures.

## Non-negotiable invariants

1. A run has immutable identity: `runId`, workspace, dataset, order, semantic model, embedding model, pipeline version, build ID, and storage schema.
2. A stage transition is valid only through a pure transition function and a persisted command transaction.
3. Model mismatch is a derived guard available before rendering; it does not require the user to press an unsafe-looking button.
4. An AI call cannot occur unless a persisted attempt exists with explicit user authorization and idempotency key.
5. Reload cannot create, repeat, or continue an attempt.
6. Synthetic experiments and personal data live in different workspaces and cannot delete each other.
7. Stored events are append-only and ordered by a monotonic sequence.
8. Critical state is written by one serialized writer. React state is a projection, not the source of truth.
9. Runtime configuration never edits tracked source.
10. The visible UI identifies the exact running build and active state.

## Target boundaries

### `domain/`

Pure types and validators:

- thought types;
- area/direction/project hierarchy;
- unresolved vs broken references;
- relation proposal state;
- run/stage/attempt types;
- transition guards;
- integrity checks.

No React, IndexedDB, filesystem, fetch, Ollama, or timestamps created internally.

### `state-core/`

Deterministic command processor:

- `createRun`;
- `inspectRun`;
- `authorizeAttempt`;
- `beginStage`;
- `recordProgress`;
- `completeStage`;
- `pauseStage`;
- `failStage`;
- `blockContinuation`;
- `startCleanRun`;
- `finalizeRun`.

Each command returns either a validated event batch or a typed rejection. No UI code constructs persistence events directly.

### `storage/`

Versioned structured local storage with transactions. Recommended MVP implementation: IndexedDB through Dexie or an equivalent thin adapter, not a mutable sql.js blob.

Stores:

- `meta` — schema version, created build, migrated build;
- `workspaces` — synthetic or personal;
- `runs` — immutable run identity plus current status/version;
- `stageAttempts` — one row per attempt with model, authorization, timestamps, idempotency key;
- `events` — append-only ordered audit stream;
- `artifacts` — stage outputs by run/stage/version;
- `thoughts`, `nodes`, `links` — materialized domain data scoped by workspace;
- `snapshots` — optional verified recovery snapshots with hash.

All command writes occur in one transaction. The storage adapter exposes no full-database replacement operation during normal use.

### `runtime/`

One local execution context for the MVP:

- production-built frontend;
- minimal local Node API for Ollama proxy/configuration;
- ignored runtime config file or environment variables;
- no Cloudflare worker, Wrangler, or source rewriting in the target Mac runtime;
- fixed port with explicit instance/build identity endpoint.

Development mode remains for developers only and is never handed to the user as the verified runtime.

### `ui/`

React renders projections from state-core queries and sends typed commands. It does not infer run state from raw event arrays and does not save critical state through effects.

Persistent status header must show:

- app version;
- commit SHA;
- artifact/build ID;
- storage schema;
- workspace;
- active run ID;
- run model;
- configured model;
- current stage and attempt;
- runtime mode (`production` or `development`).

## Explicit run state machine

Suggested states:

- `created`;
- `awaiting_authorization`;
- `running`;
- `saving`;
- `paused`;
- `blocked`;
- `failed`;
- `completed`;
- `abandoned`.

Suggested guarded transitions:

- `created → awaiting_authorization`;
- `awaiting_authorization → running` only with user authorization and matching immutable run model;
- `running → saving → paused|completed`;
- any nonterminal state → `blocked` for build/model/schema incompatibility;
- `blocked` cannot transition to `running`; it can only create a separate clean run or return to a compatible runtime;
- reload performs no transition;
- retry creates a new attempt ID and requires authorization.

## Historical migration strategy

1. Freeze Alpha.19 database and source as read-only evidence.
2. Add an export tool that reads the old sql.js blob without modifying it.
3. Convert old rows into a canonical migration package:
   - original database hash;
   - source build identity if known;
   - ordered legacy events with deterministic tie-breaking;
   - recovered runs and artifacts;
   - explicit ambiguities and unresolved records.
4. Import into a new database namespace, for example `mindmap-state-core-v1`.
5. Never write migration results back into the old database.
6. Keep the original blob downloadable until the new system is accepted.
7. A migration can end in `blocked_for_review`; it must not guess missing model/build/run identity.

## Test strategy

### Tier 1 — pure domain and transition tests

Every allowed and forbidden transition, including:

- Qwen run under DeepSeek runtime;
- Candidate 4 legacy checkpoint without a persisted block;
- reload in every state;
- unresolved thought;
- broken reference;
- partial checkpoint;
- duplicate command/idempotency key;
- retry authorization;
- clean run preserving history.

### Tier 2 — storage integration

Use real IndexedDB in a browser test and fake IndexedDB only for fast unit coverage.

Required cases:

- concurrent commands serialize;
- crash between intent and result;
- transaction rollback;
- migration from exact Alpha.19 fixture;
- monotonic event ordering;
- personal and synthetic workspace isolation;
- stale UI projection cannot overwrite newer persisted state.

### Tier 3 — service integration

Ollama is replaced by a deterministic local stub that records calls. Tests prove:

- zero calls on startup, reload, migration, diagnostics, blocking, and offline stages;
- exactly one call after explicit authorization;
- no retry after timeout or malformed response;
- idempotency prevents duplicate POST execution.

### Tier 4 — browser E2E on packaged runtime

Use Playwright against the production artifact, not `npm run dev`.

Mandatory historical scenario:

1. install exact Candidate 4 fixture;
2. launch new runtime with DeepSeek configured;
3. verify UI immediately shows historical Qwen run as blocked;
4. verify no unsafe continuation control;
5. reload and verify identical state;
6. start clean run, cancel confirmation, verify zero calls;
7. authorize once, verify one planned attempt and one model call.

### Tier 5 — target Mac smoke

The same artifact and fixture run on macOS ARM. Capture screenshot, diagnostics, artifact SHA, visible build ID, and model-call audit.

## Repository and Codex workflow

The repository is now the only technical source of truth.

- Keep `AGENTS.md` short and stable; architecture knowledge lives in linked documents.
- Start each bounded change as a GitHub issue with symptom, facts, acceptance criteria, non-goals, and exact fixtures.
- Use Codex Ask mode for exploration/audit before Code mode for implementation.
- One PR per architectural boundary or migration step.
- No source archive passed from an uncommitted local directory.
- No merge based only on test count; name the exact historical scenarios that passed.

## Phased implementation

### Phase 0 — freeze and fixtures

- mark Alpha.19 orchestration frozen;
- preserve exact Candidate 4/5 source and database evidence;
- create anonymized historical fixture from the real diagnostic/database export;
- document hashes and boundaries.

Exit: fixture loads deterministically in a standalone inspection tool with zero AI calls.

### Phase 1 — pure state core

- define run identity and state machine;
- implement commands, events, guards, and projections;
- test all transitions, including the exact current expectation gap.

Exit: no React or storage dependency; exhaustive transition suite green.

### Phase 2 — versioned transactional storage

- implement new schema and single-writer command transaction;
- add migration reader for Alpha.19;
- add crash/concurrency/idempotency tests.

Exit: exact fixture migrates without modifying the old database; reload projections are stable.

### Phase 3 — simplified production runtime

- remove target-runtime dependency on Cloudflare/Miniflare;
- stop rewriting `runtime-config.ts`;
- build and launch a production artifact;
- expose build/runtime identity.

Exit: production artifact starts on Mac and configuration is immutable for the process.

### Phase 4 — UI projection and observability

- split UI components from command orchestration;
- implement state-derived actions and REQ-OBS-001 from persisted attempts;
- add packaged Playwright historical flow.

Exit: Candidate 4 fixture displays blocked state immediately; reload changes nothing; zero hidden AI calls.

### Phase 5 — semantic pipeline adapters

- reconnect preserved pure semantic stages one at a time;
- each stage writes artifacts through state-core commands;
- keep all calls stubbed until offline and recovery gates pass.

Exit: full stubbed 96-thought run survives pause, reload, crash, and migration.

### Phase 6 — controlled local-model experiment

- authorize one DeepSeek `original` run;
- inspect semantic output and model-call audit;
- then run other orders only after the previous result is accepted.

Exit: stability metrics and semantic quality meet the defined release gate. Only then consider real data.

## Immediate next step

Do not click the current Candidate 5 continuation button. Create the Phase 0 historical fixture and a pure state-machine specification first. No Candidate 6 archive should be produced from the existing `page.tsx` orchestration.
