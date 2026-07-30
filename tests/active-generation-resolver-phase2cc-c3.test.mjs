import assert from "node:assert/strict";
import test from "node:test";
import {
  resolvePackagedActiveGeneration,
  serializeC3SanitizedDiagnostics,
} from "../app/lib/generation-runtime.ts";
import {
  cleanupFixture,
  createPromotedFixture,
  listDatabaseNames,
  readRegistryRows,
  sha256,
} from "./runtime-generation-phase2cc-c3-fixture.mjs";

function assertSafeBoundary(result) {
  assert.equal(result.diagnostics.readOnly, true);
  assert.equal(result.diagnostics.fallbackUsed, false);
  assert.equal(result.diagnostics.automaticResumeAllowed, false);
  assert.equal(result.diagnostics.automaticRetryAllowed, false);
  assert.equal(result.diagnostics.exactSourceOpened, false);
  assert.equal(result.diagnostics.backupAccessed, false);
  assert.equal(result.diagnostics.productionNamespaceUsed, false);
  assert.equal(result.diagnostics.actualMigrationPerformed, false);
  assert.equal(result.diagnostics.networkCalls, 0);
  assert.equal(result.diagnostics.modelCalls, 0);
  assert.equal(result.diagnostics.personalDataUsed, false);
}

test("C3 packaged runtime resolves the attested active immutable generation and remains read-only across reopen", async () => {
  const fixture = await createPromotedFixture("c3-valid");
  try {
    const beforeDatabases = await listDatabaseNames(fixture.indexedDB);
    const beforeRegistry = await readRegistryRows(fixture.indexedDB, fixture.stores.physical.registry);
    const options = {
      indexedDB: fixture.indexedDB,
      registryDatabaseName: fixture.stores.physical.registry,
      workspace: "synthetic",
      hasher: sha256,
    };

    const first = await resolvePackagedActiveGeneration(options);
    assert.equal(first.ok, true, first.ok ? undefined : JSON.stringify(first.rejection));
    assert.equal(first.value.registryDatabaseName, fixture.stores.physical.registry);
    assert.equal(first.value.physicalGenerationDatabaseName, fixture.stores.physical.generation);
    assert.equal(first.value.activePointer.generationId, first.value.logicalGeneration.generationId);
    assert.equal(first.value.activePointer.targetSnapshotHash, first.value.seal.targetSnapshotHash);
    assert.equal(first.value.openedReadOnly, true);
    assert.equal(first.value.hashVerified, true);
    assert.equal(first.value.mutationCount, 0);
    assertSafeBoundary(first);

    const second = await resolvePackagedActiveGeneration(options);
    assert.equal(second.ok, true, second.ok ? undefined : JSON.stringify(second.rejection));
    assert.deepEqual(second.value.activePointer, first.value.activePointer);
    assert.deepEqual(second.value.logicalGeneration, first.value.logicalGeneration);
    assert.deepEqual(second.value.seal, first.value.seal);
    assertSafeBoundary(second);

    const afterDatabases = await listDatabaseNames(fixture.indexedDB);
    const afterRegistry = await readRegistryRows(fixture.indexedDB, fixture.stores.physical.registry);
    assert.deepEqual(afterDatabases, beforeDatabases);
    assert.deepEqual(afterRegistry, beforeRegistry);

    const observations = first.diagnostics.observations;
    assert.equal(observations[0].stage, "validate_request");
    assert.equal(observations.at(-1).stage, "complete");
    assert.equal(observations.at(-1).state, "completed");
    assert.ok(observations.every((entry) => entry.model === "без AI"));
    assert.ok(observations.every((entry) => entry.workType === "local"));
    assert.ok(observations.every((entry) => Number.isInteger(entry.heartbeat)));
    assert.ok(observations.every((entry) => entry.processed <= entry.total));

    const serialized = serializeC3SanitizedDiagnostics(first);
    assert.match(serialized, /"phase": "phase2cc-c3"/);
    assert.doesNotMatch(serialized, /thought|content|mindmap-v0\.6\.sqlite/i);
  } finally {
    await cleanupFixture(fixture);
  }
});

test("C3 exposes possibly-hung without retrying and completes after real progress resumes", async () => {
  const fixture = await createPromotedFixture("c3-hang-observation");
  try {
    let delayed = false;
    const result = await resolvePackagedActiveGeneration({
      indexedDB: fixture.indexedDB,
      registryDatabaseName: fixture.stores.physical.registry,
      workspace: "synthetic",
      hasher: sha256,
      hangThresholdMs: 10,
      async onCheckpoint(checkpoint) {
        if (checkpoint === "after_registry_read" && !delayed) {
          delayed = true;
          await new Promise((resolve) => setTimeout(resolve, 35));
        }
      },
    });
    assert.equal(result.ok, true, result.ok ? undefined : JSON.stringify(result.rejection));
    assert.ok(result.diagnostics.observations.some((entry) => entry.state === "possibly_hung"));
    assert.equal(result.diagnostics.automaticRetryAllowed, false);
    assert.equal(result.diagnostics.automaticResumeAllowed, false);
  } finally {
    await cleanupFixture(fixture);
  }
});
