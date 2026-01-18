import type { Candidate, InputSpec, OpticDesignKind, Units } from "./types";

import { toMm, fromMm } from "./units";
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

  if (c.geometry.tubeLength_mm > maxTube_mm) {
    reasons.push("tube_length_exceeds_max");
  }

  if (c.geometry.obstructionRatio > spec.constraints.maxObstructionRatio) {
    reasons.push("obstruction_exceeds_max");
  }

  if (c.geometry.backFocus_mm < minBackFocus_mm) {
    reasons.push("backfocus_below_min");
  }

  const pass = reasons.length === 0;

  return {
    ...c,
    constraints: {
      pass,
      reasons,
    },
  };
}

function enumerateRange(min: number, max: number, step: number): number[] {
  if (step <= 0) return [];
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
      maxTubeLength: 1e9,
      maxObstructionRatio: 1,
      minBackFocus: 0,
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

  const fsFallback =
    spec.targetSystemFRatio > 0 ? [spec.targetSystemFRatio] : [];

  const fsValues = rawFsValues.length > 0 ? rawFsValues : fsFallback;

  for (const kind of spec.designKinds) {
    const gen = generatorFor(kind);
    if (!gen) continue;

    for (const Fp of fpValues) {
      if (kind === "newtonian") {
        const c = gen(spec, { primaryFRatio: Fp, systemFRatio: Fp });
        if (!c) continue;
        out.push(c);
        continue;
      }

      for (const Fs of fsValues) {
        const c = gen(spec, { primaryFRatio: Fp, systemFRatio: Fs });
        if (!c) continue;
        out.push(c);
      }
    }
  }

  return out;
}

function inferConstraintAdjustments(spec: InputSpec): {
  spec: InputSpec;
  warnings: string[];
} {
  const relaxed = relaxedSpecForInference(spec);
  const raw = collectRawCandidates(relaxed);

  if (raw.length === 0) {
    return { spec, warnings: [] };
  }

  let minTube_mm = Infinity;
  let minObs = Infinity;
  let maxBackFocus_mm = -Infinity;

  for (const c of raw) {
    if (Number.isFinite(c.geometry.tubeLength_mm)) {
      minTube_mm = Math.min(minTube_mm, c.geometry.tubeLength_mm);
    }
    if (Number.isFinite(c.geometry.obstructionRatio)) {
      minObs = Math.min(minObs, c.geometry.obstructionRatio);
    }
    if (Number.isFinite(c.geometry.backFocus_mm)) {
      maxBackFocus_mm = Math.max(maxBackFocus_mm, c.geometry.backFocus_mm);
    }
  }

  if (
    !Number.isFinite(minTube_mm) ||
    !Number.isFinite(minObs) ||
    !Number.isFinite(maxBackFocus_mm)
  ) {
    return { spec, warnings: [] };
  }

  const warnings: string[] = [];
  let next = spec;

  const curMaxTube_mm = toMm(
    spec.constraints.maxTubeLength,
    spec.constraints.tubeLengthUnits,
  );

  if (curMaxTube_mm < minTube_mm) {
    const v = fromMm(minTube_mm, spec.constraints.tubeLengthUnits);
    next = {
      ...next,
      constraints: {
        ...next.constraints,
        maxTubeLength: v,
      },
    };
    warnings.push(
      `Max tube length increased to ${v.toFixed(2)} ${formatUnits(spec.constraints.tubeLengthUnits)} (minimum feasible)`,
    );
  }

  if (spec.constraints.maxObstructionRatio < minObs) {
    next = {
      ...next,
      constraints: {
        ...next.constraints,
        maxObstructionRatio: minObs,
      },
    };
    warnings.push(
      `Max obstruction ratio increased to ${minObs.toFixed(3)} (minimum feasible)`,
    );
  }

  const curMinBackFocus_mm = toMm(
    spec.constraints.minBackFocus,
    spec.constraints.backFocusUnits,
  );

  if (curMinBackFocus_mm > maxBackFocus_mm) {
    const v = fromMm(maxBackFocus_mm, spec.constraints.backFocusUnits);
    next = {
      ...next,
      constraints: {
        ...next.constraints,
        minBackFocus: v,
      },
    };
    warnings.push(
      `Min backfocus reduced to ${v.toFixed(2)} ${formatUnits(spec.constraints.backFocusUnits)} (maximum feasible)`,
    );
  }

  return { spec: next, warnings };
}

