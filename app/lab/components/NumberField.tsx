'use client';

export function NumberField(props: {
  label: string;
  value: number;
  step?: number;
  min?: number;
  max?: number;
  disabled?: boolean;
  hint?: string;
  setValueAction: (v: string) => void;
}) {
  const disabled = props.disabled === true;

  return (
    <div className='flex flex-col gap-1'>
      <label
        className={
          disabled
            ? 'text-sm text-zinc-500'
            : 'text-sm font-medium text-zinc-900'
        }
      >
        {props.label}
      </label>

      <input
        className={[
          'w-full rounded-lg border px-3 py-2 text-sm transition',
          disabled
            ? 'border-zinc-200 bg-zinc-100 text-zinc-500'
            : 'border-zinc-200 bg-white text-zinc-900',
        ].join(' ')}
        type='number'
        step={props.step}
        min={props.min}
        max={props.max}
        value={props.value}
        disabled={disabled}
        onChange={(e) => props.setValueAction(e.target.value)}
      />

      {props.hint ? (
        <div className='text-xs text-zinc-500'>{props.hint}</div>
      ) : null}
    </div>
  );
}
