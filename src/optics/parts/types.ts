// src/optics/parts/types.ts

export type FocuserPart = {
  id: string;
  label: string;
  drawtubeInnerDiameter_mm: number;
  rackedInHeightAboveTube_mm: number;
  travel_mm: number;
  minInFocusReserve_mm: number;
  maxOutFocusReserve_mm: number;
};

export type EyepieceStandard = {
  id: string;
  label: string;
  barrelDiameter_mm: number;
};

export type PartsCatalog = {
  focusers: FocuserPart[];
  eyepieceStandards: EyepieceStandard[];
};
