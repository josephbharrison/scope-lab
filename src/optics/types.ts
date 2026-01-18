// src/optics/types.ts
export type OpticDesignKind = "newtonian" | "cassegrain" | "sct" | "rc";

export type Units = "mm" | "inch";

export type ControlMode = "design" | "sweep";

export type ConstraintSpec = {
  maxTubeLength: number;
  tubeLengthUnits: Units;
  maxObstructionRatio: number;
  minBackFocus: number;
  backFocusUnits: Units;
  fullyIlluminatedFieldRadius: number;
  fieldUnits: Units;
};

export type CoatingSpec = {
  reflectivityPerMirror?: number;
  correctorTransmission?: number;
};

export type SweepSpec = {
  primaryFRatioMin: number;
  primaryFRatioMax: number;
  primaryFRatioStep: number;
  systemFRatioMin: number;
  systemFRatioMax: number;
  systemFRatioStep: number;
};

export type WeightSpec = {
  usableLight: number;
  aberration: number;
  obstruction: number;
};

export type DerivedLimits = {
  primaryFRatio?: {
    min: number;
    max: number;
  };
  systemFRatio?: {
    min: number;
    max: number;
  };
};

export type InputSpec = {
  aperture: number;
  apertureUnits: Units;
  targetSystemFRatio: number;
  designKinds: OpticDesignKind[];
  controlMode: ControlMode;
  constraints: ConstraintSpec;
  coatings: CoatingSpec;
  sweep: SweepSpec;
  weights: WeightSpec;
  derivedLimits?: DerivedLimits;
};

export type GeometryMetrics = {
  tubeLength_mm: number;
  backFocus_mm: number;
  secondaryDiameter_mm: number;
  obstructionRatio: number;
};

export type ThroughputMetrics = {
  primaryArea_mm2: number;
  effectiveArea_mm2: number;
  usableLightEfficiency: number;
  mirrorCount: number;
  transmissionFactor: number;
};

export type ImageQualityMetrics = {
  fieldAngle_rad: number;
  coma_wfeRms_waves_edge: number;
  astig_wfeRms_waves_edge: number;
  fieldCurvature_wfeRms_waves_edge: number;
  spherical_wfeRms_waves_edge: number;
  wfeRms_waves_edge: number;
  strehl: number;
};

export type ScoreBreakdown = {
  usableLight: number;
  aberration: number;
  obstruction: number;
};

export type ScoreResult = {
  total: number;
  terms: ScoreBreakdown;
};

export type ConstraintResult = {
  pass: boolean;
  reasons: string[];
};

export type Candidate = {
  id: string;
  kind: OpticDesignKind;
  inputs: {
    aperture_mm: number;
    primaryFRatio: number;
    systemFRatio: number;
    primaryFocalLength_mm: number;
    systemFocalLength_mm: number;
  };
  geometry: GeometryMetrics;
  throughput: ThroughputMetrics;
  aberrations: ImageQualityMetrics;
  constraints: ConstraintResult;
  score: ScoreResult;
};

export type DesignParams = {
  primaryFRatio: number;
  systemFRatio: number;
};

export type DesignGenerator = (
  spec: InputSpec,
  params: DesignParams,
) => Candidate | null;
