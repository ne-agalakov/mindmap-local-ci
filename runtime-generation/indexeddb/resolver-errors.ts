import type {
  C3ResolverCheckpoint,
  C3ResolverOptions,
  C3ResolverRejection,
  C3ResolverRejectionCode,
  C3ResolverStage,
} from "../resolver-types.ts";

export class ResolverFailure extends Error {
  readonly code: C3ResolverRejectionCode;
  readonly stage: C3ResolverStage;
  readonly details?: Readonly<Record<string, string | number | boolean | null>>;

  constructor(
    code: C3ResolverRejectionCode,
    stage: C3ResolverStage,
    message: string,
    details?: Readonly<Record<string, string | number | boolean | null>>,
  ) {
    super(message);
    this.name = "ResolverFailure";
    this.code = code;
    this.stage = stage;
    this.details = details;
  }
}

export function failure(
  code: C3ResolverRejectionCode,
  stage: C3ResolverStage,
  message: string,
  details?: Readonly<Record<string, string | number | boolean | null>>,
): never {
  throw new ResolverFailure(code, stage, message, details);
}

export function assertNotInterrupted(options: C3ResolverOptions, stage: C3ResolverStage): void {
  if (options.signal?.aborted) failure("interrupted_verification", stage, "Resolver verification was interrupted explicitly.");
}

export async function checkpoint(
  options: C3ResolverOptions,
  point: C3ResolverCheckpoint,
  stage: C3ResolverStage,
): Promise<void> {
  assertNotInterrupted(options, stage);
  await options.onCheckpoint?.(point);
  assertNotInterrupted(options, stage);
}

export function rejectionFrom(error: unknown, currentStage: C3ResolverStage): C3ResolverRejection {
  if (error instanceof ResolverFailure) {
    return Object.freeze({
      code: error.code,
      message: error.message,
      stage: error.stage,
      ...(error.details ? { details: error.details } : {}),
    });
  }
  return Object.freeze({
    code: "unexpected_failure",
    message: error instanceof Error ? error.message : String(error),
    stage: currentStage,
  });
}
