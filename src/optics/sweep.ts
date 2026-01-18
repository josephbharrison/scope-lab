// src/optics/sweep.ts
import type { Candidate, InputSpec, OpticDesignKind, Units } from "./types";

import { toMm } from "./units";
import { computeScoreBounds, scoreCandidate } from "./score";

import { newtonian } from "./designs/newtonian";
import { cassegrain } from "./designs/cassegrain";
import { sct } from "./designs/sct";
import { rc } from "./designs/rc";

export type SweepResult = {
  candidates: Candidate[];
  ranked: Candidate[];
  bestOverall: Candidate | null;
  bestByKind: Record<OpticDesignKind, Candidate | null>;
  top: Candidate[];
  derivedSpec?: InputSpec;
  warnings?: string[];
  appliedSpec?: InputSpec;
};

function checkConstraints(spec: InputSpec, c: Candidate): Candidate {
  const reasons: string[] = [];

  const maxTube_mm = toMm(
    spec.constraints.maxTubeLength,
    spec.constraints.tubeLengthUnits,
  );

  const minBackFocus_mm = toMm(
    spec.constraints.minBackFocus,
    spec.constraints.backFocusUnits,
  );

  if (Number.isFinite(maxTube_mm) && c.geometry.tubeLength_mm > maxTube_mm) {
    reasons.push("tube_length_exceeds_max");
  }

  if (
    Number.isFinite(spec.constraints.maxObstructionRatio) &&
    c.geometry.obstructionRatio > spec.constraints.maxObstructionRatio
  ) {
    reasons.push("obstruction_exceeds_max");
  }

  if (
    Number.isFinite(minBackFocus_mm) &&
    minBackFocus_mm > 0 &&
    c.geometry.backFocus_mm < minBackFocus_mm
  ) {
    reasons.push("backfocus_below_min");
  }

  return {
    ...c,
    constraints: {
      pass: reasons.length === 0,
      reasons,
    },
  };
}

function enumerateRange(min: number, max: number, step: number): number[] {
  if (!Number.isFinite(step) || step <= 0) return [];
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [];
  if (max < min) return [];

  const out: number[] = [];
  let v = min;
  while (v <= max + 1e-12) {
    out.push(Number(v.toFixed(10)));
    v += step;
  }
  return out;
}

function generatorFor(kind: OpticDesignKind) {
  if (kind === "newtonian") return newtonian;
  if (kind === "cassegrain") return cassegrain;
  if (kind === "sct") return sct;
  if (kind === "rc") return rc;
  return null;
}

function relaxedSpecForInference(spec: InputSpec): InputSpec {
  return {
    ...spec,
    constraints: {
      ...spec.constraints,
      maxTubeLength: 1e12,
      maxObstructionRatio: 1,
      minBackFocus: spec.constraints.minBackFocus,
    },
  };
}

function formatUnits(u: Units): string {
  return u === "mm" ? "mm" : "in";
}

function collectRawCandidates(spec: InputSpec): Candidate[] {
  const out: Candidate[] = [];

  const fpValues = enumerateRange(
    spec.sweep.primaryFRatioMin,
    spec.sweep.primaryFRatioMax,
    spec.sweep.primaryFRatioStep,
  );

  const rawFsValues = enumerateRange(
    spec.sweep.systemFRatioMin,
    spec.sweep.systemFRatioMax,
    spec.sweep.systemFRatioStep,
  );

  const fsValues =
    rawFsValues.length > 0 && rawFsValues.some(Number.isFinite)
      ? rawFsValues
      : spec.targetSystemFRatio > 0
        ? [spec.targetSystemFRatio]
        : [];

  for (const kind of spec.designKinds) {
    const gen = generatorFor(kind);
    if (!gen) continue;

    for (const Fp of fpValues) {
      if (kind === "newtonian") {
        const c = gen(spec, { primaryFRatio: Fp, systemFRatio: Fp });
        if (c) out.push(c);
        continue;
      }

      for (const Fs of fsValues) {
        const c = gen(spec, { primaryFRatio: Fp, systemFRatio: Fs });
        if (c) out.push(c);
      }
    }
  }

  return out;
}

