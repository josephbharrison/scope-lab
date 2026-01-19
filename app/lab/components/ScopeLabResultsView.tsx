// app/lab/components/ScopeLabResultsView.tsx
'use client';

import React, { useMemo, useState } from 'react';
import type { Candidate } from '../../../src/optics/types';

type Props = {
  candidates: Candidate[];
  loadSvgAction: (c: Candidate) => Promise<string>;
  title?: string;
};

function fmt(n: number, digits = 3): string {
  if (!Number.isFinite(n)) return '-';
  return n.toFixed(digits);
}

function mmToIn(mm: number): number {
  return mm / 25.4;
}

function errToString(e: unknown): string {
  if (e instanceof Error) return e.message;
  return String(e);
}

export function ScopeLabResultsViewer(props: Props) {
  const { candidates, loadSvgAction, title } = props;

  const sorted = useMemo(() => {
    const copy = [...candidates];
    copy.sort((a, b) => (b.score?.total ?? 0) - (a.score?.total ?? 0));
    return copy;
  }, [candidates]);

  const [selectedId, setSelectedId] = useState<string | null>(
    sorted[0]?.id ?? null
  );
  const [svg, setSvg] = useState<string>('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [errorText, setErrorText] = useState<string>('');
  const [emptyText, setEmptyText] = useState<string>('');

  const selected = useMemo(() => {
    if (!selectedId) return null;
    return sorted.find((c) => c.id === selectedId) ?? null;
  }, [sorted, selectedId]);

  async function select(c: Candidate) {
    setSelectedId(c.id);
    setStatus('loading');
    setSvg('');
    setErrorText('');
    setEmptyText('');
    try {
      const s = await loadSvgAction(c);
      if (!s) {
        setEmptyText(
          'No SVG for this candidate (currently only Newt is supported).'
        );
        setStatus('idle');
        return;
      }
      setSvg(s);
      setStatus('idle');
    } catch (e) {
      const msg = errToString(e);
      console.error('loadSvgAction failed:', e);
      setErrorText(msg);
      setStatus('error');
    }
  }

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateRows: 'auto auto auto 1fr',
        gap: 12,
        minWidth: 0,
      }}
    >
      {title ? <h2 style={{ margin: 0 }}>{title}</h2> : null}

      <div
        style={{
          border: '1px solid #ddd',
          borderRadius: 8,
          padding: 12,
          minWidth: 0,
        }}
      >
        {selected ? (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 12,
              minWidth: 0,
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 700 }}>
                {String(selected.kind).toUpperCase()}
              </div>
              <div
                style={{
                  fontFamily: 'monospace',
                  fontSize: 12,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {selected.id}
              </div>
            </div>

            <div style={{ fontFamily: 'monospace', fontSize: 12 }}>
              <div>score {fmt(selected.score.total, 3)}</div>
              <div>usable {fmt(selected.score.terms.usableLight, 3)}</div>
              <div>aberr {fmt(selected.score.terms.aberration, 3)}</div>
              <div>obs {fmt(selected.score.terms.obstruction, 3)}</div>
            </div>
          </div>
        ) : (
          <div>Select a candidate</div>
        )}
      </div>

      <div
        style={{
          overflow: 'auto',
          maxHeight: '38vh',
          border: '1px solid #ddd',
          borderRadius: 8,
          minWidth: 0,
        }}
      >
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th
                style={{
                  textAlign: 'left',
                  padding: 10,
                  borderBottom: '1px solid #eee',
                }}
              >
                Candidate
              </th>
              <th
                style={{
                  textAlign: 'right',
                  padding: 10,
                  borderBottom: '1px solid #eee',
                }}
              >
                Score
              </th>
              <th
                style={{
                  textAlign: 'right',
                  padding: 10,
                  borderBottom: '1px solid #eee',
                }}
              >
                Tube
              </th>
              <th
                style={{
                  textAlign: 'right',
                  padding: 10,
                  borderBottom: '1px solid #eee',
                }}
              >
                Obs
              </th>
              <th
                style={{
                  textAlign: 'right',
                  padding: 10,
                  borderBottom: '1px solid #eee',
                }}
              >
                Eff
              </th>
              <th
                style={{
                  textAlign: 'right',
                  padding: 10,
                  borderBottom: '1px solid #eee',
                }}
              >
                WFE
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((c) => {
              const isSel = c.id === selectedId;
              const tubeIn = mmToIn(c.geometry.tubeLength_mm);
              const obsPct = 100 * c.geometry.obstructionRatio;
              const effPct = 100 * c.throughput.usableLightEfficiency;
              const wfe = c.aberrations.wfeRms_waves_edge;
              return (
                <tr
                  key={c.id}
                  onClick={() => void select(c)}
                  style={{
                    cursor: 'pointer',
                    background: isSel ? '#f5f5f5' : 'white',
                    borderBottom: '1px solid #f2f2f2',
                  }}
                >
                  <td style={{ padding: 10, whiteSpace: 'nowrap' }}>
                    <div style={{ fontWeight: 600 }}>
                      {String(c.kind).toUpperCase()}
                    </div>
                    <div style={{ fontFamily: 'monospace', fontSize: 12 }}>
                      {c.id}
                    </div>
                  </td>
                  <td
                    style={{
                      padding: 10,
                      textAlign: 'right',
                      fontFamily: 'monospace',
                    }}
                  >
                    {fmt(c.score.total, 3)}
                  </td>
                  <td
                    style={{
                      padding: 10,
                      textAlign: 'right',
                      fontFamily: 'monospace',
                    }}
                  >
                    {fmt(tubeIn, 1)} in
                  </td>
                  <td
                    style={{
                      padding: 10,
                      textAlign: 'right',
                      fontFamily: 'monospace',
                    }}
                  >
                    {fmt(obsPct, 1)}%
                  </td>
                  <td
                    style={{
                      padding: 10,
                      textAlign: 'right',
                      fontFamily: 'monospace',
                    }}
                  >
                    {fmt(effPct, 1)}%
                  </td>
                  <td
                    style={{
                      padding: 10,
                      textAlign: 'right',
                      fontFamily: 'monospace',
                    }}
                  >
                    {fmt(wfe, 3)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div
        style={{
          border: '1px solid #ddd',
          borderRadius: 8,
          minHeight: '40vh',
          overflow: 'auto',
          padding: 8,
          minWidth: 0,
        }}
      >
        {status === 'loading' ? (
          <div style={{ padding: 12 }}>loading svg...</div>
        ) : null}
        {status === 'error' ? (
          <div style={{ padding: 12 }}>
            <div style={{ marginBottom: 8 }}>failed to render svg</div>
            {errorText ? (
              <pre
                style={{
                  whiteSpace: 'pre-wrap',
                  fontSize: 12,
                  fontFamily: 'monospace',
                }}
              >
                {errorText}
              </pre>
            ) : null}
          </div>
        ) : null}
        {status === 'idle' && emptyText ? (
          <div style={{ padding: 12 }}>{emptyText}</div>
        ) : null}
        {svg ? (
          <div
            style={{ maxWidth: '100%' }}
            dangerouslySetInnerHTML={{ __html: svg }}
          />
        ) : null}
      </div>
    </div>
  );
}
