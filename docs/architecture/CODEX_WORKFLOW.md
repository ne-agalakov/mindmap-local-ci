# Codex workflow for MindMap

## Persistent context

- `AGENTS.md` contains only stable operating rules.
- `docs/architecture/README.md` is the navigation map.
- Architecture decisions, audits, fixtures, and phase gates are separate small documents.
- Product documents remain in Google Drive and are synchronized after accepted changes.

## Task format

Every implementation task must be written like a GitHub issue:

- observed symptom or objective;
- confirmed facts;
- exact files/boundary;
- acceptance criteria;
- prohibited actions;
- fixture and test command;
- proof limits.

## Modes

1. Ask/exploration: inspect source, history, fixtures, and risks without editing product code.
2. Code: implement one bounded phase on a branch.
3. Review: inspect diff, run required checks, download artifacts, and challenge claims.
4. Merge: only after exact scenario evidence and documentation synchronization.

## Prohibited shortcuts

- editing a downloaded folder and calling it a version;
- generating an archive before commit and CI;
- reporting `N/N` as runtime proof;
- source-regex checks as the only UI regression;
- patching `page.tsx` before the state-core boundary is accepted;
- asking the user to repeat an AI action to diagnose deterministic code or migration defects.
