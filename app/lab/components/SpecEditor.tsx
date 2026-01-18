'use client';

import type {
  InputSpec,
  OpticDesignKind,
  Units,
} from '../../../src/optics/types';

import { toMm } from '../../../src/optics/units';
import { DEFAULT_TUBE_MARGIN_MM } from '../../../src/optics/constants';

import { NumberField } from './NumberField';
import { UnitsField } from './UnitsField';
import { asNumber, setIn } from './fields';

function toggleKind(
  kinds: OpticDesignKind[],
  kind: OpticDesignKind
): OpticDesignKind[] {
  if (kinds.includes(kind)) return kinds.filter((k) => k !== kind);
  return [...kinds, kind];
}

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

function fromMm(mm: number, units: Units): number {
  return units === 'inch' ? mm / 25.4 : mm;
}

function computeRequiredMaxTube(spec: InputSpec): number | null {
  const kinds = spec.designKinds;
  const isNewtonianOnly = kinds.length === 1 && kinds[0] === 'newtonian';
  if (!isNewtonianOnly) return null;

  const D_mm = toMm(spec.aperture, spec.apertureUnits);
  const Fp = Number.isFinite(spec.targetSystemFRatio)
    ? spec.targetSystemFRatio
    : 0;

  if (!(Number.isFinite(D_mm) && D_mm > 0 && Fp > 0)) return null;

  const required_mm = Fp * D_mm + DEFAULT_TUBE_MARGIN_MM;
  if (!(Number.isFinite(required_mm) && required_mm > 0)) return null;

  return fromMm(required_mm, spec.constraints.tubeLengthUnits);
}