export function inferDerivedLimits(spec: InputSpec): InputSpec {
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

  const fsFallback =
    spec.targetSystemFRatio > 0 ? [spec.targetSystemFRatio] : [];

  const fsValues = rawFsValues.length > 0 ? rawFsValues : fsFallback;

  const relaxed = relaxedSpecForInference(spec);

  let minFp = Infinity;
  let maxFp = -Infinity;
  let minFs = Infinity;
  let maxFs = -Infinity;

  for (const kind of spec.designKinds) {
    const gen = generatorFor(kind);
    if (!gen) continue;

    for (const Fp of fpValues) {
      if (kind === "newtonian") {
        const raw = gen(relaxed, { primaryFRatio: Fp, systemFRatio: Fp });
        if (!raw) continue;

        const c = checkConstraints(spec, raw);
        if (!c.constraints.pass) continue;

        minFp = Math.min(minFp, Fp);
        maxFp = Math.max(maxFp, Fp);
        minFs = Math.min(minFs, Fp);
        maxFs = Math.max(maxFs, Fp);
        continue;
      }

      for (const Fs of fsValues) {
        const raw = gen(relaxed, { primaryFRatio: Fp, systemFRatio: Fs });
        if (!raw) continue;

        const c = checkConstraints(spec, raw);
        if (!c.constraints.pass) continue;

        minFp = Math.min(minFp, Fp);
        maxFp = Math.max(maxFp, Fp);
        minFs = Math.min(minFs, Fs);
        maxFs = Math.max(maxFs, Fs);
      }
    }
  }

  if (
    !Number.isFinite(minFp) ||
    !Number.isFinite(maxFp) ||
    !Number.isFinite(minFs) ||
    !Number.isFinite(maxFs)
  ) {
    return {
      ...spec,
      derivedLimits: undefined,
    };
  }

  return {
    ...spec,
    derivedLimits: {
      primaryFRatio: { min: minFp, max: maxFp },
      systemFRatio: { min: minFs, max: maxFs },
    },
  };
}

export function runSweep(spec: InputSpec, topN: number = 25): SweepResult {
  const candidates: Candidate[] = [];

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

  const fsFallback =
    spec.targetSystemFRatio > 0 ? [spec.targetSystemFRatio] : [];

  const fsValues = rawFsValues.length > 0 ? rawFsValues : fsFallback;

  const relaxed = relaxedSpecForInference(spec);

  for (const kind of spec.designKinds) {
    const gen = generatorFor(kind);
    if (!gen) continue;

    for (const Fp of fpValues) {
      if (kind === "newtonian") {
        const raw = gen(relaxed, { primaryFRatio: Fp, systemFRatio: Fp });
        if (!raw) continue;
        candidates.push(checkConstraints(spec, raw));
        continue;
      }

      for (const Fs of fsValues) {
        const raw = gen(relaxed, { primaryFRatio: Fp, systemFRatio: Fs });
        if (!raw) continue;
        candidates.push(checkConstraints(spec, raw));
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

  const adj = inferConstraintAdjustments(spec);
  const derivedSpec = inferDerivedLimits(adj.spec);
  const warnings = adj.warnings;

  if (passing.length === 0) {
    return {
      candidates,
      ranked: [],
      bestOverall: null,
      bestByKind,
      top: [],
      derivedSpec,
      warnings,
    };
  }

  const bounds = computeScoreBounds(passing);
  const scored = passing.map((c) => scoreCandidate(c, bounds, spec.weights));

  scored.sort((a, b) => b.score.total - a.score.total);

  for (const c of scored) {
    if (!bestByKind[c.kind]) bestByKind[c.kind] = c;
  }

  const bestOverall = scored[0] ?? null;
  const top = scored.slice(0, Math.max(0, topN));

  return {
    candidates,
    ranked: scored,
    bestOverall,
    bestByKind,
    top,
    derivedSpec,
    warnings,
  };
}
