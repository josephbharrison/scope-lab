// src/optics/designs/types.ts
import type { InputSpec, Candidate, DesignParams } from "../types";
import type { OpticalSimulator, SampleSpec } from "../plan/types";

export type DesignContext = {
  simulator: OpticalSimulator;
  scoringSampleSpec: SampleSpec;
};

export type DesignGenerator = (
  spec: InputSpec,
  params: DesignParams,
  ctx: DesignContext,
) => Candidate | null;
