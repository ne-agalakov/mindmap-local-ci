import {
  SANITIZED_GENERATION_MANIFEST,
  SANITIZED_GENERATION_SEAL,
  SANITIZED_GENERATION_VERIFICATION,
  SANITIZED_IMPORT_RESULT,
  SANITIZED_REGISTRY_SNAPSHOT,
  SANITIZED_VERIFIED_BACKUP,
  SANITIZED_VERIFIED_SOURCE,
  planPromotion,
} from "../../generation-core/index.ts";
import type { GenerationAttemptAggregate, GenerationAttemptCommand } from "../../generation-core/attempt-types.ts";
import type { ActiveGenerationPointer } from "../../generation-core/identities.ts";
import {
  C2_SANITIZED_DATABASE_PREFIX,
  NativeIndexedDbGenerationRegistry,
  NativeIndexedDbGenerationSealStore,
} from "../../generation-storage/index.ts";

type WithoutAttemptEnvelope<T> = T extends unknown ? Omit<T, "attemptId" | "meta"> : never;
type GenerationAttemptBody = WithoutAttemptEnvelope<GenerationAttemptCommand>;

export const registryDatabaseName = `${C2_SANITIZED_DATABASE_PREFIX}registry-browser-c3-runtime`;
export const generationDatabaseName = `${C2_SANITIZED_DATABASE_PREFIX}generation-browser-c3-runtime`;

export function syncHash(input: string): string {
  let a = 0x811c9dc5;
  let b = 0x9e3779b9;
  let c = 0x85ebca6b;
  let d = 0xc2b2ae35;
  for (let index = 0; index < input.length; index += 1) {
    const code = input.charCodeAt(index);
    a = Math.imul(a ^ code, 0x01000193) >>> 0;
    b = Math.imul(b ^ (code + index), 0x85ebca6b) >>> 0;
    c = Math.imul(c ^ (code + a), 0xc2b2ae35) >>> 0;
    d = Math.imul(d ^ (code + b), 0x27d4eb2f) >>> 0;
  }
  const block = [a, b, c, d].map((value) => value.toString(16).padStart(8, "0")).join("");
  return `${block}${block}`;
}

function must<T>(result: Readonly<{ ok: true; value: T; idempotent: boolean }> | Readonly<{ ok: false; rejection: unknown }>): T {
  if (!result.ok) throw new Error(`storage_rejection:${JSON.stringify(result.rejection)}`);
  return result.value;
}

function meta(commandId: string, aggregate: GenerationAttemptAggregate | undefined, second: number) {
  return { commandId, occurredAt: `2026-01-04T00:00:${String(second).padStart(2, "0")}.000Z`, expectedRevision: aggregate?.revision ?? 0 };
}

function deleteDatabase(name: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(name);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error(`delete_failed:${name}`));
    request.onblocked = () => reject(new Error(`delete_blocked:${name}`));
  });
}

async function command(
  registry: NativeIndexedDbGenerationRegistry,
  aggregate: GenerationAttemptAggregate,
  second: number,
  body: GenerationAttemptBody,
): Promise<GenerationAttemptAggregate> {
  const full = {
    ...body,
    attemptId: aggregate.attemptId,
    meta: meta(`browser-c3-${body.type}-${second}`, aggregate, second),
  } as GenerationAttemptCommand;
  return must(await registry.commitCommand({ operationId: full.meta.commandId, command: full }));
}

