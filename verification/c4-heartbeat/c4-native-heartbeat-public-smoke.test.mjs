import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { IDBFactory } from "fake-indexeddb";
import {
  C4_FIXTURE_COUNTS,
  InMemoryAtomicC4AuthorizationLedger,
  InMemoryC4ExecutionStateStore,
  NativeC1C2PromotionAdapter,
  NativeC3ResolverAdapter,
  SanitizedFixtureSourceAdapter,
  createCanonicalSanitizedC4Fixture,
  runNativeSanitizedC4Attempt,
} from "../../c4-execution/index.ts";

const sha256 = (value) => createHash("sha256").update(value).digest("hex");

class DeterministicClock {
  constructor() {
    this.tick = 0;
  }
  nowMs() {
    this.tick += 1;
    return this.tick;
  }
  nowIso() {
    return new Date(Date.UTC(2026, 6, 30, 12, 0, this.tick++)).toISOString();
  }
}

const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

test("native C4 emits live heartbeat and possibly-hung evidence without retry or AI", async () => {
  const indexedDB = new IDBFactory();
  const fixture = createCanonicalSanitizedC4Fixture(sha256);
  const clock = new DeterministicClock();
  const source = new SanitizedFixtureSourceAdapter(fixture, sha256);
  const delayedSource = Object.freeze({
    get sourceOpenCount() {
      return source.sourceOpenCount;
    },
    async openReadOnly() {
      await delay(40);
      return source.openReadOnly();
    },
  });
  const nativeOptions = {
    indexedDB,
    hasher: sha256,
    counts: C4_FIXTURE_COUNTS,
    nowIso: () => clock.nowIso(),
  };
  const promotion = new NativeC1C2PromotionAdapter(nativeOptions);
  const resolver = new NativeC3ResolverAdapter(nativeOptions);
  const streamed = [];

  const result = await runNativeSanitizedC4Attempt({
    indexedDB,
    manifest: fixture.manifest,
    authorization: fixture.authorization,
    authorizationLedger: new InMemoryAtomicC4AuthorizationLedger(),
    stateStore: new InMemoryC4ExecutionStateStore(),
    source: delayedSource,
    promotion,
    resolver,
    hasher: sha256,
    clock,
    heartbeatIntervalMs: 5,
    hangThresholdMs: 10,
    onObservation: (observation) => streamed.push(observation),
  });

  assert.equal(result.ok, true, JSON.stringify(result.diagnostics));
  const hung = result.diagnostics.observations.filter(
    (observation) => observation.checkpoint === "P03" && observation.state === "possibly_hung",
  );
  assert.ok(hung.length >= 1, JSON.stringify(result.diagnostics.observations));
  assert.ok(hung.some((observation) => observation.lastProgress.includes("Safe actions")));
  assert.ok(hung.every((observation) => observation.model === "без AI"));
  assert.equal(streamed.some((observation) => observation.state === "possibly_hung"), true);
  assert.equal(result.diagnostics.automaticRetryAllowed, false);
  assert.equal(result.diagnostics.automaticResumeAllowed, false);
  assert.equal(result.diagnostics.automaticCleanupAllowed, false);
  assert.equal(result.diagnostics.networkCalls, 0);
  assert.equal(result.diagnostics.modelCalls, 0);
  assert.equal(promotion.promotionCallCount, 1);
  assert.deepEqual(
    result.diagnostics.observations.map((observation) => observation.sequence),
    result.diagnostics.observations.map((_, index) => index + 1),
  );
  promotion.close();
});
