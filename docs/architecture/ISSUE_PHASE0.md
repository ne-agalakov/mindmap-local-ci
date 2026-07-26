# Phase 0 issue specification

## Objective

Freeze Alpha.19 and create an exact, read-only historical fixture plus standalone legacy inspector. No AI calls and no product-code refactor are allowed in this phase.

## Confirmed context

Candidate 5 only restores `continuationBlock` when `batch_continuation_blocked` already exists. Candidate 4 never persisted that event. Therefore the first Candidate 5 screen over the Candidate 4 database correctly lacks the disabled control; the prior acceptance expectation was invalid.

## Acceptance criteria

- Preserve exact legacy source and data evidence with hashes.
- Read old database/diagnostics without writing them.
- Produce a canonical deterministic fixture for the Candidate 4 state without `batch_continuation_blocked`.
- Represent run model, configured model, build, schema, dataset, order, stage, artifacts, unresolved items, and ambiguities explicitly.
- Prove inspection/migration has zero network/Ollama paths.
- Do not create Candidate 6 or invoke DeepSeek.

## Non-goals

No semantic processing, map work, UI redesign, storage selection, or personal-data migration.
