import type { Candidate, DesignGenerator, InputSpec } from "../types";

import { toMm, areaCircle } from "../units";
import {
  DEFAULT_REFLECTIVITY_PER_MIRROR,
  DEFAULT_CORRECTOR_TRANSMISSION,
  DEFAULT_TUBE_MARGIN_MM,
  SCT_ABERRATION_PENALTY,
} from "../constants";

export const sct: DesignGenerator = (
  spec: InputSpec,
  params,
): Candidate | null => {
  const D_mm = toMm(spec.aperture, spec.apertureUnits);
  const Fp = params.primaryFRatio;
  const Fs = params.systemFRatio;

  if (Fp <= 0 || Fs <= Fp) return null;

  const fPrimary_mm = Fp * D_mm;
  const fSystem_mm = Fs * D_mm;

  const magnification = fSystem_mm / fPrimary_mm;

  const backFocus_mm = toMm(
    spec.constraints.minBackFocus,
    spec.constraints.backFocusUnits,
  );

  const tubeLength_mm =
    fPrimary_mm * (1 - 1 / magnification) +
    backFocus_mm +
    DEFAULT_TUBE_MARGIN_MM;

  const secondaryDiameter_mm = D_mm * Math.sqrt(1 / magnification);

  const obstructionRatio = secondaryDiameter_mm / D_mm;

  const primaryArea_mm2 = areaCircle(D_mm);
  const obstructionArea_mm2 = areaCircle(secondaryDiameter_mm);

  const mirrorCount = 2;
  const reflectivity =
    spec.coatings.reflectivityPerMirror || DEFAULT_REFLECTIVITY_PER_MIRROR;
  const correctorTransmission =
    spec.coatings.correctorTransmission || DEFAULT_CORRECTOR_TRANSMISSION;

  const transmissionFactor =
    Math.pow(reflectivity, mirrorCount) * correctorTransmission;

  const effectiveArea_mm2 =
    (primaryArea_mm2 - obstructionArea_mm2) * transmissionFactor;

  const usableLightEfficiency = effectiveArea_mm2 / primaryArea_mm2;

  const proxyScore = SCT_ABERRATION_PENALTY * (Fs / Fp);

  return {
    id: `sct-Fp${Fp.toFixed(2)}-Fs${Fs.toFixed(2)}`,
    kind: "sct",
    inputs: {
      aperture_mm: D_mm,
      primaryFRatio: Fp,
      systemFRatio: Fs,
      primaryFocalLength_mm: fPrimary_mm,
      systemFocalLength_mm: fSystem_mm,
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
