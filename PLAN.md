# PLAN.md — scope-lab file map and responsibilities

## Purpose

scope-lab is a Next.js (TypeScript) application for exploring telescope optical designs (Newtonian, Cassegrain, Schmidt-Cassegrain, Ritchey–Chrétien) under constraints (tube length, obstruction, backfocus, field illumination) and scoring candidates using comparable metrics (usable light efficiency, aberration proxies, geometry constraints).

The project is split into:
- **Optics engine**: pure, UI-agnostic computation in `src/optics` (`.ts` only)
- **UI layer**: state/presets/formatting in `src/ui` and pages in `app` (`.tsx` only where JSX is used)

This file is the canonical map of responsibilities to prevent architectural drift.

---

## File map

### Project Structure

```md
.
├── app
│   ├── favicon.ico
│   ├── globals.css
│   ├── lab
│   │   └── page.tsx
│   ├── layout.tsx
│   └── page.tsx
├── eslint.config.mjs
├── next-env.d.ts
├── next.config.ts
├── package-lock.json
├── package.json
├── PLAN.md
├── postcss.config.mjs
├── public
│   ├── file.svg
│   ├── globe.svg
│   ├── next.svg
│   ├── vercel.svg
│   └── window.svg
├── README.md
├── src
│   ├── optics
│   │   ├── [x] constants.ts
│   │   ├── designs
│   │   │   ├── [x] cassegrain.ts
│   │   │   ├── [x] newtonian.ts
│   │   │   ├── [x] rc.ts
│   │   │   └── [x] sct.ts
│   │   ├── [x] score.ts
│   │   ├── [x] sweep.ts
│   │   ├── [x] types.ts
│   │   └── [x] units.ts
│   └── ui
│       ├── [x] format.ts
│       ├── [x] presets.ts
│       └── [x] state.ts
└── tsconfig.json

```

### UI routes

#### `app/lab/page.tsx`
Main lab workspace UI.
- Renders the parameter editor (inputs, constraints, sweep ranges, weights)
- Runs the sweep/optimizer using `src/optics/sweep.ts`
- Displays results: best overall candidate, best-by-design, and top-N comparison table
- No optics math here; only orchestration and presentation

---

## Optics engine (pure TypeScript)

### `src/optics/types.ts`
Canonical type system for the entire optics engine.
Defines:
- Design kinds (newtonian, cassegrain, sct, rc)
- Input specification schema (aperture, target f-ratio, constraints, coatings, sweep, weights)
- Candidate output structure (geometry, throughput, aberration proxy metrics, constraint results, score breakdown)
No computation, only types and shared interfaces.

### `src/optics/units.ts`
Unit conversion utilities and internal normalization.
Responsibilities:
- Convert user inputs in inches/mm to internal mm
- Helpers for area/length conversions (mm↔inch) as needed by UI formatting
- All optics computations should consume normalized mm values produced using these helpers

### `src/optics/constants.ts`
Numerical defaults and shared constants for the optics engine.
Examples:
- Default margins used in first-order geometry assumptions (initial v1)
- Default reflectivity and corrector transmission fallbacks (if not supplied)
- Fixed coefficients used by aberration proxy models (v1)

### `src/optics/score.ts`
Scoring and normalization logic.
Responsibilities:
- Compute usable light efficiency term from candidate throughput metrics
- Compute penalties/terms for tube length and obstruction
- Normalize aberration proxy values across a sweep so designs are comparable
- Combine weighted terms into a single scalar score
- Emit score breakdown (per-term) for explainability

### `src/optics/sweep.ts`
Candidate generation and optimization runner.
Responsibilities:
- Enumerate combinations over sweep parameters (Fp/Fs ranges)
- Invoke selected design generators from `src/optics/designs/*`
- Apply constraint checks (tube length, obstruction ratio, backfocus, etc.)
- Compute scoring via `score.ts`
- Return ranked candidate lists:
  - best overall
  - best per design kind
  - top N candidates

This file owns the experiment loop. It does not contain design-specific math.

---

## Design generators (first-order geometry + proxies)

Each design module:
- Implements a generator function that transforms (InputSpec + params) into a Candidate
- Computes: focal lengths, tube length estimate, obstruction estimate, throughput estimate, aberration proxy
- Performs design-specific constraint reasoning only when necessary to form a valid Candidate
- Does not score; scoring is centralized in `score.ts`

#### `src/optics/designs/newtonian.ts`
Newtonian model (parabolic primary, flat secondary, side focus).
Responsibilities:
- Compute primary focal length from aperture and primary f-ratio
- Estimate tube length from primary focal length (v1 approximation)
- Estimate secondary diameter from intercept geometry and fully illuminated field (first-order)
- Throughput: 2 mirror reflections
- Aberration proxy: coma-dominant behavior as a function of f-ratio (v1 proxy)

#### `src/optics/designs/cassegrain.ts`
Classical Cassegrain model (parabolic primary, convex secondary, rear focus).
Responsibilities:
- Compute primary and system focal lengths from Fp/Fs
- Compute magnification m = f_sys / f_primary
- Estimate folded tube length from f_sys, m, backfocus, and margin (v1)
- Estimate obstruction ratio (v1)
- Throughput: 2 mirror reflections
- Aberration proxy: narrower corrected field than RC at similar Fs (v1 proxy)

#### `src/optics/designs/sct.ts`
Schmidt-Cassegrain model (spherical primary/secondary + corrector, rear focus).
Responsibilities:
- Compute primary and system focal lengths
- Estimate folded tube length similar to Cass (v1)
- Obstruction model includes secondary + baffle impact as a first-order penalty (v1)
- Throughput: 2 reflections plus corrector transmission
- Aberration proxy: moderate base proxy plus additional penalty for obstruction/baffling (v1)

#### `src/optics/designs/rc.ts`
Ritchey–Chrétien model (hyperbolic primary/secondary, rear focus).
Responsibilities:
- Compute primary and system focal lengths and magnification
- Estimate folded tube length (v1)
- Estimate obstruction ratio (v1)
- Throughput: 2 mirror reflections
- Aberration proxy: coma-free advantage vs classical Cass, with remaining penalties for astigmatism/field curvature (v1 proxy)

---

## UI support utilities

### `src/ui/state.ts`
UI state definitions and helpers.
Responsibilities:
- Define the default lab state object (InputSpec in UI form)
- Define reducer/helpers for updating numeric fields safely
- Maintain separation from optics engine logic (no computations beyond UI state handling)

### `src/ui/presets.ts`
Curated presets for quick experiments.
Responsibilities:
- Provide preset InputSpec configurations (e.g., “16-inch visual”, “12-inch imaging”, “36-inch constrained length”)
- Provide sweep defaults tuned for exploration
- No computation beyond static preset definitions

### `src/ui/format.ts`
Formatting helpers for display.
Responsibilities:
- Render lengths/areas in the user-selected units
- Format scores/percentages and candidate summaries for tables/cards
- No optics computations; only presentation formatting

---

## Non-goals for these files

- No ray-tracer implementation in this phase
- No React components inside `src/optics`
- No scoring logic inside design generators
- No unit math scattered across UI; normalize via `units.ts`

This PLAN.md defines the responsibilities. If something doesn’t fit cleanly into one of these files, it likely indicates drift.
