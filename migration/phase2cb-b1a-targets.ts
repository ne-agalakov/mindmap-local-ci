import { InMemoryGraphStorage, type InMemoryGraphStorageOptions } from "../graph-storage/in-memory-reference-storage.ts";
import { NativeIndexedDbGraphStorage } from "../graph-storage/indexeddb/native-indexeddb-graph-storage.ts";
import type { ContentAddressedPayloadRecord } from "../graph-storage/contracts.ts";
import { InMemoryReferenceStorage } from "../storage/in-memory-reference-storage.ts";
import { NativeIndexedDbStorage } from "../storage/indexeddb/native-indexeddb-storage.ts";
import type { CanonicalContentHasher } from "../storage/contracts.ts";
import type { Phase2CbB1aTargetFactory, Phase2CbB1aTargetHandle } from "./phase2cb-b1a-contracts.ts";

export interface InMemoryPhase2CbB1aTargetFactoryOptions {
  readonly hashCanonical: CanonicalContentHasher;
  readonly hashPayload: InMemoryGraphStorageOptions["hashPayload"];
}

export class InMemoryPhase2CbB1aTargetFactory implements Phase2CbB1aTargetFactory {
  private readonly targets = new Map<string, Phase2CbB1aTargetHandle>();
  private readonly options: InMemoryPhase2CbB1aTargetFactoryOptions;

  constructor(options: InMemoryPhase2CbB1aTargetFactoryOptions) {
    this.options = options;
  }

  async exists(databaseName: string): Promise<boolean> {
    return this.targets.has(databaseName);
  }

  async create(databaseName: string): Promise<Phase2CbB1aTargetHandle> {
    if (this.targets.has(databaseName)) throw new Error(`target_exists:${databaseName}`);
    const handle: Phase2CbB1aTargetHandle = {
      databaseName,
      runStorage: new InMemoryReferenceStorage(this.options.hashCanonical),
      graphStorage: new InMemoryGraphStorage({
        hashCanonical: this.options.hashCanonical,
        hashPayload: this.options.hashPayload,
      }),
      close() {},
    };
    this.targets.set(databaseName, handle);
    return handle;
  }

  async destroy(databaseName: string): Promise<void> {
    this.targets.delete(databaseName);
  }
}

export type IndexedDbPayloadHasher = (
  record: ContentAddressedPayloadRecord,
) => string | Promise<string>;

export interface IndexedDbPhase2CbB1aTargetFactoryOptions {
  readonly indexedDB: IDBFactory;
  readonly hashCanonical: CanonicalContentHasher;
  readonly hashPayload: IndexedDbPayloadHasher;
}

function deleteDatabase(factory: IDBFactory, databaseName: string): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const request = factory.deleteDatabase(databaseName);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error(`delete_database_failed:${databaseName}`));
    request.onblocked = () => reject(new Error(`delete_database_blocked:${databaseName}`));
  });
}

export class IndexedDbPhase2CbB1aTargetFactory implements Phase2CbB1aTargetFactory {
  private readonly indexedDbFactory: IDBFactory;
  private readonly hashCanonical: CanonicalContentHasher;
  private readonly hashPayload: IndexedDbPayloadHasher;

  constructor(options: IndexedDbPhase2CbB1aTargetFactoryOptions) {
    this.indexedDbFactory = options.indexedDB;
    this.hashCanonical = options.hashCanonical;
    this.hashPayload = options.hashPayload;
  }

  async exists(databaseName: string): Promise<boolean> {
    const factory = this.indexedDbFactory as IDBFactory & {
      databases?: () => Promise<readonly Readonly<{ name?: string }>[]>
    };
    if (typeof factory.databases !== "function") {
      throw new Error("indexeddb_database_inventory_unavailable");
    }
    const databases = await factory.databases();
    return databases.some((database) => database.name === databaseName);
  }

  async create(databaseName: string): Promise<Phase2CbB1aTargetHandle> {
    if (await this.exists(databaseName)) throw new Error(`target_exists:${databaseName}`);
    const graphStorage = new NativeIndexedDbGraphStorage({
      indexedDB: this.indexedDbFactory,
      databaseName,
      hashCanonical: this.hashCanonical,
      hashPayload: this.hashPayload,
    });
    await graphStorage.load("synthetic");
    const runStorage = new NativeIndexedDbStorage({
      indexedDB: this.indexedDbFactory,
      databaseName,
      hashCanonical: this.hashCanonical,
    });
    return {
      databaseName,
      runStorage,
      graphStorage,
      close() {
        graphStorage.close();
        runStorage.close();
      },
    };
  }

  async destroy(databaseName: string): Promise<void> {
    await deleteDatabase(this.indexedDbFactory, databaseName);
  }
}
