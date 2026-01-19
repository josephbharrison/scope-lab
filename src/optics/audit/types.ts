// src/optics/audit/types.ts
import type { ImageQualityResult, SampleSpec } from "../plan/types";

export type SimulationAudit = {
  scoringSampleSpec: SampleSpec;
  imageQuality: ImageQualityResult[];
};
