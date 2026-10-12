// A modern replacement for <select>: a popup with big tappable options.
//
//   opts = [{ key, label, sub?, icon? }, ...]
//   value = the key of the selected option
//   onPick(key) is called when the user taps one (the popup then closes)
import Sheet from './Sheet';
import Icon from './Icon';

export default function OptionSheet({ title, opts, value, onPick, onClose }) {
  return (
    <Sheet onClose={onClose}>
      <b className="text-[17px]">{title}</b>

      {opts.map((option) => {
        const selected = option.key === value;
        return (
          <button
            key={option.key}
            onClick={() => { onPick(option.key); onClose(); }}
            className={`flex w-full shrink-0 items-center gap-3 rounded-2xl border-[1.5px] p-3 text-left transition ${
              selected ? 'bt-border-accent bt-bg-blush' : 'border-transparent bt-bg-surface80'
            }`}
          >
            {option.icon && (
              <span className={`grid h-[38px] w-[38px] place-items-center rounded-xl ${selected ? 'bt-bg-surface' : 'bt-bg-blush'}`}>
                <Icon name={option.icon} size={19} />
              </span>
            )}
            <div className="flex-1">
              <b className="text-sm">{option.label}</b>
              {option.sub && <small className="mt-px block text-[11px] bt-text-mute">{option.sub}</small>}
            </div>
            {/* the tick mark on the selected option */}
            <span className="w-5 bt-text-accent">{selected && <Icon name="check" size={19} stroke={2.4} />}</span>
          </button>
        );
      })}
    </Sheet>
  );
}
