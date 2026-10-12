// A row of pill buttons where exactly one is selected (like "Expense | Income").
//
//   <Segmented value="expense" onChange={setType} options={[{ key, label, icon? }, ...]} />
import Icon from './Icon';

export default function Segmented({ options, value, onChange, className = '' }) {
  return (
    <div
      className={`grid rounded-2xl border bt-border-line bt-bg-surface80 p-1 ${className}`}
      style={{ gridTemplateColumns: `repeat(${options.length}, 1fr)` }} // equal-width columns
    >
      {options.map((option) => {
        const selected = value === option.key;
        return (
          <button
            key={option.key}
            onClick={() => onChange(option.key)}
            className={`flex items-center justify-center gap-1.5 rounded-xl py-2 text-sm font-semibold transition ${
              selected ? 'bt-bg-plum text-white' : 'bt-text-mute'
            }`}
          >
            {option.icon && <Icon name={option.icon} size={15} />}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
