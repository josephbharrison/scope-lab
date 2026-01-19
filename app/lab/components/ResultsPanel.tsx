// app/lab/components/ResultsPanel.ts
'use client';

import type {
  Candidate,
  OpticDesignKind,
  Units,
} from '../../../src/optics/types';
import type { SweepResult } from '../../../src/optics/sweep';
import {
  candidateLabel,
  fmtLength,
  fmtNumber,
  fmtPercent,
} from '../../../src/ui/format';
import { TopTable } from './TopTable';
import { ScopeLabResultsViewer } from './ScopeLabResultsView';

import type {
  NewtonianPrescription,
  ConicSurface,
  PlaneSurface,
} from '../../../src/optics/raytrace/types';

type ViewerCandidate = Candidate;

function clampNonNegativeFinite(v: number): number {
  return Number.isFinite(v) && v >= 0 ? v : 0;
}

function finiteOr(v: number, fallback: number): number {
  return Number.isFinite(v) ? v : fallback;
}

function normKind(kind: unknown): string {
  return String(kind ?? '')
    .trim()
    .toLowerCase();
}

function isNewtonianKind(kind: unknown): boolean {
  const k = normKind(kind);
  return k === 'newtonian' || k === 'newt' || k === 'newton';
}

function buildNewtonianPrescription(c: ViewerCandidate): NewtonianPrescription {
  const D = finiteOr(c.inputs.aperture_mm, NaN);
  const fPrimary = finiteOr(c.inputs.primaryFocalLength_mm, NaN);
  const backFocus = finiteOr(c.geometry.backFocus_mm, NaN);
  const secondaryDiameter = finiteOr(c.geometry.secondaryDiameter_mm, NaN);

  const intercept = clampNonNegativeFinite(fPrimary - backFocus);

  const primary: ConicSurface = {
    z0: 0,
    R: 2 * fPrimary,
    K: -1,
    sagSign: 1,
    apertureRadius: 0.5 * D,
  };

  const c45 = Math.SQRT1_2;

  const secondary: PlaneSurface = {
    p0: { x: 0, y: 0, z: intercept },
    nHat: { x: c45, y: 0, z: -c45 },
    apertureRadius: 0.5 * secondaryDiameter,
  };

  const imagePlane: PlaneSurface = {
    p0: { x: backFocus, y: 0, z: intercept },
    nHat: { x: 1, y: 0, z: 0 },
    apertureRadius: Math.max(1, 2 * clampNonNegativeFinite(D)),
  };

  return {
    primary,
    secondary,
    imagePlane,
    zStart: 5 * fPrimary,
    pupilRadius: 0.5 * D,
  };
}

