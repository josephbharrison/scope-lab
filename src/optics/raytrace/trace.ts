// src/optics/raytrace/trace.ts
import type { ConicSurface, PlaneSurface, Ray, Vec3 } from "./types";
import { add, dot, mul, normalize, sub } from "./math";
import { sagZ, dsagdrConicUnsigned, surfaceNormal } from "./surface";

function withinApertureConic(surface: ConicSurface, p: Vec3): boolean {
  const r2 = p.x * p.x + p.y * p.y;
  return r2 <= surface.apertureRadius * surface.apertureRadius + 1e-12;
}

function withinAperturePlane(surface: PlaneSurface, p: Vec3): boolean {
  const dx = p.x - surface.p0.x;
  const dy = p.y - surface.p0.y;
  const dz = p.z - surface.p0.z;
  const dd = dx * dx + dy * dy + dz * dz;
  const proj = dot({ x: dx, y: dy, z: dz }, normalize(surface.nHat));
  const r2 = Math.max(0, dd - proj * proj);
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
      if (!withinApertureConic(surface, hit)) return null;
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

export function intersectPlane(
  surface: PlaneSurface,
  rayIn: Ray,
): { t: number; p: Vec3 } | null {
  const ray: Ray = { o: rayIn.o, d: normalize(rayIn.d) };
  const n = normalize(surface.nHat);
  const denom = dot(n, ray.d);
  if (!Number.isFinite(denom) || Math.abs(denom) < 1e-12) return null;

  const t = dot(n, sub(surface.p0, ray.o)) / denom;
  if (!Number.isFinite(t) || t < 0) return null;

  const p = add(ray.o, mul(ray.d, t));
  if (!withinAperturePlane(surface, p)) return null;
  return { t, p };
}

export function surfaceNormalConic(surface: ConicSurface, p: Vec3): Vec3 {
  return surfaceNormal(surface, p);
}

export function traceTwoMirror(
  ray: Ray,
  primary: ConicSurface,
  secondary: ConicSurface,
  imagePlaneZ: number,
): Vec3 | null {
  const h1 = intersectConic(primary, ray);
  if (!h1) return null;

  const n1 = surfaceNormalConic(primary, h1.p);
  const d1 = reflect(ray.d, n1);

  const r2: Ray = { o: h1.p, d: d1 };
  const h2 = intersectConic(secondary, r2);
  if (!h2) return null;

  const n2 = surfaceNormalConic(secondary, h2.p);
  const d2 = reflect(r2.d, n2);

  const denom = d2.z;
  if (!Number.isFinite(denom) || Math.abs(denom) < 1e-12) return null;

  const t = (imagePlaneZ - h2.p.z) / denom;
  if (!Number.isFinite(t) || t < 0) return null;

  return {
    x: h2.p.x + d2.x * t,
    y: h2.p.y + d2.y * t,
    z: imagePlaneZ,
  };
}
