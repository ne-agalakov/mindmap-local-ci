# Phase 2C-C4 — target-Mac package inventory and provenance

Status: planning candidate only. No package is built by this document.

## Package purpose

The future C4 archive is an offline, exact-identity execution package. It contains code, schemas, manifests and verification utilities only. It does not contain the exact SQLite, backup, authorization, database bytes, prior B1b evidence or personal data.

## Required top-level inventory

```text
README-FIRST.txt
C4_PACKAGE_MANIFEST.json
C4_PORTABLE_CHECKSUMS.sha256
verify-c4-package.command
start-phase2cc-c4.command
bin/phase2cc-c4-runner.mjs
bin/phase2cc-c4-preflight.mjs
bin/phase2cc-c4-diagnostics.mjs
schemas/c4-authorization.schema.json
schemas/c4-evidence.schema.json
schemas/c4-receipt.schema.json
contracts/accepted-c1-domain/*
contracts/accepted-c2-storage/*
contracts/accepted-c3-resolver/*
fixtures/sanitized/*
LICENSES/*
```

Exact names may be refined in implementation, but every executable and data-bearing entry must be enumerated in the manifest. Undeclared files reject the package.

## Executable modes

The following must be executable in the ZIP metadata and after extraction on macOS:

```text
verify-c4-package.command      100755
start-phase2cc-c4.command      100755
```

JavaScript modules and JSON/schemas remain `100644`. Package verification rejects missing execute bits, symlinks, device files, absolute paths, `..` traversal entries and duplicate normalized paths.

## Manifest identity

`C4_PACKAGE_MANIFEST.json` must include:

```text
formatVersion
appVersion
artifactRevision
repository
commit
tree
archiveExpectedSha256 or detached archive identity slot
buildWorkflowRunId
packageWorkflowRunId
sourceExpectedSize
sourceExpectedSha256
backupExpectedSize
backupExpectedSha256
portablePlanHash
targetSnapshotHash
registryName
generationPrefix
requiredFiles with mode/size/SHA-256
prohibitedCapabilities
networkCallsExpected = 0
modelCallsExpected = 0
personalDataExpected = false
```

The actual outer archive SHA-256 is recorded in downloaded-artifact acceptance evidence and then bound into the detached authorization. The archive cannot self-authenticate its own final outer hash.

## Build provenance

A package is eligible only when:

1. private and history-free public commits have an identical Git tree;
2. repository/commit/tree identify the actual checkout used by the packager;
3. Linux, macOS, full tests and actual Chrome sanitized harnesses pass on that tree;
4. packaging runs in a clean checkout and records workflow/run identity;
5. the downloaded archive is inspected outside the runner;
6. reconstructed source from the archive matches the accepted Git tree after removing only declared package-time metadata fields;
7. portable checksums, file modes and inventory pass independently;
8. GitHub PR is merged only with expected-head protection after Drive reverse-read.

A green workflow without downloaded-artifact inspection is insufficient.

## Offline verification order on target Mac

`verify-c4-package.command` is safe and read-only. It must not locate or open the source automatically.

Required order:

1. reject quarantine/extraction anomalies and undeclared entries;
2. verify portable checksums and modes;
3. verify manifest repository/commit/tree and artifact revision;
4. verify no forbidden files or dependency directories are present;
5. verify runner structural guards and zero external-call configuration;
6. verify the detached authorization schema if one is supplied, without consuming it;
7. print sanitized package identity and stop.

The execution launcher is a separate file and requires explicit user action after confirmation. Verification success never starts migration.

## Forbidden package contents

- `*.sqlite`, `*.sqlite3`, `*.db`, IndexedDB/LevelDB files;
- exact source or backup bytes;
- B1b evidence or run manifest from the private attempt;
- detached authorization or consumed receipt;
- `.env`, credentials, tokens, cookies, browser profiles or keychains;
- `node_modules`, caches, build workspaces or temporary files;
- raw thoughts, model prompts/responses or personal payloads;
- network clients, telemetry SDKs, model SDKs or auto-update code;
- unpinned external download/bootstrap scripts.

## Capability boundary

The package must operate with network disabled. Structural and runtime guards must prove:

```text
network calls = 0
model calls = 0
telemetry = absent
auto-update = absent
fallback = absent
automatic resume/retry = absent
automatic rollback = absent
```

The launcher may read only paths explicitly selected by the user and bound by authorization. It may not search the filesystem for SQLite or backups.

## Handoff contents

A future handoff may contain:

- the accepted archive;
- a human-readable checksum/provenance sheet;
- a read-only verification command;
- instructions to preserve the source and not launch until explicit confirmation.

It must not contain an active authorization. That file is created only immediately before the authorized attempt.
