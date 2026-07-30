import assert from "node:assert/strict";
import test from "node:test";
import {
  C2_SANITIZED_DATABASE_PREFIX,
  NativeIndexedDbGenerationRegistry,
} from "../generation-storage/index.ts";
import { CONTROL_REGISTRY_NAME, CONTROL_REGISTRY_SCHEMA_VERSION } from "../generation-core/constants.ts";
import { resolvePackagedActiveGeneration } from "../runtime-generation/index.ts";
import {
  cleanupFixture,
  corruptGenerationIdentity,
  corruptSnapshotHash,
  createMalformedRegistry,
  createPromotedFixture,
  freshIndexedDb,
  listDatabaseNames,
  mutateActivePointer,
  removeGenerationSeal,
  replaceGenerationWithMalformedDatabase,
  replaceRow,
  sha256,
} from "./runtime-generation-phase2cc-c3-fixture.mjs";

async function expectReject(options, code) {
  const result = await resolvePackagedActiveGeneration(options);
  assert.equal(result.ok, false, "resolver unexpectedly succeeded");
  assert.equal(result.rejection.code, code);
  assert.equal(result.diagnostics.status, "failed");
  assert.equal(result.diagnostics.fallbackUsed, false);
  assert.equal(result.diagnostics.automaticRetryAllowed, false);
  assert.equal(result.diagnostics.actualMigrationPerformed, false);
  return result;
}

function options(indexedDB, registryDatabaseName, extra = {}) {
  return {
    indexedDB,
    registryDatabaseName,
    workspace: "synthetic",
    hasher: sha256,
    ...extra,
  };
}

test("C3 fails closed when registry is missing and does not create it", async () => {
  const indexedDB = freshIndexedDb();
  const databaseName = `${C2_SANITIZED_DATABASE_PREFIX}registry-c3-missing`;
  const before = await listDatabaseNames(indexedDB);
  await expectReject(options(indexedDB, databaseName), "registry_database_missing");
  assert.deepEqual(await listDatabaseNames(indexedDB), before);
});

test("C3 rejects unsupported workspace before opening storage", async () => {
  const indexedDB = freshIndexedDb();
  const databaseName = `${C2_SANITIZED_DATABASE_PREFIX}registry-c3-workspace`;
  await expectReject(options(indexedDB, databaseName, { workspace: "personal" }), "unknown_workspace");
  assert.deepEqual(await listDatabaseNames(indexedDB), []);
});

test("C3 fails closed for missing pointer", async () => {
  const indexedDB = freshIndexedDb();
  const databaseName = `${C2_SANITIZED_DATABASE_PREFIX}registry-c3-no-pointer`;
  const registry = new NativeIndexedDbGenerationRegistry({ indexedDB, databaseName, hasher: sha256 });
  try {
    const initialized = await registry.initializeRegistry({
      registryName: CONTROL_REGISTRY_NAME,
      schemaVersion: CONTROL_REGISTRY_SCHEMA_VERSION,
      revision: 0,
      activePointers: [],
    }, "c3-no-pointer-init");
    assert.equal(initialized.ok, true);
    registry.close();
    await expectReject(options(indexedDB, databaseName), "workspace_pointer_missing");
  } finally {
    registry.close();
  }
});

test("C3 fails closed for malformed registry schema", async () => {
  const indexedDB = freshIndexedDb();
  const databaseName = `${C2_SANITIZED_DATABASE_PREFIX}registry-c3-malformed`;
  await createMalformedRegistry(indexedDB, databaseName);
  await expectReject(options(indexedDB, databaseName), "registry_schema_mismatch");
});

test("C3 fails closed for missing seal attestation", async () => {
  const fixture = await createPromotedFixture("c3-attestation-missing");
  try {
    await replaceRow(
      fixture.indexedDB,
      fixture.stores.physical.registry,
      "sealAttestations",
      fixture.promoted.aggregate.manifest.generation.generationId,
      () => undefined,
    );
    await expectReject(options(fixture.indexedDB, fixture.stores.physical.registry), "seal_attestation_missing");
  } finally {
    await cleanupFixture(fixture);
  }
});

