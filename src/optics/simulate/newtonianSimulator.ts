// src/optics/simulate/newtonianSimulator.ts
import type {
  OpticalPlan,
  OpticalSimulator,
  SampleSpec,
  SimulationResult,
  TraceRay,
  TraceSegment,
  Vec3,
  Surface,
  SurfaceConic,
  SurfacePlane,
} from "../plan/types";
import type { ConicSurface, PlaneSurface, Ray } from "../raytrace/types";
import { add, mul, normalize, v3 } from "../raytrace/math";
import { surfaceNormal } from "../raytrace/surface";
import { intersectConic, intersectPlane, reflect } from "../raytrace/trace";

function isConic(s: Surface): s is SurfaceConic {
  return s.kind === "conic";
}

function isPlane(s: Surface): s is SurfacePlane {
  return s.kind === "plane";
}

function toRaytraceConic(s: SurfaceConic): ConicSurface {
  return {
    z0: s.z0_mm,
    R: s.R_mm,
    K: s.K,
    sagSign: s.sagSign,
    apertureRadius: s.aperture.radius_mm,
  };
}

function toRaytracePlane(s: SurfacePlane): PlaneSurface {
  return {
    p0: s.p0_mm,
    nHat: s.nHat,
    apertureRadius: s.aperture.radius_mm,
  };
}

function rayAt(o: Vec3, d: Vec3): Ray {
  return { o, d: normalize(d) };
}

