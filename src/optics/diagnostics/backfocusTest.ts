// src/optics/diagnostics/backfocusTest.ts
import type { TwoMirrorPrescription, Vec3 } from "../raytrace/types";
import { v3, normalize } from "../raytrace/math";
import { intersectConic, propagateToPlaneZ, reflect } from "../raytrace/trace";
import { surfaceNormal } from "../raytrace/surface";

export type BackfocusTraceCounts = {
  samples: number;
  hitPrimary: number;
  hitSecondary: number;
  hitPlane: number;
  negTSecondary: number;
  negTPlane: number;
  nanHits: number;
};

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
  return { o: v3(pupilX, pupilY, zStart), d: normalize(v3(dx, 0, dz)) };
}

export function traceCountsTwoMirror(
  pres: TwoMirrorPrescription,
  fieldAngle: number,
  gridN = 9,
): BackfocusTraceCounts {
  const samples = pupilSamplesGrid(gridN, pres.pupilRadius);

  let hitPrimary = 0;
  let hitSecondary = 0;
  let hitPlane = 0;
  let negTSecondary = 0;
  let negTPlane = 0;
  let nanHits = 0;

  for (const s of samples) {
    const r0 = makeRayAtPupil(s.x, s.y, pres.zStart, fieldAngle);

    const h1 = intersectConic(pres.primary, { o: r0.o, d: r0.d });
    if (!h1) continue;
    hitPrimary++;

    const n1 = surfaceNormal(pres.primary, h1.p);
    const d1 = normalize(reflect(normalize(r0.d), n1));
    const r1 = { o: h1.p, d: d1 };

    const h2 = intersectConic(pres.secondary, r1);
    if (!h2) continue;
    hitSecondary++;
    if (h2.t < 0) negTSecondary++;

    const n2 = surfaceNormal(pres.secondary, h2.p);
    const d2 = normalize(reflect(normalize(r1.d), n2));
    const r2 = { o: h2.p, d: d2 };

    const p = propagateToPlaneZ(r2, pres.imagePlaneZ);
    if (!p) continue;

    const dz = r2.d.z;
    const tPlane =
      Math.abs(dz) < 1e-12 ? NaN : (pres.imagePlaneZ - r2.o.z) / dz;
    if (Number.isFinite(tPlane) && tPlane < 0) negTPlane++;

    if (
      !Number.isFinite(p.x) ||
      !Number.isFinite(p.y) ||
      !Number.isFinite(p.z)
    ) {
      nanHits++;
      continue;
    }

    hitPlane++;
  }

  return {
    samples: samples.length,
    hitPrimary,
    hitSecondary,
    hitPlane,
    negTSecondary,
    negTPlane,
    nanHits,
  };
}
