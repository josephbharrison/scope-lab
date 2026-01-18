import type { Candidate, ScoreBreakdown, WeightSpec } from "./types";

import { OBSTRUCTION_CONTRAST_COEFFICIENT } from "./constants";

/*
  Normalize a value into [0, 1] given min/max bounds.
  Values outside the range are clamped.
*/
function normalize(value: number, min: number, max: number): number {
  if (max <= min) return 1;
  if (value <= min) return 1;
  if (value >= max) return 0;
  return 1 - (value - min) / (max - min);
}

/*
  Score a single candidate given global bounds and weights.

  This function assumes:
  - lower aberration proxy is better
  - shorter tube length is better
  - lower obstruction ratio is better
  - higher usable light efficiency is better
*/
export function scoreCandidate(
  candidate: Candidate,
  bounds: {
    minTubeLength: number;
    maxTubeLength: number;
    minAberration: number;
    maxAberration: number;
  },
  weights: WeightSpec,
): Candidate {
  const { geometry, throughput, aberrations } = candidate;

  const usableLightTerm = throughput.usableLightEfficiency;

  const tubeLengthTerm = normalize(
    geometry.tubeLength_mm,
    bounds.minTubeLength,
    bounds.maxTubeLength,
  );

  const aberrationTerm = normalize(
    aberrations.proxyScore,
    bounds.minAberration,
    bounds.maxAberration,
  );

  const obstructionPenalty =
    geometry.obstructionRatio +
    OBSTRUCTION_CONTRAST_COEFFICIENT *
    geometry.obstructionRatio *
    geometry.obstructionRatio;

  const obstructionTerm = 1 - obstructionPenalty;

  const terms: ScoreBreakdown = {
    usableLight: usableLightTerm,
    aberration: aberrationTerm,
    tubeLength: tubeLengthTerm,
    obstruction: obstructionTerm,
  };

  const total =
    weights.usableLight * terms.usableLight +
    weights.aberration * terms.aberration +
    weights.tubeLength * terms.tubeLength +
    weights.obstruction * terms.obstruction;

  return {
    ...candidate,
    score: {
      total,
      terms,
    },
  };
}

/*
  Compute global bounds needed for normalization across a sweep.
*/
export function computeScoreBounds(candidates: Candidate[]): {
  minTubeLength: number;
  maxTubeLength: number;
  minAberration: number;
  maxAberration: number;
} {
  let minTubeLength = Infinity;
  let maxTubeLength = -Infinity;
  let minAberration = Infinity;
  let maxAberration = -Infinity;

  for (const c of candidates) {
    minTubeLength = Math.min(minTubeLength, c.geometry.tubeLength_mm);
    maxTubeLength = Math.max(maxTubeLength, c.geometry.tubeLength_mm);
    minAberration = Math.min(minAberration, c.aberrations.proxyScore);
    maxAberration = Math.max(maxAberration, c.aberrations.proxyScore);
  }

  return {
    minTubeLength,
    maxTubeLength,
    minAberration,
    maxAberration,
  };
}
