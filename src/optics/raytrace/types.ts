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
  innerApertureRadius?: number;
};

export type PlaneSurface = {
  p0: Vec3;
  nHat: Vec3;
  apertureRadius: number;
  innerApertureRadius?: number;
};
