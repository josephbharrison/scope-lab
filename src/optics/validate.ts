import type { InputSpec, OpticDesignKind, Candidate } from "./types";

import { toMm } from "./units";
import { newtonian } from "./designs/newtonian";
import { cassegrain } from "./designs/cassegrain";
import { sct } from "./designs/sct";
import { rc } from "./designs/rc";

export type ConstraintKind = "min" | "max";

export type SpecViolation = {
  key: string;
  value: number;
  constraint: ConstraintKind;
  warning: string;
};

export type ValidationResult = {
  spec: InputSpec;
  violations: SpecViolation[];
};

function generatorFor(kind: OpticDesignKind) {
  if (kind === "newtonian") return newtonian;
  if (kind === "cassegrain") return cassegrain;
  if (kind === "sct") return sct;
  if (kind === "rc") return rc;
  return null;
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

function relaxedSpec(spec: InputSpec): InputSpec {
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

function toUnits(mm: number, units: "mm" | "inch"): number {
  return units === "mm" ? mm : mm / 25.4;
}

function metricDelta(
  current: {
    maxTube_mm: number;
    maxObs: number;
    minBack_mm: number;
  },
  needed: {
    maxTube_mm: number;
    maxObs: number;
    minBack_mm: number;
  },
): number {
  const tube =
    needed.maxTube_mm > current.maxTube_mm
      ? (needed.maxTube_mm - current.maxTube_mm) /
      Math.max(1, current.maxTube_mm)
      : 0;

  const obs =
    needed.maxObs > current.maxObs
      ? (needed.maxObs - current.maxObs) / Math.max(1e-9, current.maxObs)
      : 0;

  const back =
    needed.minBack_mm < current.minBack_mm
      ? (current.minBack_mm - needed.minBack_mm) /
      Math.max(1, current.minBack_mm)
      : 0;

  return tube + obs + back;
}

function bestFeasibleAdjustment(spec: InputSpec): {
  nextSpec: InputSpec;
  violations: SpecViolation[];
} {
  const tubeUnits = spec.constraints.tubeLengthUnits;
  const backUnits = spec.constraints.backFocusUnits;

  const currentMaxTube_mm = toMm(spec.constraints.maxTubeLength, tubeUnits);
  const currentMaxObs = spec.constraints.maxObstructionRatio;
  const currentMinBack_mm = toMm(spec.constraints.minBackFocus, backUnits);

  const fpValues = enumerateRange(
    spec.sweep.primaryFRatioMin,
    spec.sweep.primaryFRatioMax,
    spec.sweep.primaryFRatioStep,
  );

  const fsValuesRaw = enumerateRange(
    spec.sweep.systemFRatioMin,
    spec.sweep.systemFRatioMax,
    spec.sweep.systemFRatioStep,
  );

  const fsFallback =
    spec.targetSystemFRatio > 0 ? [spec.targetSystemFRatio] : [];
  const fsValues = fsValuesRaw.length > 0 ? fsValuesRaw : fsFallback;

  const relaxed = relaxedSpec(spec);

  let best: {
    c: Candidate;
    neededMaxTube_mm: number;
    neededMaxObs: number;
    neededMinBack_mm: number;
    delta: number;
  } | null = null;

  for (const kind of spec.designKinds) {
    const gen = generatorFor(kind);
    if (!gen) continue;

    for (const Fp of fpValues) {
      if (kind === "newtonian") {
        const c = gen(relaxed, { primaryFRatio: Fp, systemFRatio: Fp });
        if (!c) continue;

        const neededMaxTube_mm = c.geometry.tubeLength_mm;
        const neededMaxObs = c.geometry.obstructionRatio;
        const neededMinBack_mm = Math.min(
          currentMinBack_mm,
          c.geometry.backFocus_mm,
        );

        const delta = metricDelta(
          {
            maxTube_mm: currentMaxTube_mm,
            maxObs: currentMaxObs,
            minBack_mm: currentMinBack_mm,
          },
          {
            maxTube_mm: neededMaxTube_mm,
            maxObs: neededMaxObs,
            minBack_mm: neededMinBack_mm,
          },
        );

        if (!best || delta < best.delta) {
          best = { c, neededMaxTube_mm, neededMaxObs, neededMinBack_mm, delta };
        }
        continue;
      }

      for (const Fs of fsValues) {
        const c = gen(relaxed, { primaryFRatio: Fp, systemFRatio: Fs });
        if (!c) continue;

        const neededMaxTube_mm = c.geometry.tubeLength_mm;
        const neededMaxObs = c.geometry.obstructionRatio;
        const neededMinBack_mm = Math.min(
          currentMinBack_mm,
          c.geometry.backFocus_mm,
        );

        const delta = metricDelta(
          {
            maxTube_mm: currentMaxTube_mm,
            maxObs: currentMaxObs,
            minBack_mm: currentMinBack_mm,
          },
          {
            maxTube_mm: neededMaxTube_mm,
            maxObs: neededMaxObs,
            minBack_mm: neededMinBack_mm,
          },
        );

        if (!best || delta < best.delta) {
          best = { c, neededMaxTube_mm, neededMaxObs, neededMinBack_mm, delta };
        }
      }
    }
  }

  if (!best) {
    return { nextSpec: spec, violations: [] };
  }

  const violations: SpecViolation[] = [];
  let next = spec;

  if (best.neededMaxTube_mm > currentMaxTube_mm + 1e-9) {
    const vUnits = toUnits(best.neededMaxTube_mm, tubeUnits);
    violations.push({
      key: "constraints.maxTubeLength",
      value: vUnits,
      constraint: "max",
      warning: `Max tube length increased to ${vUnits.toFixed(2)} ${tubeUnits} to allow at least one ${best.c.kind} candidate`,
    });
    next = {
      ...next,
      constraints: {
        ...next.constraints,
        maxTubeLength: vUnits,
      },
    };
  }

  if (best.neededMaxObs > currentMaxObs + 1e-12) {
    violations.push({
      key: "constraints.maxObstructionRatio",
      value: best.neededMaxObs,
      constraint: "max",
      warning: `Max obstruction ratio increased to ${best.neededMaxObs.toFixed(3)} to allow at least one ${best.c.kind} candidate`,
    });
    next = {
      ...next,
      constraints: {
        ...next.constraints,
        maxObstructionRatio: best.neededMaxObs,
      },
    };
  }

  if (best.neededMinBack_mm < currentMinBack_mm - 1e-9) {
    const vUnits = toUnits(best.neededMinBack_mm, backUnits);
    violations.push({
      key: "constraints.minBackFocus",
      value: vUnits,
      constraint: "min",
      warning: `Min backfocus decreased to ${vUnits.toFixed(2)} ${backUnits} to allow at least one ${best.c.kind} candidate`,
    });
    next = {
      ...next,
      constraints: {
        ...next.constraints,
        minBackFocus: vUnits,
      },
    };
  }

  return { nextSpec: next, violations };
}

export function validateSpec(
  applied: InputSpec,
  current: InputSpec,
): ValidationResult {
  const tuned = bestFeasibleAdjustment(applied);
  return {
    spec: tuned.nextSpec,
    violations: tuned.violations,
  };
}
