import type { InputSpec } from "../optics/types";

export type LabPreset = {
  id: string;
  label: string;
  description: string;
  spec: InputSpec;
};

export const presets: LabPreset[] = [
  {
    id: "visual-16",
    label: "16-inch Visual Dobsonian",
    description:
      "Large-aperture visual scope prioritizing light grasp and simplicity",
    spec: {
      aperture: 16,
      apertureUnits: "inch",
      targetSystemFRatio: 5,
      designKinds: ["newtonian"],
      constraints: {
        maxTubeLength: 80,
        tubeLengthUnits: "inch",
        maxObstructionRatio: 0.25,
        minBackFocus: 0,
        backFocusUnits: "mm",
        fullyIlluminatedFieldRadius: 10,
        fieldUnits: "mm",
      },
      coatings: {
        reflectivityPerMirror: 0.92,
        correctorTransmission: 1.0,
      },
      sweep: {
        primaryFRatioMin: 4,
        primaryFRatioMax: 6,
        primaryFRatioStep: 0.25,
        systemFRatioMin: 5,
        systemFRatioMax: 5,
        systemFRatioStep: 1,
      },
      weights: {
        usableLight: 0.6,
        aberration: 0.2,
        tubeLength: 0.1,
        obstruction: 0.1,
      },
    },
  },

  {
    id: "imaging-12",
    label: "12-inch Imaging",
    description: "Balanced imaging scope with emphasis on aberration control",
    spec: {
      aperture: 12,
      apertureUnits: "inch",
      targetSystemFRatio: 8,
      designKinds: ["newtonian", "cassegrain", "rc"],
      constraints: {
        maxTubeLength: 60,
        tubeLengthUnits: "inch",
        maxObstructionRatio: 0.35,
        minBackFocus: 100,
        backFocusUnits: "mm",
        fullyIlluminatedFieldRadius: 15,
        fieldUnits: "mm",
      },
      coatings: {
        reflectivityPerMirror: 0.9,
        correctorTransmission: 0.95,
      },
      sweep: {
        primaryFRatioMin: 3,
        primaryFRatioMax: 6,
        primaryFRatioStep: 0.25,
        systemFRatioMin: 6,
        systemFRatioMax: 12,
        systemFRatioStep: 0.5,
      },
      weights: {
        usableLight: 0.35,
        aberration: 0.4,
        tubeLength: 0.15,
        obstruction: 0.1,
      },
    },
  },

  {
    id: "large-aperture-constrained",
    label: "36-inch Length-Constrained",
    description: "Extreme aperture under strict tube length constraints",
    spec: {
      aperture: 36,
      apertureUnits: "inch",
      targetSystemFRatio: 10,
      designKinds: ["newtonian", "cassegrain", "rc", "sct"],
      constraints: {
        maxTubeLength: 72,
        tubeLengthUnits: "inch",
        maxObstructionRatio: 0.4,
        minBackFocus: 150,
        backFocusUnits: "mm",
        fullyIlluminatedFieldRadius: 12,
        fieldUnits: "mm",
      },
      coatings: {
        reflectivityPerMirror: 0.92,
        correctorTransmission: 0.9,
      },
      sweep: {
        primaryFRatioMin: 2.5,
        primaryFRatioMax: 6,
        primaryFRatioStep: 0.25,
        systemFRatioMin: 8,
        systemFRatioMax: 16,
        systemFRatioStep: 1,
      },
      weights: {
        usableLight: 0.3,
        aberration: 0.3,
        tubeLength: 0.25,
        obstruction: 0.15,
      },
    },
  },
];
