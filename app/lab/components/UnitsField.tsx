'use client';

import type { Units } from '../../../src/optics/types';

export function UnitsField(props: {
  value: Units;
  setUnitsAction: (u: Units) => void;
  options?: Units[];
  disabled?: boolean;
}) {
  const options = props.options ?? ['inch', 'mm'];
  const disabled = props.disabled === true;

  return (
    <select
      className={[
        'rounded-lg border px-3 py-2 text-sm transition',
        disabled
          ? 'border-zinc-200 bg-zinc-100 text-zinc-500'
          : 'border-zinc-200 bg-white text-zinc-900',
      ].join(' ')}
      value={props.value}
      disabled={disabled}
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
