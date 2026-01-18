'use client';

import { useEffect, useState } from 'react';
import type { InputSpec } from '../../../src/optics/types';
import type { SpecListItem } from '../../api/specifications/route';
import type { LoadedSpecification } from '../../api/specifications/[name]/route';

type Props = {
  value: string;
  setValueAction: (filename: string) => void;
  loadSpecAction: (spec: InputSpec, topN: number) => void;
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

function isSpecListItem(v: unknown): v is SpecListItem {
  if (!isRecord(v)) return false;
  return typeof v.filename === 'string' && typeof v.label === 'string';
}

function isLoadedSpecification(v: unknown): v is LoadedSpecification {
  if (!isRecord(v)) return false;
  if (!('spec' in v)) return false;
  if ('topN' in v && v.topN !== undefined && typeof v.topN !== 'number')
    return false;
  return true;
}

export function LoadSpecPicker(props: Props) {
  const [items, setItems] = useState<SpecListItem[]>([]);

  useEffect(() => {
    const ac = new AbortController();

    fetch('/api/specifications', { signal: ac.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('bad_status'))))
      .then((data: unknown) => {
        if (!Array.isArray(data)) {
          setItems([]);
          return;
        }
        const next: SpecListItem[] = [];
        for (const it of data) {
          if (isSpecListItem(it)) next.push(it);
        }
        setItems(next);
      })
      .catch(() => setItems([]));

    return () => ac.abort();
  }, []);

  function loadAction(filename: string) {
    if (!filename) return;

    fetch(`/api/specifications/${encodeURIComponent(filename)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('bad_status'))))
      .then((data: unknown) => {
        if (!isLoadedSpecification(data)) return;
        if (!isRecord(data.spec)) return;

        const topN = typeof data.topN === 'number' ? data.topN : 25;
        props.loadSpecAction(data.spec as InputSpec, topN);
      })
      .catch(() => { });
  }

  function changeAction(filename: string) {
    props.setValueAction(filename);
    loadAction(filename);
  }

  return (
    <div className='flex flex-col gap-1'>
      <span className='text-xs font-medium text-zinc-700'>Load</span>
      <select
        className='h-10 rounded-lg border border-zinc-200 bg-white px-3 text-sm'
        value={props.value}
        onChange={(e) => changeAction(e.target.value)}
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