test("C3 fails closed when active generation database is missing", async () => {
  const fixture = await createPromotedFixture("c3-generation-missing");
  try {
    await new Promise((resolve, reject) => {
      const request = fixture.indexedDB.deleteDatabase(fixture.stores.physical.generation);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error ?? new Error("delete_failed"));
    });
    await expectReject(options(fixture.indexedDB, fixture.stores.physical.registry), "generation_database_missing");
  } finally {
    await cleanupFixture(fixture);
  }
});

test("C3 fails closed for malformed generation schema", async () => {
  const fixture = await createPromotedFixture("c3-generation-schema");
  try {
    await replaceGenerationWithMalformedDatabase(fixture.indexedDB, fixture.stores.physical.generation);
    await expectReject(options(fixture.indexedDB, fixture.stores.physical.registry), "generation_schema_mismatch");
  } finally {
    await cleanupFixture(fixture);
  }
});

test("C3 fails closed for missing physical generation seal", async () => {
  const fixture = await createPromotedFixture("c3-seal-missing");
  try {
    await removeGenerationSeal(fixture.indexedDB, fixture.stores.physical.generation);
    await expectReject(options(fixture.indexedDB, fixture.stores.physical.registry), "generation_seal_missing");
  } finally {
    await cleanupFixture(fixture);
  }
});

test("C3 fails closed for generation identity and workspace mismatch", async (t) => {
  await t.test("identity mismatch", async () => {
    const fixture = await createPromotedFixture("c3-identity-mismatch");
    try {
      await corruptGenerationIdentity(fixture.indexedDB, fixture.stores.physical.generation);
      await expectReject(options(fixture.indexedDB, fixture.stores.physical.registry), "generation_identity_mismatch");
    } finally {
      await cleanupFixture(fixture);
    }
  });

  await t.test("workspace mismatch", async () => {
    const fixture = await createPromotedFixture("c3-workspace-mismatch");
    try {
      await corruptGenerationIdentity(fixture.indexedDB, fixture.stores.physical.generation, "personal");
      await expectReject(options(fixture.indexedDB, fixture.stores.physical.registry), "generation_workspace_mismatch");
    } finally {
      await cleanupFixture(fixture);
    }
  });
});

test("C3 fails closed for snapshot hash mismatch", async () => {
  const fixture = await createPromotedFixture("c3-hash-mismatch");
  try {
    await corruptSnapshotHash(
      fixture.indexedDB,
      fixture.stores.physical.registry,
      fixture.stores.physical.generation,
    );
    await expectReject(options(fixture.indexedDB, fixture.stores.physical.registry), "generation_snapshot_hash_mismatch");
  } finally {
    await cleanupFixture(fixture);
  }
});

test("C3 detects active pointer replacement between initial read and final verification", async () => {
  const fixture = await createPromotedFixture("c3-pointer-replaced");
  try {
    await expectReject(options(fixture.indexedDB, fixture.stores.physical.registry, {
      async onCheckpoint(checkpoint) {
        if (checkpoint === "after_generation_verification") {
          await mutateActivePointer(fixture.indexedDB, fixture.stores.physical.registry);
        }
      },
    }), "registry_pointer_changed");
  } finally {
    await cleanupFixture(fixture);
  }
});

test("C3 explicit interruption is terminal for the call and never auto-resumes", async () => {
  const fixture = await createPromotedFixture("c3-interrupted");
  const controller = new AbortController();
  try {
    const result = await expectReject(options(fixture.indexedDB, fixture.stores.physical.registry, {
      onCheckpoint(checkpoint) {
        if (checkpoint === "after_registry_read") controller.abort();
      },
      signal: controller.signal,
    }), "interrupted_verification");
    assert.equal(result.diagnostics.automaticResumeAllowed, false);
    assert.equal(result.diagnostics.automaticRetryAllowed, false);
  } finally {
    await cleanupFixture(fixture);
  }
});
