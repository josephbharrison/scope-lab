// src/optics/plan/types.ts
export type Vec3 = {
  x: number;
  y: number;
  z: number;
};

export type Aperture = {
  kind: "circle";
  radius_mm: number;
};

export type Material = {
  kind: "reflector" | "transmitter" | "absorber";
  reflectivity?: number;
  transmission?: number;
};

export type SurfaceConic = {
  kind: "conic";
  id: string;
  z0_mm: number;
  R_mm: number;
  K: number;
  sagSign: -1 | 1;
  aperture: Aperture;
  material: Material;
};

export type SurfacePlane = {
  kind: "plane";
  id: string;
  p0_mm: Vec3;
  nHat: Vec3;
  aperture: Aperture;
  material: Material;
};

export type Surface = SurfaceConic | SurfacePlane;

export type EntranceSpec = {
  zStart_mm: number;
  pupilRadius_mm: number;
  fieldAngles_rad: number[];
};

export type SensorSpec = {
  id: string;
  plane: SurfacePlane;
};

export type OpticalPlan = {
  id: string;
  label?: string;
  entrance: EntranceSpec;
  surfaces: Surface[];
  sensor: SensorSpec;
};

export type SampleSpec = {
  pupil: {
    kind: "grid";
    steps: number;
  };
  raysPerField: number;
  maxBounces: number;
};

export type TracePoint = Vec3;

export type TraceSegment = {
  a: Vec3;
  b: Vec3;
  surfaceId?: string;
};

export type TraceRay = {
  fieldAngle_rad: number;
  pupil: { x_mm: number; y_mm: number };
  segments: TraceSegment[];
  hitSensor: boolean;
  sensorHitPoint_mm?: Vec3;
};

export type SimulationTraces = {
  rays: TraceRay[];
};

export type ImageQualityResult = {
  fieldAngle_rad: number;
  spotRms_mm: number;
  spotRmsU_mm?: number;
  spotRmsV_mm?: number;
  bestFocusShift_mm?: number;
};

export type SimulationResult = {
  traces?: SimulationTraces;
  imageQuality?: ImageQualityResult[];
};

export interface OpticalSimulator {
  simulate(plan: OpticalPlan, sampleSpec: SampleSpec): SimulationResult;
}
