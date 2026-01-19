// src/optics/fabrication/types.ts

export type MirrorBlankSpec = {
  diameter_mm: number;
  thickness_mm: number;
  material?: string;
};

export type SecondarySpec = {
  kind: "flat" | "spherical" | "hyperbolic";
  minorAxis_mm: number;
  majorAxis_mm?: number;
  thickness_mm: number;
  tilt_deg?: number;
};

export type SpiderSpec = {
  vaneCount: number;
  hubOuterDiameter_mm: number;
  offset_mm?: number;
};

export type EnclosureSpec = {
  kind: "tube" | "closed-cell";
  innerDiameter_mm?: number;
  length_mm?: number;
  baffleInnerDiameter_mm?: number;
  baffleLength_mm?: number;
  correctorOuterDiameter_mm?: number;
  correctorThickness_mm?: number;
};

export type FabricationSpec = {
  primary: MirrorBlankSpec;
  secondary: SecondarySpec;
  spider?: SpiderSpec;
  enclosure?: EnclosureSpec;
};
