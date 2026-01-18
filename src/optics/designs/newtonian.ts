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

  if (!Number.isFinite(D_mm) || D_mm <= 0) return null;
  if (!Number.isFinite(Fp) || Fp <= 0) return null;

  const fPrimary_mm = Fp * D_mm;

  const tubeLength_mm = fPrimary_mm + DEFAULT_TUBE_MARGIN_MM;

  const maxTube_mm = toMm(
    spec.constraints.maxTubeLength,
    spec.constraints.tubeLengthUnits,
  );

  const intercept_mm = NEWTONIAN_INTERCEPT_FRACTION * fPrimary_mm;

  const fieldRadius_mm = toMm(
    spec.constraints.fullyIlluminatedFieldRadius,
    spec.constraints.fieldUnits,
  );

  const secondaryDiameter_mm =
    (D_mm * intercept_mm) / fPrimary_mm +
    (2 * fieldRadius_mm * (fPrimary_mm - intercept_mm)) / fPrimary_mm;

  const obstructionRatio = secondaryDiameter_mm / D_mm;

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

  const baseProxy = COMA_PROXY_COEFFICIENT / (Fp * Fp);

  const target = spec.targetSystemFRatio;
  const denom = target > 0 ? target : 1;
  const rel = Math.abs(Fp - target) / denom;
  const proxyScore = baseProxy * (1 + TARGET_FRATIO_MISMATCH_COEFFICIENT * rel);

  const backFocus_mm = Math.max(0, fPrimary_mm - intercept_mm);

  const reasons: string[] = [];

  if (Number.isFinite(maxTube_mm) && tubeLength_mm > maxTube_mm) {
    reasons.push(
      `Tube length requires >= ${tubeLength_mm.toFixed(0)}mm (current max ${maxTube_mm.toFixed(0)}mm)`,
    );
  }

  if (obstructionRatio > spec.constraints.maxObstructionRatio) {
    reasons.push(
      `Obstruction requires <= ${spec.constraints.maxObstructionRatio.toFixed(2)} (current ${obstructionRatio.toFixed(2)})`,
    );
  }

  const minBackFocus_mm = toMm(
    spec.constraints.minBackFocus,
    spec.constraints.backFocusUnits,
  );

  if (Number.isFinite(minBackFocus_mm) && backFocus_mm < minBackFocus_mm) {
    reasons.push(
      `Backfocus requires >= ${minBackFocus_mm.toFixed(0)}mm (current ${backFocus_mm.toFixed(0)}mm)`,
    );
  }

  const pass = reasons.length === 0;

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
      backFocus_mm,
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
      pass,
      reasons,
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
