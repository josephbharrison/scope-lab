import type { Candidate, DesignGenerator, InputSpec } from "../types";

import { toMm, areaCircle } from "../units";
import {
  DEFAULT_REFLECTIVITY_PER_MIRROR,
  COMA_PROXY_COEFFICIENT,
  NEWTONIAN_INTERCEPT_FRACTION,
  DEFAULT_TUBE_MARGIN_MM,
  TARGET_FRATIO_MISMATCH_COEFFICIENT,
} from "../constants";

export const newtonian: DesignGenerator = (
  spec: InputSpec,
  params,
): Candidate | null => {
  const D_mm = toMm(spec.aperture, spec.apertureUnits);
  const Fp = params.primaryFRatio;

  if (Fp <= 0) return null;

  const fPrimary_mm = Fp * D_mm;

  // First-order tube length: primary focal length + margin
  const tubeLength_mm = fPrimary_mm + DEFAULT_TUBE_MARGIN_MM;

  // Intercept distance from primary to secondary (first-order proxy)
  const intercept_mm = NEWTONIAN_INTERCEPT_FRACTION * fPrimary_mm;

  // Fully illuminated field radius
  const fieldRadius_mm = toMm(
    spec.constraints.fullyIlluminatedFieldRadius,
    spec.constraints.fieldUnits,
  );

  // Secondary diameter estimate (minor axis)
  const secondaryDiameter_mm =
    (D_mm * intercept_mm) / fPrimary_mm +
    (2 * fieldRadius_mm * (fPrimary_mm - intercept_mm)) / fPrimary_mm;

  const obstructionRatio = secondaryDiameter_mm / D_mm;

  // Areas
  const primaryArea_mm2 = areaCircle(D_mm);
  const obstructionArea_mm2 = areaCircle(secondaryDiameter_mm);

  const mirrorCount = 2;
  const transmissionFactor = Math.pow(
    spec.coatings.reflectivityPerMirror || DEFAULT_REFLECTIVITY_PER_MIRROR,
    mirrorCount,
  );

  const effectiveArea_mm2 =
    (primaryArea_mm2 - obstructionArea_mm2) * transmissionFactor;

  const usableLightEfficiency = effectiveArea_mm2 / primaryArea_mm2;

  // Aberration proxy: coma-dominated, scales as 1 / F^2
  const baseProxy = COMA_PROXY_COEFFICIENT / (Fp * Fp);

  const target = spec.targetSystemFRatio;
  const denom = target > 0 ? target : 1;
  const rel = Math.abs(Fp - target) / denom;
  const proxyScore = baseProxy * (1 + TARGET_FRATIO_MISMATCH_COEFFICIENT * rel);

  return {
    id: `newtonian-F${Fp.toFixed(2)}`,
    kind: "newtonian",
    inputs: {
      aperture_mm: D_mm,
      primaryFRatio: Fp,
      systemFRatio: Fp,
      primaryFocalLength_mm: fPrimary_mm,
      systemFocalLength_mm: fPrimary_mm,
    },
    geometry: {
      tubeLength_mm,
      backFocus_mm: 0,
      secondaryDiameter_mm,
      obstructionRatio,
    },
    throughput: {
      primaryArea_mm2,
      effectiveArea_mm2,
      usableLightEfficiency,
      mirrorCount,
      transmissionFactor,
    },
    aberrations: {
      proxyScore,
    },
    constraints: {
      pass: true,
      reasons: [],
    },
    score: {
      total: 0,
      terms: {
        usableLight: 0,
        aberration: 0,
        tubeLength: 0,
        obstruction: 0,
      },
    },
  };
};
