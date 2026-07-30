import type { GenerationAttemptAggregate, GenerationAttemptEvent } from "./attempt-types.ts";
import { hashGenerationAttemptEvents, hashGenerationAttemptState } from "./attempt-commands.ts";
import type { CanonicalHasher } from "./canonical-json.ts";

export const GENERATION_ATTEMPT_EVIDENCE_VERSION = "phase2cc-c1-evidence-v1" as const;

export interface SanitizedGenerationAttemptEvidence {
  readonly evidenceVersion: typeof GENERATION_ATTEMPT_EVIDENCE_VERSION;
  readonly attemptId: string;
  readonly status: GenerationAttemptAggregate["status"];
  readonly revision: number;
  readonly artifact: Readonly<{
    repository: string;
    commitSha: string;
    treeSha: string;
    archiveSha256: string;
  }>;
  readonly source: Readonly<{
    sizeBytes: number;
    sha256: string;
    workspace: string;
    counts: GenerationAttemptAggregate["manifest"]["source"]["counts"];
  }>;
  readonly generation: Readonly<{
    generationId: string;
    databaseName: string;
    storageSchema: string;
    mappingVersion: string;
  }>;
  readonly registry: Readonly<{
    registryName: string;
    expectedRevision: number;
    previousGenerationId?: string;
  }>;
  readonly hashes: Readonly<{
    expectedPortablePlanHash: string;
    expectedTargetSnapshotHash: string;
    aggregateHash: string;
    eventStreamHash: string;
  }>;
  readonly eventTypes: readonly GenerationAttemptEvent["type"][];
  readonly boundaries: Readonly<{
    exactSourceBytesIncluded: false;
    rawThoughtTextIncluded: false;
    nodeLabelsIncluded: false;
    localPathsIncluded: false;
    personalDataIncluded: false;
    actualMigrationPerformed: false;
    productionWritePerformed: false;
    automaticRetryAllowed: false;
    networkCalls: 0;
    modelCalls: 0;
    modelMode: "без AI";
  }>;
}

export function createSanitizedGenerationAttemptEvidence(
  aggregate: GenerationAttemptAggregate,
  events: readonly GenerationAttemptEvent[],
  hasher: CanonicalHasher,
): SanitizedGenerationAttemptEvidence {
  const manifest = aggregate.manifest;
  return {
    evidenceVersion: GENERATION_ATTEMPT_EVIDENCE_VERSION,
    attemptId: aggregate.attemptId,
    status: aggregate.status,
    revision: aggregate.revision,
    artifact: {
      repository: manifest.artifact.repository,
      commitSha: manifest.artifact.commitSha,
      treeSha: manifest.artifact.treeSha,
      archiveSha256: manifest.artifact.archiveSha256,
    },
    source: {
      sizeBytes: manifest.source.sizeBytes,
      sha256: manifest.source.sha256,
      workspace: manifest.source.workspace,
      counts: manifest.source.counts,
    },
    generation: {
      generationId: manifest.generation.generationId,
      databaseName: manifest.generation.databaseName,
      storageSchema: manifest.generation.storageSchema,
      mappingVersion: manifest.generation.mappingVersion,
    },
    registry: {
      registryName: manifest.registry.registryName,
      expectedRevision: manifest.registry.expectedRevision,
      previousGenerationId: manifest.registry.expectedActivePointer?.generationId,
    },
    hashes: {
      expectedPortablePlanHash: manifest.expectedPortablePlanHash,
      expectedTargetSnapshotHash: manifest.expectedTargetSnapshotHash,
      aggregateHash: hashGenerationAttemptState(aggregate, hasher),
      eventStreamHash: hashGenerationAttemptEvents(events, hasher),
    },
    eventTypes: events.map((event) => event.type),
    boundaries: {
      exactSourceBytesIncluded: false,
      rawThoughtTextIncluded: false,
      nodeLabelsIncluded: false,
      localPathsIncluded: false,
      personalDataIncluded: false,
      actualMigrationPerformed: false,
      productionWritePerformed: false,
      automaticRetryAllowed: false,
      networkCalls: 0,
      modelCalls: 0,
      modelMode: "без AI",
    },
  };
}
