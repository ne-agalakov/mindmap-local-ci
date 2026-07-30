import { C4_FIXTURE_COUNTS } from "./canonical-fixture.ts";
import { IndexedDbSanitizedFixtureBackupStore } from "./native-fixture-backup.ts";
import { IndexedDbSanitizedGenerationStore } from "./native-fixture-generation.ts";
import {
  inspectNativeC4TargetInventory,
  type NativeC4TargetInventorySnapshot,
} from "./native-target-inventory.ts";
import {
  runSanitizedC4Attempt,
  type C4FixtureBackupStoreLike,
  type C4FixtureSourceAdapterLike,
  type C4GenerationStoreLike,
  type C4PromotionAdapter,
  type C4ResolverAdapter,
  type C4RunnerOptions,
  type C4RunnerResult,
  type C4TargetInventoryAdapter,
} from "./runner.ts";
import type { C4ExecutionStateStore } from "./state-store.ts";
import type {
  C4AuthorizationLedger,
  C4Checkpoint,
  C4LongOperationObservation,
} from "./types.ts";

export interface NativeC4RunnerOptions extends Omit<
  C4RunnerOptions,
  "targetInventory" | "targetInventoryAdapter" | "backupStore" | "generationStore"
> {
  readonly indexedDB: IDBFactory;
  readonly onTargetInventory?: (snapshot: NativeC4TargetInventorySnapshot) => void;
  readonly heartbeatIntervalMs?: number;
  readonly monotonicNowMs?: () => number;
}

type ProgressReporter = (processed: number, total: number, lastProgress: string) => void;

function defaultMonotonicNowMs(): number {
  return typeof globalThis.performance?.now === "function"
    ? globalThis.performance.now()
    : Date.now();
}

