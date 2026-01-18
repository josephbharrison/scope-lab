// src/optics/raytrace/adapt.ts
import type { ImageQualityResult } from "./types";
import type { ImageQualityMetrics } from "../types";

function finiteOr(v: number, fallback: number): number {
  return Number.isFinite(v) ? v : fallback;
}

function isFinitePos(v: number): boolean {
  return Number.isFinite(v) && v > 0;
}

function airyRadiusMm(F?: number, wavelength_mm = 0.00055): number {
  if (!isFinitePos(F as number)) return NaN;
  return 1.22 * wavelength_mm * (F as number);
}

function strehlFromBlurRatio(blurOverAiry: number): number {
  if (!isFinitePos(blurOverAiry)) return 0;
  const x = 2 * Math.PI * blurOverAiry;
  return Math.exp(-(x * x));
}

export function adaptRaytraceToMetrics(
  iq: ImageQualityResult,
  systemFRatio?: number,
): ImageQualityMetrics {
  const airy = airyRadiusMm(systemFRatio);

  const edge_mm = finiteOr(iq.spotRms_mm_edge, NaN);
  const onAxis_mm = finiteOr(iq.spotRms_mm_onAxis, NaN);
  const tan_mm = finiteOr(iq.spotRmsTan_mm_edge, edge_mm);
  const sag_mm = finiteOr(iq.spotRmsSag_mm_edge, edge_mm);

  const edge = isFinitePos(edge_mm) && isFinitePos(airy) ? edge_mm / airy : NaN;

  const onAxis =
    isFinitePos(onAxis_mm) && isFinitePos(airy) ? onAxis_mm / airy : NaN;

  const tan = isFinitePos(tan_mm) && isFinitePos(airy) ? tan_mm / airy : NaN;

  const sag = isFinitePos(sag_mm) && isFinitePos(airy) ? sag_mm / airy : NaN;

  const astig =
    Number.isFinite(tan) && Number.isFinite(sag) ? Math.abs(tan - sag) : NaN;

  const fieldCurv = finiteOr(Math.abs(iq.bestFocusShift_mm_edge), NaN);

  const wfe =
    Number.isFinite(edge) && Number.isFinite(onAxis)
      ? Math.max(edge, onAxis)
      : Number.isFinite(edge)
        ? edge
        : onAxis;

  return {
    fieldAngle_rad: finiteOr(iq.fieldAngle_rad, 0),

    coma_wfeRms_waves_edge: edge,
    astig_wfeRms_waves_edge: astig,
    fieldCurvature_wfeRms_waves_edge: fieldCurv,
    spherical_wfeRms_waves_edge: onAxis,

    wfeRms_waves_edge: finiteOr(wfe, NaN),
    strehl: strehlFromBlurRatio(edge),
  };
}
