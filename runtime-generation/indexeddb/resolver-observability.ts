import { C3_RESOLVER_MODEL, C3_RESOLVER_PHASE, type C3ResolverObservation, type C3ResolverOptions, type C3ResolverRuntimeState, type C3ResolverStage } from "../resolver-types.ts";

export const C3_TOTAL_STAGES = 6;
const DEFAULT_HANG_THRESHOLD_MS = 5_000;
const MIN_TIMER_INTERVAL_MS = 10;
const MAX_TIMER_INTERVAL_MS = 250;

export class ResolverObservability {
  readonly observations: C3ResolverObservation[] = [];
  private readonly options: C3ResolverOptions;
  private readonly startedAt: number;
  private stageStartedAt: number;
  private lastProgressAt: number;
  private heartbeat = 0;
  private currentStage: C3ResolverStage = "validate_request";
  private currentProcessed = 0;

  constructor(options: C3ResolverOptions) {
    this.options = options;
    const now = this.now();
    this.startedAt = now;
    this.stageStartedAt = now;
    this.lastProgressAt = now;
  }

  transition(
    stage: C3ResolverStage,
    state: Exclude<C3ResolverRuntimeState, "possibly_hung">,
    processed: number,
    message?: string,
  ): void {
    const now = this.now();
    this.currentStage = stage;
    this.currentProcessed = processed;
    this.stageStartedAt = now;
    this.lastProgressAt = now;
    this.heartbeat += 1;
    this.emit(state, message, 0);
  }

  async waitFor<T>(task: () => Promise<T>): Promise<T> {
    const threshold = Math.max(MIN_TIMER_INTERVAL_MS, this.options.hangThresholdMs ?? DEFAULT_HANG_THRESHOLD_MS);
    const intervalMs = Math.max(MIN_TIMER_INTERVAL_MS, Math.min(MAX_TIMER_INTERVAL_MS, Math.floor(threshold / 2)));
    let hangReported = false;
    const timer = setInterval(() => {
      const inactivityMs = Math.max(0, Math.round(this.now() - this.lastProgressAt));
      if (!hangReported && inactivityMs >= threshold) {
        hangReported = true;
        this.emit("possibly_hung", "Возможно, процесс завис: прогресс и heartbeat не менялись дольше порога.", inactivityMs);
      }
    }, intervalMs);
    try {
      return await task();
    } finally {
      clearInterval(timer);
    }
  }

  private emit(state: C3ResolverRuntimeState, message: string | undefined, inactivityMs: number): void {
    const now = this.now();
    const observation: C3ResolverObservation = Object.freeze({
      phase: C3_RESOLVER_PHASE,
      workName: "Packaged active generation resolver",
      workType: "local",
      stage: this.currentStage,
      state,
      elapsedMs: Math.max(0, Math.round(now - this.startedAt)),
      stageElapsedMs: Math.max(0, Math.round(now - this.stageStartedAt)),
      processed: this.currentProcessed,
      total: C3_TOTAL_STAGES,
      heartbeat: this.heartbeat,
      lastProgressAt: this.options.nowIso?.() ?? new Date().toISOString(),
      inactivityMs,
      model: C3_RESOLVER_MODEL,
      ...(message ? { message } : {}),
    });
    this.observations.push(observation);
    this.options.onObservation?.(observation);
  }

  private now(): number {
    return this.options.now?.() ?? performance.now();
  }
}
