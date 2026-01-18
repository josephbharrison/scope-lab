import type { InputSpec, OpticDesignKind, Units } from "../optics/types";

export type LabState = {
  spec: InputSpec;
  topN: number;
};

export function defaultLabState(): LabState {
  const spec: InputSpec = {
    aperture: 12,
    apertureUnits: "inch",
    targetSystemFRatio: 6,
    designKinds: ["newtonian", "cassegrain", "sct", "rc"],
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
  return {
    ...state,
    spec: {
      ...state.spec,
      aperture: value,
      apertureUnits: units,
    },
  };
}

export function setDesignKinds(
  state: LabState,
  kinds: OpticDesignKind[],
): LabState {
  return {
    ...state,
    spec: {
      ...state.spec,
      designKinds: kinds,
    },
  };
}