export function SpecEditor(props: {
  spec: InputSpec;
  setSpecAction: (s: InputSpec) => void;
  disabled?: boolean;
}) {
  const spec = props.spec;
  const disabled = props.disabled === true;

  const requiredMaxTube = computeRequiredMaxTube(spec);
  const maxTubeHint =
    requiredMaxTube !== null
      ? `Requires >= ${requiredMaxTube.toFixed(2)} ${spec.constraints.tubeLengthUnits} for selected design(s)`
      : '';

  function updateNumber(path: string, v: string) {
    if (disabled) return;
    const parts = path.split('.');
    const fallback = getNumberFallback(spec, parts);
    let next = asNumber(v, fallback);

    if (path === 'constraints.maxTubeLength' && requiredMaxTube !== null) {
      if (Number.isFinite(next) && next < requiredMaxTube)
        next = requiredMaxTube;
    }

    props.setSpecAction(setIn(spec, parts, next));
  }

  function updateUnits(path: string, v: Units) {
    if (disabled) return;
    const parts = path.split('.');
    props.setSpecAction(setIn(spec, parts, v));
  }

  function updateKinds(kind: OpticDesignKind) {
    if (disabled) return;
    props.setSpecAction({
      ...spec,
      designKinds: toggleKind(spec.designKinds, kind),
    });
  }

  return (
    <div
      className={`flex flex-col gap-6 ${disabled ? 'opacity-60 pointer-events-none' : ''}`}
    >
      <div>
        <h2 className='text-lg font-semibold'>Design selection</h2>
        <div className='mt-4 grid grid-cols-2 gap-3'>
          {(['newtonian', 'cassegrain', 'sct', 'rc'] as OpticDesignKind[]).map(
            (k) => (
              <label key={k} className='flex items-center gap-2 text-sm'>
                <input
                  type='checkbox'
                  checked={spec.designKinds.includes(k)}
                  onChange={() => updateKinds(k)}
                  disabled={disabled}
                />
                <span className='capitalize'>{k}</span>
              </label>
            )
          )}
        </div>
      </div>

      <div className='grid grid-cols-2 gap-4'>
        <div className='flex flex-col gap-2'>
          <label className='text-sm font-medium'>Aperture</label>
          <div className='flex gap-2'>
            <input
              className='w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm'
              type='number'
              value={spec.aperture}
              onChange={(e) => updateNumber('aperture', e.target.value)}
              disabled={disabled}
            />
            <UnitsField
              value={spec.apertureUnits}
              setUnitsAction={(u) => updateUnits('apertureUnits', u)}
            />
          </div>
        </div>

        <NumberField
          label='Target system f-ratio'
          value={spec.targetSystemFRatio}
          step={0.1}
          setValueAction={(v) => updateNumber('targetSystemFRatio', v)}
          disabled={disabled}
        />
      </div>

      <div>
        <h3 className='text-sm font-semibold text-zinc-900'>Constraints</h3>
        <div className='mt-3 grid grid-cols-2 gap-4'>
          <div className='flex flex-col gap-1'>
            <label className='text-sm font-medium'>Max tube length</label>
            {maxTubeHint ? (
              <div className='text-xs text-zinc-500'>{maxTubeHint}</div>
            ) : null}
            <div className='mt-1 flex gap-2'>
              <input
                className='w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm'
                type='number'
                value={spec.constraints.maxTubeLength}
                min={requiredMaxTube !== null ? requiredMaxTube : undefined}
                onChange={(e) =>
                  updateNumber('constraints.maxTubeLength', e.target.value)
                }
                disabled={disabled}
              />
              <UnitsField
                value={spec.constraints.tubeLengthUnits}
                setUnitsAction={(u) =>
                  updateUnits('constraints.tubeLengthUnits', u)
                }
              />
            </div>
          </div>

          <NumberField
            label='Max obstruction ratio'
            value={spec.constraints.maxObstructionRatio}
            step={0.01}
            setValueAction={(v) =>
              updateNumber('constraints.maxObstructionRatio', v)
            }
            disabled={disabled}
          />

          <div className='flex flex-col gap-2'>
            <label className='text-sm font-medium'>Min backfocus</label>
            <div className='flex gap-2'>
              <input
                className='w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm'
                type='number'
                value={spec.constraints.minBackFocus}
                onChange={(e) =>
                  updateNumber('constraints.minBackFocus', e.target.value)
                }
                disabled={disabled}
              />
              <UnitsField
                value={spec.constraints.backFocusUnits}
                setUnitsAction={(u) =>
                  updateUnits('constraints.backFocusUnits', u)
                }
                options={['mm', 'inch']}
              />
            </div>
          </div>

          <div className='flex flex-col gap-2'>
            <label className='text-sm font-medium'>
              Fully illuminated field radius
            </label>
            <div className='flex gap-2'>
              <input
                className='w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm'
                type='number'
                value={spec.constraints.fullyIlluminatedFieldRadius}
                onChange={(e) =>
                  updateNumber(
                    'constraints.fullyIlluminatedFieldRadius',
                    e.target.value
                  )
                }
                disabled={disabled}
              />
              <UnitsField
                value={spec.constraints.fieldUnits}
                setUnitsAction={(u) => updateUnits('constraints.fieldUnits', u)}
                options={['mm', 'inch']}
              />
            </div>
          </div>
        </div>
      </div>

      <div>
        <h3 className='text-sm font-semibold text-zinc-900'>Coatings</h3>
        <div className='mt-3 grid grid-cols-2 gap-4'>
          <NumberField
            label='Reflectivity per mirror'
            value={spec.coatings.reflectivityPerMirror ?? 0}
            step={0.01}
            setValueAction={(v) =>
              updateNumber('coatings.reflectivityPerMirror', v)
            }
            disabled={disabled}
          />
          <NumberField
            label='Corrector transmission'
            value={spec.coatings.correctorTransmission ?? 0}
            step={0.01}
            setValueAction={(v) =>
              updateNumber('coatings.correctorTransmission', v)
            }
            disabled={disabled}
          />
        </div>
      </div>

      {disabled ? (
        <div className='rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-600'>
          Locked: sweep parameters drive design targets
        </div>
      ) : null}
    </div>
  );
}
