import { createHash } from "node:crypto";
import {
  InMemoryAtomicC4AuthorizationLedger,
  InMemoryC4ExecutionStateStore,
  SanitizedFixtureBackupStore,
  SanitizedFixtureSourceAdapter,
  SanitizedGenerationStore,
  createCanonicalSanitizedC4Fixture,
  runSanitizedC4Attempt,
} from "../c4-execution/index.ts";

export const sha256 = (content) => createHash("sha256").update(content).digest("hex");

export class FixedClock {
  constructor(iso = "2026-07-30T13:00:00.000Z") {
    this.iso = iso;
    this.ms = Date.parse(iso);
  }
  nowIso() { return this.iso; }
  nowMs() { return this.ms; }
  advance(ms) { this.ms += ms; this.iso = new Date(this.ms).toISOString(); }
}

export class TickingClock extends FixedClock {
  constructor(iso = "2026-07-30T13:00:00.000Z", tickMs = 2) {
    super(iso);
    this.tickMs = tickMs;
  }
  nowMs() {
    const value = this.ms;
    this.advance(this.tickMs);
    return value;
  }
}

export function activationReceipt(manifest, committedAt = "2026-07-30T13:00:00.000Z") {
  const nextPointer = Object.freeze({
    workspace: "synthetic",
    generationId: manifest.generationId,
    databaseName: manifest.logicalGenerationDatabaseName,
    targetSnapshotHash: manifest.expectedTargetSnapshotHash,
    sourceSha256: manifest.source.sha256,
    attemptId: manifest.attemptId,
    activationEpoch: 1,
    registryRevision: 1,
    state: "active",
  });
  return Object.freeze({
    receiptId: `activation-${manifest.attemptId}-1`,
    attemptId: manifest.attemptId,
    authorizationId: manifest.authorizationId,
    workspace: "synthetic",
    expectedRegistryRevision: 0,
    committedRegistryRevision: 1,
    nextPointer,
    committedAt,
    outcome: "committed",
  });
}

export class MockPromotionAdapter {
  constructor(options = {}) {
    this.options = options;
    this.calls = 0;
    this.prepareCalls = 0;
    this.readbackCalls = 0;
  }
  async preflight() {
    if (this.options.preflightFailure) return { ok: false, ...this.options.preflightFailure };
    return { ok: true, value: { registryRevision: 0, previousPointerFingerprint: sha256("null"), registryEmptyBootstrap: true } };
  }
  async prepare() {
    this.prepareCalls += 1;
    if (this.options.prepareFailure) return { ok: false, evidenceFingerprint: "prepare-failure", ...this.options.prepareFailure };
    return { ok: true, evidenceFingerprint: "prepared" };
  }
  async promoteOnce({ manifest }) {
    this.calls += 1;
    if (this.options.promotionFailure) return { ok: false, evidenceFingerprint: "promotion-failure", ...this.options.promotionFailure };
    if (this.options.uncertainWithoutCommit || this.options.uncertainAfterCommit) {
      this.receipt = this.options.uncertainAfterCommit ? activationReceipt(manifest) : undefined;
      return { ok: true, outcome: "uncertain", evidenceFingerprint: "uncertain" };
    }
    this.receipt = activationReceipt(manifest);
    return { ok: true, outcome: "committed", receipt: this.receipt, evidenceFingerprint: "committed" };
  }
  async readbackUncertainPromotion() {
    this.readbackCalls += 1;
    if (this.options.readbackFailure) return { ok: false, evidenceFingerprint: "readback-failure", ...this.options.readbackFailure };
    if (!this.receipt) return { ok: true, committed: false, evidenceFingerprint: "not-committed" };
    return { ok: true, committed: true, receipt: this.receipt, evidenceFingerprint: "readback-committed" };
  }
}

export class MockResolverAdapter {
  constructor(options = {}) { this.options = options; this.calls = 0; }
  async resolve(manifest) {
    this.calls += 1;
    if (this.options.failure) return { ok: false, code: "resolver_failure", message: "injected resolver failure", evidenceFingerprint: "resolver-failure" };
    return {
      ok: true,
      generationId: manifest.generationId,
      databaseName: manifest.logicalGenerationDatabaseName,
      targetSnapshotHash: manifest.expectedTargetSnapshotHash,
      verificationFingerprint: sha256("resolver-ok"),
    };
  }
}

export function createRunnerContext(options = {}) {
  const fixture = createCanonicalSanitizedC4Fixture(sha256);
  const manifest = options.manifest ?? fixture.manifest;
  const authorization = options.authorization ?? fixture.authorization;
  const source = options.source ?? new SanitizedFixtureSourceAdapter(fixture, sha256, options.sourceFaults);
  const backupStore = options.backupStore ?? new SanitizedFixtureBackupStore();
  const generationStore = options.generationStore ?? new SanitizedGenerationStore();
  const authorizationLedger = options.authorizationLedger ?? new InMemoryAtomicC4AuthorizationLedger();
  const stateStore = options.stateStore ?? new InMemoryC4ExecutionStateStore();
  const promotion = options.promotion ?? new MockPromotionAdapter(options.promotionOptions);
  const resolver = options.resolver ?? new MockResolverAdapter(options.resolverOptions);
  const clock = options.clock ?? new FixedClock();
  const targetInventory = options.targetInventory ?? Object.freeze({
    registryExists: false,
    registryEmptyBootstrap: true,
    physicalGenerationDatabaseNames: Object.freeze([]),
    logicalGenerationDatabaseNames: Object.freeze([]),
  });
  const runnerOptions = {
    manifest,
    authorization,
    authorizationLedger,
    stateStore,
    source,
    backupStore,
    generationStore,
    targetInventory,
    promotion,
    resolver,
    hasher: sha256,
    clock,
    backupFaults: options.backupFaults,
    interruptAfter: options.interruptAfter,
    hangThresholdMs: options.hangThresholdMs,
    onObservation: options.onObservation,
  };
  return {
    fixture,
    manifest,
    authorization,
    source,
    backupStore,
    generationStore,
    authorizationLedger,
    stateStore,
    promotion,
    resolver,
    clock,
    runnerOptions,
  };
}

export async function runContext(options = {}) {
  const context = createRunnerContext(options);
  return { context, result: await runSanitizedC4Attempt(context.runnerOptions) };
}
