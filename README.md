# Scope Lab

A small optics design lab for exploring common telescope architectures, currently focused on two-mirror systems (Cassegrain-like variants). It provides a browser-based UI for editing constraints, running parameter sweeps, and comparing optical candidates using derived geometric and performance metrics.

---

## What it does

- **Interactive lab UI** built with Next.js, exposed at `/lab`
- **Design generation and sweeps** over optical parameters
- **Two-mirror geometry core** that computes spacing, backfocus, magnification, and secondary sizing
- **Constraint-driven feasibility filtering** with clean null rejection
- **Scoring pipeline** that ranks candidates using obstruction and ray-derived metrics

---

## Core concepts

### Units and constraints

All user-facing inputs are modeled through an `InputSpec` with explicit units. Internal math is performed in millimeters using helpers such as:

- `toMm(value, units)`

Common constraints:
- `minBackFocus` + `backFocusUnits`
- `fullyIlluminatedFieldRadius` + `fieldUnits`

---

### Two-mirror layout model

The heart of the system is `twoMirrorLayout(...)`, which implements a Cassegrain-like two-mirror geometry.

Key relations:

- Primary focal length
  `fPrimary_mm = Fp * D_mm`

- System focal length
  `fSystem_mm = Fs * D_mm`

- Magnification
  `m = fSystem_mm / fPrimary_mm`

- **Backfocus is treated as an input constraint**, not a derived quantity

- Primary-to-secondary spacing solved from backfocus:
  `d = (m * fPrimary_mm - backFocus_mm) / (m + 1)`

Secondary sizing terms:

- Cone radius at secondary:
  `coneRadius = 0.5 * D_mm * (1 - d / fPrimary_mm)`

- Chief ray height (for fully illuminated field):
  `chiefRayHeight = fieldRadius > 0 ? (fieldRadius * (backFocus + d)) / fSystem_mm : 0`

- Secondary diameter:
  `secondaryDiameter = 2 * (coneRadius + chiefRayHeight)`

This formulation avoids the algebraic degeneracy that forces backfocus to zero and allows meaningful non-zero backfocus constraints.

---

## Repository layout

High-signal overview:

- `app/`
  - `page.tsx` – redirects to `/lab`
  - `lab/page.tsx` – main lab UI
  - `lab/components/` – editors, unit selectors, results tables

- `src/optics/`
  - `constants.ts` – scoring and design constants
  - `units.ts` – unit conversion helpers
  - `types.ts` – `InputSpec`, units, candidate definitions
  - `sweep.ts` – sweep runner and feasibility filtering
  - `designs/`
    - `twoMirror.ts` – two-mirror geometry solver
    - `cassegrain.ts` – design-family wiring
    - `secondary.ts` – secondary sizing helpers
  - `raytrace/` – ray-based quality metrics
  - `diagnostics/` – optional debugging and validation tools

---

## Running the project

Typical Next.js workflow:

```bash
npm install
npm run dev
```

Then open:

```text
http://localhost:3000
```

You will be redirected automatically to:

```text
http://localhost:3000/lab
```

---

## Using the lab

1. Select or edit an optical **preset**
2. Configure constraints:
   - Minimum backfocus
   - Fully illuminated field radius
3. Choose:
   - **Single design mode** or
   - **Sweep mode** for parameter exploration
4. Inspect ranked candidates in the results table
5. Export results if enabled

---

## Programmatic usage

```ts
import type { InputSpec } from "./src/optics/types"
import { toMm } from "./src/optics/units"
import { twoMirrorLayout } from "./src/optics/designs/twoMirror"

const spec: InputSpec = /* your spec */
const D_mm = toMm(spec.aperture, spec.apertureUnits)

const Fp = 3.0
const Fs = 12.0

const layout = twoMirrorLayout(spec, D_mm, Fp, Fs)
if (!layout) {
  throw new Error("No feasible layout for these constraints")
}

console.log(layout.backFocus_mm, layout.secondaryDiameter_mm)
```

---

## Feasibility rules

A candidate returns `null` when any physical or numerical constraint fails, including:

- Non-finite or invalid inputs
- `Fs <= Fp` (system f-ratio must exceed primary f-ratio)
- Spacing `d` not strictly within `(0, fPrimary_mm)`
- Non-physical cone radius or secondary diameter

This keeps the sweep space clean and avoids propagating invalid geometries downstream.

---

## License

Add your license here (MIT, Apache-2.0, etc.).