export function inferDerivedLimits(spec: InputSpec): InputSpec {
  const relaxed = relaxedSpecForInference(spec);
  const raw = collectRawCandidates(relaxed);

  let minFp = Infinity;
  let maxFp = -Infinity;
  let minFs = Infinity;
  let maxFs = -Infinity;

  for (const c of raw) {
    const { primaryFRatio, systemFRatio } = c.inputs;
    if (Number.isFinite(primaryFRatio)) {
      minFp = Math.min(minFp, primaryFRatio);
      maxFp = Math.max(maxFp, primaryFRatio);
    }
    if (Number.isFinite(systemFRatio)) {
      minFs = Math.min(minFs, systemFRatio);
      maxFs = Math.max(maxFs, systemFRatio);
    }
  }

  if (
    !Number.isFinite(minFp) ||
    !Number.isFinite(maxFp) ||
    !Number.isFinite(minFs) ||
    !Number.isFinite(maxFs)
  ) {
    return { ...spec, derivedLimits: undefined };
  }

  return {
    ...spec,
    derivedLimits: {
      primaryFRatio: { min: minFp, max: maxFp },
      systemFRatio: { min: minFs, max: maxFs },
    },
  };
}

function computeSweep(
  spec: InputSpec,
  topN: number,
): {
  candidates: Candidate[];
  passing: Candidate[];
  ranked: Candidate[];
  bestByKind: Record<OpticDesignKind, Candidate | null>;
  bestOverall: Candidate | null;
  top: Candidate[];
} {
  const candidates: Candidate[] = [];
  const relaxed = relaxedSpecForInference(spec);

  const fpValues = enumerateRange(
    spec.sweep.primaryFRatioMin,
    spec.sweep.primaryFRatioMax,
    spec.sweep.primaryFRatioStep,
  );

  const rawFsValues = enumerateRange(
    spec.sweep.systemFRatioMin,
    spec.sweep.systemFRatioMax,
    spec.sweep.systemFRatioStep,
  );

  const fsValues =
    rawFsValues.length > 0 && rawFsValues.some(Number.isFinite)
      ? rawFsValues
      : spec.targetSystemFRatio > 0
        ? [spec.targetSystemFRatio]
        : [];

  for (const kind of spec.designKinds) {
    const gen = generatorFor(kind);
    if (!gen) continue;

    for (const Fp of fpValues) {
      if (kind === "newtonian") {
        const raw = gen(relaxed, { primaryFRatio: Fp, systemFRatio: Fp });
        if (raw) candidates.push(checkConstraints(spec, raw));
        continue;
      }

      for (const Fs of fsValues) {
        const raw = gen(relaxed, { primaryFRatio: Fp, systemFRatio: Fs });
        if (raw) candidates.push(checkConstraints(spec, raw));
      }
    }
  }

  const passing = candidates.filter((c) => c.constraints.pass);

  const bestByKind: Record<OpticDesignKind, Candidate | null> = {
    newtonian: null,
    cassegrain: null,
    sct: null,
    rc: null,
  };

  if (passing.length === 0) {
    return {
      candidates,
      passing,
      ranked: [],
      bestByKind,
      bestOverall: null,
      top: [],
    };
  }

  const bounds = computeScoreBounds(passing);
  const ranked = passing
    .map((c) => scoreCandidate(c, bounds, spec.weights))
    .sort((a, b) => b.score.total - a.score.total);

  for (const c of ranked) {
    if (!bestByKind[c.kind]) bestByKind[c.kind] = c;
  }

  return {
    candidates,
    passing,
    ranked,
    bestByKind,
    bestOverall: ranked[0] ?? null,
    top: ranked.slice(0, Math.max(0, topN)),
  };
}

export function runSweep(spec: InputSpec, topN: number = 25): SweepResult {
  const first = computeSweep(spec, topN);
  const derivedSpec = inferDerivedLimits(spec);

  if (first.passing.length > 0) {
    return {
      candidates: first.candidates,
      ranked: first.ranked,
      bestOverall: first.bestOverall,
      bestByKind: first.bestByKind,
      top: first.top,
      derivedSpec,
      warnings: [],
    };
  }

  return {
    candidates: first.candidates,
    ranked: [],
    bestOverall: null,
    bestByKind: first.bestByKind,
    top: [],
    derivedSpec,
    warnings: [],
  };
}
