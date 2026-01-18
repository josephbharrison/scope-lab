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

export default function LabPage() {
  const initial = defaultLabState();

  const [spec, setSpec] = useState<InputSpec>(initial.spec);
  const [topN, setTopN] = useState<number>(initial.topN);
  const [result, setResult] = useState<SweepResult | null>(null);

  const currentPresetId = useMemo(() => {
    const found = presets.find(
      (p) => JSON.stringify(p.spec) === JSON.stringify(spec)
    );
    return found ? found.id : '';
  }, [spec]);

  function runAction() {
    setResult(runSweep(spec, topN));
  }

  function loadPresetAction(id: string) {
    const p = presets.find((x) => x.id === id);
    if (!p) return;
    setSpec(p.spec);
    setResult(runSweep(p.spec, topN));
  }

  function loadSpecAction(nextSpec: InputSpec, nextTopN: number) {
    setSpec(nextSpec);
    setTopN(nextTopN);
    setResult(runSweep(nextSpec, nextTopN));
  }

  function setSpecAction(next: InputSpec) {
    setSpec(next);
  }

  function setTopNAction(next: number) {
    setTopN(next);
  }

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
            <LoadSpecPicker loadSpecAction={loadSpecAction} />
            <PresetPicker
              presetId={currentPresetId}
              setPresetIdAction={loadPresetAction}
            />
            <TopNField value={topN} setTopNAction={setTopNAction} />
            <div className='flex gap-2'>
              <button
                className='rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white'
                onClick={runAction}
              >
                Run sweep
              </button>
            </div>
          </div>
        </section>

        <section className='grid grid-cols-1 gap-6 lg:grid-cols-2'>
          <div className='rounded-xl border border-zinc-200 bg-white p-5'>
            <SpecEditor spec={spec} setSpecAction={setSpecAction} />
          </div>

          <div className='rounded-xl border border-zinc-200 bg-white p-5'>
            <SweepEditor spec={spec} setSpecAction={setSpecAction} />
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
