'use client';

import { presets } from '../../../src/ui/presets';

type PresetPickerProps = {
  presetId: string;
  setPresetIdAction: (id: string) => void;
};

export function PresetPicker(props: PresetPickerProps) {
  return (
    <label className='flex flex-col gap-1'>
      <span className='text-xs font-medium text-zinc-700'>Preset</span>
      <select
        className='h-10 rounded-lg border border-zinc-200 bg-white px-3 text-sm'
        value={props.presetId}
        onChange={(e) => props.setPresetIdAction(e.target.value)}
      >
        <option value=''>Custom</option>
        {presets.map((p) => (
          <option key={p.id} value={p.id}>
            {p.label}
          </option>
        ))}
      </select>
    </label>
  );
}
