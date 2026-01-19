// src/optics/parts/catalog.ts
import type { PartsCatalog } from "./types";

export const partsCatalog: PartsCatalog = {
  focusers: [
    {
      id: "focuser-2in-crayford",
      label: "2in Crayford",
      drawtubeInnerDiameter_mm: 50.8,
      rackedInHeightAboveTube_mm: 55,
      travel_mm: 50,
      minInFocusReserve_mm: 5,
      maxOutFocusReserve_mm: 10,
    },
    {
      id: "focuser-3in-rnp",
      label: "3in Rack & Pinion",
      drawtubeInnerDiameter_mm: 76.2,
      rackedInHeightAboveTube_mm: 70,
      travel_mm: 80,
      minInFocusReserve_mm: 8,
      maxOutFocusReserve_mm: 15,
    },
  ],
  eyepieceStandards: [
    { id: "ep-0_965", label: "0.965in (legacy)", barrelDiameter_mm: 24.5 },
    { id: "ep-1_25", label: "1.25in", barrelDiameter_mm: 31.7 },
    { id: "ep-2in", label: "2in", barrelDiameter_mm: 50.8 },
  ],
};
