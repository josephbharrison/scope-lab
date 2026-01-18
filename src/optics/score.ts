// src/optics/score.ts
import type { Candidate, ScoreBreakdown, WeightSpec } from "./types";
import { OBSTRUCTION_CONTRAST_COEFFICIENT } from "./constants";

function clamp01(v: number): number {
  if (!Number.isFinite(v)) return 0;
  if (v <= 0) return 0;
  if (v >= 1) return 1;
  return v;
}

function finiteOr(v: number, fallback: number): number {
  return Number.isFinite(v) ? v : fallback;
}

export function scoreCandidate(
  candidate: Candidate,
  bounds: {
    minWfeRms: number;
    maxWfeRms: number;
    wfeScale: number;
  },
  weights: WeightSpec,
): Candidate {
  const { geometry, throughput, aberrations } = candidate;

  const usableLightTerm = clamp01(throughput.usableLightEfficiency);

  const w = finiteOr(aberrations.wfeRms_waves_edge, NaN);
  const minW = finiteOr(bounds.minWfeRms, 0);
  const maxW = finiteOr(bounds.maxWfeRms, minW + 1);

  const denom = Math.max(1e-12, maxW - minW);
  const normBad = Number.isFinite(w) ? clamp01((w - minW) / denom) : 1;
  const aberrationTerm = clamp01(1 - normBad);

  const o = clamp01(geometry.obstructionRatio);
  const obstructionPenalty = o + OBSTRUCTION_CONTRAST_COEFFICIENT * o * o;
  const obstructionTerm = clamp01(1 - obstructionPenalty);

  const terms: ScoreBreakdown = {
    usableLight: usableLightTerm,
    aberration: aberrationTerm,
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
  minWfeRms: number;
  maxWfeRms: number;
  wfeScale: number;
} {
  let min = Infinity;
  let max = -Infinity;

  for (const c of candidates) {
    const w = c.aberrations.wfeRms_waves_edge;
    if (!Number.isFinite(w)) continue;
    if (w < min) min = w;
    if (w > max) max = w;
  }

  if (!Number.isFinite(min)) min = 0;
  if (!Number.isFinite(max) || max <= min) max = min + 1;

  return {
    minWfeRms: min,
    maxWfeRms: max,
    wfeScale: 1,
  };
}
