// src/optics/raytrace/debugSvg.ts
import type {
  ConicSurface,
  PlaneSurface,
  Ray,
  Vec3,
  NewtonianPrescription,
} from "./types";
import { add, mul, normalize, v3 } from "./math";
import { sagZ, surfaceNormal } from "./surface";
import { intersectConic, intersectPlane, reflect } from "./trace";

type Segment = { a: Vec3; b: Vec3 };

type Bounds = {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
};

function finiteOr(v: number, fallback: number): number {
  return Number.isFinite(v) ? v : fallback;
}

function vMin(a: number, b: number): number {
  return a < b ? a : b;
}

function vMax(a: number, b: number): number {
  return a > b ? a : b;
}

function rayAt(o: Vec3, d: Vec3): Ray {
  return { o, d: normalize(d) };
}

function makeRayAtPupil(
  pupilX: number,
  zStart: number,
  fieldAngle: number,
): Ray {
  const dx = Math.sin(fieldAngle);
  const dz = -Math.cos(fieldAngle);
  return rayAt(v3(pupilX, 0, zStart), v3(dx, 0, dz));
}

function traceNewtonianWithSegments(
  rayIn: Ray,
  primary: ConicSurface,
  secondary: PlaneSurface,
  imagePlane: PlaneSurface,
): { hit: Vec3 | null; segments: Segment[] } {
  const segs: Segment[] = [];
  const ray0: Ray = { o: rayIn.o, d: normalize(rayIn.d) };

  const hit1 = intersectConic(primary, ray0);
  if (!hit1) return { hit: null, segments: segs };
  segs.push({ a: ray0.o, b: hit1.p });

  const n1 = surfaceNormal(primary, hit1.p);
  const d1 = normalize(reflect(ray0.d, n1));
  const ray1: Ray = { o: hit1.p, d: d1 };

  const hit2 = intersectPlane(secondary, ray1);
  if (!hit2) return { hit: null, segments: segs };
  segs.push({ a: ray1.o, b: hit2.p });

  const n2 = normalize(secondary.nHat);
  const d2 = normalize(reflect(ray1.d, n2));
  const ray2: Ray = { o: hit2.p, d: d2 };

  const hit3 = intersectPlane(imagePlane, ray2);
  if (!hit3) return { hit: null, segments: segs };
  segs.push({ a: ray2.o, b: hit3.p });

  return { hit: hit3.p, segments: segs };
}

function sampleConicXZ(surface: ConicSurface, samples: number): Vec3[] {
  const pts: Vec3[] = [];
  const r = surface.apertureRadius;
  const n = Math.max(2, samples | 0);

  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0 : i / (n - 1);
    const x = (t * 2 - 1) * r;
    const z = sagZ(surface, x, 0);
    if (Number.isFinite(z)) pts.push({ x, y: 0, z });
  }

  return pts;
}

function samplePlaneXZ(surface: PlaneSurface, halfLen: number): Vec3[] {
  const n = normalize(surface.nHat);
  const tHat = normalize({ x: n.z, y: 0, z: -n.x });
  const a = add(surface.p0, mul(tHat, -halfLen));
  const b = add(surface.p0, mul(tHat, halfLen));
  return [a, b];
}

function boundsFromPoints(points: Vec3[]): Bounds {
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;

  for (const p of points) {
    if (!Number.isFinite(p.x) || !Number.isFinite(p.z)) continue;
    minX = vMin(minX, p.x);
    maxX = vMax(maxX, p.x);
    minZ = vMin(minZ, p.z);
    maxZ = vMax(maxZ, p.z);
  }

  if (!Number.isFinite(minX)) minX = -1;
  if (!Number.isFinite(maxX)) maxX = 1;
  if (!Number.isFinite(minZ)) minZ = -1;
  if (!Number.isFinite(maxZ)) maxZ = 1;

  return { minX, maxX, minZ, maxZ };
}

