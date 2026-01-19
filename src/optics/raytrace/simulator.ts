// src/optics/raytrace/simulator.ts
import type {
  ImageQualityResult,
  OpticalPlan,
  OpticalSimulator,
  SampleSpec,
  SimulationResult,
  Surface,
  SurfaceConic,
  SurfacePlane,
  TraceRay,
  TraceSegment,
  Vec3 as PlanVec3,
} from "../plan/types";

import type { ConicSurface, PlaneSurface, Ray, Vec3 } from "./types";
import { add, dot, mul, normalize, planeBasis, sub } from "./math";
import {
  intersectConic,
  intersectPlane,
  reflect,
  surfaceNormalConic,
} from "./trace";

function toRayVec3(p: PlanVec3): Vec3 {
  return { x: p.x, y: p.y, z: p.z };
}

function toPlanVec3(p: Vec3): PlanVec3 {
  return { x: p.x, y: p.y, z: p.z };
}

function toConicSurface(s: SurfaceConic): ConicSurface {
  return {
    z0: s.z0_mm,
    R: s.R_mm,
    K: s.K,
    sagSign: s.sagSign,
    apertureRadius: s.aperture.radius_mm,
  };
}

function toPlaneSurface(s: SurfacePlane): PlaneSurface {
  return {
    p0: toRayVec3(s.p0_mm),
    nHat: toRayVec3(s.nHat),
    apertureRadius: s.aperture.radius_mm,
  };
}

function pupilSamplesGrid(
  steps: number,
  radius_mm: number,
): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  const n = Math.max(1, steps | 0);

  for (let iy = 0; iy < n; iy++) {
    const fy = n === 1 ? 0 : (iy / (n - 1)) * 2 - 1;
    for (let ix = 0; ix < n; ix++) {
      const fx = n === 1 ? 0 : (ix / (n - 1)) * 2 - 1;
      const x = fx * radius_mm;
      const y = fy * radius_mm;
      if (x * x + y * y <= radius_mm * radius_mm + 1e-12) out.push({ x, y });
    }
  }

  if (out.length === 0) out.push({ x: 0, y: 0 });
  return out;
}

function pickRays(
  samples: { x: number; y: number }[],
  count: number,
): { x: number; y: number }[] {
  const n = Math.max(1, count | 0);
  if (samples.length <= n) return samples.slice();
  const out: { x: number; y: number }[] = [];
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0 : i / (n - 1);
    const j = Math.min(
      samples.length - 1,
      Math.max(0, Math.round(t * (samples.length - 1))),
    );
    out.push(samples[j]);
  }
  return out;
}

type Hit = { t: number; p: Vec3 };

type RuntimeSurface =
  | {
    id: string;
    kind: "conic";
    material: Surface["material"];
    s: ConicSurface;
  }
  | {
    id: string;
    kind: "plane";
    material: Surface["material"];
    s: PlaneSurface;
  };

function buildRuntimeSurfaces(
  plan: OpticalPlan,
  sensorPlane: SurfacePlane,
): RuntimeSurface[] {
  const out: RuntimeSurface[] = [];

  for (const s of plan.surfaces) {
    if (s.kind === "conic") {
      out.push({
        id: s.id,
        kind: "conic",
        material: s.material,
        s: toConicSurface(s),
      });
    } else {
      out.push({
        id: s.id,
        kind: "plane",
        material: s.material,
        s: toPlaneSurface(s),
      });
    }
  }

  out.push({
    id: plan.sensor.id,
    kind: "plane",
    material: sensorPlane.material,
    s: toPlaneSurface(sensorPlane),
  });

  return out;
}

function intersectRuntimeSurface(rs: RuntimeSurface, ray: Ray): Hit | null {
  if (rs.kind === "conic") return intersectConic(rs.s, ray);
  return intersectPlane(rs.s, ray);
}

function shiftPlane(surface: SurfacePlane, shift_mm: number): SurfacePlane {
  const n = normalize(toRayVec3(surface.nHat));
  return {
    ...surface,
    p0_mm: toPlanVec3(add(toRayVec3(surface.p0_mm), mul(n, shift_mm))),
  };
}

