import type { Candidate, DesignGenerator, InputSpec } from "../types";

import { toMm, areaCircle } from "../units";
import {
  DEFAULT_REFLECTIVITY_PER_MIRROR,
  DEFAULT_TUBE_MARGIN_MM,
  CASSEGRAIN_ABERRATION_PENALTY,
  CASSEGRAIN_BAFFLE_FACTOR,
  TARGET_FRATIO_MISMATCH_COEFFICIENT,
} from "../constants";
import { twoMirrorLayout } from "./twoMirror";

export const cassegrain: DesignGenerator = (
  spec: InputSpec,
  params,
): Candidate | null => {
  const D_mm = toMm(spec.aperture, spec.apertureUnits);
  const Fp = params.primaryFRatio;
  const Fs = params.systemFRatio;

  if (Fp <= 0 || Fs <= 0) return null;
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

  if (tubeLength_mm > maxTube_mm) {
    reasons.push(
      `Tube length ${tubeLength_mm.toFixed(
        0,
      )}mm exceeds max ${maxTube_mm.toFixed(0)}mm`,
    );
  }

  if (obstructionRatio > spec.constraints.maxObstructionRatio) {
    reasons.push(
      `Obstruction ${obstructionRatio.toFixed(
        2,
      )} exceeds max ${spec.constraints.maxObstructionRatio}`,
    );
  }

  if (
    layout.backFocus_mm <
    toMm(spec.constraints.minBackFocus, spec.constraints.backFocusUnits)
  ) {
    reasons.push("Backfocus below minimum");
  }

  if (reasons.length > 0) return null;

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

  const baseProxy = CASSEGRAIN_ABERRATION_PENALTY * (Fs / Fp);

  const target = spec.targetSystemFRatio;
  const denom = target > 0 ? target : 1;
  const rel = Math.abs(Fs - target) / denom;
  const proxyScore = baseProxy * (1 + TARGET_FRATIO_MISMATCH_COEFFICIENT * rel);

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
