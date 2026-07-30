import assert from "node:assert/strict";
import { createHash } from "node:crypto";

export {
  ALLOWED_ATTEMPT_TRANSITIONS,
  CONTROL_REGISTRY_NAME,
  GENERATION_DATABASE_PREFIX,
  SANITIZED_GENERATION_MANIFEST,
  SANITIZED_GENERATION_SEAL,
  SANITIZED_GENERATION_VERIFICATION,
  SANITIZED_IMPORT_RESULT,
  SANITIZED_REGISTRY_SNAPSHOT,
  SANITIZED_RESOLVER_VERIFICATION,
  SANITIZED_VERIFIED_BACKUP,
  SANITIZED_VERIFIED_SOURCE,
  applyGenerationAttemptEvent,
  assertGenerationIdentity,
  assertGenerationManifest,
  canTransitionAttempt,
  createSanitizedGenerationAttemptEvidence,
  executeGenerationAttemptCommand,
  hashGenerationAttemptEvents,
  hashGenerationAttemptState,
  inspectGenerationAttempt,
  planGenerationAttempt,
  planPromotion,
  planRollback,
  replayGenerationAttemptEvents,
} from "../generation-core/index.ts";

import {
  SANITIZED_GENERATION_MANIFEST,
  SANITIZED_GENERATION_SEAL,
  SANITIZED_GENERATION_VERIFICATION,
  SANITIZED_IMPORT_RESULT,
  SANITIZED_VERIFIED_BACKUP,
  SANITIZED_VERIFIED_SOURCE,
  executeGenerationAttemptCommand,
  planGenerationAttempt,
} from "../generation-core/index.ts";

export const sha256 = (content) => createHash("sha256").update(content).digest("hex");
export const at = (second) => `2026-01-01T00:00:${String(second).padStart(2, "0")}.000Z`;
export const meta = (commandId, aggregate, second) => ({
  commandId,
  occurredAt: at(second),
  expectedRevision: aggregate?.revision ?? 0,
});

export function mustSucceed(result) {
  assert.equal(result.ok, true, result.ok ? undefined : JSON.stringify(result.rejection));
  return result;
}

export function mustReject(result, code) {
  assert.equal(result.ok, false, "command unexpectedly succeeded");
  assert.equal(result.rejection.code, code);
  return result.rejection;
}

export function startAttempt(prefix = "main") {
  return mustSucceed(planGenerationAttempt(
    SANITIZED_GENERATION_MANIFEST,
    meta(`${prefix}-plan`, undefined, 1),
    sha256,
  ));
}

export function runToSealed(prefix = "sealed") {
  const events = [];
  let result = startAttempt(prefix);
  events.push(...result.events);
  let aggregate = result.aggregate;
  const commands = [
    { type: "consume_authorization", attemptId: aggregate.attemptId, authorizationId: SANITIZED_GENERATION_MANIFEST.authorization.authorizationId },
    { type: "verify_backup", attemptId: aggregate.attemptId, backup: SANITIZED_VERIFIED_BACKUP },
    { type: "verify_source", attemptId: aggregate.attemptId, source: SANITIZED_VERIFIED_SOURCE },
    { type: "record_generation_created", attemptId: aggregate.attemptId, generation: SANITIZED_GENERATION_MANIFEST.generation },
    { type: "begin_import", attemptId: aggregate.attemptId },
    { type: "record_import_completed", attemptId: aggregate.attemptId, result: SANITIZED_IMPORT_RESULT },
    { type: "record_generation_verified", attemptId: aggregate.attemptId, verification: SANITIZED_GENERATION_VERIFICATION },
    { type: "record_generation_sealed", attemptId: aggregate.attemptId, seal: SANITIZED_GENERATION_SEAL },
  ];
  let second = 2;
  for (const command of commands) {
    result = mustSucceed(executeGenerationAttemptCommand(aggregate, { ...command, meta: meta(`${prefix}-${command.type}`, aggregate, second) }, sha256));
    events.push(...result.events);
    aggregate = result.aggregate;
    second += 1;
  }
  return { aggregate, events, nextSecond: second };
}