function toSvgPoint(
  p: Vec3,
  b: Bounds,
  w: number,
  h: number,
  pad: number,
): { x: number; y: number } {
  const dx = Math.max(1e-12, b.maxX - b.minX);
  const dz = Math.max(1e-12, b.maxZ - b.minZ);

  const sx = (w - 2 * pad) / dx;
  const sz = (h - 2 * pad) / dz;
  const s = Math.min(sx, sz);

  const cx = 0.5 * (b.minX + b.maxX);
  const cz = 0.5 * (b.minZ + b.maxZ);

  const x = pad + (w - 2 * pad) * 0.5 + (p.x - cx) * s;
  const y = h - (pad + (h - 2 * pad) * 0.5 + (p.z - cz) * s);

  return { x, y };
}

function polyline(
  points: Vec3[],
  b: Bounds,
  w: number,
  h: number,
  pad: number,
): string {
  const pts = points
    .map((p) => {
      const q = toSvgPoint(p, b, w, h, pad);
      return `${q.x.toFixed(2)},${q.y.toFixed(2)}`;
    })
    .join(" ");
  return pts;
}

export function renderNewtonianCrossSectionSvg(
  pres: NewtonianPrescription,
  fieldAngle: number,
  opts?: {
    width?: number;
    height?: number;
    pad?: number;
    rays?: number;
    conicSamples?: number;
  },
): string {
  const width = finiteOr(opts?.width ?? 1200, 1200);
  const height = finiteOr(opts?.height ?? 600, 600);
  const pad = finiteOr(opts?.pad ?? 30, 30);
  const rays = Math.max(3, (opts?.rays ?? 7) | 0);
  const conicSamples = Math.max(20, (opts?.conicSamples ?? 200) | 0);

  const primaryPts = sampleConicXZ(pres.primary, conicSamples);
  const secPts = samplePlaneXZ(pres.secondary, pres.secondary.apertureRadius);
  const imgPts = samplePlaneXZ(pres.imagePlane, pres.imagePlane.apertureRadius);

  const allPts: Vec3[] = [];
  allPts.push(...primaryPts, ...secPts, ...imgPts);

  const segs: Segment[] = [];
  const pupilR = pres.pupilRadius;
  const xMin = -pupilR;
  const xMax = pupilR;

  for (let i = 0; i < rays; i++) {
    const t = rays === 1 ? 0.5 : i / (rays - 1);
    const px = xMin + t * (xMax - xMin);
    const r = makeRayAtPupil(px, pres.zStart, fieldAngle);
    const tr = traceNewtonianWithSegments(
      r,
      pres.primary,
      pres.secondary,
      pres.imagePlane,
    );
    segs.push(...tr.segments);
    for (const s of tr.segments) {
      allPts.push(s.a, s.b);
    }
  }

  const b = boundsFromPoints(allPts);

  const primaryPath = polyline(primaryPts, b, width, height, pad);
  const secPath = polyline(secPts, b, width, height, pad);
  const imgPath = polyline(imgPts, b, width, height, pad);

  const rayLines = segs
    .map((s) => {
      const a = toSvgPoint(s.a, b, width, height, pad);
      const c = toSvgPoint(s.b, b, width, height, pad);
      return `<line x1="${a.x.toFixed(2)}" y1="${a.y.toFixed(2)}" x2="${c.x.toFixed(2)}" y2="${c.y.toFixed(2)}" stroke="black" stroke-width="1" opacity="0.7" />`;
    })
    .join("\n");

  const axisA = toSvgPoint({ x: 0, y: 0, z: b.minZ }, b, width, height, pad);
  const axisB = toSvgPoint({ x: 0, y: 0, z: b.maxZ }, b, width, height, pad);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect x="0" y="0" width="${width}" height="${height}" fill="white" />
  <line x1="${axisA.x.toFixed(2)}" y1="${axisA.y.toFixed(2)}" x2="${axisB.x.toFixed(2)}" y2="${axisB.y.toFixed(2)}" stroke="#999" stroke-width="1" stroke-dasharray="4 4" />
  <polyline points="${primaryPath}" fill="none" stroke="black" stroke-width="2" />
  <polyline points="${secPath}" fill="none" stroke="black" stroke-width="2" />
  <polyline points="${imgPath}" fill="none" stroke="black" stroke-width="2" />
  ${rayLines}
</svg>`;
}
