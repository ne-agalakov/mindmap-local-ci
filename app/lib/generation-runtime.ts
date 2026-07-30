"use client";

export {
  resolvePackagedActiveGeneration,
  serializeC3SanitizedDiagnostics,
} from "../../runtime-generation/index.ts";
export type {
  C3ResolvedGeneration,
  C3ResolverObservation,
  C3ResolverOptions,
  C3ResolverRejection,
  C3ResolverResult,
  C3SanitizedDiagnostics,
} from "../../runtime-generation/index.ts";

export const PACKAGED_GENERATION_RUNTIME_PHASE = "phase2cc-c3" as const;
