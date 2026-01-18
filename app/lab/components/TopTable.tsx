'use client';

import type { Candidate, Units } from '../../../src/optics/types';
import {
  candidateLabel,
  fmtLength,
  fmtNumber,
  fmtPercent,
} from '../../../src/ui/format';

export function TopTable(props: { candidates: Candidate[]; tubeUnits: Units }) {
  return (
    <div className='mt-2 overflow-x-auto'>
      <table className='w-full min-w-[820px] border-collapse text-xs'>
        <thead>
          <tr className='text-left text-zinc-600'>
            <th className='border-b border-zinc-200 py-2 pr-3'>candidate</th>
            <th className='border-b border-zinc-200 py-2 pr-3'>score</th>
            <th className='border-b border-zinc-200 py-2 pr-3'>tube</th>
            <th className='border-b border-zinc-200 py-2 pr-3'>obs</th>
            <th className='border-b border-zinc-200 py-2 pr-3'>eff</th>
            <th className='border-b border-zinc-200 py-2 pr-3'>usable</th>
            <th className='border-b border-zinc-200 py-2 pr-3'>aberr</th>
            <th className='border-b border-zinc-200 py-2 pr-3'>tubeTerm</th>
            <th className='border-b border-zinc-200 py-2 pr-3'>obsTerm</th>
          </tr>
        </thead>
        <tbody>
          {props.candidates.map((c) => (
            <tr key={c.id} className='text-zinc-900'>
              <td className='border-b border-zinc-100 py-2 pr-3'>
                {candidateLabel(c)}
              </td>
              <td className='border-b border-zinc-100 py-2 pr-3'>
                {fmtNumber(c.score.total, 3)}
              </td>
              <td className='border-b border-zinc-100 py-2 pr-3'>
                {fmtLength(c.geometry.tubeLength_mm, props.tubeUnits, 1)}
              </td>
              <td className='border-b border-zinc-100 py-2 pr-3'>
                {fmtPercent(c.geometry.obstructionRatio, 1)}
              </td>
              <td className='border-b border-zinc-100 py-2 pr-3'>
                {fmtPercent(c.throughput.usableLightEfficiency, 1)}
              </td>
              <td className='border-b border-zinc-100 py-2 pr-3'>
                {fmtNumber(c.score.terms.usableLight, 3)}
              </td>
              <td className='border-b border-zinc-100 py-2 pr-3'>
                {fmtNumber(c.score.terms.aberration, 3)}
              </td>
              <td className='border-b border-zinc-100 py-2 pr-3'>
                {fmtNumber(c.score.terms.tubeLength, 3)}
              </td>
              <td className='border-b border-zinc-100 py-2 pr-3'>
                {fmtNumber(c.score.terms.obstruction, 3)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
