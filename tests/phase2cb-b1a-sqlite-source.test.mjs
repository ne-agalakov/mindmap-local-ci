import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { runPhase2CbB1aHarness } from "../migration/phase2cb-b1a-executor.ts";
import { InMemoryPhase2CbB1aTargetFactory } from "../migration/phase2cb-b1a-targets.ts";
import {
  createSanitizedPhase2CbSqliteFixture,
  SanitizedPhase2CbSqliteSourceAdapter,
} from "../tools/phase2cb-b1a-sanitized-sqlite-source.mjs";
import { phase2CbB1aCandidate } from "../migration/phase2cb-b1a-fixture.ts";

const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const hashCanonical = (value) => sha256(value);
const hashBytes = (bytes) => sha256(bytes);
const hashPayload = (payload) => sha256(
  payload.encoding === "base64" || payload.encoding === "float32-le-base64"
    ? Buffer.from(payload.data, "base64")
    : Buffer.from(payload.data, "utf8"),
);

async function fileIdentity(path) {
  const [bytes, info] = await Promise.all([readFile(path), stat(path)]);
  return { sha256: sha256(bytes), sizeBytes: bytes.byteLength, mode: info.mode & 0o777 };
}

test("sanitized SQLite source adapter opens read-only and preserves source bytes across B1a", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "mindmap-b1a-sqlite-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const path = join(root, "sanitized.sqlite");
  await createSanitizedPhase2CbSqliteFixture(path, phase2CbB1aCandidate());
  const before = await fileIdentity(path);
  assert.equal(before.mode, 0o444);

  const source = new SanitizedPhase2CbSqliteSourceAdapter({
    path,
    sourceId: "sanitized-sqlite-fixture",
    hashBytes,
  });
  const targetFactory = new InMemoryPhase2CbB1aTargetFactory({ hashCanonical, hashPayload });
  const result = await runPhase2CbB1aHarness({
    runId: "sqlite-readonly",
    source,
    targetFactory,
    mappingOptions: { hashCanonical, hashBytes },
    hashCanonical,
    boundaryCounters: () => ({ networkCalls: 0, modelCalls: 0 }),
  });
  assert.equal(result.ok, true);
  const after = await fileIdentity(path);
  assert.deepEqual(after, before);
  assert.equal(result.evidence.sourceUnchangedAcrossHarness, true);
});
