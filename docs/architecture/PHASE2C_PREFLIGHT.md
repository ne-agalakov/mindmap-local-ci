# Phase 2C exact-source preflight

Date: 2026-07-25

Status: exact source verified; migration intentionally stopped before target creation because the accepted target contract was incomplete.

## Exact private source proof

- size: `5,070,848` bytes;
- SHA-256 before immutable read: `356b943275cce292d0e14f8a7fbe95af07e79de73f06d3e361874d342aa2f918`;
- SHA-256 after immutable read: unchanged;
- SQLite `quick_check`: `ok`;
- SQLite `integrity_check`: `ok`;
- thoughts: 96;
- hierarchy nodes: 30;
- links: 0;
- historical decisions/events: 133;
- synthetic thoughts: 96;
- personal thoughts: 0;
- source writes, upgrades, migration, network and model calls: 0.

The raw SQLite file, thought text, embeddings and raw model payloads remain private and outside Git.

## Proven blocker

Phase 2B stored run aggregates/events and artifact metadata only. It had no canonical target records for:

- thought text and thought metadata;
- embedding payloads/model/dimensions;
- hierarchy nodes and typed parentage;
- one primary placement or unresolved state;
- graph links;
- damaged references;
- content-addressed payload bytes.

Importing only run history would discard the actual 96 thoughts and graph. That is data loss, not migration.

## Approved split

- Phase 2C-A (#36): pure transactional graph/payload contract, deterministic replay/reference semantics, then a separately proven IndexedDB extension.
- Phase 2C-B (#37): exact private source to isolated temporary target dry run after Phase 2C-A acceptance.

Actual target-Mac migration remains prohibited after both phases until a separate explicit gate and user confirmation.
