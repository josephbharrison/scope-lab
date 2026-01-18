// src/optics/designs/twoMirror.ts
import type { InputSpec } from "../types";
import { toMm } from "../units";

export type TwoMirrorLayout = {
  fPrimary_mm: number;
  fSystem_mm: number;
  magnification: number;
  backFocus_mm: number;
  dPrimaryToSecondary_mm: number;
  secondaryDiameter_mm: number;
  coneRadiusAtSecondary_mm: number;
  chiefRayHeightAtSecondary_mm: number;
};

function clampNonNegativeFinite(v: number): number {
  return Number.isFinite(v) && v >= 0 ? v : 0;
}

export function twoMirrorLayout(
  spec: InputSpec,
  D_mm: number,
  Fp: number,
  Fs: number,
): TwoMirrorLayout | null {
  if (!Number.isFinite(D_mm) || D_mm <= 0) return null;
  if (!Number.isFinite(Fp) || !Number.isFinite(Fs)) return null;
  if (Fp <= 0 || Fs <= Fp) return null;

  const fPrimary_mm = Fp * D_mm;
  const fSystem_mm = Fs * D_mm;
  const magnification = fSystem_mm / fPrimary_mm;
  if (!(magnification > 1)) return null;

  const minBackFocus_mm = clampNonNegativeFinite(
    toMm(spec.constraints.minBackFocus, spec.constraints.backFocusUnits),
  );

  const backFocus_mm = minBackFocus_mm;

  const d = (magnification * fPrimary_mm - backFocus_mm) / (magnification + 1);
  if (!Number.isFinite(d) || d <= 0 || d >= fPrimary_mm) return null;

  const fieldRadius_mm = clampNonNegativeFinite(
    toMm(
      spec.constraints.fullyIlluminatedFieldRadius,
      spec.constraints.fieldUnits,
    ),
  );

  const coneRadiusAtSecondary_mm = 0.5 * D_mm * (1 - d / fPrimary_mm);
  if (
    !Number.isFinite(coneRadiusAtSecondary_mm) ||
    coneRadiusAtSecondary_mm <= 0
  ) {
    return null;
  }

  const chiefRayHeightAtSecondary_mm =
    fieldRadius_mm > 0 ? (fieldRadius_mm * (backFocus_mm + d)) / fSystem_mm : 0;

  const secondaryDiameter_mm =
    2 * (coneRadiusAtSecondary_mm + chiefRayHeightAtSecondary_mm);
  if (!Number.isFinite(secondaryDiameter_mm) || secondaryDiameter_mm <= 0)
    return null;

  return {
    fPrimary_mm,
    fSystem_mm,
    magnification,
    backFocus_mm,
    dPrimaryToSecondary_mm: d,
    secondaryDiameter_mm,
    coneRadiusAtSecondary_mm,
    chiefRayHeightAtSecondary_mm,
  };
}
