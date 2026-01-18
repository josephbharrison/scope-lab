'use client';

import { useEffect, useState } from 'react';
import type { InputSpec } from '../../../src/optics/types';
import type { SpecListItem } from '../../api/specifications/route';
import type { LoadedSpecification } from '../../api/specifications/[name]/route';

export function LoadSpecPicker(props: {
  loadSpecAction: (spec: InputSpec, topN: number) => void;
}) {
  const [items, setItems] = useState<SpecListItem[]>([]);
  const [selected, setSelected] = useState<string>('');

  useEffect(() => {
    fetch('/api/specifications')
      .then((r) => r.json())
      .then((data: SpecListItem[]) => setItems(data))
      .catch(() => setItems([]));
  }, []);

  function loadAction(filename: string) {
    if (!filename) return;
    fetch(`/api/specifications/${encodeURIComponent(filename)}`)
      .then((r) => r.json())
      .then((data: LoadedSpecification) => {
        props.loadSpecAction(data.spec as InputSpec, data.topN ?? 25);
        setSelected('');
      })
      .catch(() => { });
  }

  return (
    <div className='flex flex-col gap-1'>
      <span className='text-xs font-medium text-zinc-700'>Load</span>
      <select
        className='h-10 rounded-lg border border-zinc-200 bg-white px-3 text-sm'
        value={selected}
        onChange={(e) => {
          const v = e.target.value;
          setSelected(v);
          loadAction(v);
        }}
      >
        <option value=''>Select...</option>
        {items.map((it) => (
          <option key={it.filename} value={it.filename}>
            {it.label}
          </option>
        ))}
      </select>
    </div>
  );
}
