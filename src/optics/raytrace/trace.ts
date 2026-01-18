// src/optics/raytrace/trace.ts
import type { ConicSurface, Ray, Vec3 } from "./types";
import { add, dot, mul, normalize, sub } from "./math";
import { sagZ, dsagdrConicUnsigned, surfaceNormal } from "./surface";

function withinAperture(surface: ConicSurface, p: Vec3): boolean {
  const r2 = p.x * p.x + p.y * p.y;
  return r2 <= surface.apertureRadius * surface.apertureRadius + 1e-12;
}

export function reflect(d: Vec3, nHat: Vec3): Vec3 {
  const dn = dot(d, nHat);
  return sub(d, mul(nHat, 2 * dn));
}

export function intersectConic(
  surface: ConicSurface,
  rayIn: Ray,
): { t: number; p: Vec3 } | null {
  const ray: Ray = { o: rayIn.o, d: normalize(rayIn.d) };

  let t =
    (surface.z0 - ray.o.z) / (Math.abs(ray.d.z) < 1e-12 ? 1e-12 : ray.d.z);

  if (!Number.isFinite(t)) return null;
  if (t < 0) t = 0;

  for (let i = 0; i < 40; i++) {
    const p = add(ray.o, mul(ray.d, t));
    const zSurf = sagZ(surface, p.x, p.y);
    if (!Number.isFinite(zSurf)) return null;

    const f = p.z - zSurf;
    if (Math.abs(f) < 1e-9) {
      if (t < 0) return null;
      const hit = { x: p.x, y: p.y, z: zSurf };
      if (!withinAperture(surface, hit)) return null;
      return { t, p: hit };
    }

    const r = Math.sqrt(p.x * p.x + p.y * p.y);
    let dfdt = ray.d.z;

    if (r > 0) {
      const dsdr = dsagdrConicUnsigned(r, surface.R, surface.K);
      if (!Number.isFinite(dsdr)) return null;

      const drdt = (p.x / r) * ray.d.x + (p.y / r) * ray.d.y;
      dfdt -= surface.sagSign * dsdr * drdt;
    }

    if (!Number.isFinite(dfdt) || Math.abs(dfdt) < 1e-12) return null;

    t -= f / dfdt;
    if (!Number.isFinite(t)) return null;
  }

  return null;
}

export function propagateToPlaneZ(rayIn: Ray, z: number): Vec3 | null {
  const ray: Ray = { o: rayIn.o, d: normalize(rayIn.d) };
  if (Math.abs(ray.d.z) < 1e-12) return null;

  const t = (z - ray.o.z) / ray.d.z;
  if (!Number.isFinite(t) || t < 0) return null;

  return add(ray.o, mul(ray.d, t));
}

export function traceTwoMirror(
  rayIn: Ray,
  primary: ConicSurface,
  secondary: ConicSurface,
  imagePlaneZ: number,
): Vec3 | null {
  const ray0: Ray = { o: rayIn.o, d: normalize(rayIn.d) };

  const hit1 = intersectConic(primary, ray0);
  if (!hit1) return null;

  const n1 = surfaceNormal(primary, hit1.p);
  const d1 = normalize(reflect(ray0.d, n1));
  const ray1: Ray = { o: hit1.p, d: d1 };

  const hit2 = intersectConic(secondary, ray1);
  if (!hit2) return null;

  const n2 = surfaceNormal(secondary, hit2.p);
  const d2 = normalize(reflect(ray1.d, n2));
  const ray2: Ray = { o: hit2.p, d: d2 };

  return propagateToPlaneZ(ray2, imagePlaneZ);
}