function placeholderSvg(kind: string, id: string): string {
  const k = kind.toUpperCase();
  const safeId = id;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="200" viewBox="0 0 1200 200">
  <rect x="0" y="0" width="1200" height="200" fill="white" />
  <text x="24" y="60" font-family="monospace" font-size="20">No SVG for this candidate (currently only Newt is supported).</text>
  <text x="24" y="100" font-family="monospace" font-size="16">${k}</text>
  <text x="24" y="130" font-family="monospace" font-size="14">${safeId}</text>
</svg>`;
}

export function ResultsPanel(props: {
  result: SweepResult | null;
  tubeUnits: Units;
  runAction: () => void;
}) {
  const r = props.result;

  if (!r) {
    return (
      <div className='rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700'>
        <div className='flex items-center justify-between'>
          <div className='font-medium text-zinc-900'>Results</div>
          <button
            className='rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white'
            onClick={props.runAction}
          >
            Run
          </button>
        </div>
        <div className='mt-3'>Click Run to compute candidates.</div>
      </div>
    );
  }

  if (r.ranked.length === 0) {
    return (
      <div className='rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700'>
        <div className='flex items-center justify-between'>
          <div className='font-medium text-zinc-900'>Results</div>
          <button
            className='rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white'
            onClick={props.runAction}
          >
            Run
          </button>
        </div>

        <div className='mt-3 flex flex-col gap-3'>
          <div>No passing candidates.</div>
          <div className='text-xs text-zinc-500'>
            Candidates generated: {r.candidates.length} | Passing: 0
          </div>
        </div>
      </div>
    );
  }

  const bestOverall = r.bestOverall as Candidate;
  const bestByKind = r.bestByKind as Record<OpticDesignKind, Candidate | null>;

  const viewerCandidates: ViewerCandidate[] = r.top;

  async function loadSvgForCandidate(c: ViewerCandidate): Promise<string> {
    if (!isNewtonianKind(c.kind)) {
      return placeholderSvg(String(c.kind), String(c.id));
    }

    const debugSvg = await import('../../../src/optics/raytrace/debugSvg');

    const pres = buildNewtonianPrescription(c);

    const fieldAngle = clampNonNegativeFinite(
      finiteOr(c.aberrations.fieldAngle_rad, 0)
    );

    const svg = debugSvg.renderNewtonianCrossSectionSvg(pres, fieldAngle, {
      width: 1200,
      height: 600,
      pad: 30,
      rays: 9,
      conicSamples: 250,
    });

    return svg || placeholderSvg(String(c.kind), String(c.id));
  }

  return (
    <div className='rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700'>
      <div className='flex items-center justify-between'>
        <div className='font-medium text-zinc-900'>Results</div>
        <button
          className='rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white'
          onClick={props.runAction}
        >
          Run
        </button>
      </div>

      <div className='mt-3 flex flex-col gap-4'>
        <div className='rounded-lg border border-zinc-200 bg-white p-3'>
          <div className='text-xs text-zinc-500'>Best overall</div>
          <div className='mt-1 font-medium text-zinc-900'>
            {candidateLabel(bestOverall)}
          </div>
          <div className='mt-2 grid grid-cols-2 gap-2 text-xs'>
            <div>score {fmtNumber(bestOverall.score.total, 3)}</div>
            <div>
              tube{' '}
              {fmtLength(
                bestOverall.geometry.tubeLength_mm,
                props.tubeUnits,
                1
              )}
            </div>
            <div>
              obs {fmtPercent(bestOverall.geometry.obstructionRatio, 1)}
            </div>
            <div>
              eff {fmtPercent(bestOverall.throughput.usableLightEfficiency, 1)}
            </div>
          </div>
        </div>

        <div className='rounded-lg border border-zinc-200 bg-white p-3'>
          <div className='text-xs text-zinc-500'>Best by kind</div>
          <div className='mt-2 grid grid-cols-1 gap-2 text-xs'>
            {(
              ['newtonian', 'cassegrain', 'sct', 'rc'] as OpticDesignKind[]
            ).map((k) => {
              const c = bestByKind[k];
              if (!c) return <div key={k}>{k}: none</div>;
              return (
                <div key={k} className='flex flex-col'>
                  <div className='font-medium text-zinc-900'>
                    {k}: {candidateLabel(c)}
                  </div>
                  <div className='text-zinc-700'>
                    score {fmtNumber(c.score.total, 3)} | tube{' '}
                    {fmtLength(c.geometry.tubeLength_mm, props.tubeUnits, 1)} |
                    obs {fmtPercent(c.geometry.obstructionRatio, 1)} | eff{' '}
                    {fmtPercent(c.throughput.usableLightEfficiency, 1)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className='rounded-lg border border-zinc-200 bg-white p-3'>
          <div className='text-xs text-zinc-500'>Top {r.top.length}</div>
          <TopTable candidates={r.top} tubeUnits={props.tubeUnits} />
        </div>

        <div className='rounded-lg border border-zinc-200 bg-white p-3'>
          <div className='text-xs text-zinc-500'>Inspect</div>
          <div className='mt-2'>
            <ScopeLabResultsViewer
              title='Scope Lab Results'
              candidates={viewerCandidates}
              loadSvgAction={loadSvgForCandidate}
            />
          </div>
        </div>

        <div className='text-xs text-zinc-500'>
          Candidates generated: {r.candidates.length} | Passing:{' '}
          {r.ranked.length}
        </div>
      </div>
    </div>
  );
}