export async function seedPromotedGeneration(): Promise<void> {
  await deleteDatabase(registryDatabaseName).catch(() => undefined);
  await deleteDatabase(generationDatabaseName).catch(() => undefined);
  const registry = new NativeIndexedDbGenerationRegistry({ indexedDB, databaseName: registryDatabaseName, hasher: syncHash });
  const generation = new NativeIndexedDbGenerationSealStore({ indexedDB, databaseName: generationDatabaseName, hasher: syncHash });
  try {
    must(await registry.initializeRegistry(SANITIZED_REGISTRY_SNAPSHOT, "browser-c3-registry-init"));
    must(await generation.initialize(SANITIZED_GENERATION_MANIFEST.generation, "browser-c3-generation-init"));
    let aggregate = must(await registry.createAttempt(SANITIZED_GENERATION_MANIFEST, meta("browser-c3-plan", undefined, 1)));
    const sequence: readonly GenerationAttemptBody[] = [
      { type: "consume_authorization", authorizationId: SANITIZED_GENERATION_MANIFEST.authorization.authorizationId },
      { type: "verify_backup", backup: SANITIZED_VERIFIED_BACKUP },
      { type: "verify_source", source: SANITIZED_VERIFIED_SOURCE },
      { type: "record_generation_created", generation: SANITIZED_GENERATION_MANIFEST.generation },
      { type: "begin_import" },
      { type: "record_import_completed", result: SANITIZED_IMPORT_RESULT },
      { type: "record_generation_verified", verification: SANITIZED_GENERATION_VERIFICATION },
    ];
    let second = 2;
    for (const item of sequence) {
      aggregate = await command(registry, aggregate, second, item);
      second += 1;
    }
    must(await generation.seal(SANITIZED_GENERATION_SEAL, "browser-c3-physical-seal"));
    aggregate = await command(registry, aggregate, second, { type: "record_generation_sealed", seal: SANITIZED_GENERATION_SEAL });
    second += 1;
    must(await registry.attestGenerationSeal({
      operationId: "browser-c3-attest-seal",
      attemptId: aggregate.attemptId,
      seal: SANITIZED_GENERATION_SEAL,
      physicalGenerationDatabaseName: generationDatabaseName,
    }));
    const snapshot = await registry.loadRegistry();
    if (!snapshot) throw new Error("registry_missing");
    aggregate = await command(registry, aggregate, second, { type: "mark_promotion_ready", registrySnapshot: snapshot });
    const plan = planPromotion(aggregate, snapshot);
    must(await registry.commitPromotion({
      operationId: "browser-c3-promote",
      attemptId: aggregate.attemptId,
      plan,
      seal: SANITIZED_GENERATION_SEAL,
      physicalGenerationDatabaseName: generationDatabaseName,
      commandId: "browser-c3-record-promotion",
      occurredAt: "2026-01-04T00:00:20.000Z",
    }));
  } finally {
    registry.close();
    generation.close();
  }
}

export async function mutatePointer(): Promise<void> {
  const database = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(registryDatabaseName);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("registry_open_failed"));
  });
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(["registry", "activePointers"], "readwrite");
      const registryStore = transaction.objectStore("registry");
      const pointerStore = transaction.objectStore("activePointers");
      const registryRequest = registryStore.get("registry");
      const pointerRequest = pointerStore.get("synthetic");
      let registryRow: { revision: number } | undefined;
      let pointerRow: ActiveGenerationPointer | undefined;
      let queued = false;
      const queue = () => {
        if (queued || !registryRow || !pointerRow) return;
        queued = true;
        const revision = registryRow.revision + 1;
        registryStore.put({ ...registryRow, revision });
        pointerStore.put({ ...pointerRow, registryRevision: revision, activationEpoch: pointerRow.activationEpoch + 1 });
      };
      registryRequest.onsuccess = () => { registryRow = registryRequest.result as { revision: number }; queue(); };
      pointerRequest.onsuccess = () => { pointerRow = pointerRequest.result as ActiveGenerationPointer; queue(); };
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error("pointer_mutation_failed"));
      transaction.onabort = () => reject(transaction.error ?? new Error("pointer_mutation_aborted"));
    });
  } finally {
    database.close();
  }
}

export async function databaseNames(): Promise<string[]> {
  return (await indexedDB.databases()).map((entry) => entry.name).filter((name): name is string => Boolean(name)).sort();
}
