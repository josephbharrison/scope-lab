'use client';

import type {
  Candidate,
  OpticDesignKind,
  Units,
} from '../../../src/optics/types';
import type { SweepResult } from '../../../src/optics/sweep';
import type {
  OpticalSimulator,
  SampleSpec,
} from '../../../src/optics/plan/types';

import {
  candidateLabel,
  fmtLength,
  fmtNumber,
  fmtPercent,
} from '../../../src/ui/format';
import { TopTable } from './TopTable';
import { ScopeLabResultsViewer } from './ScopeLabResultsView';

type ViewerCandidate = Candidate;

function normKind(kind: unknown): string {
  return String(kind ?? '')
    .trim()
    .toLowerCase();
}

function isNewtonianKind(kind: unknown): boolean {
  const k = normKind(kind);
  return k === 'newtonian' || k === 'newt' || k === 'newton';
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
  simulator: OpticalSimulator;
  scoringSampleSpec: SampleSpec;
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
    const debugSvg = await import('../../../src/optics/raytrace/debugSvg');

    if (!c.plan) return placeholderSvg(String(c.kind), String(c.id));

    const svg = debugSvg.renderPlanCrossSectionSvg(
      c.plan,
      props.simulator,
      props.scoringSampleSpec,
      {
        width: 1200,
        height: 600,
        pad: 30,
        surfaceSamples: 250,
      }
    );

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
