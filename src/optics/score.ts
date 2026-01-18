import type { Candidate, ScoreBreakdown, WeightSpec } from "./types";
import { OBSTRUCTION_CONTRAST_COEFFICIENT } from "./constants";

function clamp01(v: number): number {
  if (!Number.isFinite(v)) return 0;
  if (v <= 0) return 0;
  if (v >= 1) return 1;
  return v;
}

function inv1p(x: number): number {
  if (!Number.isFinite(x)) return 0;
  if (x <= 0) return 1;
  return 1 / (1 + x);
}

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

  const usableLightTerm = clamp01(throughput.usableLightEfficiency);

  const aberrScale =
    Number.isFinite(bounds.maxAberration) && bounds.maxAberration > 0
      ? bounds.maxAberration
      : 1;

  const aberrationTerm = clamp01(inv1p(aberrations.proxyScore / aberrScale));

  const o = clamp01(geometry.obstructionRatio);
  const obstructionPenalty = o + OBSTRUCTION_CONTRAST_COEFFICIENT * o * o;
  const obstructionTerm = clamp01(1 - obstructionPenalty);

  const tubeLengthTerm = 1;

  const terms: ScoreBreakdown = {
    usableLight: usableLightTerm,
    aberration: aberrationTerm,
    tubeLength: tubeLengthTerm,
    obstruction: obstructionTerm,
  };

  const total =
    weights.usableLight * terms.usableLight +
    weights.aberration * terms.aberration +
    weights.obstruction * terms.obstruction;

  return {
    ...candidate,
    score: {
      total,
      terms,
    },
  };
}

export function computeScoreBounds(candidates: Candidate[]): {
  minTubeLength: number;
  maxTubeLength: number;
  minAberration: number;
  maxAberration: number;
} {
  let maxAberration = 0;

  for (const c of candidates) {
    const ab = c.aberrations.proxyScore;
    if (Number.isFinite(ab) && ab > maxAberration) maxAberration = ab;
  }

  if (!(maxAberration > 0)) maxAberration = 1;

  return {
    minTubeLength: 0,
    maxTubeLength: 1,
    minAberration: 0,
    maxAberration,
  };
}
