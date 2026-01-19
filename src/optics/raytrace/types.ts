// src/optics/raytrace/types.ts
export type Vec3 = {
  x: number;
  y: number;
  z: number;
};

export type Ray = {
  o: Vec3;
  d: Vec3;
};

export type ConicSurface = {
  z0: number;
  R: number;
  K: number;
  sagSign: -1 | 1;
  apertureRadius: number;
};

export type PlaneSurface = {
  p0: Vec3;
  nHat: Vec3;
  apertureRadius: number;
};

export type TwoMirrorPrescription = {
  primary: ConicSurface;
  secondary: ConicSurface;
  imagePlaneZ: number;
  zStart: number;
  pupilRadius: number;
};

export type ImageQualityResult = {
  fieldAngle_rad: number;
  spotRms_mm_onAxis: number;
  spotRms_mm_edge: number;
  spotRmsTan_mm_edge: number;
  spotRmsSag_mm_edge: number;
  bestFocusShift_mm_edge: number;
};
