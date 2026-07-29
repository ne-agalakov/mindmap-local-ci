import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const C2_MODULES = [
  "../generation-storage/indexeddb/c2-indexeddb-common.ts",
  "../generation-storage/indexeddb/native-generation-seal-store.ts",
  "../generation-storage/indexeddb/c2-attempt-operations.ts",
  "../generation-storage/indexeddb/c2-pointer-operations.ts",
  "../generation-storage/indexeddb/native-generation-registry.ts",
];

test("C2 full implementation surface excludes filesystem, network, model, exact-source, and personal-data paths", async () => {
  const source = (await Promise.all(C2_MODULES.map((path) => readFile(new URL(path, import.meta.url), "utf8")))).join("\n");
  for (const forbidden of [
    'from "node:fs',
    "from 'node:fs",
    "fetch(",
    "XMLHttpRequest",
    "WebSocket",
    "EventSource",
    "sendBeacon",
    "ollama",
    "deepseek",
    "qwen",
    "tools/phase2cb",
    "migration/phase2cb",
    "legacy-database-inspector",
    "mindmap-local-semantic-v060",
    "mindmap-v0.6.sqlite",
  ]) assert.equal(source.toLowerCase().includes(forbidden.toLowerCase()), false, forbidden);
  assert.equal(source.includes("productionWriteAllowed: true"), false);
  assert.equal(source.includes("production_or_legacy_database_forbidden"), true);
});
