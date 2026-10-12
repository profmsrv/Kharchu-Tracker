// A dropdown-looking button. Tapping it opens an OptionSheet popup.
//
//   <Pick label="Chart type" value={key} opts={[{ key, label, ... }]} onPick={setKey} />
import { useState } from 'react';
import OptionSheet from './OptionSheet';
import Icon from './Icon';

export default function Pick({ label, opts, value, onPick }) {
  const [open, setOpen] = useState(false);
  const current = opts.find((option) => option.key === value) || opts[0];

  return (
    <div>
      <button
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-between rounded-2xl border bt-border-line bt-bg-surface80 px-3.5 py-2.5 text-left"
      >
        <span>
          <small className="block text-[10px] tracking-wide bt-text-mute">{label}</small>
          <b className="text-sm">{current.label}</b>
        </span>
        <Icon name="chevD" size={18} />
      </button>

      {open && <OptionSheet title={label} opts={opts} value={value} onPick={onPick} onClose={() => setOpen(false)} />}
    </div>
  );
}
