# MindMap agent instructions

This repository is the technical source of truth. Work from a clean Git branch and leave every accepted change in a reviewable commit or pull request.

## Required workflow

1. Read `docs/architecture/README.md` and the documents it links before changing state, storage, run orchestration, model configuration, recovery, packaging, or release logic.
2. Separate facts, hypotheses, implementation, and experiment results. Do not claim a build or green test proves a user runtime scenario unless that exact scenario ran.
3. Reproduce the symptom and identify the root cause before patching. Add a behavioral regression for the real failure mode.
4. Never automatically repeat an AI request after an error, reload, version change, model change, or uncertain checkpoint.
5. Never mix runs, models, datasets, orders, pipeline versions, storage schemas, or builds. These identities must be explicit and immutable.
6. Offline diagnostics, migration, recovery, candidate generation, packaging, and documentation checks must have no path to Ollama.
7. Keep synthetic experiments isolated from personal data. Real thoughts remain prohibited until the 96-thought release gate passes in multiple orders.
8. Do not mutate tracked source files at runtime. Runtime configuration belongs in environment or ignored runtime data.
9. Critical persistence must be transaction-first and single-writer. Do not use debounced React effects as the source of truth for run/checkpoint events.
10. Display the exact build identity in the UI: version, commit SHA, artifact revision, storage schema, configured model, and active run.

## Verification

- Prefer behavioral unit/integration tests over source-text regex tests.
- State/recovery changes require an exact historical fixture and a browser-level packaged-runtime test.
- Storage changes require crash, concurrent-write, migration, and idempotency tests.
- Packaging changes require downloading the generated artifact and verifying it outside the runner.
- Run the documented checks after every change and list uncovered scenarios explicitly.

## Release boundary

A version is not releasable until code, README, project documents, Drive readback, diagnostics metadata, packaged commit, automated tests, target-runtime UI checks, and AI-call audit agree.
