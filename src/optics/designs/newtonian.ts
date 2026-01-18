// src/optics/designs/newtonian.ts
import type { Candidate, DesignGenerator, InputSpec } from "../types";

import { toMm, areaCircle } from "../units";
import {
  DEFAULT_REFLECTIVITY_PER_MIRROR,
  NEWTONIAN_INTERCEPT_FRACTION,
  DEFAULT_TUBE_MARGIN_MM,
} from "../constants";
import { adaptRaytraceToMetrics } from "../raytrace/adapt";

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

  const backFocus_mm = Math.max(0, fPrimary_mm - intercept_mm);

  const reasons: string[] = [];

  if (Number.isFinite(maxTube_mm) && tubeLength_mm > maxTube_mm) {
    reasons.push(
      `Tube length requires >= ${tubeLength_mm.toFixed(0)}mm (current max ${maxTube_mm.toFixed(0)}mm)`,
    );
  }

  if (
    Number.isFinite(spec.constraints.maxObstructionRatio) &&
    obstructionRatio > spec.constraints.maxObstructionRatio
  ) {
    reasons.push(
      `Obstruction requires <= ${spec.constraints.maxObstructionRatio.toFixed(2)} (current ${obstructionRatio.toFixed(2)})`,
    );
  }

  const minBackFocus_mm = toMm(
    spec.constraints.minBackFocus,
    spec.constraints.backFocusUnits,
  );

  if (
    Number.isFinite(minBackFocus_mm) &&
    minBackFocus_mm > 0 &&
    backFocus_mm < minBackFocus_mm
  ) {
    reasons.push(
      `Backfocus requires >= ${minBackFocus_mm.toFixed(0)}mm (current ${backFocus_mm.toFixed(0)}mm)`,
    );
  }

  const pass = reasons.length === 0;

  const aberrations = adaptRaytraceToMetrics(
    {
      fieldAngle_rad: 0,
      spotRms_mm_onAxis: 0,
      spotRms_mm_edge: 0,
      spotRmsTan_mm_edge: 0,
      spotRmsSag_mm_edge: 0,
      bestFocusShift_mm_edge: 0,
    },
    Fp,
  );

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
    aberrations,
    constraints: {
      pass,
      reasons,
    },
    score: {
      total: 0,
      terms: {
        usableLight: 0,
        aberration: 0,
        obstruction: 0,
      },
    },
  };
};
