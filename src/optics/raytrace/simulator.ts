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
    innerApertureRadius: s.aperture.innerRadius_mm,
  };
}

function toPlaneSurface(s: SurfacePlane): PlaneSurface {
  return {
    p0: toRayVec3(s.p0_mm),
    nHat: toRayVec3(s.nHat),
    apertureRadius: s.aperture.radius_mm,
    innerApertureRadius: s.aperture.innerRadius_mm,
  };
}

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
    out.push(
      s.kind === "conic"
        ? {
          id: s.id,
          kind: "conic",
          material: s.material,
          s: toConicSurface(s),
        }
        : {
          id: s.id,
          kind: "plane",
          material: s.material,
          s: toPlaneSurface(s),
        },
    );
  }

  out.push({
    id: plan.sensor.id,
    kind: "plane",
    material: sensorPlane.material,
    s: toPlaneSurface(sensorPlane),
  });

  return out;
}

function intersectRuntimeSurface(
  rs: RuntimeSurface,
  ray: Ray,
): { t: number; p: Vec3 } | null {
  return rs.kind === "conic"
    ? intersectConic(rs.s, ray)
    : intersectPlane(rs.s, ray);
}

function nudgeOrigin(p: Vec3, d: Vec3): Vec3 {
  return add(p, mul(d, 1e-6));
}

function traceRayCore(
  plan: OpticalPlan,
  fieldAngle_rad: number,
  pupil: { x: number; y: number },
  sampleSpec: SampleSpec,
  sensorPlane: SurfacePlane,
  record: boolean,
): { ray?: TraceRay; hitPoint?: Vec3 } {
  const o0: Vec3 = { x: pupil.x, y: pupil.y, z: plan.entrance.zStart_mm };
  const d0 = normalize({
    x: Math.sin(fieldAngle_rad),
    y: 0,
    z: Math.cos(fieldAngle_rad),
  });

  let ray: Ray = { o: o0, d: d0 };
  let lastSurfaceId: string | null = null;

  const segments: TraceSegment[] = [];
  const surfaces = buildRuntimeSurfaces(plan, sensorPlane);

  for (let bounce = 0; bounce < sampleSpec.maxBounces; bounce++) {
    let bestT = Infinity;
    let bestP: Vec3 | null = null;
    let bestS: RuntimeSurface | null = null;

    for (const s of surfaces) {
      if (s.id === lastSurfaceId) continue;

      const hit = intersectRuntimeSurface(s, ray);
      if (!hit || hit.t <= 1e-9) continue;

      if (hit.t < bestT) {
        bestT = hit.t;
        bestP = hit.p;
        bestS = s;
      }
    }

    if (!bestP || !bestS) break;

    if (record) {
      segments.push({
        a: toPlanVec3(ray.o),
        b: toPlanVec3(bestP),
        surfaceId: bestS.id,
      });
    }

    if (bestS.id === plan.sensor.id) {
      return record
        ? {
          ray: {
            fieldAngle_rad,
            pupil: { x_mm: pupil.x, y_mm: pupil.y },
            segments,
            hitSensor: true,
            sensorHitPoint_mm: toPlanVec3(bestP),
          },
        }
        : { hitPoint: bestP };
    }

    if (bestS.material.kind !== "reflector") break;

    const nHat =
      bestS.kind === "conic"
        ? surfaceNormalConic(bestS.s, bestP)
        : normalize(bestS.s.nHat);

    const dNext = normalize(reflect(ray.d, nHat));
    ray = { o: nudgeOrigin(bestP, dNext), d: dNext };
    lastSurfaceId = bestS.id;
  }

  return record
    ? {
      ray: {
        fieldAngle_rad,
        pupil: { x_mm: pupil.x, y_mm: pupil.y },
        segments,
        hitSensor: false,
      },
    }
    : {};
}

function shiftPlane(surface: SurfacePlane, shift_mm: number): SurfacePlane {
  const n = normalize(toRayVec3(surface.nHat));
  return {
    ...surface,
    p0_mm: toPlanVec3(add(toRayVec3(surface.p0_mm), mul(n, shift_mm))),
  };
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
  const hits: { a: number; b: number }[] = [];

  for (const p of pupil) {
    const h = traceRayCore(
      plan,
      fieldAngle_rad,
      p,
      sampleSpec,
      sensorPlane,
      false,
    ).hitPoint;
    if (!h) continue;

    const d = sub(h, origin);
    hits.push({ a: dot(d, basis.u), b: dot(d, basis.v) });
  }

  if (hits.length < 3) return { rms: NaN, rmsA: NaN, rmsB: NaN };

  let sa = 0,
    sb = 0;
  for (const h of hits) {
    sa += h.a;
    sb += h.b;
  }
  const ca = sa / hits.length;
  const cb = sb / hits.length;

  let va = 0,
    vb = 0;
  for (const h of hits) {
    va += (h.a - ca) ** 2;
    vb += (h.b - cb) ** 2;
  }

  return {
    rms: Math.sqrt((va + vb) / hits.length),
    rmsA: Math.sqrt(va / hits.length),
    rmsB: Math.sqrt(vb / hits.length),
  };
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
      const pupil: { x: number; y: number }[] = [];
      const r = plan.entrance.pupilRadius_mm;
      const n = Math.max(1, sampleSpec.pupil.steps | 0);

      for (let iy = 0; iy < n; iy++) {
        for (let ix = 0; ix < n; ix++) {
          const x = ((ix / (n - 1)) * 2 - 1) * r;
          const y = ((iy / (n - 1)) * 2 - 1) * r;
          if (x * x + y * y <= r * r) pupil.push({ x, y });
        }
      }

      const rays: TraceRay[] = [];
      const imageQuality: ImageQualityResult[] = [];

      for (const fieldAngle_rad of plan.entrance.fieldAngles_rad) {
        const best = bestFocusForField(plan, fieldAngle_rad, pupil, sampleSpec);

        for (const p of pupil) {
          const r0 = traceRayCore(
            plan,
            fieldAngle_rad,
            p,
            sampleSpec,
            best.bestPlane,
            true,
          );
          if (r0.ray) rays.push(r0.ray);
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
