import type { Candidate, InputSpec, OpticDesignKind } from "./types";

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

export function runSweep(spec: InputSpec, topN: number = 25): SweepResult {
  const candidates: Candidate[] = [];

  const fpValues = enumerateRange(
    spec.sweep.primaryFRatioMin,
    spec.sweep.primaryFRatioMax,
    spec.sweep.primaryFRatioStep,
  );

  const fsValues = enumerateRange(
    spec.sweep.systemFRatioMin,
    spec.sweep.systemFRatioMax,
    spec.sweep.systemFRatioStep,
  );

  for (const kind of spec.designKinds) {
    const gen = generatorFor(kind);
    if (!gen) continue;

    for (const Fp of fpValues) {
      if (kind === "newtonian") {
        const c = gen(spec, { primaryFRatio: Fp, systemFRatio: Fp });
        if (!c) continue;
        candidates.push(checkConstraints(spec, c));
        continue;
      }

      for (const Fs of fsValues) {
        const c = gen(spec, { primaryFRatio: Fp, systemFRatio: Fs });
        if (!c) continue;
        candidates.push(checkConstraints(spec, c));
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
      ranked: [],
      bestOverall: null,
      bestByKind,
      top: [],
    };
  }

  const bounds = computeScoreBounds(passing);

  const scored = passing.map((c) => scoreCandidate(c, bounds, spec.weights));

  scored.sort((a, b) => b.score.total - a.score.total);

  for (const c of scored) {
    if (!bestByKind[c.kind]) bestByKind[c.kind] = c;
  }

  const bestOverall = scored.length > 0 ? scored[0] : null;
  const top = scored.slice(0, Math.max(0, topN));

  return {
    candidates,
    ranked: scored,
    bestOverall,
    bestByKind,
    top,
  };
}
