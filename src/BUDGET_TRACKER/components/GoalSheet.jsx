// The popup for creating or editing a SAVINGS PLAN.
//   <GoalSheet goal={{}} />        -> new plan
//   <GoalSheet goal={existing} />  -> edit that plan
//
// A plan has: name, icon, colour, target amount, "already saved" amount, and a NOTE (what it is for).
// Creating a plan also creates a category with the same name (done in services/localStore.js).
import { useState } from 'react';
import Sheet from './ui/Sheet';
import Icon from './ui/Icon';
import { COLORS } from '../constants/defaults';
import { CATEGORY_ICONS } from '../constants/icons';
import { getCurrencySymbol } from '../utils/format';

// onSave(data) may throw an Error (for example "name already used"): we show its message
export default function GoalSheet({ goal, onClose, onSave }) {
  const [name, setName] = useState(goal.name || '');
  const [icon, setIcon] = useState(goal.icon || 'target');
  const [color, setColor] = useState(goal.color || COLORS[0]);
  const [target, setTarget] = useState(goal.target ? String(goal.target) : '');
  // the amount saved before tracking (older plans kept it in `saved`)
  const openingAmount = goal.start !== undefined ? goal.start : goal.saved || 0;
  const [start, setStart] = useState(openingAmount ? String(openingAmount) : '');
  const [note, setNote] = useState(goal.note || '');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const canSave = name.trim() !== '' && Number(target) > 0 && !saving;
  const symbol = getCurrencySymbol();

  async function submit() {
    setSaving(true);
    setError('');
    try {
      await onSave({ name: name.trim(), icon, color, target: Number(target), start: Number(start) || 0, note: note.trim() });
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <Sheet onClose={onClose}>
      <b className="text-[17px]">{goal.id ? 'Edit plan' : 'New savings plan'}</b>

      <input className="bt-field" placeholder="Plan name (e.g. New phone)" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      <textarea
        className="bt-field"
        rows={3}
        placeholder="Note: what are you saving for? (optional)"
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />

      <div className="grid grid-cols-2 gap-2.5">
        <input className="bt-field" type="number" inputMode="decimal" placeholder={`Target (${symbol})`} value={target} onChange={(e) => setTarget(e.target.value)} />
        <input className="bt-field" type="number" inputMode="decimal" placeholder={`Already saved (${symbol})`} value={start} onChange={(e) => setStart(e.target.value)} />
      </div>

      {/* icon choice */}
      <small className="text-xs bt-text-mute">Icon</small>
      <div className="grid grid-cols-8 gap-1.5">
        {CATEGORY_ICONS.map((iconName) => (
          <button
            key={iconName}
            aria-label={iconName}
            onClick={() => setIcon(iconName)}
            className={`grid place-items-center rounded-[10px] border-[1.5px] bt-bg-surface80 py-[7px] ${icon === iconName ? 'bt-border-accent' : 'border-transparent'}`}
          >
            <Icon name={iconName} size={18} color={icon === iconName ? color : undefined} />
          </button>
        ))}
      </div>

      {/* colour choice */}
      <div className="flex gap-2">
        {COLORS.map((c) => (
          <button
            key={c}
            aria-label={c}
            onClick={() => setColor(c)}
            className={`h-7 w-7 rounded-full border-[3px] ${color === c ? 'bt-border-ink' : 'border-transparent'}`}
            style={{ background: c }}
          />
        ))}
      </div>

      {error && <p className="text-xs bt-text-danger">{error}</p>}
      <p className="bt-hint">
        A category named “{name.trim() || 'your plan'}” is created too. Income added to it grows the plan; expenses reduce it.
      </p>
      <button className="bt-btn-primary" disabled={!canSave} onClick={submit}>{goal.id ? 'Update plan' : 'Create plan'}</button>
    </Sheet>
  );
}
