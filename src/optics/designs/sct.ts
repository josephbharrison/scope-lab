import type { Candidate, DesignGenerator, InputSpec } from "../types";

import { toMm, areaCircle } from "../units";
import {
  DEFAULT_REFLECTIVITY_PER_MIRROR,
  DEFAULT_CORRECTOR_TRANSMISSION,
  DEFAULT_TUBE_MARGIN_MM,
  SCT_ABERRATION_PENALTY,
  SCT_BAFFLE_FACTOR,
} from "../constants";
import { twoMirrorLayout } from "./twoMirror";

export const sct: DesignGenerator = (
  spec: InputSpec,
  params,
): Candidate | null => {
  const D_mm = toMm(spec.aperture, spec.apertureUnits);
  const Fp = params.primaryFRatio;
  const Fs = params.systemFRatio;

  const layout = twoMirrorLayout(spec, D_mm, Fp, Fs);
  if (!layout) return null;

  const tubeLength_mm =
    layout.fPrimary_mm * (1 - 1 / layout.magnification) +
    layout.backFocus_mm +
    DEFAULT_TUBE_MARGIN_MM;

  const secondaryDiameter_mm = layout.secondaryDiameter_mm;
  const obstructionDiameter_mm = secondaryDiameter_mm * SCT_BAFFLE_FACTOR;

  const obstructionRatio = obstructionDiameter_mm / D_mm;

  const primaryArea_mm2 = areaCircle(D_mm);
  const obstructionArea_mm2 = areaCircle(obstructionDiameter_mm);

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
