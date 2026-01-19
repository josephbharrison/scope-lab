// src/optics/fabrication/newtonian.ts
import type { InputSpec } from "../types";
import type { FabricationSpec } from "../fabrication/types";

export function synthesizeNewtonianFabrication(
  spec: InputSpec,
  solved: {
    primaryDiameter_mm: number;
    secondaryMinorAxis_mm: number;
  },
): FabricationSpec {
  const minor = solved.secondaryMinorAxis_mm;
  const major = minor * Math.SQRT2;

  return {
    primary: {
      diameter_mm: solved.primaryDiameter_mm,
      thickness_mm: Math.max(25, 0.12 * solved.primaryDiameter_mm),
    },
    secondary: {
      kind: "flat",
      minorAxis_mm: minor,
      majorAxis_mm: major,
      thickness_mm: Math.max(8, 0.12 * minor),
      tilt_deg: 45,
    },
    spider: {
      vaneCount: 4,
      hubOuterDiameter_mm: Math.max(35, 0.5 * minor),
    },
  };
}
