# Alpha.19 candidate 5 — current state audit

Date: 2026-07-25

Status: architecture audit, no product release claim.

## Executive conclusion

The repeated return to earlier-looking behavior is not one isolated bug. The current implementation conflates four different concerns in one UI module and reconstructs authoritative run state indirectly from a mutable event list stored inside a whole-database snapshot.

The latest screenshot with an active `Продолжить к AI-проверке связей` button is **not proof that Candidate 5 failed to load**. Candidate 5 only persists `batch_continuation_blocked` after that button is clicked under Candidate 5. Candidate 4 showed a mismatch message but did not persist the new event type. Therefore the preserved Candidate 4 database cannot display the disabled Candidate 5 state on first Candidate 5 load. Our earlier expectation was invalid.

This is a process and architecture failure:

1. the expected migration behavior was never specified;
2. tests only covered restoration when a block event already exists;
3. no test covered `Candidate 4 checkpoint without block → launch Candidate 5 → initial UI`;
4. the UI did not expose candidate/build identity, so old behavior and expected compatibility behavior looked identical;
5. the release claim was made before the actual historical state transition was tested.

No AI call is required to establish this conclusion.

## Confirmed facts from the source

### 1. Candidate 5 cannot restore a block that Candidate 4 never wrote

`restoreBatchProgress()` in `app/lib/batch-run-state.ts` searches the journal for `batch_continuation_blocked`. It sets `continuationBlock` only when that event is present.

`continueSyntheticTestWithConfirmation()` in `app/page.tsx` creates and saves `batch_continuation_blocked` only after the user presses the continuation button and the configured model differs from the historical run model.

The UI disables the button and exposes a clean-run action only when `batchProgress.continuationBlock` is already present.

Therefore the first Candidate 5 screen over a Candidate 4 database is expected to show the active continuation button. The correct Candidate 5 behavioral test is:

1. load the Candidate 4 database in Candidate 5;
2. press continuation once;
3. verify mismatch is blocked before AI and the event is persisted;
4. reload Candidate 5;
5. verify the old continuation is disabled and the separate clean-run action is visible.

The project instead expected step 5 immediately after step 1. That expectation had no implementation or regression test.

### 2. The primary UI and orchestration are a monolith

`app/page.tsx` is approximately 4,849 lines and contains about 66 functions. `runSyntheticTest()` alone spans about 928 lines. The same module owns:

- React rendering;
- user actions;
- run creation and resume decisions;
- model preflight;
- all pipeline stages;
- checkpoint event construction;
- persistence calls;
- recovery;
- diagnostics;
- map rendering and export;
- test controls.

This makes local patches easy to add but difficult to reason about as a complete state machine.

### 3. The event journal is not append-only storage

`saveSnapshot()` deletes and reinserts every row in `links`, `thoughts`, `knowledge_nodes`, and `ai_decisions`, then exports the entire in-memory SQLite database and writes one blob to IndexedDB.

Consequences:

- a checkpoint journal can be lost by a stale full-snapshot write;
- explicit saves and the debounced React autosave can overlap;
- the last IndexedDB write to complete wins, not necessarily the newest logical state;
- every state mutation rewrites the full database;
- journal integrity is not enforced by storage.

The code calls `saveSnapshot()` explicitly throughout pipeline operations and also from a `useEffect` that runs 220 ms after any thoughts/links/nodes/decisions change. There is no single-writer queue or revision compare-and-swap.

### 4. Run state is inferred from opaque events instead of stored explicitly

There is no `runs`, `stages`, `attempts`, `checkpoints`, or `runtime_state` table. Run identity, stage, status, model, order, and continuation guard are reconstructed from `ai_decisions.input_json` and `output_json`.

`restoreBatchProgress()` selects the most recent `batch_started` by array order and derives the active stage from later events. The model is recovered by scanning backward for the latest Ollama event rather than reading immutable run metadata.

This makes historical compatibility depend on every old event shape and on reconstruction logic accumulated across versions.

### 5. Event order is not deterministic for equal timestamps

The database loads decisions using `ORDER BY created_at ASC` only. There is no monotonic sequence or secondary order. Multiple events created in the same millisecond can be returned in unspecified order, yet restoration uses array order and reverse scans to decide the latest state.

### 6. All Alpha.19 candidates share one user-visible version

The UI shows only `v0.6 alpha.19`. Candidate 3, 4, 5, GitHub commits, artifact revision, storage schema, configured model, and active run are not shown together in the main interface.

Diagnostics include build metadata, but screenshots cannot prove which artifact is running. This amplified confusion and made every compatible old checkpoint look like a stale frontend.

