import { canonicalClone } from "../storage/canonical-json.ts";
import type { Phase2CbMappingCandidate } from "./phase2cb-contracts.ts";
import {
  PHASE2CB_B1B_AUTHORIZATION_ID,
  type Phase2CbB1bPreparedSourceAdapter,
} from "./phase2cb-b1b-contracts.ts";
import type { Phase2CbB1aSourceSnapshot } from "./phase2cb-b1a-contracts.ts";

export class PreparedPhase2CbB1bSourceAdapter implements Phase2CbB1bPreparedSourceAdapter {
  readonly mode = "prepared-readonly-candidate" as const;
  readonly sourceKind: "sanitized-rehearsal" | "exact-source";
  readonly sourceId: string;
  readonly authorizationId = PHASE2CB_B1B_AUTHORIZATION_ID;
  readonly manifestFrozenBeforeOpen = true as const;
  readonly exactSourceOpened: boolean;
  private readonly sourceSnapshot: Phase2CbB1aSourceSnapshot;
  private readonly candidate: Phase2CbMappingCandidate;

  constructor(options: Readonly<{
    sourceKind: "sanitized-rehearsal" | "exact-source";
    sourceId: string;
    sourceSnapshot: Phase2CbB1aSourceSnapshot;
    candidate: Phase2CbMappingCandidate;
    exactSourceOpened: boolean;
  }>) {
    this.sourceKind = options.sourceKind;
    this.sourceId = options.sourceId;
    this.sourceSnapshot = Object.freeze({ ...options.sourceSnapshot });
    this.candidate = canonicalClone(options.candidate);
    this.exactSourceOpened = options.exactSourceOpened;
  }

  async snapshot(): Promise<Phase2CbB1aSourceSnapshot> {
    return Object.freeze({ ...this.sourceSnapshot });
  }

  async readCandidate(): Promise<Phase2CbMappingCandidate> {
    return canonicalClone(this.candidate);
  }
}
