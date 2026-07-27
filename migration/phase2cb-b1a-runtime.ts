import type {
  Phase2CbB1aExecutorOptions,
  Phase2CbB1aObservation,
  Phase2CbB1aStep,
  Phase2CbB1aStop,
  Phase2CbB1aWorkType,
} from "./phase2cb-b1a-contracts.ts";

export const HEX_64 = /^[a-f0-9]{64}$/;

export function stop(
  code: Phase2CbB1aStop["code"],
  message: string,
  details?: Phase2CbB1aStop["details"],
  mappingStopCode?: Phase2CbB1aStop["mappingStopCode"],
): Phase2CbB1aStop {
  return Object.freeze({ code, message, details, mappingStopCode });
}

export function safeRunId(value: string): string {
  const normalized = value.trim().replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  if (!normalized) throw new Error("invalid_b1a_run_id");
  return normalized;
}

export function sourceSnapshotsEqual(
  left: Readonly<{ sizeBytes: number; sha256: string }>,
  right: Readonly<{ sizeBytes: number; sha256: string }>,
): boolean {
  return left.sizeBytes === right.sizeBytes && left.sha256 === right.sha256;
}

export function countersAreZero(counters: Readonly<{ networkCalls: number; modelCalls: number }>): boolean {
  return counters.networkCalls === 0 && counters.modelCalls === 0;
}

export class Observer {
  private readonly now: () => number;
  private readonly sink?: (observation: Phase2CbB1aObservation) => void;
  private readonly heartbeatIntervalMs: number;
  private readonly possiblyHungThresholdMs: number;
  private sequence = 0;
  private stepStartedAt = 0;
  private lastProgressAt = 0;
  private currentStep?: Phase2CbB1aStep;
  private currentProcessed?: number;
  private currentTotal?: number;
  readonly trace: Phase2CbB1aObservation[] = [];

  constructor(
    now: () => number,
    sink?: (observation: Phase2CbB1aObservation) => void,
    heartbeatIntervalMs = 1_000,
    possiblyHungThresholdMs = 10_000,
  ) {
    if (!Number.isFinite(heartbeatIntervalMs) || heartbeatIntervalMs < 1) {
      throw new Error("invalid_b1a_heartbeat_interval");
    }
    if (!Number.isFinite(possiblyHungThresholdMs) || possiblyHungThresholdMs < heartbeatIntervalMs) {
      throw new Error("invalid_b1a_possibly_hung_threshold");
    }
    this.now = now;
    this.sink = sink;
    this.heartbeatIntervalMs = heartbeatIntervalMs;
    this.possiblyHungThresholdMs = possiblyHungThresholdMs;
  }

  emit(
    step: Phase2CbB1aStep,
    workType: Phase2CbB1aWorkType,
    state: Phase2CbB1aObservation["state"],
    extras: Readonly<Pick<Phase2CbB1aObservation, "processed" | "total" | "message">> = {},
    markProgress = true,
  ): void {
    const current = this.now();
    if (this.currentStep !== step) {
      this.currentStep = step;
      this.stepStartedAt = current;
      this.lastProgressAt = current;
      this.currentProcessed = undefined;
      this.currentTotal = undefined;
    }
    if (extras.processed !== undefined) this.currentProcessed = extras.processed;
    if (extras.total !== undefined) this.currentTotal = extras.total;
    if (markProgress) this.lastProgressAt = current;
    const observation: Phase2CbB1aObservation = Object.freeze({
      sequence: ++this.sequence,
      step,
      workType,
      state,
      stepStartedAt: new Date(this.stepStartedAt).toISOString(),
      heartbeatAt: new Date(current).toISOString(),
      elapsedMs: Math.max(0, current - this.stepStartedAt),
      lastProgressAt: new Date(this.lastProgressAt).toISOString(),
      inactivityMs: Math.max(0, current - this.lastProgressAt),
      model: "без AI",
      ...(this.currentProcessed !== undefined ? { processed: this.currentProcessed } : {}),
      ...(this.currentTotal !== undefined ? { total: this.currentTotal } : {}),
      ...(extras.message !== undefined ? { message: extras.message } : {}),
    });
    this.trace.push(observation);
    this.sink?.(observation);
  }

  async run<T>(
    step: Phase2CbB1aStep,
    workType: Phase2CbB1aWorkType,
    state: "working" | "saving" | "validating",
    operation: (progress: (processed?: number, total?: number, message?: string) => void) => Promise<T>,
    initial: Readonly<Pick<Phase2CbB1aObservation, "processed" | "total" | "message">> = {},
  ): Promise<T> {
    this.emit(step, workType, state, initial, true);
    const timer = setInterval(() => {
      const current = this.now();
      const inactivity = Math.max(0, current - this.lastProgressAt);
      this.emit(
        step,
        workType,
        inactivity >= this.possiblyHungThresholdMs ? "possibly_hung" : state,
        {
          message: inactivity >= this.possiblyHungThresholdMs
            ? `возможно, процесс завис; без активности ${inactivity} мс; безопасно дождаться или скачать диагностику`
            : "heartbeat",
        },
        false,
      );
    }, this.heartbeatIntervalMs);
    (timer as unknown as { unref?: () => void }).unref?.();
    try {
      return await operation((processed, total, message) => {
        this.emit(step, workType, state, { processed, total, message }, true);
      });
    } finally {
      clearInterval(timer);
    }
  }
}
