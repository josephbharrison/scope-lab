'use client';

import { useMemo, useState } from 'react';
import type { InputSpec } from '../../src/optics/types';
import type { SweepResult } from '../../src/optics/sweep';

import { runSweep } from '../../src/optics/sweep';
import { presets } from '../../src/ui/presets';
import { defaultLabState } from '../../src/ui/state';

import { LoadSpecPicker } from './components/LoadSpecPicker';
import { PresetPicker } from './components/PresetPicker';
import { TopNField } from './components/TopNField';
import { SpecEditor } from './components/SpecEditor';
import { SweepEditor } from './components/SweepEditor';
import { ResultsPanel } from './components/ResultsPanel';
import { Export } from './components/Export';

import { toMm } from '../../src/optics/units';
import { DEFAULT_TUBE_MARGIN_MM } from '../../src/optics/constants';

type SyncMode = 'design' | 'sweep';

function clampFinite(v: number, fallback: number): number {
  return Number.isFinite(v) ? v : fallback;
}

function reconcileFromDesign(spec: InputSpec): InputSpec {
  const target = clampFinite(spec.targetSystemFRatio, 1);
  return {
    ...spec,
    sweep: {
      ...spec.sweep,
      systemFRatioMin: target,
      systemFRatioMax: target,
    },
  };
}

function reconcileFromSweep(spec: InputSpec): InputSpec {
  let min = clampFinite(spec.sweep.systemFRatioMin, spec.targetSystemFRatio);
  let max = clampFinite(spec.sweep.systemFRatioMax, spec.targetSystemFRatio);
  if (max < min) {
    const t = min;
    min = max;
    max = t;
  }
  const target = (min + max) * 0.5;
  return {
    ...spec,
    targetSystemFRatio: target,
    sweep: {
      ...spec.sweep,
      systemFRatioMin: min,
      systemFRatioMax: max,
    },
  };
}

function reconcile(spec: InputSpec, mode: SyncMode): InputSpec {
  return mode === 'design'
    ? reconcileFromDesign(spec)
    : reconcileFromSweep(spec);
}

function isNewtonianOnly(spec: InputSpec): boolean {
  return spec.designKinds.length === 1 && spec.designKinds[0] === 'newtonian';
}

function toUnits(mm: number, units: 'mm' | 'inch'): number {
  return units === 'mm' ? mm : mm / 25.4;
}

function ensureFeasibleSpec(spec: InputSpec): {
  spec: InputSpec;
  warnings: string[];
} {
  const warnings: string[] = [];

  if (!isNewtonianOnly(spec)) {
    return { spec, warnings };
  }

  const D_mm = toMm(spec.aperture, spec.apertureUnits);
  const F = clampFinite(spec.targetSystemFRatio, 1);
  const requiredTube_mm = F * D_mm + DEFAULT_TUBE_MARGIN_MM;

  const tubeUnits = spec.constraints.tubeLengthUnits;
  const requiredTube_units = toUnits(requiredTube_mm, tubeUnits);
  const currentMax_units = clampFinite(
    spec.constraints.maxTubeLength,
    requiredTube_units
  );

  if (currentMax_units + 1e-9 < requiredTube_units) {
    warnings.push(
      `Max tube length increased to ${requiredTube_units.toFixed(2)} ${tubeUnits} to support f/${F.toFixed(2)} Newtonian`
    );

    return {
      spec: {
        ...spec,
        constraints: {
          ...spec.constraints,
          maxTubeLength: requiredTube_units,
        },
      },
      warnings,
    };
  }

  return { spec, warnings };
}

