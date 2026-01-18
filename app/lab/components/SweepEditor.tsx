'use client';

import type { InputSpec } from '../../../src/optics/types';
import { NumberField } from './NumberField';
import { asNumber, setIn } from './fields';

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function getAtPath(root: unknown, path: string[]): unknown {
  let cur: unknown = root;

  for (const key of path) {
    if (Array.isArray(cur)) {
      const idx = Number(key);
      if (!Number.isInteger(idx) || idx < 0 || idx >= cur.length)
        return undefined;
      cur = cur[idx];
      continue;
    }

    if (isRecord(cur)) {
      cur = cur[key];
      continue;
    }

    return undefined;
  }

  return cur;
}

function getNumberFallback(spec: InputSpec, path: string[]): number {
  const v = getAtPath(spec, path);
  return typeof v === 'number' && Number.isFinite(v) ? v : 0;
}

export function SweepEditor(props: {
  spec: InputSpec;
  setSpecAction: (s: InputSpec) => void;
  disabled?: boolean;
}) {
  const spec = props.spec;
  const disabled = props.disabled === true;

  function updateNumber(path: string, v: string) {
    if (disabled) return;
    const parts = path.split('.');
    const fallback = getNumberFallback(spec, parts);
    const next = asNumber(v, fallback);
    props.setSpecAction(setIn(spec, parts, next));
  }

  return (
    <div className='flex flex-col gap-6'>
      <div>
        <h2 className='text-lg font-semibold'>Sweep and scoring</h2>

        <h3 className='mt-4 text-sm font-semibold text-zinc-900'>
          Sweep ranges
        </h3>
        <div className='mt-3 grid grid-cols-2 gap-4'>
          <NumberField
            label='Primary f-ratio min'
            value={spec.sweep.primaryFRatioMin}
            step={0.1}
            setValueAction={(v) => updateNumber('sweep.primaryFRatioMin', v)}
          />
          <NumberField
            label='Primary f-ratio max'
            value={spec.sweep.primaryFRatioMax}
            step={0.1}
            setValueAction={(v) => updateNumber('sweep.primaryFRatioMax', v)}
          />
          <NumberField
            label='Primary f-ratio step'
            value={spec.sweep.primaryFRatioStep}
            step={0.05}
            setValueAction={(v) => updateNumber('sweep.primaryFRatioStep', v)}
          />
          <NumberField
            label='System f-ratio min'
            value={spec.sweep.systemFRatioMin}
            step={0.1}
            setValueAction={(v) => updateNumber('sweep.systemFRatioMin', v)}
          />
          <NumberField
            label='System f-ratio max'
            value={spec.sweep.systemFRatioMax}
            step={0.1}
            setValueAction={(v) => updateNumber('sweep.systemFRatioMax', v)}
          />
          <NumberField
            label='System f-ratio step'
            value={spec.sweep.systemFRatioStep}
            step={0.05}
            setValueAction={(v) => updateNumber('sweep.systemFRatioStep', v)}
          />
        </div>

        <h3 className='mt-6 text-sm font-semibold text-zinc-900'>Weights</h3>
        <div className='mt-3 grid grid-cols-2 gap-4'>
          <NumberField
            label='usableLight'
            value={spec.weights.usableLight}
            step={0.05}
            setValueAction={(v) => updateNumber('weights.usableLight', v)}
          />
          <NumberField
            label='aberration'
            value={spec.weights.aberration}
            step={0.05}
            setValueAction={(v) => updateNumber('weights.aberration', v)}
          />
          <NumberField
            label='tubeLength'
            value={spec.weights.tubeLength}
            step={0.05}
            setValueAction={(v) => updateNumber('weights.tubeLength', v)}
          />
          <NumberField
            label='obstruction'
            value={spec.weights.obstruction}
            step={0.05}
            setValueAction={(v) => updateNumber('weights.obstruction', v)}
          />
        </div>
      </div>

      {disabled ? (
        <div className='rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-600'>
          Locked: Design drives sweep
        </div>
      ) : null}
    </div>
  );
}
