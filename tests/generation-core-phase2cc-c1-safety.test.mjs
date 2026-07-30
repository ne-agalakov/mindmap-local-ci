import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import * as c1 from "./generation-core-phase2cc-c1-fixture.mjs";
const { createSanitizedGenerationAttemptEvidence, runToSealed, sha256 } = c1;

test("sanitized evidence is deterministic and excludes private payload, paths, writes, retry, network, and models", () => {
  const { aggregate, events } = runToSealed("evidence");
  const first = createSanitizedGenerationAttemptEvidence(aggregate, events, sha256);
  const second = createSanitizedGenerationAttemptEvidence(structuredClone(aggregate), structuredClone(events), sha256);
  assert.deepEqual(second, first);
  assert.equal(first.boundaries.exactSourceBytesIncluded, false);
  assert.equal(first.boundaries.rawThoughtTextIncluded, false);
  assert.equal(first.boundaries.nodeLabelsIncluded, false);
  assert.equal(first.boundaries.localPathsIncluded, false);
  assert.equal(first.boundaries.personalDataIncluded, false);
  assert.equal(first.boundaries.actualMigrationPerformed, false);
  assert.equal(first.boundaries.productionWritePerformed, false);
  assert.equal(first.boundaries.automaticRetryAllowed, false);
  assert.equal(first.boundaries.networkCalls, 0);
  assert.equal(first.boundaries.modelCalls, 0);
  assert.equal(first.boundaries.modelMode, "без AI");
  const serialized = JSON.stringify(first).toLowerCase();
  for (const forbidden of ["/users/", "originalcontent", "modelpayload", "private-thought-payload"]) {
    assert.equal(serialized.includes(forbidden), false, `evidence leaked ${forbidden}`);
  }
});

test("C1 core has no browser, IndexedDB, filesystem, network, model-service, exact-source, clock, or randomness dependency", async () => {
  const files = [
    "constants.ts",
    "identities.ts",
    "registry-types.ts",
    "validators.ts",
    "canonical-json.ts",
    "attempt-types.ts",
    "attempt-reducer.ts",
    "plans.ts",
    "command-common.ts",
    "command-prepromotion.ts",
    "command-postpromotion.ts",
    "attempt-commands.ts",
    "evidence.ts",
    "sanitized-fixture.ts",
    "index.ts",
  ].map((file) => new URL(`../generation-core/${file}`, import.meta.url));
  const source = (await Promise.all(files.map((file) => readFile(file, "utf8")))).join("\n").toLowerCase();
  for (const forbidden of [
    "from \"react",
    "from 'react",
    "indexeddb",
    "window.",
    "document.",
    "navigator.",
    "fetch(",
    "xmlhttprequest",
    "websocket",
    "node:fs",
    "node:path",
    "sql.js",
    "ollama",
    "qwen",
    "deepseek",
    "date.now",
    "new date(",
    "math.random",
    "randomuuid",
    "356b943275cce292d0e14f8a7fbe95af07e79de73f06d3e361874d342aa2f918",
  ]) {
    assert.equal(source.includes(forbidden), false, `pure C1 core contains forbidden dependency/token ${forbidden}`);
  }
});
