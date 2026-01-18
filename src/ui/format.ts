import type { Candidate, Units } from "../optics/types";
import { fromMm } from "../optics/units";

export function fmtNumber(value: number, digits: number = 2): string {
  if (!Number.isFinite(value)) return "-";
  return value.toFixed(digits);
}

export function fmtPercent(value: number, digits: number = 1): string {
  if (!Number.isFinite(value)) return "-";
  return (value * 100).toFixed(digits) + "%";
}

export function fmtLength(
  mm: number,
  units: Units,
  digits: number = 1,
): string {
  const v = fromMm(mm, units);
  return fmtNumber(v, digits) + " " + units;
}

export function candidateLabel(c: Candidate): string {
  if (c.kind === "newtonian") {
    return `Newtonian F${fmtNumber(c.inputs.primaryFRatio, 2)}`;
  }
  return `${c.kind.toUpperCase()} Fp${fmtNumber(c.inputs.primaryFRatio, 2)} Fs${fmtNumber(c.inputs.systemFRatio, 2)}`;
}

export function candidateSummary(c: Candidate, tubeUnits: Units): string {
  const tube = fmtLength(c.geometry.tubeLength_mm, tubeUnits, 1);
  const obs = fmtPercent(c.geometry.obstructionRatio, 1);
  const eff = fmtPercent(c.throughput.usableLightEfficiency, 1);
  const score = fmtNumber(c.score.total, 3);
  return `${candidateLabel(c)} | score ${score} | tube ${tube} | obs ${obs} | eff ${eff}`;
}