export async function runNativeSanitizedC4Attempt(
  options: NativeC4RunnerOptions,
): Promise<C4RunnerResult> {
  const {
    indexedDB,
    onTargetInventory,
    heartbeatIntervalMs: requestedHeartbeatIntervalMs,
    monotonicNowMs = defaultMonotonicNowMs,
    onObservation,
    ...baseOptions
  } = options;
  const heartbeatIntervalMs = Math.max(1, requestedHeartbeatIntervalMs ?? 1_000);
  const hangThresholdMs = Math.max(1, options.hangThresholdMs ?? 30_000);
  const observations: C4LongOperationObservation[] = [];
  let observationSequence = 0;

  const recordObservation = (
    observation: Omit<C4LongOperationObservation, "sequence"> | C4LongOperationObservation,
  ): void => {
    const recorded: C4LongOperationObservation = Object.freeze({
      ...observation,
      sequence: ++observationSequence,
    });
    observations.push(recorded);
    onObservation?.(recorded);
  };

  const monitor = async <T>(
    checkpoint: C4Checkpoint,
    workName: string,
    operation: (progress: ProgressReporter) => Promise<T> | T,
  ): Promise<T> => {
    const startedAt = monotonicNowMs();
    let lastProgressAt = startedAt;
    let completed = false;
    const emit = (
      state: C4LongOperationObservation["state"],
      processed: number,
      total: number,
      lastProgress: string,
    ): void => {
      recordObservation({
        checkpoint,
        workName,
        workType: "local",
        elapsedMs: Math.max(0, monotonicNowMs() - startedAt),
        processed,
        total,
        lastProgress,
        heartbeatAt: options.clock.nowIso(),
        state,
        model: "без AI",
      });
    };
    const progress: ProgressReporter = (processed, total, lastProgress) => {
      lastProgressAt = monotonicNowMs();
      emit("saving", processed, total, lastProgress);
    };

    emit("working", 0, 1, `${workName} started.`);
    const timer = globalThis.setInterval(() => {
      if (completed) return;
      const quietMs = Math.max(0, monotonicNowMs() - lastProgressAt);
      if (quietMs >= hangThresholdMs) {
        emit(
          "possibly_hung",
          0,
          1,
          `No confirmed progress for ${Math.round(quietMs)} ms; the process may be hung. Safe actions: download diagnostics, inspect persisted state, stop and diagnose offline. No automatic retry, resume, cleanup or AI call.`,
        );
      } else {
        emit(
          "working",
          0,
          1,
          `Heartbeat; no confirmed progress for ${Math.round(quietMs)} ms.`,
        );
      }
    }, heartbeatIntervalMs);

    try {
      const value = await operation(progress);
      lastProgressAt = monotonicNowMs();
      emit("completed", 1, 1, `${workName} completed.`);
      return value;
    } catch (error) {
      emit(
        "failed",
        0,
        1,
        `${workName} failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    } finally {
      completed = true;
      globalThis.clearInterval(timer);
    }
  };

  const backupStore = new IndexedDbSanitizedFixtureBackupStore({ indexedDB });
  const generationStore = new IndexedDbSanitizedGenerationStore({
    indexedDB,
    hasher: options.hasher,
    counts: C4_FIXTURE_COUNTS,
    nowIso: () => options.clock.nowIso(),
  });

  const monitoredAuthorizationLedger: C4AuthorizationLedger = Object.freeze({
    consume(authorization, manifest, consumedAt, sourceOpenCount, hasher) {
      return monitor(
        "P02",
        "Consume one-shot C4 authorization",
        () => options.authorizationLedger.consume(
          authorization,
          manifest,
          consumedAt,
          sourceOpenCount,
          hasher,
        ),
      );
    },
    read(authorizationId) {
      return options.authorizationLedger.read(authorizationId);
    },
  });

  const monitoredStateStore: C4ExecutionStateStore | undefined = options.stateStore
    ? Object.freeze({
        initialize(state) {
          return monitor(
            "P00",
            "Persist initial C4 journal state",
            () => options.stateStore!.initialize(state),
          );
        },
        commit(expectedRevision, state) {
          return monitor(
            state.checkpoint,
            `Persist C4 checkpoint ${state.checkpoint}`,
            () => options.stateStore!.commit(expectedRevision, state),
          );
        },
        load(attemptId) {
          return options.stateStore!.load(attemptId);
        },
      })
    : undefined;

  const monitoredSource: C4FixtureSourceAdapterLike = Object.freeze({
    get sourceOpenCount() {
      return options.source.sourceOpenCount;
    },
    openReadOnly() {
      return monitor(
        "P03",
        "Open and verify sanitized fixture source read-only",
        () => options.source.openReadOnly(),
      );
    },
  });

  const monitoredBackupStore: C4FixtureBackupStoreLike = Object.freeze({
    createCloseReopenVerify(backupId, sourceBytes, expected, hasher, faults) {
      return monitor(
        "P04",
        "Create, close, reopen and verify fixture backup",
        () => backupStore.createCloseReopenVerify(
          backupId,
          sourceBytes,
          expected,
          hasher,
          faults,
        ),
      );
    },
  });

  const monitoredGenerationStore: C4GenerationStoreLike = Object.freeze({
    listPhysicalNames() {
      return monitor(
        "P05",
        "Enumerate physical fixture generations",
        () => generationStore.listPhysicalNames(),
      );
    },
    listLogicalNames() {
      return monitor(
        "P05",
        "Enumerate logical fixture generations",
        () => generationStore.listLogicalNames(),
      );
    },
    create(manifest) {
      return monitor(
        "P06",
        "Create isolated fixture generation",
        () => generationStore.create(manifest),
      );
    },
    importDeterministic(manifest, records, hasher, onCheckpoint) {
      return monitor(
        "P07",
        "Import deterministic fixture records",
        (progress) => generationStore.importDeterministic(
          manifest,
          records,
          hasher,
          (processed, total) => {
            progress(processed, total, `Persisted native import checkpoint ${processed}/${total}.`);
            onCheckpoint?.(processed, total);
          },
        ),
      );
    },
    closeReopenVerify(manifest, hasher) {
      return monitor(
        "P08",
        "Close, reopen and verify fixture generation",
        () => generationStore.closeReopenVerify(manifest, hasher),
      );
    },
    seal(manifest, sealedAt) {
      return monitor(
        "P10",
        "Persist immutable fixture generation seal",
        () => generationStore.seal(manifest, sealedAt),
      );
    },
    payloadFingerprint(physicalGenerationDatabaseName, hasher) {
      return monitor(
        "P14",
        "Read fixture generation payload fingerprint",
        () => generationStore.payloadFingerprint(physicalGenerationDatabaseName, hasher),
      );
    },
  });

  const targetInventoryAdapter: C4TargetInventoryAdapter = Object.freeze({
    inspect(manifest) {
      return monitor(
        "P05",
        "Inspect fail-closed native target inventory",
        async () => {
          const inspected = await inspectNativeC4TargetInventory({
            indexedDB,
            manifest,
            hasher: options.hasher,
          });
          if (!inspected.ok) return inspected;
          onTargetInventory?.(inspected.value);
          return Object.freeze({
            ok: true,
            inventory: inspected.value.inventory,
            evidenceFingerprint: inspected.value.evidenceFingerprint,
          });
        },
      );
    },
  });

  const monitoredPromotion: C4PromotionAdapter = Object.freeze({
    preflight(manifest) {
      return monitor(
        "P11",
        "Verify C1/C2 promotion preflight",
        () => options.promotion.preflight(manifest),
      );
    },
    prepare(request) {
      return monitor(
        "P11",
        "Prepare accepted C1/C2 promotion state",
        () => options.promotion.prepare(request),
      );
    },
    promoteOnce(request) {
      return monitor(
        "P12",
        "Invoke the single authorized C2 promotion call",
        () => options.promotion.promoteOnce(request),
      );
    },
    readbackUncertainPromotion(manifest) {
      return monitor(
        "P12",
        "Read back uncertain C2 promotion without retry",
        () => options.promotion.readbackUncertainPromotion(manifest),
      );
    },
  });

  const monitoredResolver: C4ResolverAdapter = Object.freeze({
    resolve(manifest) {
      return monitor(
        "P13",
        "Verify active generation through accepted C3 resolver",
        () => options.resolver.resolve(manifest),
      );
    },
  });

  try {
    const result = await runSanitizedC4Attempt({
      ...baseOptions,
      authorizationLedger: monitoredAuthorizationLedger,
      ...(monitoredStateStore ? { stateStore: monitoredStateStore } : {}),
      source: monitoredSource,
      backupStore: monitoredBackupStore,
      generationStore: monitoredGenerationStore,
      targetInventoryAdapter,
      promotion: monitoredPromotion,
      resolver: monitoredResolver,
      onObservation: recordObservation,
    });
    return Object.freeze({
      ...result,
      diagnostics: Object.freeze({
        ...result.diagnostics,
        observations: Object.freeze(observations.map((observation) => Object.freeze({ ...observation }))),
      }),
    }) as C4RunnerResult;
  } finally {
    generationStore.close();
  }
}

export function serializeC4SanitizedDiagnostics(result: C4RunnerResult): string {
  return JSON.stringify(result.diagnostics, null, 2);
}