function traceHitPoint(
  plan: OpticalPlan,
  fieldAngle_rad: number,
  pupil: { x: number; y: number },
  sampleSpec: SampleSpec,
  sensorPlane: SurfacePlane,
): { hitPoint?: Vec3 } {
  const o0: Vec3 = { x: pupil.x, y: pupil.y, z: plan.entrance.zStart_mm };
  const d0 = normalize({
    x: Math.sin(fieldAngle_rad),
    y: 0,
    z: Math.cos(fieldAngle_rad),
  });

  let ray: Ray = { o: o0, d: d0 };

  const surfaces = buildRuntimeSurfaces(plan, sensorPlane);
  let sensorHitPoint: Vec3 | undefined;

  for (
    let bounce = 0;
    bounce < Math.max(1, sampleSpec.maxBounces | 0);
    bounce++
  ) {
    let bestT = Infinity;
    let bestP: Vec3 | null = null;
    let bestS: RuntimeSurface | null = null;

    for (const s of surfaces) {
      const hit = intersectRuntimeSurface(s, ray);
      if (!hit) continue;
      if (!(hit.t > 1e-9) || !Number.isFinite(hit.t)) continue;
      if (hit.t < bestT) {
        bestT = hit.t;
        bestP = hit.p;
        bestS = s;
      }
    }

    if (!bestP || !bestS) break;

    if (bestS.id === plan.sensor.id) {
      sensorHitPoint = bestP;
      break;
    }

    if (bestS.material.kind === "absorber") break;

    if (bestS.material.kind === "reflector") {
      const nHat =
        bestS.kind === "conic"
          ? surfaceNormalConic(bestS.s, bestP)
          : normalize(bestS.s.nHat);

      const dNext = normalize(reflect(ray.d, nHat));
      ray = { o: bestP, d: dNext };
      continue;
    }

    ray = { o: bestP, d: ray.d };
  }

  return { hitPoint: sensorHitPoint };
}

