import assert from "node:assert/strict";
import test from "node:test";
import { indexedDB } from "fake-indexeddb";
import {
  loadSnapshot,
  saveSnapshot,
  shouldSeedSnapshot,
} from "../app/lib/local-db.ts";

globalThis.indexedDB = indexedDB;

test("does not overwrite an in-progress run whose journal exists before thoughts are materialized", () => {
  assert.equal(shouldSeedSnapshot({ thoughts: 0, links: 0, nodes: 0, decisions: 2 }), false);
});

test("seeds only a genuinely empty database", () => {
  assert.equal(shouldSeedSnapshot({ thoughts: 0, links: 0, nodes: 0, decisions: 0 }), true);
});

test("preserves any partially populated snapshot", () => {
  assert.equal(shouldSeedSnapshot({ thoughts: 0, links: 0, nodes: 1, decisions: 0 }), false);
  assert.equal(shouldSeedSnapshot({ thoughts: 1, links: 0, nodes: 0, decisions: 0 }), false);
});

test("reload keeps the saved 12/96 journal even while the thoughts table is empty", async () => {
  const runId = "v06-reload-integration";
  const items = Array.from({ length: 12 }, (_, index) => ({
    thoughtId: `synthetic-${index + 1}`,
  }));
  const checkpoint = {
    thoughts: [],
    links: [],
    nodes: [],
    decisions: [
      {
        id: "started",
        eventType: "batch_started",
        createdAt: "2026-07-22T12:00:00.000Z",
        engine: "user",
        input: { runId, orderVariant: "round_robin" },
      },
      {
        id: "extract-12",
        eventType: "pipeline_extract",
        createdAt: "2026-07-22T12:01:00.000Z",
        engine: "ollama",
        input: { runId },
        output: { items },
      },
    ],
  };

  await saveSnapshot(checkpoint);
  const reloaded = await loadSnapshot({
    thoughts: [{
      id: "demo-that-must-not-overwrite-the-run",
      title: "Demo",
      content: "Demo",
      type: "Наблюдение",
      project: "Без проекта",
      tags: [],
      createdAt: "2026-07-22T00:00:00.000Z",
      status: "inbox",
    }],
    links: [],
    nodes: [],
    decisions: [],
  });

  assert.equal(reloaded.thoughts.length, 0);
  assert.deepEqual(reloaded.decisions.map((decision) => decision.id), ["started", "extract-12"]);
  assert.equal(reloaded.decisions[1].output.items.length, 12);
});
