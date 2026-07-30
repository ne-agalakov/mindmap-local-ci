import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const resolverPaths = [
  "../runtime-generation/indexeddb/active-generation-resolver.ts",
  "../runtime-generation/indexeddb/resolver-errors.ts",
  "../runtime-generation/indexeddb/resolver-observability.ts",
  "../runtime-generation/indexeddb/resolver-readers.ts",
].map((path) => new URL(path, import.meta.url));
const runtimePath = new URL("../app/lib/generation-runtime.ts", import.meta.url);

async function source() {
  const resolverSources = await Promise.all(resolverPaths.map((path) => readFile(path, "utf8")));
  return `${resolverSources.join("\n")}\n${await readFile(runtimePath, "utf8")}`;
}

test("C3 resolver source contains no write, fallback, source, backup, network, model, or production paths", async () => {
  const content = await source();
  for (const forbidden of [
    /mindmap-local-semantic-v060/i,
    /mindmap-v0\.6\.sqlite/i,
    /\.sqlite\b/i,
    /readwrite/i,
    /\.put\s*\(/,
    /\.add\s*\(/,
    /\.clear\s*\(/,
    /fetch\s*\(/,
    /XMLHttpRequest/,
    /WebSocket/,
    /EventSource/,
    /sendBeacon/,
    /ollama/i,
    /deepseek/i,
    /openai/i,
    /automaticRetryAllowed:\s*true/,
    /automaticResumeAllowed:\s*true/,
    /fallbackUsed:\s*true/,
  ]) {
    assert.doesNotMatch(content, forbidden);
  }
  assert.match(content, /database\.transaction\(requiredStores, "readonly"\)/);
  assert.match(content, /fallbackUsed:\s*false/);
  assert.match(content, /automaticRetryAllowed:\s*false/);
  assert.match(content, /automaticResumeAllowed:\s*false/);
  assert.match(content, /exactSourceOpened:\s*false/);
  assert.match(content, /backupAccessed:\s*false/);
  assert.match(content, /actualMigrationPerformed:\s*false/);
  assert.match(content, /networkCalls:\s*0/);
  assert.match(content, /modelCalls:\s*0/);
  assert.match(content, /personalDataUsed:\s*false/);
});

test("C3 packaged runtime imports the resolver from the production app module boundary", async () => {
  const content = await readFile(runtimePath, "utf8");
  assert.match(content, /^"use client";/);
  assert.match(content, /resolvePackagedActiveGeneration/);
  assert.match(content, /runtime-generation\/index\.ts/);
  assert.match(content, /PACKAGED_GENERATION_RUNTIME_PHASE = "phase2cc-c3"/);
});
