// src/optics/raytrace/adapt.ts
import type { ImageQualityMetrics } from "../types";
import type { ImageQualityResult } from "../plan/types";

function finiteOr(v: number, fallback: number): number {
  return Number.isFinite(v) ? v : fallback;
}

function isFiniteNonNeg(v: number): boolean {
  return Number.isFinite(v) && v >= 0;
}

function isFinitePos(v: number): boolean {
  return Number.isFinite(v) && v > 0;
}

function airyRadiusMm(F?: number, wavelength_mm = 0.00055): number {
  if (!isFinitePos(F as number)) return NaN;
  return 1.22 * wavelength_mm * (F as number);
}

function strehlFromBlurRatio(blurOverAiry: number): number {
  if (!isFiniteNonNeg(blurOverAiry)) return 0;
  const x = 2 * Math.PI * blurOverAiry;
  return Math.exp(-(x * x));
}

export function adaptRaytraceToMetrics(
  edge: ImageQualityResult,
  systemFRatio?: number,
  onAxis?: ImageQualityResult,
): ImageQualityMetrics {
  const airy = airyRadiusMm(systemFRatio);

  const edge_mm = finiteOr(edge.spotRms_mm, NaN);
  const onAxis_mm = finiteOr(onAxis?.spotRms_mm ?? NaN, NaN);

  const tan_mm = finiteOr(edge.spotRmsU_mm ?? edge_mm, edge_mm);
  const sag_mm = finiteOr(edge.spotRmsV_mm ?? edge_mm, edge_mm);

  const edgeWaves =
    isFiniteNonNeg(edge_mm) && isFinitePos(airy) ? edge_mm / airy : NaN;

  const onAxisWaves =
    isFiniteNonNeg(onAxis_mm) && isFinitePos(airy) ? onAxis_mm / airy : NaN;

  const tan = isFiniteNonNeg(tan_mm) && isFinitePos(airy) ? tan_mm / airy : NaN;

  const sag = isFiniteNonNeg(sag_mm) && isFinitePos(airy) ? sag_mm / airy : NaN;

  const astig =
    Number.isFinite(tan) && Number.isFinite(sag) ? Math.abs(tan - sag) : NaN;

  const fieldCurv = finiteOr(Math.abs(edge.bestFocusShift_mm ?? NaN), NaN);

  const wfe =
    Number.isFinite(edgeWaves) && Number.isFinite(onAxisWaves)
      ? Math.max(edgeWaves, onAxisWaves)
      : Number.isFinite(edgeWaves)
        ? edgeWaves
        : onAxisWaves;

  return {
    fieldAngle_rad: finiteOr(edge.fieldAngle_rad, 0),

    coma_wfeRms_waves_edge: edgeWaves,
    astig_wfeRms_waves_edge: astig,
    fieldCurvature_wfeRms_waves_edge: fieldCurv,
    spherical_wfeRms_waves_edge: onAxisWaves,

    wfeRms_waves_edge: finiteOr(wfe, NaN),
    strehl: strehlFromBlurRatio(edgeWaves),
  };
}
