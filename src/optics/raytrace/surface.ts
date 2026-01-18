// src/optics/raytrace/surface.ts
import type { ConicSurface, Vec3 } from "./types";
import { normalize } from "./math";

export function sagConicUnsigned(r: number, R: number, K: number): number {
  const R2 = R * R;
  if (!(R2 > 0) || !Number.isFinite(R2)) return NaN;

  const u = ((1 + K) * (r * r)) / R2;
  const inside = 1 - u;
  if (inside <= 0) return NaN;

  const s = Math.sqrt(inside);
  const denom = R * (1 + s);
  if (!Number.isFinite(denom) || denom === 0) return NaN;

  return (r * r) / denom;
}

export function dsagdrConicUnsigned(r: number, R: number, K: number): number {
  const R2 = R * R;
  if (!(R2 > 0) || !Number.isFinite(R2)) return NaN;

  const u = ((1 + K) * (r * r)) / R2;
  const inside = 1 - u;
  if (inside <= 0) return NaN;

  const s = Math.sqrt(inside);
  const denom = 1 + s;
  if (!Number.isFinite(denom) || denom === 0) return NaN;

  const A = (r * r) / R;
  const dA = (2 * r) / R;
  const dDenom = (-(1 + K) * r) / (R2 * s);

  return (dA * denom - A * dDenom) / (denom * denom);
}

export function sagZ(surface: ConicSurface, x: number, y: number): number {
  const r = Math.sqrt(x * x + y * y);
  const s = sagConicUnsigned(r, surface.R, surface.K);
  if (!Number.isFinite(s)) return NaN;
  return surface.z0 + surface.sagSign * s;
}

export function surfaceNormal(surface: ConicSurface, p: Vec3): Vec3 {
  const r = Math.sqrt(p.x * p.x + p.y * p.y);

  if (!(r > 0)) {
    return normalize({ x: 0, y: 0, z: surface.sagSign });
  }

  const ds = dsagdrConicUnsigned(r, surface.R, surface.K);
  if (!Number.isFinite(ds)) {
    return normalize({ x: 0, y: 0, z: surface.sagSign });
  }

  const dsSigned = surface.sagSign * ds;
  return normalize({
    x: -dsSigned * (p.x / r),
    y: -dsSigned * (p.y / r),
    z: surface.sagSign,
  });
}
