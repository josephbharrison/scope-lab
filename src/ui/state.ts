import type { InputSpec, OpticDesignKind, Units } from "../optics/types";

import { toMm } from "../optics/units";
import { DEFAULT_TUBE_MARGIN_MM } from "../optics/constants";

export type LabState = {
  spec: InputSpec;
  topN: number;
};

function fromMm(mm: number, units: Units): number {
  return units === "inch" ? mm / 25.4 : mm;
}

function normalizeForDesignKinds(spec: InputSpec): InputSpec {
  const kinds = spec.designKinds;
  const isNewtonianOnly = kinds.length === 1 && kinds[0] === "newtonian";

  const D_mm = toMm(spec.aperture, spec.apertureUnits);

  const target = Number.isFinite(spec.targetSystemFRatio)
    ? spec.targetSystemFRatio
    : 0;

  const fpMin = Number.isFinite(spec.sweep.primaryFRatioMin)
    ? spec.sweep.primaryFRatioMin
    : 0;
  const fpMax = Number.isFinite(spec.sweep.primaryFRatioMax)
    ? spec.sweep.primaryFRatioMax
    : 0;

  let clampedTarget = target;

  if (isNewtonianOnly) {
    if (fpMax >= fpMin && fpMin > 0) {
      clampedTarget =
        clampedTarget < fpMin
          ? fpMin
          : clampedTarget > fpMax
            ? fpMax
            : clampedTarget;
    }

    const requiredTube_mm =
      Number.isFinite(D_mm) && D_mm > 0 && clampedTarget > 0
        ? clampedTarget * D_mm + DEFAULT_TUBE_MARGIN_MM
        : 0;

    const maxTube_mm = toMm(
      spec.constraints.maxTubeLength,
      spec.constraints.tubeLengthUnits,
    );

    const nextMaxTube_mm =
      Number.isFinite(requiredTube_mm) &&
        requiredTube_mm > 0 &&
        Number.isFinite(maxTube_mm) &&
        maxTube_mm > 0 &&
        maxTube_mm < requiredTube_mm
        ? requiredTube_mm
        : maxTube_mm;

    const nextMaxTube =
      Number.isFinite(nextMaxTube_mm) && nextMaxTube_mm > 0
        ? fromMm(nextMaxTube_mm, spec.constraints.tubeLengthUnits)
        : spec.constraints.maxTubeLength;

    return {
      ...spec,
      targetSystemFRatio: clampedTarget,
      sweep: {
        ...spec.sweep,
        systemFRatioMin: clampedTarget,
        systemFRatioMax: clampedTarget,
        systemFRatioStep: 0,
      },
      constraints: {
        ...spec.constraints,
        maxTubeLength: nextMaxTube,
      },
    };
  }

  return spec;
}

export function defaultLabState(): LabState {
  const rawSpec: InputSpec = {
    aperture: 12,
    apertureUnits: "inch",
    targetSystemFRatio: 6,
    designKinds: ["newtonian", "cassegrain", "sct", "rc"],
    controlMode: "design",
    constraints: {
      maxTubeLength: 60,
      tubeLengthUnits: "inch",
      maxObstructionRatio: 0.35,
      minBackFocus: 100,
      backFocusUnits: "mm",
      fullyIlluminatedFieldRadius: 12,
      fieldUnits: "mm",
    },
    coatings: {
      reflectivityPerMirror: 0.9,
      correctorTransmission: 0.9,
    },
    sweep: {
      primaryFRatioMin: 3,
      primaryFRatioMax: 10,
      primaryFRatioStep: 0.25,
      systemFRatioMin: 6,
      systemFRatioMax: 16,
      systemFRatioStep: 0.5,
    },
    weights: {
      usableLight: 0.45,
      aberration: 0.25,
      tubeLength: 0.15,
      obstruction: 0.15,
    },
  };

  const spec = normalizeForDesignKinds(rawSpec);

  return {
    spec,
    topN: 25,
  };
}

export function setAperture(
  state: LabState,
  value: number,
  units: Units,
): LabState {
  const nextSpec = normalizeForDesignKinds({
    ...state.spec,
    aperture: value,
    apertureUnits: units,
  });

  return {
    ...state,
    spec: nextSpec,
  };
}

export function setDesignKinds(
  state: LabState,
  kinds: OpticDesignKind[],
): LabState {
  const nextSpec = normalizeForDesignKinds({
    ...state.spec,
    designKinds: kinds,
  });

  return {
    ...state,
    spec: nextSpec,
  };
}