### 7. Runtime model configuration mutates tracked source

`start-mindmap.command` writes the selected model directly into `app/lib/runtime-config.ts` before launch. Runtime configuration is therefore implemented by changing source code.

This causes several problems:

- a checked-out repository becomes dirty at runtime;
- configuration and code provenance are mixed;
- Vite/HMR may rebuild because a source file changes;
- packaged source no longer exactly matches the running source after launch;
- worker/environment boundary bugs are solved by code generation instead of a runtime contract.

### 8. The user runs a development server, not the verified production runtime

The launcher executes `npm run dev`. GitHub CI verifies builds and source packaging, but the target Mac runs a live Vite/Cloudflare/Vinext development stack with runtime dependency installation and HMR.

A green production build does not prove the behavior of this development runtime. Conversely, a browser screenshot from the dev runtime does not prove the packaged production output.

### 9. Local-only product logic carries unnecessary cloud-worker complexity

The local app uses Vinext, the Cloudflare Vite plugin, Wrangler/Miniflare state, worker bindings, and server routes for Ollama proxying. This environment split caused the Candidate 3 model configuration defect.

For the current local-first MVP, this infrastructure increases the number of execution contexts without delivering a validated product requirement.

### 10. Synthetic experiments and future personal data share one database

The synthetic run writes to the same thoughts, links, nodes, and decisions tables used by the product. Starting a new synthetic run immediately saves a working snapshot with empty thoughts, links, and nodes while retaining decisions.

There is no workspace/test namespace. This is acceptable only while real personal data is prohibited; it is not a safe foundation for the product.

### 11. Storage schema versioning is effectively absent

All versions open IndexedDB database `mindmap-local-semantic-v060` with IndexedDB version `1` and key `mindmap-v0.6.sqlite`. SQL migrations are opportunistic `CREATE TABLE IF NOT EXISTS` and `ensureColumn()` calls.

The stored database does not contain a durable application build, storage schema version, migration history, or compatibility state.

### 12. Test count overstates runtime confidence

The repository has 107 declared tests, but 22 tests primarily assert that source text contains or does not contain particular strings. The Candidate 5 UI test checks that code contains `batch_continuation_blocked`, a disabled button, and a clean-run label. It does not execute the historical Candidate 4 state in a browser.

The behavioral restoration test starts with an artificial journal that already contains `batch_continuation_blocked`. It therefore cannot catch the exact expectation error observed on the Mac.

There is no Playwright/Cypress browser test, no persistent-profile packaged-runtime test, and no target-flow test that clicks the control, reloads, and verifies the persisted guard.

## What is not supported by evidence

- There is no evidence that a service worker or browser cache served an old frontend. No service-worker registration exists in the inspected source.
- There is no evidence that Candidate 5 made an AI call on the latest screen.
- There is no evidence that the latest active button was caused by a failed save. It is fully explained by the missing historical event.
- Green CI does not establish semantic quality or target Mac runtime behavior.

## Root causes by layer

### Product-state root cause

Run identity and transition guards are derived from loosely structured historical events rather than immutable run/state records and explicit transitions.

### Persistence root cause

The system calls a mutable full-snapshot rewrite a checkpoint journal. It lacks append-only events, storage revisions, a single writer, and transactional command boundaries.

### Runtime root cause

The target application runs a development stack and mutates source to configure the model. Build identity is not visible in the UI.

### Testing root cause

Tests validate code presence and hand-built states more often than real cross-version user flows. Historical fixtures are not promoted into packaged browser-level regression tests.

### Process root cause

The project evolved through serial local archives before the repository and durable agent instructions existed. Requirements, implementation, fixture assumptions, and runtime evidence were repeatedly conflated.

## Preserve vs replace

### Preserve

- product principles and hierarchy invariants;
- approved 96-thought dataset and independent benchmark;
- pure semantic algorithms that pass isolated tests;
- unresolved/reference integrity rules;
- AI-call audit requirements;
- REQ-OBS-001 content requirements;
- historical diagnostics and source commits;
- visual design components that do not own state.

### Replace or isolate

- `runSyntheticTest()` orchestration;
- event-derived authoritative run state;
- full-snapshot delete/reinsert persistence;
- debounced critical autosave;
- shared synthetic/personal workspace;
- source-mutating model configuration;
- dev-server handoff as the tested application runtime;
- regex/source-presence tests as release evidence;
- candidate labels that share one build identity.

## Decision

Do not create Candidate 6 on the existing orchestration. Preserve Alpha.19 as a research and migration input. Build a new state core behind a separate storage namespace and a separate runtime entry point. Only after that core passes historical migration and packaged browser tests should semantic pipeline work resume.
