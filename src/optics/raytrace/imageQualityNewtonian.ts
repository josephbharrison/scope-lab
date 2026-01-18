import type { ImageQualityResult, NewtonianPrescription, Vec3 } from "./types";
import { dot, normalize, v3 } from "./math";
import { traceNewtonian } from "./trace";

function finiteOr(v: number, fallback: number): number {
  return Number.isFinite(v) ? v : fallback;
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

function planeBasis(nHatIn: Vec3): { u: Vec3; v: Vec3; n: Vec3 } {
  const n = normalize(nHatIn);
  const a = Math.abs(n.z) < 0.9 ? v3(0, 0, 1) : v3(1, 0, 0);
  const u = normalize(cross(a, n));
  const v = normalize(cross(n, u));
  return { u, v, n };
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
      if (x * x + y * y <= radius * radius + 1e-12) out.push({ x, y });
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

function centroid2(points: { a: number; b: number }[]): {
  ca: number;
  cb: number;
} {
  let sa = 0;
  let sb = 0;
  let n = 0;

  for (const p of points) {
    if (!Number.isFinite(p.a) || !Number.isFinite(p.b)) continue;
    sa += p.a;
    sb += p.b;
    n++;
  }

  if (n === 0) return { ca: NaN, cb: NaN };
  return { ca: sa / n, cb: sb / n };
}

function rms2(points: { a: number; b: number }[]): {
  rms: number;
  rmsA: number;
  rmsB: number;
} {
  if (points.length < 3) return { rms: NaN, rmsA: NaN, rmsB: NaN };

  const c = centroid2(points);
  if (!Number.isFinite(c.ca) || !Number.isFinite(c.cb)) {
    return { rms: NaN, rmsA: NaN, rmsB: NaN };
  }

  let sa2 = 0;
  let sb2 = 0;
  let n = 0;

  for (const p of points) {
    if (!Number.isFinite(p.a) || !Number.isFinite(p.b)) continue;
    const da = p.a - c.ca;
    const db = p.b - c.cb;
    sa2 += da * da;
    sb2 += db * db;
    n++;
  }

  if (n < 3) return { rms: NaN, rmsA: NaN, rmsB: NaN };

  const va = sa2 / n;
  const vb = sb2 / n;

  return {
    rms: Math.sqrt(va + vb),
    rmsA: Math.sqrt(va),
    rmsB: Math.sqrt(vb),
  };
}

function spotRmsAtPlane(
  pres: NewtonianPrescription,
  fieldAngle: number,
  planeP0: Vec3,
): { rms: number; rmsU: number; rmsV: number } {
  const samples = pupilSamplesGrid(9, pres.pupilRadius);
  const hits: Vec3[] = [];

  const plane = {
    p0: planeP0,
    nHat: pres.imagePlane.nHat,
    apertureRadius: pres.imagePlane.apertureRadius,
  };
  const b = planeBasis(plane.nHat);

  for (const s of samples) {
    const r = makeRayAtPupil(s.x, s.y, pres.zStart, fieldAngle);
    const p = traceNewtonian(
      { o: r.o, d: r.d },
      pres.primary,
      pres.secondary,
      plane,
    );
    if (p) hits.push(p);
  }

  const uv: { a: number; b: number }[] = [];
  for (const p of hits) {
    const d = { x: p.x - plane.p0.x, y: p.y - plane.p0.y, z: p.z - plane.p0.z };
    uv.push({ a: dot(d, b.u), b: dot(d, b.v) });
  }

  const r = rms2(uv);
  return { rms: r.rms, rmsU: r.rmsA, rmsV: r.rmsB };
}

function bestFocusShift(
  pres: NewtonianPrescription,
  fieldAngle: number,
): { bestShift: number; bestRms: number; bestU: number; bestV: number } {
  const p0 = pres.imagePlane.p0;
  const n = normalize(pres.imagePlane.nHat);
  const step = Math.max(0.5, Math.abs(p0.x) * 1e-4);

  let bestShift = 0;
  let bestRms = NaN;
  let bestU = NaN;
  let bestV = NaN;

  for (let i = -4; i <= 4; i++) {
    const shift = i * step;
    const p = {
      x: p0.x + n.x * shift,
      y: p0.y + n.y * shift,
      z: p0.z + n.z * shift,
    };
    const r = spotRmsAtPlane(pres, fieldAngle, p);
    if (!Number.isFinite(r.rms)) continue;

    if (!Number.isFinite(bestRms) || r.rms < bestRms) {
      bestRms = r.rms;
      bestU = r.rmsU;
      bestV = r.rmsV;
      bestShift = shift;
    }
  }

  return { bestShift, bestRms, bestU, bestV };
}

export function evaluateImageQualityNewtonian(
  _spec: unknown,
  pres: NewtonianPrescription,
  fieldAngle: number,
): ImageQualityResult {
  const onAxis = bestFocusShift(pres, 0);
  const edge = bestFocusShift(pres, fieldAngle);

  return {
    fieldAngle_rad: finiteOr(fieldAngle, 0),
    spotRms_mm_onAxis: finiteOr(onAxis.bestRms, NaN),
    spotRms_mm_edge: finiteOr(edge.bestRms, NaN),
    spotRmsTan_mm_edge: finiteOr(edge.bestU, NaN),
    spotRmsSag_mm_edge: finiteOr(edge.bestV, NaN),
    bestFocusShift_mm_edge: finiteOr(edge.bestShift, NaN),
  };
}
