import { canonicalJson, hashCanonical } from "../../generation-core/canonical-json.ts";
import { assertSha256 } from "../../generation-core/validators.ts";
import { assertSafeC2RegistryDatabaseName, cloneCanonical } from "../../generation-storage/indexeddb/c2-indexeddb-common.ts";
import {
  C3_RESOLVER_PHASE,
  type C3ResolvedGeneration,
  type C3ResolverObservation,
  type C3ResolverOptions,
  type C3ResolverRejection,
  type C3ResolverResult,
  type C3ResolverStage,
  type C3SanitizedDiagnostics,
} from "../resolver-types.ts";
import { assertNotInterrupted, checkpoint, failure, rejectionFrom } from "./resolver-errors.ts";
import { C3_TOTAL_STAGES, ResolverObservability } from "./resolver-observability.ts";
import { readGeneration, readRegistry, validateAttestation, validatePointer } from "./resolver-readers.ts";

function diagnostics(
  options: C3ResolverOptions,
  observations: readonly C3ResolverObservation[],
  status: "passed" | "failed",
  resolved?: C3ResolvedGeneration,
  rejection?: C3ResolverRejection,
): C3SanitizedDiagnostics {
  return Object.freeze({
    phase: C3_RESOLVER_PHASE,
    status,
    workspace: "synthetic",
    registryDatabaseName: options.registryDatabaseName,
    ...(resolved ? {
      registryRevision: resolved.registryRevision,
      physicalGenerationDatabaseName: resolved.physicalGenerationDatabaseName,
      generationId: resolved.logicalGeneration.generationId,
      targetSnapshotHash: resolved.targetSnapshotHash,
      verificationFingerprint: resolved.verificationFingerprint,
    } : {}),
    ...(rejection ? { rejection } : {}),
    observations: cloneCanonical(observations),
    readOnly: true,
    fallbackUsed: false,
    automaticResumeAllowed: false,
    automaticRetryAllowed: false,
    exactSourceOpened: false,
    backupAccessed: false,
    productionNamespaceUsed: false,
    actualMigrationPerformed: false,
    networkCalls: 0,
    modelCalls: 0,
    personalDataUsed: false,
  });
}

export async function resolvePackagedActiveGeneration(options: C3ResolverOptions): Promise<C3ResolverResult> {
  const observability = new ResolverObservability(options);
  let currentStage: C3ResolverStage = "validate_request";
  try {
    observability.transition(currentStage, "working", 0, "Validating resolver request and isolated namespace.");
    if (!options.indexedDB || typeof options.registryDatabaseName !== "string" || !options.registryDatabaseName.trim()) {
      failure("invalid_request", currentStage, "IndexedDB factory and registry database name are required.");
    }
    if (options.workspace !== "synthetic") {
      failure("unknown_workspace", currentStage, `Unsupported workspace: ${options.workspace}`);
    }
    try {
      assertSafeC2RegistryDatabaseName(options.registryDatabaseName);
    } catch (error) {
      failure("invalid_request", currentStage, error instanceof Error ? error.message : String(error));
    }
    assertNotInterrupted(options, currentStage);
    await observability.waitFor(() => checkpoint(options, "after_request_validation", currentStage));

    currentStage = "read_registry";
    observability.transition(currentStage, "working", 1, "Reading control registry atomically in read-only mode.");
    const initialRegistry = await observability.waitFor(() => readRegistry(options));
    await observability.waitFor(() => checkpoint(options, "after_registry_read", currentStage));

    currentStage = "verify_pointer";
    observability.transition(currentStage, "verifying", 2, "Validating active pointer and seal attestation.");
    validatePointer(initialRegistry.pointer, initialRegistry.snapshot.revision);
    validateAttestation(initialRegistry.attestation, initialRegistry.pointer);
    await observability.waitFor(() => checkpoint(options, "after_pointer_verification", currentStage));

    currentStage = "read_generation";
    observability.transition(currentStage, "working", 3, "Opening the attested active generation in read-only mode.");
    const generation = await observability.waitFor(() => readGeneration(options, initialRegistry));
    await observability.waitFor(() => checkpoint(options, "after_generation_verification", currentStage));

    currentStage = "recheck_registry";
    observability.transition(currentStage, "verifying", 4, "Re-reading registry to reject stale pointer resolution.");
    await observability.waitFor(() => checkpoint(options, "before_final_registry_read", currentStage));
    const finalRegistry = await observability.waitFor(() => readRegistry(options));
    if (canonicalJson(initialRegistry) !== canonicalJson(finalRegistry)) {
      failure("registry_pointer_changed", currentStage, "Registry, pointer or seal attestation changed during resolution.");
    }

    currentStage = "complete";
    const resolvedAt = options.nowIso?.() ?? new Date().toISOString();
    const verificationFingerprint = hashCanonical({
      registryRevision: initialRegistry.snapshot.revision,
      pointer: initialRegistry.pointer,
      attestation: initialRegistry.attestation,
      logicalGeneration: generation.logicalGeneration,
      seal: generation.seal,
    }, options.hasher);
    assertSha256(verificationFingerprint, "resolver.verificationFingerprint");
    const value: C3ResolvedGeneration = Object.freeze({
      workspace: "synthetic",
      registryDatabaseName: options.registryDatabaseName,
      registryRevision: initialRegistry.snapshot.revision,
      activePointer: cloneCanonical(initialRegistry.pointer),
      physicalGenerationDatabaseName: initialRegistry.attestation.physicalGenerationDatabaseName,
      logicalGeneration: cloneCanonical(generation.logicalGeneration),
      seal: cloneCanonical(generation.seal),
      targetSnapshotHash: generation.seal.targetSnapshotHash,
      verificationFingerprint,
      resolvedAt,
      openedReadOnly: true,
      hashVerified: true,
      fallbackUsed: false,
      mutationCount: 0,
      networkCalls: 0,
      modelCalls: 0,
      personalDataUsed: false,
    });
    observability.transition(currentStage, "completed", C3_TOTAL_STAGES, "Active immutable generation resolved without mutation or fallback.");
    return Object.freeze({
      ok: true,
      value,
      diagnostics: diagnostics(options, observability.observations, "passed", value),
    });
  } catch (error) {
    const rejection = rejectionFrom(error, currentStage);
    observability.transition(rejection.stage, "failed", Math.min(observability.observations.at(-1)?.processed ?? 0, C3_TOTAL_STAGES), rejection.message);
    return Object.freeze({
      ok: false,
      rejection,
      diagnostics: diagnostics(options, observability.observations, "failed", undefined, rejection),
    });
  }
}

export function serializeC3SanitizedDiagnostics(result: C3ResolverResult): string {
  return JSON.stringify(result.diagnostics, null, 2);
}
