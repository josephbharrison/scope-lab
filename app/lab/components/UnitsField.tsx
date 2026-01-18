'use client';

import type { Units } from '../../../src/optics/types';

export function UnitsField(props: {
  value: Units;
  setUnitsAction: (u: Units) => void;
  options?: Units[];
}) {
  const options = props.options ?? ['inch', 'mm'];
  return (
    <select
      className='rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm'
      value={props.value}
      onChange={(e) => props.setUnitsAction(e.target.value as Units)}
    >
      {options.map((u) => (
        <option key={u} value={u}>
          {u}
        </option>
      ))}
    </select>
  );
}
