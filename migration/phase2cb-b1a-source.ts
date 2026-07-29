import { canonicalClone } from "../storage/canonical-json.ts";
import type { Phase2CbHashBytes, Phase2CbMappingCandidate } from "./phase2cb-contracts.ts";
import type {
  Phase2CbB1aSourceAdapter,
  Phase2CbB1aSourceSnapshot,
} from "./phase2cb-b1a-contracts.ts";

export class MemoryPhase2CbB1aSourceAdapter implements Phase2CbB1aSourceAdapter {
  readonly mode = "sanitized-fixture" as const;
  readonly sourceId: string;
  private readonly bytes: Uint8Array;
  private readonly candidate: Phase2CbMappingCandidate;
  private readonly hashBytes: Phase2CbHashBytes;

  constructor(options: Readonly<{
    sourceId: string;
    bytes: Uint8Array;
    candidate: Phase2CbMappingCandidate;
    hashBytes: Phase2CbHashBytes;
  }>) {
    this.sourceId = options.sourceId;
    this.bytes = new Uint8Array(options.bytes);
    this.candidate = canonicalClone(options.candidate);
    this.hashBytes = options.hashBytes;
  }

  async snapshot(): Promise<Phase2CbB1aSourceSnapshot> {
    return {
      exists: true,
      sizeBytes: this.bytes.byteLength,
      sha256: await this.hashBytes(this.bytes),
    };
  }

  async readCandidate(): Promise<Phase2CbMappingCandidate> {
    return canonicalClone(this.candidate);
  }
}
