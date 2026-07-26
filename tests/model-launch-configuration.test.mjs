import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const semanticRoute = await readFile(new URL("../app/api/semantic-pipeline/route.ts", import.meta.url), "utf8");
const analyzeRoute = await readFile(new URL("../app/api/analyze/route.ts", import.meta.url), "utf8");
const runtimeConfig = await readFile(new URL("../app/lib/runtime-config.ts", import.meta.url), "utf8");
const launcher = await readFile(new URL("../start-mindmap.command", import.meta.url), "utf8");
const deepSeekLauncher = await readFile(new URL("../start-mindmap-deepseek.command", import.meta.url), "utf8");

test("launcher-selected model is written to the module used by every AI route", () => {
  assert.match(deepSeekLauncher, /export OLLAMA_MODEL="deepseek-r1:8b"/);
  assert.match(launcher, /MODEL_JSON=.*JSON\.stringify/);
  assert.match(launcher, /app\/lib\/runtime-config\.ts/);
  assert.match(launcher, /CONFIGURED_SEMANTIC_MODEL/);
  assert.match(runtimeConfig, /CONFIGURED_SEMANTIC_MODEL/);
  assert.match(semanticRoute, /CONFIGURED_SEMANTIC_MODEL/);
  assert.match(analyzeRoute, /CONFIGURED_SEMANTIC_MODEL/);
  assert.doesNotMatch(semanticRoute, /process\.env\.OLLAMA_MODEL/);
  assert.doesNotMatch(analyzeRoute, /process\.env\.OLLAMA_MODEL/);
});
