'use client';

export function NumberField(props: {
  label: string;
  value: number;
  step?: number;
  min?: number;
  max?: number;
  setValueAction: (v: string) => void;
}) {
  return (
    <div className='flex flex-col gap-2'>
      <label className='text-sm font-medium'>{props.label}</label>
      <input
        className='w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm'
        type='number'
        step={props.step}
        min={props.min}
        max={props.max}
        value={props.value}
        onChange={(e) => props.setValueAction(e.target.value)}
      />
    </div>
  );
}
