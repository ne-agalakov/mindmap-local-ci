# Browser legacy exporter

Purpose: export the exact Alpha.19 IndexedDB/sql.js blob from the original Chrome profile without loading the old MindMap application or changing storage.

## Safety model

- standalone Node built-in HTTP server;
- fixed same origin `http://127.0.0.1:5173`;
- no Vite, Cloudflare, Miniflare, sql.js initialization, app import, API route, or model service;
- verifies the IndexedDB database exists before calling `open`;
- opens without a version and aborts any unexpected upgrade event;
- uses only a `readonly` transaction and exact key lookup;
- computes SHA-256 in browser WebCrypto;
- prepares unchanged SQLite bytes and evidence JSON as explicit downloads;
- never parses, migrates, repairs, or writes the database.

The exported `.sqlite` file contains private local MindMap data. It must not be published. The evidence JSON contains only storage identity, byte length, hash, and zero-call statements.

## Target smoke procedure

1. Close the old MindMap terminal window so port 5173 is free.
2. In the same Chrome profile, launch `start-legacy-exporter.command`.
3. Confirm the page origin is exactly `http://127.0.0.1:5173`.
4. Press `Проверить и подготовить экспорт` once.
5. Record the displayed size and SHA-256.
6. Download both the exact `.sqlite` file and evidence JSON.
7. Close the exporter terminal window.

The target-Mac export completed on 2026-07-25. The accepted SQLite source is `5,070,848` bytes with SHA-256 `356b943275cce292d0e14f8a7fbe95af07e79de73f06d3e361874d342aa2f918`. Independent read-only inspection reproduced the same hash and returned `quick_check = ok` and `integrity_check = ok`.

This tool remains only a preservation utility. Re-running it is unnecessary unless the accepted source itself is lost. It does not authorize a model run, migration, or legacy-database write.
