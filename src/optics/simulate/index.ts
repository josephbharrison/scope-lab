// src/optics/simulate/index.ts
import type {
  OpticalPlan,
  OpticalSimulator,
  SampleSpec,
  SimulationResult,
} from "../plan/types";

export function simulate(
  plan: OpticalPlan,
  simulator: OpticalSimulator,
  sampleSpec: SampleSpec,
): SimulationResult {
  return simulator.simulate(plan, sampleSpec);
}
