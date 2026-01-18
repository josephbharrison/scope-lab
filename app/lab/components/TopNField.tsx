'use client';

export function TopNField(props: {
  value: number;
  setTopNAction: (v: number) => void;
}) {
  return (
    <div className='flex flex-col gap-2'>
      <label className='text-sm font-medium text-zinc-900'>Top N</label>
      <input
        className='w-28 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm'
        type='number'
        min={1}
        max={200}
        value={props.value}
        onChange={(e) => props.setTopNAction(Number(e.target.value))}
      />
    </div>
  );
}
