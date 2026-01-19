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

function zoomBounds(b: Bounds, zoom: number): Bounds {
  const z = Number.isFinite(zoom) && zoom > 0 ? zoom : 1;
  const cx = 0.5 * (b.minX + b.maxX);
  const cz = 0.5 * (b.minZ + b.maxZ);
  const hx = (0.5 * (b.maxX - b.minX)) / z;
  const hz = (0.5 * (b.maxZ - b.minZ)) / z;
  const eps = 1e-9;
  return {
    minX: cx - Math.max(eps, hx),
    maxX: cx + Math.max(eps, hx),
    minZ: cz - Math.max(eps, hz),
    maxZ: cz + Math.max(eps, hz),
  };
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

function renderSvgMarkup(
  width: number,
  height: number,
  axisA: { x: number; y: number },
  axisB: { x: number; y: number },
  surfacesSvg: string,
  sensorPath: string,
  rayLines: string,
  initialInteractiveZoom: number,
): string {
  const cx = width * 0.5;
  const cy = height * 0.5;
  const rot = `translate(${cx},${cy}) rotate(-90) translate(${-cx},${-cy})`;
  const z0 =
    Number.isFinite(initialInteractiveZoom) && initialInteractiveZoom > 0
      ? initialInteractiveZoom
      : 1;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg id="scope-svg"
     xmlns="http://www.w3.org/2000/svg"
     width="${width}"
     height="${height}"
     viewBox="0 0 ${width} ${height}"
     style="touch-action:none; cursor:grab; user-select:none; -webkit-user-select:none; display:block;">
  <rect x="0" y="0" width="${width}" height="${height}" fill="white" />

  <g id="viewport" transform="translate(0,0) scale(${z0}) ${rot}">
    <line x1="${axisA.x.toFixed(2)}" y1="${axisA.y.toFixed(2)}"
          x2="${axisB.x.toFixed(2)}" y2="${axisB.y.toFixed(2)}"
          stroke="#999" stroke-width="1" stroke-dasharray="4 4" />
    ${surfacesSvg}
    <polyline points="${sensorPath}" fill="none" stroke="black" stroke-width="2" opacity="0.9" />
    ${rayLines}
  </g>

  <g id="hud" opacity="0.92">
    <rect x="10" y="10" width="560" height="54" fill="white" stroke="#999" />
    <text x="20" y="30" font-family="sans-serif" font-size="14">Drag: pan  Double-click: reset</text>
    <text x="20" y="50" font-family="sans-serif" font-size="14">Wheel: zoom (scroll blocked while over SVG)</text>

    <g id="btnZoomIn">
      <rect x="590" y="10" width="36" height="24" fill="white" stroke="#999" />
      <text x="602" y="27" font-family="sans-serif" font-size="16">+</text>
    </g>

    <g id="btnZoomOut">
      <rect x="630" y="10" width="36" height="24" fill="white" stroke="#999" />
      <text x="644" y="27" font-family="sans-serif" font-size="16">-</text>
    </g>

    <g id="btnReset">
      <rect x="670" y="10" width="70" height="24" fill="white" stroke="#999" />
      <text x="684" y="27" font-family="sans-serif" font-size="14">Reset</text>
    </g>
  </g>
</svg>`;
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
    initialBoundsZoom?: number;
    initialInteractiveZoom?: number;
  },
): string {
  const width = finiteOr(opts?.width ?? 1200, 1200);
  const height = finiteOr(opts?.height ?? 600, 600);
  const pad = finiteOr(opts?.pad ?? 30, 30);
  const surfaceSamples = Math.max(20, (opts?.surfaceSamples ?? 250) | 0);

  const initialBoundsZoom = finiteOr(opts?.initialBoundsZoom ?? 3.8, 3.8);
  const initialInteractiveZoom = finiteOr(
    opts?.initialInteractiveZoom ?? 1.0,
    1.0,
  );

  const sim = simulator.simulate(plan, sampleSpec);
  const rays = sim.traces?.rays ?? [];

  const surfaceById = new Map<string, Surface>();
  for (const s of plan.surfaces) surfaceById.set(s.id, s);

  const allPts: Vec3[] = [];
  const surfacePolylines: { id: string; pts: Vec3[] }[] = [];

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

  const b0 = boundsFromPoints(allPts);
  const b = zoomBounds(b0, initialBoundsZoom);

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

  return renderSvgMarkup(
    width,
    height,
    axisA,
    axisB,
    surfacesSvg,
    sensorPath,
    rayLines,
    initialInteractiveZoom,
  );
}

export function renderPlanCrossSectionHtml(
  plan: OpticalPlan,
  simulator: OpticalSimulator,
  sampleSpec: SampleSpec,
  opts?: {
    width?: number;
    height?: number;
    pad?: number;
    surfaceSamples?: number;
    initialBoundsZoom?: number;
    initialInteractiveZoom?: number;
  },
): string {
  const width = finiteOr(opts?.width ?? 1200, 1200);
  const height = finiteOr(opts?.height ?? 600, 600);

  const svg = renderPlanCrossSectionSvg(plan, simulator, sampleSpec, opts);

  const cx = width * 0.5;
  const cy = height * 0.5;
  const rot = `translate(${cx},${cy}) rotate(-90) translate(${-cx},${-cy})`;

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      html, body { margin: 0; padding: 0; height: 100%; overflow: hidden; background: white; }
      #wrap { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; }
    </style>
  </head>
  <body>
    <div id="wrap">${svg}</div>
    <script>
      (function(){
        var svg = document.getElementById('scope-svg');
        if (!svg) return;

        var vp = document.getElementById('viewport');
        if (!vp) return;

        var btnIn = document.getElementById('btnZoomIn');
        var btnOut = document.getElementById('btnZoomOut');
        var btnReset = document.getElementById('btnReset');

        var state = { scale: 1, tx: 0, ty: 0, dragging: false, pid: null, lastX: 0, lastY: 0 };
        var base = { scale: 1, tx: 0, ty: 0 };

        function clampScale(s){
          if (s < 0.05) return 0.05;
          if (s > 100) return 100;
          return s;
        }

        function apply(){
          var panzoom = 'translate(' + state.tx + ',' + state.ty + ') scale(' + state.scale + ')';
          vp.setAttribute('transform', panzoom + ' ${rot}');
        }

        function getPoint(evt){
          var rect = svg.getBoundingClientRect();
          return { x: evt.clientX - rect.left, y: evt.clientY - rect.top };
        }

        function zoomAt(factor, px, py){
          var s0 = state.scale;
          var s1 = clampScale(s0 * factor);
          var k = s1 / s0;
          state.tx = px - k * (px - state.tx);
          state.ty = py - k * (py - state.ty);
          state.scale = s1;
          apply();
        }

        function reset(){
          state.scale = base.scale;
          state.tx = base.tx;
          state.ty = base.ty;
          apply();
        }

        function isHudTarget(t){
          if (!t) return false;
          var id = t.id || '';
          if (id === 'btnZoomIn' || id === 'btnZoomOut' || id === 'btnReset') return true;
          var p = t.parentNode;
          while (p && p !== svg) {
            if (p.id === 'btnZoomIn' || p.id === 'btnZoomOut' || p.id === 'btnReset') return true;
            p = p.parentNode;
          }
          return false;
        }

        svg.addEventListener('wheel', function(evt){
          evt.preventDefault();
          var p = getPoint(evt);
          var dir = evt.deltaY < 0 ? 1.15 : 1/1.15;
          zoomAt(dir, p.x, p.y);
        }, { passive: false });

        svg.addEventListener('pointerdown', function(evt){
          if (isHudTarget(evt.target)) return;
          state.dragging = true;
          state.pid = evt.pointerId;
          svg.setPointerCapture(evt.pointerId);
          svg.style.cursor = 'grabbing';
          var p = getPoint(evt);
          state.lastX = p.x;
          state.lastY = p.y;
          evt.preventDefault();
        });

        svg.addEventListener('pointermove', function(evt){
          if (!state.dragging) return;
          if (state.pid !== evt.pointerId) return;
          var p = getPoint(evt);
          state.tx += (p.x - state.lastX);
          state.ty += (p.y - state.lastY);
          state.lastX = p.x;
          state.lastY = p.y;
          apply();
          evt.preventDefault();
        });

        svg.addEventListener('pointerup', function(evt){
          if (state.pid !== evt.pointerId) return;
          state.dragging = false;
          state.pid = null;
          svg.style.cursor = 'grab';
          evt.preventDefault();
        });

        svg.addEventListener('pointercancel', function(evt){
          if (state.pid !== evt.pointerId) return;
          state.dragging = false;
          state.pid = null;
          svg.style.cursor = 'grab';
          evt.preventDefault();
        });

        svg.addEventListener('dblclick', function(evt){
          evt.preventDefault();
          reset();
        });

        function bindButton(el, fn){
          if (!el) return;
          el.style.cursor = 'pointer';
          el.addEventListener('click', function(evt){
            evt.preventDefault();
            evt.stopPropagation();
            fn();
          });
        }

        bindButton(btnIn, function(){ zoomAt(1.25, ${width} * 0.5, ${height} * 0.5); });
        bindButton(btnOut, function(){ zoomAt(1/1.25, ${width} * 0.5, ${height} * 0.5); });
        bindButton(btnReset, function(){ reset(); });

        apply();
      })();
    </script>
  </body>
</html>`;
}
