import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
const localDb = await readFile(new URL("../app/lib/local-db.ts", import.meta.url), "utf8");

test("main panel exposes separate sanitized stage diagnostics", () => {
  assert.match(page, /Скачать диагностику этапа/);
  assert.match(page, /buildOperationDiagnostics\(observation/);
  assert.match(page, /projectOperationCallCounters\(decisions, observation\)/);
  assert.match(page, /persistedCallEvidence/);
  assert.match(page, /onDownloadDiagnostics=\{\(\) => downloadStageDiagnostics\(displayedObservation\)\}/);
});

test("factual network configuration calls are persisted in the existing decision journal", () => {
  assert.match(localDb, /operation_network_call_planned/);
  assert.match(localDb, /operation_network_call_completed/);
  assert.match(page, /eventType: "operation_network_call_planned"/);
  assert.match(page, /eventType: "operation_network_call_completed"/);
  assert.match(page, /runSyntheticTest\(false, configResult\.decisions, true\)/);
  assert.match(page, /runSyntheticTest\(false, continuationDecisions\)/);
});

test("full diagnostics remains visibly distinct because it contains thought text", () => {
  assert.match(page, /Скачать диагностику для анализа/);
  assert.match(page, /Диагностика содержит тексты мыслей/);
});
