// src/optics/raytrace/debugSvg.ts
import type {
  OpticalPlan,
  OpticalSimulator,
  Surface,
  SurfaceConic,
  SurfacePlane,
  TraceSegment,
  Vec3,
  SampleSpec,
} from "../plan/types";

function finiteOr(v: number, fallback: number): number {
  return Number.isFinite(v) ? v : fallback;
}

function vMin(a: number, b: number): number {
  return a < b ? a : b;
}

function vMax(a: number, b: number): number {
  return a > b ? a : b;
}

function dot(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

function norm(a: Vec3): number {
  return Math.sqrt(dot(a, a));
}

function normalize(a: Vec3): Vec3 {
  const n = norm(a);
  if (!(n > 0) || !Number.isFinite(n)) return { x: 0, y: 0, z: 0 };
  return { x: a.x / n, y: a.y / n, z: a.z / n };
}

function add(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

function mul(a: Vec3, s: number): Vec3 {
  return { x: a.x * s, y: a.y * s, z: a.z * s };
}

function isFiniteVec3(p: Vec3): boolean {
  return Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z);
}

type Bounds = {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
};

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
  return points
    .map((p) => {
      const q = toSvgPoint(p, b, w, h, pad);
      return `${q.x.toFixed(2)},${q.y.toFixed(2)}`;
    })
    .join(" ");
}

function sagConicUnsigned(r: number, R: number, K: number): number {
  const R2 = R * R;
  if (!(R2 > 0) || !Number.isFinite(R2)) return NaN;

  const u = ((1 + K) * (r * r)) / R2;
  const inside = 1 - u;
  if (inside <= 0) return NaN;

  const s = Math.sqrt(inside);

  const absR = Math.abs(R);
  const denom = absR * (1 + s);
  if (!Number.isFinite(denom) || denom === 0) return NaN;

  return (r * r) / denom;
}

function sampleConicXZ(surface: SurfaceConic, samples: number): Vec3[] {
  const pts: Vec3[] = [];
  const rA = surface.aperture.radius_mm;
  const n = Math.max(2, samples | 0);

  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0 : i / (n - 1);
    const x = (t * 2 - 1) * rA;
    const r = Math.abs(x);
    const s = sagConicUnsigned(r, surface.R_mm, surface.K);
    if (!Number.isFinite(s)) continue;
    const z = surface.z0_mm + surface.sagSign * s;
    pts.push({ x, y: 0, z });
  }

  return pts;
}

function samplePlaneXZ(surface: SurfacePlane, halfLen: number): Vec3[] {
  const n = normalize(surface.nHat);
  const tHat = normalize({ x: n.z, y: 0, z: -n.x });
  const a = add(surface.p0_mm, mul(tHat, -halfLen));
  const b = add(surface.p0_mm, mul(tHat, halfLen));
  return [a, b];
}

function surfaceStrokeWidth(surface: Surface): number {
  if (surface.kind === "plane" && surface.material.kind === "absorber")
    return 1;
  return 2;
}

function surfaceOpacity(surface: Surface): number {
  if (surface.material.kind === "absorber") return 0.35;
  if (surface.material.kind === "transmitter") return 0.7;
  return 1.0;
}

export function renderPlanCrossSectionSvg(
  plan: OpticalPlan,
  simulator: OpticalSimulator,
  sampleSpec: SampleSpec,
  opts?: {
    width?: number;
    height?: number;
    pad?: number;
    surfaceSamples?: number;
  },
): string {
  const width = finiteOr(opts?.width ?? 1200, 1200);
  const height = finiteOr(opts?.height ?? 600, 600);
  const pad = finiteOr(opts?.pad ?? 30, 30);
  const surfaceSamples = Math.max(20, (opts?.surfaceSamples ?? 200) | 0);

  const sim = simulator.simulate(plan, sampleSpec);
  const rays = sim.traces?.rays ?? [];

  const surfaceById = new Map<string, Surface>();
  for (const s of plan.surfaces) surfaceById.set(s.id, s);

  const allPts: Vec3[] = [];

  const surfacePolylines: {
    id: string;
    pts: Vec3[];
  }[] = [];

  for (const s of plan.surfaces) {
    if (s.kind === "conic") {
      const pts = sampleConicXZ(s, surfaceSamples);
      surfacePolylines.push({ id: s.id, pts });
      allPts.push(...pts);
    } else {
      const halfLen = s.aperture.radius_mm;
      const pts = samplePlaneXZ(s, halfLen);
      surfacePolylines.push({ id: s.id, pts });
      allPts.push(...pts);
    }
  }

  const sensorPlane = plan.sensor.plane;
  const sensorPts = samplePlaneXZ(sensorPlane, sensorPlane.aperture.radius_mm);
  allPts.push(...sensorPts);

  const segs: TraceSegment[] = [];
  for (const r of rays) {
    for (const s of r.segments) {
      if (!isFiniteVec3(s.a) || !isFiniteVec3(s.b)) continue;
      segs.push(s);
      allPts.push(s.a, s.b);
    }
  }

  const b = boundsFromPoints(allPts);

  const axisA = toSvgPoint({ x: 0, y: 0, z: b.minZ }, b, width, height, pad);
  const axisB = toSvgPoint({ x: 0, y: 0, z: b.maxZ }, b, width, height, pad);

  const sensorPath = polyline(sensorPts, b, width, height, pad);

  const surfacesSvg = surfacePolylines
    .map((sp) => {
      const s = surfaceById.get(sp.id);
      if (!s) return "";
      const pts = polyline(sp.pts, b, width, height, pad);
      const sw = surfaceStrokeWidth(s);
      const op = surfaceOpacity(s);
      return `<polyline points="${pts}" fill="none" stroke="black" stroke-width="${sw}" opacity="${op.toFixed(3)}" />`;
    })
    .join("\n");

  const rayLines = segs
    .map((s) => {
      const a = toSvgPoint(s.a, b, width, height, pad);
      const c = toSvgPoint(s.b, b, width, height, pad);
      return `<line x1="${a.x.toFixed(2)}" y1="${a.y.toFixed(2)}" x2="${c.x.toFixed(2)}" y2="${c.y.toFixed(2)}" stroke="black" stroke-width="1" opacity="0.7" />`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect x="0" y="0" width="${width}" height="${height}" fill="white" />
  <line x1="${axisA.x.toFixed(2)}" y1="${axisA.y.toFixed(2)}" x2="${axisB.x.toFixed(2)}" y2="${axisB.y.toFixed(2)}" stroke="#999" stroke-width="1" stroke-dasharray="4 4" />
  ${surfacesSvg}
  <polyline points="${sensorPath}" fill="none" stroke="black" stroke-width="2" opacity="0.9" />
  ${rayLines}
</svg>`;
}
