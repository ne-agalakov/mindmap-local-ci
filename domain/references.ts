export type PlacementTargetKind = "area" | "direction" | "project";

export interface PlacementTarget {
  readonly id: string;
  readonly kind: PlacementTargetKind;
}

export type PlacementResolution =
  | {
      readonly kind: "resolved";
      readonly targetId: string;
      readonly targetKind: "direction" | "project";
    }
  | {
      readonly kind: "unresolved";
      readonly marker: null | "__unmatched__";
    }
  | {
      readonly kind: "damaged_reference";
      readonly targetId: string;
      readonly reason: "missing_target" | "invalid_target_type";
      readonly actualKind?: PlacementTargetKind;
    };

export function classifyPlacementReference(
  targetId: string | null | undefined,
  targets: ReadonlyMap<string, PlacementTarget>,
): PlacementResolution {
  if (targetId === null || targetId === undefined || targetId === "__unmatched__") {
    return {
      kind: "unresolved",
      marker: targetId === "__unmatched__" ? "__unmatched__" : null,
    };
  }

  const target = targets.get(targetId);
  if (!target) {
    return {
      kind: "damaged_reference",
      targetId,
      reason: "missing_target",
    };
  }

  if (target.kind !== "direction" && target.kind !== "project") {
    return {
      kind: "damaged_reference",
      targetId,
      reason: "invalid_target_type",
      actualKind: target.kind,
    };
  }

  return {
    kind: "resolved",
    targetId,
    targetKind: target.kind,
  };
}
