import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { IDBFactory } from "fake-indexeddb";

import { runPhase2CbB1aHarness } from "../migration/phase2cb-b1a-executor.ts";
import { MemoryPhase2CbB1aSourceAdapter } from "../migration/phase2cb-b1a-source.ts";
import { IndexedDbPhase2CbB1aTargetFactory } from "../migration/phase2cb-b1a-targets.ts";
import { phase2CbB1aCandidate } from "../migration/phase2cb-b1a-fixture.ts";

const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const hashCanonical = (value) => sha256(value);
const hashBytes = (bytes) => sha256(bytes);
const hashPayload = (payload) => sha256(
  payload.encoding === "base64" || payload.encoding === "float32-le-base64"
    ? Buffer.from(payload.data, "base64")
    : Buffer.from(payload.data, "utf8"),
);

test("B1a uses native IndexedDB adapters in an isolated sanitized target", async () => {
  const indexedDB = new IDBFactory();
  const targetFactory = new IndexedDbPhase2CbB1aTargetFactory({ indexedDB, hashCanonical, hashPayload });
  const source = new MemoryPhase2CbB1aSourceAdapter({
    sourceId: "sanitized-indexeddb-fixture",
    bytes: Buffer.from("sanitized-indexeddb-fixture", "utf8"),
    candidate: phase2CbB1aCandidate(),
    hashBytes,
  });
  const result = await runPhase2CbB1aHarness({
    runId: "indexeddb-fixture",
    source,
    targetFactory,
    mappingOptions: { hashCanonical, hashBytes },
    hashCanonical,
    boundaryCounters: () => ({ networkCalls: 0, modelCalls: 0 }),
  });
  assert.equal(result.ok, true);
  assert.equal(result.evidence.repeatTargetHashesEqual, true);
  assert.equal(result.evidence.rollbackTargetEmpty, true);
  assert.deepEqual(await indexedDB.databases(), []);
});
