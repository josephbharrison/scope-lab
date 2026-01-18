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

        <div className='text-xs text-zinc-500'>
          Candidates generated: {r.candidates.length} | Passing:{' '}
          {r.ranked.length}
        </div>
      </div>
    </div>
  );
}
