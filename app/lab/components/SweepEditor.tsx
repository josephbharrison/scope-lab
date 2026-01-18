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

function clampRange(v: number, min?: number, max?: number): number {
  let out = v;
  if (typeof min === 'number' && Number.isFinite(min) && out < min) out = min;
  if (typeof max === 'number' && Number.isFinite(max) && out > max) out = max;
  return out;
}

export function SweepEditor(props: {
  spec: InputSpec;
  setSpecAction: (s: InputSpec) => void;
  disabled?: boolean;
}) {
  const spec = props.spec;
  const disabled = props.disabled === true;

  const isNewtonianOnly =
    spec.designKinds.length === 1 && spec.designKinds[0] === 'newtonian';

  const fpLimitMin = spec.derivedLimits?.primaryFRatio?.min;
  const fpLimitMax = spec.derivedLimits?.primaryFRatio?.max;

  const fsLimitMin = spec.derivedLimits?.systemFRatio?.min;
  const fsLimitMax = spec.derivedLimits?.systemFRatio?.max;

  const fpHint =
    typeof fpLimitMin === 'number' && typeof fpLimitMax === 'number'
      ? `Requires ${fpLimitMin.toFixed(2)} to ${fpLimitMax.toFixed(2)}`
      : undefined;

  const fsHint = isNewtonianOnly
    ? 'Locked to primary f-ratio for Newtonian designs'
    : typeof fsLimitMin === 'number' && typeof fsLimitMax === 'number'
      ? `Requires ${fsLimitMin.toFixed(2)} to ${fsLimitMax.toFixed(2)}`
      : undefined;

  function updateNumber(path: string, v: string) {
    if (disabled) return;

    const parts = path.split('.');
    const fallback = getNumberFallback(spec, parts);
    let next = asNumber(v, fallback);

    if (
      path === 'sweep.primaryFRatioStep' ||
      path === 'sweep.systemFRatioStep'
    ) {
      if (!Number.isFinite(next) || next <= 0) next = 0.05;
    }

    if (
      path === 'sweep.primaryFRatioMin' ||
      path === 'sweep.primaryFRatioMax'
    ) {
      next = clampRange(next, fpLimitMin, fpLimitMax);

      if (path === 'sweep.primaryFRatioMin') {
        const curMax = clampRange(
          spec.sweep.primaryFRatioMax,
          fpLimitMin,
          fpLimitMax
        );
        const minV = next;
        const maxV = curMax < minV ? minV : curMax;

        let nextSpec = setIn(spec, ['sweep', 'primaryFRatioMin'], minV);
        nextSpec = setIn(nextSpec, ['sweep', 'primaryFRatioMax'], maxV);

        if (isNewtonianOnly) {
          nextSpec = setIn(nextSpec, ['sweep', 'systemFRatioMin'], minV);
          nextSpec = setIn(nextSpec, ['sweep', 'systemFRatioMax'], minV);
        }

        props.setSpecAction(nextSpec);
        return;
      }

      const curMin = clampRange(
        spec.sweep.primaryFRatioMin,
        fpLimitMin,
        fpLimitMax
      );
      const maxV = next;
      const minV = curMin > maxV ? maxV : curMin;

      let nextSpec = setIn(spec, ['sweep', 'primaryFRatioMin'], minV);
      nextSpec = setIn(nextSpec, ['sweep', 'primaryFRatioMax'], maxV);

      if (isNewtonianOnly) {
        nextSpec = setIn(nextSpec, ['sweep', 'systemFRatioMin'], maxV);
        nextSpec = setIn(nextSpec, ['sweep', 'systemFRatioMax'], maxV);
      }

      props.setSpecAction(nextSpec);
      return;
    }

    if (path === 'sweep.systemFRatioMin' || path === 'sweep.systemFRatioMax') {
      if (isNewtonianOnly) return;

      next = clampRange(next, fsLimitMin, fsLimitMax);

      if (path === 'sweep.systemFRatioMin') {
        const curMax = clampRange(
          spec.sweep.systemFRatioMax,
          fsLimitMin,
          fsLimitMax
        );
        const minV = next;
        const maxV = curMax < minV ? minV : curMax;

        let nextSpec = setIn(spec, ['sweep', 'systemFRatioMin'], minV);
        nextSpec = setIn(nextSpec, ['sweep', 'systemFRatioMax'], maxV);

        props.setSpecAction(nextSpec);
        return;
      }

      const curMin = clampRange(
        spec.sweep.systemFRatioMin,
        fsLimitMin,
        fsLimitMax
      );
      const maxV = next;
      const minV = curMin > maxV ? maxV : curMin;

      let nextSpec = setIn(spec, ['sweep', 'systemFRatioMin'], minV);
      nextSpec = setIn(nextSpec, ['sweep', 'systemFRatioMax'], maxV);

      props.setSpecAction(nextSpec);
      return;
    }

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
            min={fpLimitMin}
            max={fpLimitMax}
            hint={fpHint}
            setValueAction={(v) => updateNumber('sweep.primaryFRatioMin', v)}
            disabled={disabled}
          />

          <NumberField
            label='Primary f-ratio max'
            value={spec.sweep.primaryFRatioMax}
            step={0.1}
            min={fpLimitMin}
            max={fpLimitMax}
            hint={fpHint}
            setValueAction={(v) => updateNumber('sweep.primaryFRatioMax', v)}
            disabled={disabled}
          />

          <NumberField
            label='Primary f-ratio step'
            value={spec.sweep.primaryFRatioStep}
            step={0.05}
            min={0.0000001}
            setValueAction={(v) => updateNumber('sweep.primaryFRatioStep', v)}
            disabled={disabled}
          />

          <NumberField
            label='System f-ratio min'
            value={spec.sweep.systemFRatioMin}
            step={0.1}
            min={fsLimitMin}
            max={fsLimitMax}
            hint={fsHint}
            setValueAction={(v) => updateNumber('sweep.systemFRatioMin', v)}
            disabled={disabled || isNewtonianOnly}
          />

          <NumberField
            label='System f-ratio max'
            value={spec.sweep.systemFRatioMax}
            step={0.1}
            min={fsLimitMin}
            max={fsLimitMax}
            hint={fsHint}
            setValueAction={(v) => updateNumber('sweep.systemFRatioMax', v)}
            disabled={disabled || isNewtonianOnly}
          />

          <NumberField
            label='System f-ratio step'
            value={spec.sweep.systemFRatioStep}
            step={0.05}
            min={0.0000001}
            setValueAction={(v) => updateNumber('sweep.systemFRatioStep', v)}
            disabled={disabled || isNewtonianOnly}
          />
        </div>

        <h3 className='mt-6 text-sm font-semibold text-zinc-900'>Weights</h3>

        <div className='mt-3 grid grid-cols-2 gap-4'>
          <NumberField
            label='usableLight'
            value={spec.weights.usableLight}
            step={0.05}
            setValueAction={(v) => updateNumber('weights.usableLight', v)}
            disabled={disabled}
          />

          <NumberField
            label='aberration'
            value={spec.weights.aberration}
            step={0.05}
            setValueAction={(v) => updateNumber('weights.aberration', v)}
            disabled={disabled}
          />

          <NumberField
            label='tubeLength'
            value={spec.weights.tubeLength}
            step={0.05}
            setValueAction={(v) => updateNumber('weights.tubeLength', v)}
            disabled={disabled}
          />

          <NumberField
            label='obstruction'
            value={spec.weights.obstruction}
            step={0.05}
            setValueAction={(v) => updateNumber('weights.obstruction', v)}
            disabled={disabled}
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
