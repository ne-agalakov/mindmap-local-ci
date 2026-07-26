import type {
  SemanticPlacement,
  StrictHierarchyNode,
} from "./semantic-pipeline";

const REFERENCE_GROUPS = [
  [1, 12],
  [13, 21],
  [22, 28],
  [29, 38],
  [39, 47],
  [48, 57],
  [58, 66],
  [67, 73],
  [74, 83],
  [84, 96],
] as const;

export const SYNTHETIC_SEMANTIC_THRESHOLDS = {
  precision: 0.68,
  recall: 0.52,
  f1: 0.58,
} as const;

export type SyntheticSemanticMetrics = {
  precision: number;
  recall: number;
  f1: number;
  truePositivePairs: number;
  falsePositivePairs: number;
  falseNegativePairs: number;
  placedThoughts: number;
  totalThoughts: number;
  passed: boolean;
};

export function evaluateSyntheticHierarchy(
  nodes: StrictHierarchyNode[],
  placements: SemanticPlacement[],
): SyntheticSemanticMetrics {
  const leafByThought = predictedLeaves(nodes, placements);
  let truePositivePairs = 0;
  let falsePositivePairs = 0;
  let falseNegativePairs = 0;

  for (let left = 1; left <= 96; left += 1) {
    for (let right = left + 1; right <= 96; right += 1) {
      const leftId = thoughtId(left);
      const rightId = thoughtId(right);
      const expectedSame = referenceGroup(left) === referenceGroup(right);
      const predictedSame = leafByThought.has(leftId)
        && leafByThought.get(leftId) === leafByThought.get(rightId);
      if (predictedSame && expectedSame) truePositivePairs += 1;
      else if (predictedSame) falsePositivePairs += 1;
      else if (expectedSame) falseNegativePairs += 1;
    }
  }

  const precision = ratio(truePositivePairs, truePositivePairs + falsePositivePairs);
  const recall = ratio(truePositivePairs, truePositivePairs + falseNegativePairs);
  const f1 = precision + recall ? round((2 * precision * recall) / (precision + recall)) : 0;
  return {
    precision,
    recall,
    f1,
    truePositivePairs,
    falsePositivePairs,
    falseNegativePairs,
    placedThoughts: leafByThought.size,
    totalThoughts: 96,
    passed: leafByThought.size === 96
      && precision >= SYNTHETIC_SEMANTIC_THRESHOLDS.precision
      && recall >= SYNTHETIC_SEMANTIC_THRESHOLDS.recall
      && f1 >= SYNTHETIC_SEMANTIC_THRESHOLDS.f1,
  };
}

function predictedLeaves(
  nodes: StrictHierarchyNode[],
  placements: SemanticPlacement[],
) {
  const validLeaves = new Set(
    nodes
      .filter((node) => node.kind === "direction" || node.kind === "project")
      .map((node) => node.id),
  );
  const result = new Map<string, string>();
  for (const placement of placements) {
    if (validLeaves.has(placement.primaryNodeId)) {
      result.set(placement.thoughtId, placement.primaryNodeId);
    }
  }
  return result;
}

function referenceGroup(number: number) {
  return REFERENCE_GROUPS.findIndex(([start, end]) => number >= start && number <= end);
}

function thoughtId(number: number) {
  return `synthetic-${String(number).padStart(3, "0")}`;
}

function ratio(numerator: number, denominator: number) {
  return denominator ? round(numerator / denominator) : 0;
}

function round(value: number) {
  return Math.round(value * 1000) / 1000;
}
