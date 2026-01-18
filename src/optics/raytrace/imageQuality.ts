// src/optics/raytrace/imageQuality.ts
import type { ImageQualityResult, TwoMirrorPrescription, Vec3 } from "./types";
import { normalize, v3 } from "./math";
import { traceTwoMirror } from "./trace";

function finiteOr(v: number, fallback: number): number {
  return Number.isFinite(v) ? v : fallback;
}

function pupilSamplesGrid(
  n: number,
  radius: number,
): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  const steps = Math.max(1, n);

  for (let iy = 0; iy < steps; iy++) {
    const fy = steps === 1 ? 0 : (iy / (steps - 1)) * 2 - 1;
    for (let ix = 0; ix < steps; ix++) {
      const fx = steps === 1 ? 0 : (ix / (steps - 1)) * 2 - 1;
      const x = fx * radius;
      const y = fy * radius;
      if (x * x + y * y <= radius * radius + 1e-12) {
        out.push({ x, y });
      }
    }
  }

  if (out.length === 0) out.push({ x: 0, y: 0 });
  return out;
}

function makeRayAtPupil(
  pupilX: number,
  pupilY: number,
  zStart: number,
  fieldAngle: number,
): { o: Vec3; d: Vec3 } {
  const dx = Math.sin(fieldAngle);
  const dz = Math.cos(fieldAngle);

  return {
    o: v3(pupilX, pupilY, zStart),
    d: normalize(v3(dx, 0, dz)),
  };
}

function centroid(points: Vec3[]): { cx: number; cy: number } {
  let sx = 0;
  let sy = 0;
  let n = 0;

  for (const p of points) {
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) continue;
    sx += p.x;
    sy += p.y;
    n++;
  }

  if (n === 0) return { cx: NaN, cy: NaN };
  return { cx: sx / n, cy: sy / n };
}

function rmsXY(points: Vec3[]): { rms: number; rmsX: number; rmsY: number } {
  if (points.length < 3) {
    return { rms: NaN, rmsX: NaN, rmsY: NaN };
  }

  const c = centroid(points);
  if (!Number.isFinite(c.cx) || !Number.isFinite(c.cy)) {
    return { rms: NaN, rmsX: NaN, rmsY: NaN };
  }

  let sx2 = 0;
  let sy2 = 0;
  let n = 0;

  for (const p of points) {
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) continue;
    const dx = p.x - c.cx;
    const dy = p.y - c.cy;
    sx2 += dx * dx;
    sy2 += dy * dy;
    n++;
  }

  if (n < 3) return { rms: NaN, rmsX: NaN, rmsY: NaN };

  const vx = sx2 / n;
  const vy = sy2 / n;

  return {
    rms: Math.sqrt(vx + vy),
    rmsX: Math.sqrt(vx),
    rmsY: Math.sqrt(vy),
  };
}

function spotRmsAtPlane(
  pres: TwoMirrorPrescription,
  fieldAngle: number,
  imagePlaneZ: number,
): { rms: number; rmsX: number; rmsY: number } {
  const samples = pupilSamplesGrid(9, pres.pupilRadius);
  const hits: Vec3[] = [];

  for (const s of samples) {
    const r = makeRayAtPupil(s.x, s.y, pres.zStart, fieldAngle);
    const p = traceTwoMirror(
      { o: r.o, d: r.d },
      pres.primary,
      pres.secondary,
      imagePlaneZ,
    );
    if (p) hits.push(p);
  }

  return rmsXY(hits);
}

function bestFocusShift(
  pres: TwoMirrorPrescription,
  fieldAngle: number,
): { bestZ: number; bestRms: number; bestRmsX: number; bestRmsY: number } {
  const z0 = pres.imagePlaneZ;
  const dz = Math.max(0.5, Math.abs(z0) * 1e-4);

  let bestZ = z0;
  let bestRms = NaN;
  let bestRmsX = NaN;
  let bestRmsY = NaN;

  for (let i = -4; i <= 4; i++) {
    const z = z0 + i * dz;
    const r = spotRmsAtPlane(pres, fieldAngle, z);

    if (!Number.isFinite(r.rms)) continue;

    if (!Number.isFinite(bestRms) || r.rms < bestRms) {
      bestRms = r.rms;
      bestRmsX = r.rmsX;
      bestRmsY = r.rmsY;
      bestZ = z;
    }
  }

  return {
    bestZ,
    bestRms,
    bestRmsX,
    bestRmsY,
  };
}

export function evaluateImageQualityTwoMirror(
  _spec: unknown,
  pres: TwoMirrorPrescription,
  fieldAngle: number,
): ImageQualityResult {
  const onAxis = bestFocusShift(pres, 0);
  const edge = bestFocusShift(pres, fieldAngle);

  return {
    fieldAngle_rad: finiteOr(fieldAngle, 0),
    spotRms_mm_onAxis: finiteOr(onAxis.bestRms, NaN),
    spotRms_mm_edge: finiteOr(edge.bestRms, NaN),
    spotRmsTan_mm_edge: finiteOr(edge.bestRmsX, NaN),
    spotRmsSag_mm_edge: finiteOr(edge.bestRmsY, NaN),
    bestFocusShift_mm_edge: finiteOr(edge.bestZ - pres.imagePlaneZ, NaN),
  };
}
