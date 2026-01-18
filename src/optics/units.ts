import type { Units } from "./types";

export const MM_PER_INCH = 25.4;

export function inchToMm(value: number): number {
  return value * MM_PER_INCH;
}

export function mmToInch(value: number): number {
  return value / MM_PER_INCH;
}

export function toMm(value: number, units: Units): number {
  return units === "inch" ? inchToMm(value) : value;
}

export function fromMm(value: number, units: Units): number {
  return units === "inch" ? mmToInch(value) : value;
}

export function areaCircle(diameter_mm: number): number {
  const r = diameter_mm * 0.5;
  return Math.PI * r * r;
}
