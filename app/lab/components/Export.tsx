// app/lab/components/Export.ts
'use client';

import { useMemo, useState } from 'react';
import type { SweepResult } from '../../../src/optics/sweep';
import type { Units } from '../../../src/optics/types';
import { exportSweepResultsMarkdown } from '../../../src/utils/export';

export function Export(props: {
  result: SweepResult | null;
  tubeUnits: Units;
}) {
  const [status, setStatus] = useState<'idle' | 'copied' | 'failed'>('idle');

  const markdown = useMemo(() => {
    if (!props.result) return '';
    return exportSweepResultsMarkdown(props.result, props.tubeUnits, {
      includeAudit: true,
    });
  }, [props.result, props.tubeUnits]);

  async function copyAction() {
    if (!markdown) return;
    try {
      await navigator.clipboard.writeText(markdown);
      setStatus('copied');
      window.setTimeout(() => setStatus('idle'), 1200);
    } catch {
      setStatus('failed');
      window.setTimeout(() => setStatus('idle'), 1500);
    }
  }

  const label =
    status === 'copied'
      ? 'Copied'
      : status === 'failed'
        ? 'Copy failed'
        : 'Copy';

  return (
    <button
      className='rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-900 disabled:opacity-50'
      onClick={copyAction}
      disabled={!props.result || markdown.length === 0}
      title='Copy results as Markdown'
      type='button'
    >
      {label}
    </button>
  );
}
