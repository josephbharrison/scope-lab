// src/optics/designs/newtonian.ts
import type { Candidate } from "../types";
import type { DesignGenerator } from "./types";
import type { OpticalPlan, SurfaceConic, SurfacePlane } from "../plan/types";

import { toMm, areaCircle } from "../units";
import {
  DEFAULT_REFLECTIVITY_PER_MIRROR,
  NEWTONIAN_INTERCEPT_FRACTION,
  DEFAULT_TUBE_MARGIN_MM,
} from "../constants";

import { adaptRaytraceToMetrics } from "../raytrace/adapt";

function clampNonNegativeFinite(v: number): number {
  return Number.isFinite(v) && v >= 0 ? v : 0;
}

export const newtonian: DesignGenerator = (
  spec,
  params,
  ctx,
): Candidate | null => {
  const D_mm = toMm(spec.aperture, spec.apertureUnits);
  const Fp = params.primaryFRatio;

  if (!(D_mm > 0 && Fp > 0)) return null;

  const fPrimary_mm = Fp * D_mm;
  const intercept_mm = NEWTONIAN_INTERCEPT_FRACTION * fPrimary_mm;
  const backFocus_mm = Math.max(0, fPrimary_mm - intercept_mm);
  const tubeLength_mm = fPrimary_mm + DEFAULT_TUBE_MARGIN_MM;

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

  const reflectivity =
    spec.coatings.reflectivityPerMirror ?? DEFAULT_REFLECTIVITY_PER_MIRROR;

  const primary: SurfaceConic = {
    kind: "conic",
    id: "primary",
    z0_mm: 0,
    R_mm: -2 * fPrimary_mm,
    K: -1,
    sagSign: -1,
    aperture: { kind: "circle", radius_mm: 0.5 * D_mm },
    material: { kind: "reflector", reflectivity },
  };

  const c45 = Math.SQRT1_2;

  const secondary: SurfacePlane = {
    kind: "plane",
    id: "secondary",
    p0_mm: { x: 0, y: 0, z: -intercept_mm },
    nHat: { x: c45, y: 0, z: c45 },
    aperture: { kind: "circle", radius_mm: 0.5 * secondaryDiameter_mm },
    material: { kind: "reflector", reflectivity },
  };

  const imagePlane: SurfacePlane = {
    kind: "plane",
    id: "sensor",
    p0_mm: { x: backFocus_mm, y: 0, z: -intercept_mm },
    nHat: { x: 1, y: 0, z: 0 },
    aperture: { kind: "circle", radius_mm: Math.max(1, 2 * fieldRadius_mm) },
    material: { kind: "absorber" },
  };

  const fieldAngle_rad = fieldRadius_mm > 0 ? fieldRadius_mm / fPrimary_mm : 0;

  const plan: OpticalPlan = {
    id: `newtonian-F${Fp.toFixed(2)}`,
    label: "Newtonian",
    entrance: {
      zStart_mm: -5 * fPrimary_mm,
      pupilRadius_mm: 0.5 * D_mm,
      fieldAngles_rad: [0, fieldAngle_rad],
    },
    surfaces: [primary, secondary],
    sensor: { id: "sensor", plane: imagePlane },
  };

  const sim = ctx.simulator.simulate(plan, ctx.scoringSampleSpec);
  const iq = sim.imageQuality ?? [];
  if (iq.length === 0) return null;

  const iqOnAxis = iq[0];
  const iqEdge = iq[iq.length - 1];
  const aberrations = adaptRaytraceToMetrics(iqEdge, Fp, iqOnAxis);

  const primaryArea_mm2 = areaCircle(D_mm);
  const obstructionArea_mm2 = areaCircle(secondaryDiameter_mm);

  const mirrorCount = 2;
  const transmissionFactor = Math.pow(reflectivity, mirrorCount);

  const effectiveArea_mm2 =
    (primaryArea_mm2 - obstructionArea_mm2) * transmissionFactor;

  const usableLightEfficiency = effectiveArea_mm2 / primaryArea_mm2;

  const reasons: string[] = [];

  const maxTube_mm = toMm(
    spec.constraints.maxTubeLength,
    spec.constraints.tubeLengthUnits,
  );

  if (Number.isFinite(maxTube_mm) && tubeLength_mm > maxTube_mm) {
    reasons.push(`Tube length ${tubeLength_mm.toFixed(0)}mm exceeds max`);
  }

  if (
    Number.isFinite(spec.constraints.maxObstructionRatio) &&
    obstructionRatio > spec.constraints.maxObstructionRatio
  ) {
    reasons.push(`Obstruction ratio too large`);
  }

  const pass = reasons.length === 0;

  return {
    id: plan.id,
    kind: "newtonian",
    plan,

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

    constraints: { pass, reasons },

    score: {
      total: 0,
      terms: { usableLight: 0, aberration: 0, obstruction: 0 },
    },

    audit: {
      scoringSampleSpec: ctx.scoringSampleSpec,
      imageQuality: iq,
    },
  };
};
