// src/optics/designs/newtonian.ts
import type { Candidate, DesignGenerator, InputSpec } from "../types";

import { toMm, areaCircle } from "../units";
import {
  DEFAULT_REFLECTIVITY_PER_MIRROR,
  NEWTONIAN_INTERCEPT_FRACTION,
  DEFAULT_TUBE_MARGIN_MM,
} from "../constants";
import { evaluateImageQualityNewtonian } from "../raytrace/imageQualityNewtonian";
import { adaptRaytraceToMetrics } from "../raytrace/adapt";

function clampNonNegativeFinite(v: number): number {
  return Number.isFinite(v) && v >= 0 ? v : 0;
}

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

  const fieldRadius_mm = clampNonNegativeFinite(
    toMm(
      spec.constraints.fullyIlluminatedFieldRadius,
      spec.constraints.fieldUnits,
    ),
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

  const fieldAngle = fieldRadius_mm > 0 ? fieldRadius_mm / fPrimary_mm : 0;

  const primary = {
    z0: 0,
    R: -2 * fPrimary_mm,
    K: -1,
    sagSign: -1 as const,
    apertureRadius: 0.5 * D_mm,
  };

  const c45 = Math.SQRT1_2;

  const secondary = {
    p0: { x: 0, y: 0, z: -intercept_mm },
    nHat: { x: c45, y: 0, z: c45 },
    apertureRadius: 0.5 * secondaryDiameter_mm,
  };

  const imagePlane = {
    p0: { x: backFocus_mm, y: 0, z: -intercept_mm },
    nHat: { x: 1, y: 0, z: 0 },
    apertureRadius: Math.max(1, 2 * fieldRadius_mm),
  };

  const pres = {
    primary,
    secondary,
    imagePlane,
    zStart: -5 * fPrimary_mm,
    pupilRadius: 0.5 * D_mm,
  };

  const iq = evaluateImageQualityNewtonian(spec, pres, fieldAngle);
  const aberrations = adaptRaytraceToMetrics(iq, Fp);

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
