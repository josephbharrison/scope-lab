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

  const [spec, setSpec] = useState<InputSpec>(() =>
    reconcile(structuredClone(initial.spec), 'design')
  );
  const [topN, setTopN] = useState<number>(initial.topN);
  const [result, setResult] = useState<SweepResult | null>(null);
  const [loadedSpecFilename, setLoadedSpecFilename] = useState<string>('');

  const currentPresetId = useMemo(() => {
    const found = presets.find(
      (p) => JSON.stringify(p.spec) === JSON.stringify(spec)
    );
    return found ? found.id : '';
  }, [spec]);

  function runAction() {
    const next = runSweep(spec, topN);
    setResult(structuredClone(next));
  }

  function setSyncModeAction(nextMode: SyncMode) {
    setSyncMode(nextMode);
    setSpec((prev) => reconcile(prev, nextMode));
    setResult(null);
  }

  function setSpecFromDesign(next: InputSpec) {
    const reconciled = reconcileFromDesign(next);
    setSpec(structuredClone(reconciled));
    setResult(null);
  }

  function setSpecFromSweep(next: InputSpec) {
    const reconciled = reconcileFromSweep(next);
    setSpec(structuredClone(reconciled));
    setResult(null);
  }

  function loadPresetAction(id: string) {
    const p = presets.find((x) => x.id === id);
    if (!p) return;
    setLoadedSpecFilename('');
    const nextSpec = reconcile(structuredClone(p.spec), syncMode);
    setSpec(nextSpec);
    setResult(structuredClone(runSweep(nextSpec, topN)));
  }

  function loadSpecAction(nextSpec: InputSpec, nextTopN: number) {
    setTopN(nextTopN);
    const reconciled = reconcile(structuredClone(nextSpec), syncMode);
    setSpec(reconciled);
    setResult(structuredClone(runSweep(reconciled, nextTopN)));
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
