import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("../scripts/run-browser-req-obs-harness.mjs", import.meta.url), "utf8");

test("REQ-OBS Chrome runner waits after SIGKILL and retries profile cleanup", () => {
  assert.match(source, /async function waitForExit/);
  assert.match(source, /child\.kill\("SIGKILL"\); await waitForExit\(child, 2_000\)/);
  assert.match(source, /async function cleanupDirectory/);
  assert.match(source, /maxRetries: 3, retryDelay: 100/);
  assert.match(source, /await cleanupDirectory\(profile\)/);
});
