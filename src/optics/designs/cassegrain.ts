// src/optics/designs/cassegrain.ts
import type { Candidate, DesignGenerator, InputSpec } from "../types";

import { toMm, areaCircle } from "../units";
import {
  DEFAULT_REFLECTIVITY_PER_MIRROR,
  DEFAULT_TUBE_MARGIN_MM,
  CASSEGRAIN_BAFFLE_FACTOR,
} from "../constants";
import { twoMirrorLayout } from "./twoMirror";
import { evaluateImageQualityTwoMirror } from "../raytrace/imageQuality";
import { adaptRaytraceToMetrics } from "../raytrace/adapt";
import { traceCountsTwoMirror } from "../diagnostics/backfocusTest";

function shouldRunBackfocusDiag(spec: InputSpec): boolean {
  const minBackFocus_mm = toMm(
    spec.constraints.minBackFocus,
    spec.constraints.backFocusUnits,
  );
  return Number.isFinite(minBackFocus_mm) && minBackFocus_mm > 0;
}

export const cassegrain: DesignGenerator = (
  spec: InputSpec,
  params,
): Candidate | null => {
  const D_mm = toMm(spec.aperture, spec.apertureUnits);
  const Fp = params.primaryFRatio;
  const Fs = params.systemFRatio;

  if (!Number.isFinite(D_mm) || D_mm <= 0) return null;
  if (!Number.isFinite(Fp) || Fp <= 0) return null;
  if (!Number.isFinite(Fs) || Fs <= 0) return null;
  if (Fs <= Fp) return null;

  const layout = twoMirrorLayout(spec, D_mm, Fp, Fs);
  if (!layout) return null;

  const tubeLength_mm =
    layout.fPrimary_mm * (1 - 1 / layout.magnification) +
    layout.backFocus_mm +
    DEFAULT_TUBE_MARGIN_MM;

  const maxTube_mm = toMm(
    spec.constraints.maxTubeLength,
    spec.constraints.tubeLengthUnits,
  );

  const secondaryDiameter_mm = layout.secondaryDiameter_mm;
  const obstructionDiameter_mm =
    secondaryDiameter_mm * CASSEGRAIN_BAFFLE_FACTOR;
  const obstructionRatio = obstructionDiameter_mm / D_mm;

  const reasons: string[] = [];

  if (Number.isFinite(maxTube_mm) && tubeLength_mm > maxTube_mm) {
    reasons.push(
      `Tube length ${tubeLength_mm.toFixed(0)}mm exceeds max ${maxTube_mm.toFixed(0)}mm`,
    );
  }

  if (
    Number.isFinite(spec.constraints.maxObstructionRatio) &&
    obstructionRatio > spec.constraints.maxObstructionRatio
  ) {
    reasons.push(
      `Obstruction ${obstructionRatio.toFixed(2)} exceeds max ${spec.constraints.maxObstructionRatio.toFixed(2)}`,
    );
  }

  const minBackFocus_mm = toMm(
    spec.constraints.minBackFocus,
    spec.constraints.backFocusUnits,
  );

  if (
    Number.isFinite(minBackFocus_mm) &&
    minBackFocus_mm > 0 &&
    layout.backFocus_mm < minBackFocus_mm
  ) {
    reasons.push(
      `Backfocus requires >= ${minBackFocus_mm.toFixed(0)}mm (current ${layout.backFocus_mm.toFixed(0)}mm)`,
    );
  }

  const pass = reasons.length === 0;

  const primaryArea_mm2 = areaCircle(D_mm);
  const obstructionArea_mm2 = areaCircle(obstructionDiameter_mm);

  const mirrorCount = 2;
  const transmissionFactor = Math.pow(
    spec.coatings.reflectivityPerMirror || DEFAULT_REFLECTIVITY_PER_MIRROR,
    mirrorCount,
  );

  const effectiveArea_mm2 =
    (primaryArea_mm2 - obstructionArea_mm2) * transmissionFactor;
  const usableLightEfficiency = effectiveArea_mm2 / primaryArea_mm2;

  const fieldRadius_mm = toMm(
    spec.constraints.fullyIlluminatedFieldRadius,
    spec.constraints.fieldUnits,
  );

  const fieldSafe = Math.max(
    0,
    Number.isFinite(fieldRadius_mm) ? fieldRadius_mm : 0,
  );
  const fieldAngle = fieldSafe / layout.fSystem_mm;

  const primary = {
    z0: 0,
    R: -2 * layout.fPrimary_mm,
    K: -1,
    sagSign: -1 as const,
    apertureRadius: 0.5 * D_mm,
  };

  const secondary = {
    z0: -layout.dPrimaryToSecondary_mm,
    R: 2 * (-layout.fPrimary_mm / Math.max(1e-6, layout.magnification - 1)),
    K: -1,
    sagSign: 1 as const,
    apertureRadius: 0.5 * secondaryDiameter_mm,
  };

  if (shouldRunBackfocusDiag(spec)) {
    const zStart = -5 * layout.fPrimary_mm;
    const pupilRadius = 0.5 * D_mm;

    const presPlus = {
      primary,
      secondary,
      imagePlaneZ: layout.backFocus_mm,
      zStart,
      pupilRadius,
    };

    const presMinus = {
      primary,
      secondary,
      imagePlaneZ: -layout.backFocus_mm,
      zStart,
      pupilRadius,
    };

    const plus = traceCountsTwoMirror(presPlus, fieldAngle);
    const minus = traceCountsTwoMirror(presMinus, fieldAngle);

    console.log({
      diag: "backfocus",
      kind: "cassegrain",
      Fp,
      Fs,
      backFocus_mm: layout.backFocus_mm,
      plus,
      minus,
    });
  }

  const pres = {
    primary,
    secondary,
    imagePlaneZ: layout.backFocus_mm,
    zStart: -5 * layout.fPrimary_mm,
    pupilRadius: 0.5 * D_mm,
  };

  const iq = evaluateImageQualityTwoMirror(spec, pres, fieldAngle);
  const aberrations = adaptRaytraceToMetrics(iq, Fs);

  return {
    id: `cass-Fp${Fp.toFixed(2)}-Fs${Fs.toFixed(2)}`,
    kind: "cassegrain",
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
