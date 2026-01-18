import type { InputSpec } from "../types";
import { toMm } from "../units";

export type SecondarySizingInput = {
  D_mm: number;
  fPrimary_mm: number;
  fSystem_mm: number;
  backFocus_mm: number;
  fieldRadius_mm: number;
};

export function sizeSecondaryCassegrainLike(x: SecondarySizingInput): number {
  const m = x.fSystem_mm / x.fPrimary_mm;
  if (!(m > 1)) return Infinity;

  const d = (m * x.fPrimary_mm - x.backFocus_mm) / (m + 1);
  if (!(d > 0 && d < x.fPrimary_mm)) return Infinity;

  const onAxisDiameter = x.D_mm * (1 - d / x.fPrimary_mm);

  const theta = x.fieldRadius_mm / x.fSystem_mm;
  const sPrime = d + x.backFocus_mm;
  const fieldAdd = 2 * theta * sPrime;

  return Math.max(0, onAxisDiameter + fieldAdd);
}

export function readBackFocusMm(spec: InputSpec): number {
  return toMm(spec.constraints.minBackFocus, spec.constraints.backFocusUnits);
}

export function readFieldRadiusMm(spec: InputSpec): number {
  return toMm(
    spec.constraints.fullyIlluminatedFieldRadius,
    spec.constraints.fieldUnits,
  );
}
