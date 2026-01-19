// src/optics/designs/rc.ts
import type { Candidate } from "../types";
import type { DesignGenerator } from "./types";
import type { OpticalPlan, SurfaceConic, SurfacePlane } from "../plan/types";

import { toMm, areaCircle } from "../units";
import {
  DEFAULT_REFLECTIVITY_PER_MIRROR,
  DEFAULT_TUBE_MARGIN_MM,
  RC_BAFFLE_FACTOR,
} from "../constants";
import { twoMirrorLayout } from "./twoMirror";
import { adaptRaytraceToMetrics } from "../raytrace/adapt";

function clampNonNegativeFinite(v: number): number {
  return Number.isFinite(v) && v >= 0 ? v : 0;
}

export const rc: DesignGenerator = (spec, params, ctx): Candidate | null => {
  const D_mm = toMm(spec.aperture, spec.apertureUnits);
  const Fp = params.primaryFRatio;
  const Fs = params.systemFRatio;

  if (!(D_mm > 0 && Fp > 0 && Fs > Fp)) return null;

  const layout = twoMirrorLayout(spec, D_mm, Fp, Fs);
  if (!layout) return null;

  const tubeLength_mm =
    layout.fPrimary_mm * (1 - 1 / layout.magnification) +
    layout.backFocus_mm +
    DEFAULT_TUBE_MARGIN_MM;

  const secondaryDiameter_mm = layout.secondaryDiameter_mm;
  const obstructionDiameter_mm = secondaryDiameter_mm * RC_BAFFLE_FACTOR;
  const obstructionRatio = obstructionDiameter_mm / D_mm;

  const reasons: string[] = [];

  const maxTube_mm = toMm(
    spec.constraints.maxTubeLength,
    spec.constraints.tubeLengthUnits,
  );
  if (Number.isFinite(maxTube_mm) && tubeLength_mm > maxTube_mm)
    reasons.push("Tube too long");

  if (
    Number.isFinite(spec.constraints.maxObstructionRatio) &&
    obstructionRatio > spec.constraints.maxObstructionRatio
  )
    reasons.push("Obstruction too large");

  const pass = reasons.length === 0;

  const reflectivity =
    spec.coatings.reflectivityPerMirror ?? DEFAULT_REFLECTIVITY_PER_MIRROR;

  const primary: SurfaceConic = {
    kind: "conic",
    id: "primary",
    z0_mm: 0,
    R_mm: -2 * layout.fPrimary_mm,
    K: -1.15,
    sagSign: -1,
    aperture: {
      kind: "circle",
      radius_mm: 0.5 * D_mm,
      innerRadius_mm: 0.5 * obstructionDiameter_mm,
    },
    material: { kind: "reflector", reflectivity },
  };

  const m = layout.magnification;

  // src/optics/designs/rc.ts
  const secondary: SurfaceConic = {
    kind: "conic",
    id: "secondary",
    z0_mm: -layout.dPrimaryToSecondary_mm,
    R_mm: -2 * (layout.fPrimary_mm / (m - 1)),
    K: -2.4,
    sagSign: 1,
    aperture: { kind: "circle", radius_mm: 0.5 * secondaryDiameter_mm },
    material: { kind: "reflector", reflectivity },
  };

  const fieldRadius_mm = clampNonNegativeFinite(
    toMm(
      spec.constraints.fullyIlluminatedFieldRadius,
      spec.constraints.fieldUnits,
    ),
  );

  const sensorPlane: SurfacePlane = {
    kind: "plane",
    id: "sensor",
    p0_mm: { x: 0, y: 0, z: layout.backFocus_mm },
    nHat: { x: 0, y: 0, z: 1 },
    aperture: { kind: "circle", radius_mm: Math.max(1, 2 * fieldRadius_mm) },
    material: { kind: "absorber" },
  };

  const plan: OpticalPlan = {
    id: `rc-Fp${Fp.toFixed(2)}-Fs${Fs.toFixed(2)}`,
    label: "Ritchey-Chrétien",
    entrance: {
      zStart_mm: -5 * layout.fPrimary_mm,
      pupilRadius_mm: 0.5 * D_mm,
      fieldAngles_rad: [0, fieldRadius_mm / layout.fSystem_mm],
    },
    surfaces: [primary, secondary],
    sensor: { id: "sensor", plane: sensorPlane },
  };

  const sim = ctx.simulator.simulate(plan, ctx.scoringSampleSpec);
  if (!sim.imageQuality || sim.imageQuality.length === 0) return null;

  const aberrations = adaptRaytraceToMetrics(
    sim.imageQuality.at(-1)!,
    Fs,
    sim.imageQuality[0],
  );

  const primaryArea_mm2 = areaCircle(D_mm);
  const obstructionArea_mm2 = areaCircle(obstructionDiameter_mm);

  const effectiveArea_mm2 =
    (primaryArea_mm2 - obstructionArea_mm2) * Math.pow(reflectivity, 2);

  return {
    id: plan.id,
    kind: "rc",
    plan,
    inputs: {
      aperture_mm: D_mm,
      primaryFRatio: Fp,
      systemFRatio: Fs,
      primaryFocalLength_mm: layout.fPrimary_mm,
      systemFocalLength_mm: layout.fSystem_mm,
    },
    geometry: {
      tubeLength_mm,
      backFocus_mm: layout.backFocus_mm,
      secondaryDiameter_mm: obstructionDiameter_mm,
      obstructionRatio,
    },
    throughput: {
      primaryArea_mm2,
      effectiveArea_mm2,
      usableLightEfficiency: effectiveArea_mm2 / primaryArea_mm2,
      mirrorCount: 2,
      transmissionFactor: Math.pow(reflectivity, 2),
    },
    aberrations,
    constraints: { pass, reasons },
    score: {
      total: 0,
      terms: { usableLight: 0, aberration: 0, obstruction: 0 },
    },
    audit: {
      scoringSampleSpec: ctx.scoringSampleSpec,
      imageQuality: sim.imageQuality,
    },
  };
};