function ToggleSwitch(props: {
  leftLabel: string;
  rightLabel: string;
  value: SyncMode;
  onChange: (v: SyncMode) => void;
}) {
  const isRight = props.value === 'sweep';

  return (
    <div className='flex items-center gap-3'>
      <span
        className={
          isRight
            ? 'text-xs text-zinc-500'
            : 'text-xs font-medium text-zinc-900'
        }
      >
        {props.leftLabel}
      </span>

      <button
        type='button'
        role='switch'
        aria-checked={isRight}
        onClick={() => props.onChange(isRight ? 'design' : 'sweep')}
        className={[
          'relative inline-flex h-7 w-12 items-center rounded-full border transition-colors',
          isRight ? 'bg-zinc-900 border-zinc-900' : 'bg-white border-zinc-300',
          'focus:outline-none focus:ring-2 focus:ring-zinc-400 focus:ring-offset-2',
        ].join(' ')}
      >
        <span
          className={[
            'inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform',
            isRight ? 'translate-x-6' : 'translate-x-1',
          ].join(' ')}
        />
      </button>

      <span
        className={
          isRight
            ? 'text-xs font-medium text-zinc-900'
            : 'text-xs text-zinc-500'
        }
      >
        {props.rightLabel}
      </span>
    </div>
  );
}