function pupilSamplesGrid(
  steps: number,
  radius: number,
): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  const n = Math.max(1, steps | 0);

  for (let iy = 0; iy < n; iy++) {
    const fy = n === 1 ? 0 : (iy / (n - 1)) * 2 - 1;
    for (let ix = 0; ix < n; ix++) {
      const fx = n === 1 ? 0 : (ix / (n - 1)) * 2 - 1;
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
): Ray {
  const dx = Math.sin(fieldAngle);
  const dz = -Math.cos(fieldAngle);
  return rayAt(v3(pupilX, pupilY, zStart), v3(dx, 0, dz));
}

function traceNewtonianSegments(
  rayIn: Ray,
  primary: ConicSurface,
  secondary: PlaneSurface,
  sensor: PlaneSurface,
  maxBounces: number,
): { hit: Vec3 | null; segments: TraceSegment[] } {
  const segs: TraceSegment[] = [];
  let ray = rayAt(rayIn.o, rayIn.d);
  let bounces = 0;

  const hit1 = intersectConic(primary, ray);
  if (!hit1) return { hit: null, segments: segs };
  segs.push({ a: ray.o, b: hit1.p, surfaceId: "primary" });

  const n1 = surfaceNormal(primary, hit1.p);
  const d1 = normalize(reflect(ray.d, n1));
  ray = rayAt(hit1.p, d1);
  bounces++;

  if (bounces > maxBounces) return { hit: null, segments: segs };

  const hit2 = intersectPlane(secondary, ray);
  if (!hit2) return { hit: null, segments: segs };
  segs.push({ a: ray.o, b: hit2.p, surfaceId: "secondary" });

  const n2 = normalize(secondary.nHat);
  const d2 = normalize(reflect(ray.d, n2));
  ray = rayAt(hit2.p, d2);
  bounces++;

  if (bounces > maxBounces) return { hit: null, segments: segs };

  const hit3 = intersectPlane(sensor, ray);
  if (!hit3) return { hit: null, segments: segs };
  segs.push({ a: ray.o, b: hit3.p, surfaceId: "sensor" });

  return { hit: hit3.p, segments: segs };
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
  if (!Number.isFinite(c.ca) || !Number.isFinite(c.cb))
    return { rms: NaN, rmsA: NaN, rmsB: NaN };

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

function cross(a: Vec3, b: Vec3): Vec3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

function dot(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

function planeBasis(nHatIn: Vec3): { u: Vec3; v: Vec3; n: Vec3 } {
  const n = normalize(nHatIn);
  const a = Math.abs(n.z) < 0.9 ? v3(0, 0, 1) : v3(1, 0, 0);
  const u = normalize(cross(a, n));
  const v = normalize(cross(n, u));
  return { u, v, n };
}

function shiftPlane(p: SurfacePlane, shift_mm: number): SurfacePlane {
  const n = normalize(p.nHat);
  return {
    ...p,
    p0_mm: add(p.p0_mm, mul(n, shift_mm)),
  };
}

function spotRmsAtPlane(
  primary: ConicSurface,
  secondary: PlaneSurface,
  sensor: PlaneSurface,
  zStart: number,
  pupilRadius: number,
  fieldAngle: number,
  sampleSteps: number,
  maxBounces: number,
): { rms: number; rmsU: number; rmsV: number } {
  const samples = pupilSamplesGrid(sampleSteps, pupilRadius);
  const hits: Vec3[] = [];
  const b = planeBasis(sensor.nHat);

  for (const s of samples) {
    const r = makeRayAtPupil(s.x, s.y, zStart, fieldAngle);
    const tr = traceNewtonianSegments(
      r,
      primary,
      secondary,
      sensor,
      maxBounces,
    );
    if (tr.hit) hits.push(tr.hit);
  }

  const uv: { a: number; b: number }[] = [];
  for (const p of hits) {
    const d = {
      x: p.x - sensor.p0.x,
      y: p.y - sensor.p0.y,
      z: p.z - sensor.p0.z,
    };
    uv.push({ a: dot(d, b.u), b: dot(d, b.v) });
  }

  const r = rms2(uv);
  return { rms: r.rms, rmsU: r.rmsA, rmsV: r.rmsB };
}

function bestFocusShift(
  primary: ConicSurface,
  secondary: PlaneSurface,
  sensorBase: SurfacePlane,
  zStart: number,
  pupilRadius: number,
  fieldAngle: number,
  sampleSteps: number,
  maxBounces: number,
): { bestShift: number; bestRms: number; bestU: number; bestV: number } {
  const baseP0 = sensorBase.p0_mm;
  const step = Math.max(0.5, Math.abs(baseP0.x) * 1e-4);

  let bestShift = 0;
  let bestRms = NaN;
  let bestU = NaN;
  let bestV = NaN;

  for (let i = -4; i <= 4; i++) {
    const shift = i * step;
    const sensor = toRaytracePlane(shiftPlane(sensorBase, shift));
    const r = spotRmsAtPlane(
      primary,
      secondary,
      sensor,
      zStart,
      pupilRadius,
      fieldAngle,
      sampleSteps,
      maxBounces,
    );

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

function extractNewtonianTriplet(plan: OpticalPlan): {
  primary: SurfaceConic;
  secondary: SurfacePlane;
  sensor: SurfacePlane;
} | null {
  const conics = plan.surfaces.filter(isConic);
  const planes = plan.surfaces.filter(isPlane);

  const primary = conics[0];
  const secondary =
    planes.find((p) => p.material.kind === "reflector") || planes[0];
  const sensor = plan.sensor?.plane;

  if (!primary || !secondary || !sensor) return null;
  return { primary, secondary, sensor };
}

export function createNewtonianSimulator(): OpticalSimulator {
  return {
    simulate(plan: OpticalPlan, sampleSpec: SampleSpec): SimulationResult {
      const triplet = extractNewtonianTriplet(plan);
      if (!triplet) return { traces: { rays: [] }, imageQuality: [] };

      const primary = toRaytraceConic(triplet.primary);
      const secondary = toRaytracePlane(triplet.secondary);
      const sensorBase = triplet.sensor;

      const zStart = plan.entrance.zStart_mm;
      const pupilRadius = plan.entrance.pupilRadius_mm;
      const fieldAngles = plan.entrance.fieldAngles_rad;

      const sampleSteps = Math.max(1, sampleSpec.pupil.steps | 0);
      const maxBounces = Math.max(1, sampleSpec.maxBounces | 0);

      const traces: TraceRay[] = [];

      for (const fa of fieldAngles) {
        const samples = pupilSamplesGrid(sampleSteps, pupilRadius);
        for (const s of samples) {
          const r = makeRayAtPupil(s.x, s.y, zStart, fa);
          const sensor = toRaytracePlane(sensorBase);
          const tr = traceNewtonianSegments(
            r,
            primary,
            secondary,
            sensor,
            maxBounces,
          );

          traces.push({
            fieldAngle_rad: fa,
            pupil: { x_mm: s.x, y_mm: s.y },
            segments: tr.segments,
            hitSensor: !!tr.hit,
            sensorHitPoint_mm: tr.hit || undefined,
          });
        }
      }

      const iq = fieldAngles.map((fa) => {
        const onAxis = bestFocusShift(
          primary,
          secondary,
          sensorBase,
          zStart,
          pupilRadius,
          0,
          sampleSteps,
          maxBounces,
        );
        const edge = bestFocusShift(
          primary,
          secondary,
          sensorBase,
          zStart,
          pupilRadius,
          fa,
          sampleSteps,
          maxBounces,
        );

        const fieldAngle_rad = fa;
        const spotRms_mm = edge.bestRms;
        const bestFocusShift_mm = edge.bestShift;

        return {
          fieldAngle_rad,
          spotRms_mm,
          spotRmsU_mm: edge.bestU,
          spotRmsV_mm: edge.bestV,
          bestFocusShift_mm,
        };
      });

      return {
        traces: { rays: traces },
        imageQuality: iq,
      };
    },
  };
}