function traceOneRayFocused(
  plan: OpticalPlan,
  fieldAngle_rad: number,
  pupil: { x: number; y: number },
  sampleSpec: SampleSpec,
  sensorPlane: SurfacePlane,
): { ray: TraceRay } {
  const o0: Vec3 = { x: pupil.x, y: pupil.y, z: plan.entrance.zStart_mm };
  const d0 = normalize({
    x: Math.sin(fieldAngle_rad),
    y: 0,
    z: Math.cos(fieldAngle_rad),
  });

  let ray: Ray = { o: o0, d: d0 };

  const segments: TraceSegment[] = [];
  const surfaces = buildRuntimeSurfaces(plan, sensorPlane);

  let hitSensor = false;
  let sensorHitPoint_mm: PlanVec3 | undefined;

  for (
    let bounce = 0;
    bounce < Math.max(1, sampleSpec.maxBounces | 0);
    bounce++
  ) {
    let bestT = Infinity;
    let bestP: Vec3 | null = null;
    let bestS: RuntimeSurface | null = null;

    for (const s of surfaces) {
      const hit = intersectRuntimeSurface(s, ray);
      if (!hit) continue;
      if (!(hit.t > 1e-9) || !Number.isFinite(hit.t)) continue;
      if (hit.t < bestT) {
        bestT = hit.t;
        bestP = hit.p;
        bestS = s;
      }
    }

    if (!bestP || !bestS) break;

    segments.push({
      a: toPlanVec3(ray.o),
      b: toPlanVec3(bestP),
      surfaceId: bestS.id,
    });

    if (bestS.id === plan.sensor.id) {
      hitSensor = true;
      sensorHitPoint_mm = toPlanVec3(bestP);
      break;
    }

    if (bestS.material.kind === "absorber") break;

    if (bestS.material.kind === "reflector") {
      const nHat =
        bestS.kind === "conic"
          ? surfaceNormalConic(bestS.s, bestP)
          : normalize(bestS.s.nHat);

      const dNext = normalize(reflect(ray.d, nHat));
      ray = { o: bestP, d: dNext };
      continue;
    }

    ray = { o: bestP, d: ray.d };
  }

  return {
    ray: {
      fieldAngle_rad,
      pupil: { x_mm: pupil.x, y_mm: pupil.y },
      segments,
      hitSensor,
      sensorHitPoint_mm,
    },
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

  return { rms: Math.sqrt(va + vb), rmsA: Math.sqrt(va), rmsB: Math.sqrt(vb) };
}

function rmsAtPlane(
  plan: OpticalPlan,
  fieldAngle_rad: number,
  pupil: { x: number; y: number }[],
  sampleSpec: SampleSpec,
  sensorPlane: SurfacePlane,
): { rms: number; rmsA: number; rmsB: number } {
  const basis = planeBasis(toRayVec3(sensorPlane.nHat));
  const origin = toRayVec3(sensorPlane.p0_mm);
  const hitsUV: { a: number; b: number }[] = [];

  for (const p of pupil) {
    const tr = traceHitPoint(plan, fieldAngle_rad, p, sampleSpec, sensorPlane);
    if (tr.hitPoint) {
      const d = sub(tr.hitPoint, origin);
      hitsUV.push({ a: dot(d, basis.u), b: dot(d, basis.v) });
    }
  }

  return rms2(hitsUV);
}

function bestFocusForField(
  plan: OpticalPlan,
  fieldAngle_rad: number,
  pupil: { x: number; y: number }[],
  sampleSpec: SampleSpec,
): {
  bestShift_mm: number;
  bestPlane: SurfacePlane;
  bestRms: { rms: number; rmsA: number; rmsB: number };
} {
  const sensor0 = plan.sensor.plane;
  const n = normalize(toRayVec3(sensor0.nHat));
  const z0 = dot(toRayVec3(sensor0.p0_mm), n);
  const step = Math.max(0.5, Math.abs(z0) * 1e-4);

  let bestShift_mm = 0;
  let bestRms = { rms: NaN, rmsA: NaN, rmsB: NaN };

  for (let i = -4; i <= 4; i++) {
    const shift = i * step;
    const plane = shiftPlane(sensor0, shift);
    const r = rmsAtPlane(plan, fieldAngle_rad, pupil, sampleSpec, plane);

    if (!Number.isFinite(r.rms)) continue;
    if (!Number.isFinite(bestRms.rms) || r.rms < bestRms.rms) {
      bestRms = r;
      bestShift_mm = shift;
    }
  }

  return {
    bestShift_mm,
    bestPlane: shiftPlane(sensor0, bestShift_mm),
    bestRms,
  };
}

export function createRaytraceSimulator(): OpticalSimulator {
  return {
    simulate(plan: OpticalPlan, sampleSpec: SampleSpec): SimulationResult {
      const pupilAll = pupilSamplesGrid(
        sampleSpec.pupil.steps,
        plan.entrance.pupilRadius_mm,
      );
      const pupil = pickRays(pupilAll, sampleSpec.raysPerField);

      const rays: TraceRay[] = [];
      const imageQuality: ImageQualityResult[] = [];

      for (const fieldAngle_rad of plan.entrance.fieldAngles_rad) {
        const best = bestFocusForField(plan, fieldAngle_rad, pupil, sampleSpec);

        for (const p of pupil) {
          const tr = traceOneRayFocused(
            plan,
            fieldAngle_rad,
            p,
            sampleSpec,
            best.bestPlane,
          );
          rays.push(tr.ray);
        }

        imageQuality.push({
          fieldAngle_rad,
          spotRms_mm: best.bestRms.rms,
          spotRmsU_mm: best.bestRms.rmsA,
          spotRmsV_mm: best.bestRms.rmsB,
          bestFocusShift_mm: best.bestShift_mm,
        });
      }

      return { traces: { rays }, imageQuality };
    },
  };
}