export default function LabPage() {
  const initial = defaultLabState();

  const [syncMode, setSyncMode] = useState<SyncMode>('design');

  const boot = reconcile(structuredClone(initial.spec), 'design');
  const bootFeasible = ensureFeasibleSpec(boot);

  const [spec, setSpec] = useState<InputSpec>(() =>
    structuredClone(bootFeasible.spec)
  );
  const [topN, setTopN] = useState<number>(initial.topN);
  const [result, setResult] = useState<SweepResult | null>(null);
  const [loadedSpecFilename, setLoadedSpecFilename] = useState<string>('');
  const [warnings, setWarnings] = useState<string[]>(
    () => bootFeasible.warnings
  );

  const currentPresetId = useMemo(() => {
    const found = presets.find(
      (p) => JSON.stringify(p.spec) === JSON.stringify(spec)
    );
    return found ? found.id : '';
  }, [spec]);

  function applySpec(next: InputSpec) {
    const tuned = ensureFeasibleSpec(next);
    setSpec(structuredClone(tuned.spec));
    setWarnings(tuned.warnings);
    return tuned;
  }

  function runWithSpec(nextSpec: InputSpec, nextWarnings: string[]) {
    setWarnings(nextWarnings);
    const next = runSweep(nextSpec, topN);
    setResult(structuredClone(next));
  }

  function runAction() {
    const tuned = ensureFeasibleSpec(spec);
    const tunedSpec = tuned.spec;

    if (JSON.stringify(tunedSpec) !== JSON.stringify(spec)) {
      setSpec(structuredClone(tunedSpec));
    }

    const next = runSweep(tunedSpec, topN);
    const derived = next.derivedSpec
      ? ensureFeasibleSpec(next.derivedSpec)
      : null;

    if (derived && JSON.stringify(derived.spec) !== JSON.stringify(tunedSpec)) {
      setSpec(structuredClone(derived.spec));
      setWarnings(derived.warnings);
      const rerun = runSweep(derived.spec, topN);
      setResult(structuredClone(rerun));
      return;
    }

    setWarnings(tuned.warnings);
    setResult(structuredClone(next));
  }

  function setSyncModeAction(nextMode: SyncMode) {
    setSyncMode(nextMode);

    setSpec((prev) => {
      const next = reconcile(prev, nextMode);
      const tuned = ensureFeasibleSpec(next);
      setWarnings(tuned.warnings);
      return structuredClone(tuned.spec);
    });

    setResult(null);
  }

  function setSpecFromDesign(next: InputSpec) {
    const reconciled = reconcileFromDesign(next);
    const tuned = applySpec(reconciled);
    setResult(structuredClone(runSweep(tuned.spec, topN)));
  }

  function setSpecFromSweep(next: InputSpec) {
    const reconciled = reconcileFromSweep(next);
    const tuned = applySpec(reconciled);
    setResult(structuredClone(runSweep(tuned.spec, topN)));
  }

  function loadPresetAction(id: string) {
    const p = presets.find((x) => x.id === id);
    if (!p) return;

    setLoadedSpecFilename('');

    const nextSpec = reconcile(structuredClone(p.spec), syncMode);
    const tuned = applySpec(nextSpec);
    setResult(structuredClone(runSweep(tuned.spec, topN)));
  }

  function loadSpecAction(nextSpec: InputSpec, nextTopN: number) {
    setTopN(nextTopN);

    const reconciled = reconcile(structuredClone(nextSpec), syncMode);
    const tuned = applySpec(reconciled);
    setResult(structuredClone(runSweep(tuned.spec, nextTopN)));
  }

  function setTopNAction(next: number) {
    setTopN(next);
  }

  const designEditable = syncMode === 'design';
  const sweepEditable = syncMode === 'sweep';

  const panelBase =
    'rounded-xl border border-zinc-200 bg-white p-5 transition-opacity';
  const panelDisabled = 'opacity-50';
  const panelEnabled = 'opacity-100';

  return (
    <div className='min-h-screen bg-zinc-50 text-zinc-950'>
      <main className='mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-10'>
        <header className='flex flex-col gap-2'>
          <h1 className='text-3xl font-semibold tracking-tight'>scope-lab</h1>
          <p className='text-sm text-zinc-600'>
            Enter parameters, run sweep, review ranked plans.
          </p>
        </header>

        <section className='rounded-xl border border-zinc-200 bg-white p-5'>
          <div className='flex flex-col gap-4 md:flex-row md:items-end md:justify-between'>
            <LoadSpecPicker
              value={loadedSpecFilename}
              setValueAction={setLoadedSpecFilename}
              loadSpecAction={loadSpecAction}
            />
            <PresetPicker
              presetId={currentPresetId}
              setPresetIdAction={loadPresetAction}
            />
            <TopNField value={topN} setTopNAction={setTopNAction} />

            <div className='flex flex-col gap-1'>
              <span className='text-xs font-medium text-zinc-700'>
                Authority
              </span>
              <ToggleSwitch
                leftLabel='Design'
                rightLabel='Sweep'
                value={syncMode}
                onChange={setSyncModeAction}
              />
            </div>

            <div className='flex items-center gap-2'>
              <button
                className='rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white'
                onClick={runAction}
                type='button'
              >
                Run sweep
              </button>
              <Export
                result={result}
                tubeUnits={spec.constraints.tubeLengthUnits}
              />
            </div>
          </div>
        </section>

        {warnings.length > 0 ? (
          <section className='rounded-xl border border-amber-200 bg-amber-50 p-4'>
            <div className='text-sm font-medium text-amber-900'>
              Auto-tuned constraints
            </div>
            <ul className='mt-2 list-disc pl-5 text-sm text-amber-900'>
              {warnings.map((w, i) => (
                <li key={`${i}-${w}`}>{w}</li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className='grid grid-cols-1 gap-6 lg:grid-cols-2'>
          <div
            className={[
              panelBase,
              designEditable ? panelEnabled : panelDisabled,
            ].join(' ')}
          >
            <div className='mb-3 flex items-center justify-between'>
              <div
                className={
                  designEditable
                    ? 'text-xs font-medium text-zinc-900'
                    : 'text-xs text-zinc-500'
                }
              >
                {designEditable ? 'Editable' : 'Locked'}
              </div>
              <div
                className={[
                  'h-2 w-2 rounded-full',
                  designEditable ? 'bg-emerald-500' : 'bg-zinc-300',
                ].join(' ')}
              />
            </div>

            <SpecEditor
              spec={spec}
              setSpecAction={setSpecFromDesign}
              disabled={!designEditable}
            />
          </div>

          <div
            className={[
              panelBase,
              sweepEditable ? panelEnabled : panelDisabled,
            ].join(' ')}
          >
            <div className='mb-3 flex items-center justify-between'>
              <div
                className={
                  sweepEditable
                    ? 'text-xs font-medium text-zinc-900'
                    : 'text-xs text-zinc-500'
                }
              >
                {sweepEditable ? 'Editable' : 'Locked'}
              </div>
              <div
                className={[
                  'h-2 w-2 rounded-full',
                  sweepEditable ? 'bg-emerald-500' : 'bg-zinc-300',
                ].join(' ')}
              />
            </div>

            <SweepEditor
              spec={spec}
              setSpecAction={setSpecFromSweep}
              disabled={!sweepEditable}
            />
          </div>

          <div className='rounded-xl border border-zinc-200 bg-white p-5 lg:col-span-2'>
            <ResultsPanel
              result={result}
              runAction={runAction}
              tubeUnits={spec.constraints.tubeLengthUnits}
            />
          </div>
        </section>
      </main>
    </div>
  );
}
