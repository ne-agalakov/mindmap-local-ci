# Legacy evidence fixtures

Raw user diagnostics and databases are **not committed**. They can contain private thought text, full embeddings, and raw model output.

`alpha19-candidate4-run03.canonical.json` is produced from the read-only result of `tools/legacy-inspector.mjs` by `tools/legacy-fixture-projector.mjs`. It contains source hashes, structural counts, decisive sanitized event metadata, per-event digests, run identity, terminal state, and explicit ambiguities. It contains no thought text, node labels, raw prompts, or raw model responses.

`browser-database-inspection.json` is produced by `tools/legacy-database-inspector.mjs` from the exact target-Mac SQLite blob in read-only/query-only mode. It records the source hash before and after inspection, SQLite integrity checks, table counts, hierarchy/reference invariants, embedding dimensions, candidate integrity, workspace classification, exact row equality with the prior diagnostics export, and a zero-call migration-package manifest. It contains no thought text, node labels, embeddings, or raw model payloads.

The private sources remain read-only outside the repository. Matching SHA-256 values are required before either sanitized fixture is accepted. `EVIDENCE.json` records all source and fixture hashes plus the zero-write/zero-call boundary.
