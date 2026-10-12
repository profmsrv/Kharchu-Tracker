// CATEGORIES (Settings -> Manage categories, or the "Add" tile inside the Add-transaction popup).
// Add a category (icon + colour + name) or delete one.
import { useState } from 'react';
import Icon from '../components/ui/Icon';
import Segmented from '../components/ui/Segmented';
import { useData } from '../hooks/useBudgetData';
import { CATEGORY_SUGGESTIONS, COLORS } from '../constants/defaults';
import { CATEGORY_ICONS } from '../constants/icons';

// type = 'expense' | 'income' (the toggle at the top); askDelete(category) shows the confirm popup
export default function CategoryManager({ type, setType, onBack, askDelete }) {
  const { categories, goals, addCategory, deleteOrphanCategories } = useData();

  // the "new category" form
  const [icon, setIcon] = useState('cart');
  const [color, setColor] = useState(COLORS[0]);
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');

  // Leftovers: categories of a savings plan that was deleted earlier (older versions did not remove them)
  const isLeftover = (c) => Boolean(c.goalId) && !goals.some((g) => g.id === c.goalId);
  const leftovers = [...categories.expense, ...categories.income].filter(isLeftover);

  // Suggestions that do not exist yet (not as a category of this type and not as a plan name)
  const taken = [...categories[type].map((c) => c.name), ...goals.map((g) => g.name)].map((n) => n.toLowerCase());
  const suggestions = CATEGORY_SUGGESTIONS.filter((item) => !taken.includes(item.name.toLowerCase()));

  // Tapping a suggestion fills the form (name, icon, and the next colour); the user can still change anything
  function useSuggestion(item, index) {
    setName(item.name);
    setIcon(item.icon);
    setColor(COLORS[index % COLORS.length]);
    setMessage('');
  }

  async function add() {
    const cleanName = name.trim();
    const alreadyExists = categories[type].some((c) => c.name.toLowerCase() === cleanName.toLowerCase());
    if (!cleanName || alreadyExists) {
      setMessage('Enter a unique name');
      return;
    }

    const category = { type, name: cleanName, icon, color };

    await addCategory(category);
    setName('');
    setMessage('Added ✓');
  }

  return (
    <div>
      <button className="mb-2 flex items-center gap-1 text-sm font-semibold" onClick={onBack}>
        <Icon name="chevL" size={16} /> Settings
      </button>
      <h2 className="mb-2.5 text-[15px] font-bold">Categories</h2>

      <Segmented
        className="mb-3"
        value={type}
        onChange={setType}
        options={[{ key: 'expense', label: 'Expense' }, { key: 'income', label: 'Income' }]}
      />

      {/* the form */}
      <div className="bt-glass flex flex-col gap-2.5">
        <b className="text-sm">Add new category</b>

        {/* quick add: tap a name to fill the form */}
        {suggestions.length > 0 && (
          <div>
            <small className="text-xs bt-text-mute">Quick add (tap one)</small>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {suggestions.map((item, index) => (
                <button
                  key={item.name}
                  onClick={() => useSuggestion(item, index)}
                  className="flex items-center gap-1 rounded-full border bt-border-line bt-bg-surface80 px-2.5 py-1 text-[11px] font-medium"
                >
                  <Icon name={item.icon} size={13} /> {item.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* icon choice */}
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

        <input className="bt-field" placeholder="Category name" value={name} onChange={(e) => setName(e.target.value)} />
        <button className="bt-btn-primary" onClick={add}>Add {name || 'category'}</button>
        {message && <div className="bt-hint">{message}</div>}
      </div>

      {/* leftovers of deleted savings plans (for example "Vacation" or "Savings plan") */}
      {leftovers.length > 0 && (
        <div className="bt-glass mt-3 flex items-center gap-3">
          <div className="min-w-0 flex-1 text-[12px]">
            <b className="block text-[13px]">{leftovers.length} leftover categor{leftovers.length === 1 ? 'y' : 'ies'}</b>
            <span className="bt-text-mute">From savings plans that were deleted: {[...new Set(leftovers.map((c) => c.name))].join(', ')}.</span>
          </div>
          <button className="bt-btn-danger shrink-0 !px-3.5 !py-2 text-xs" onClick={deleteOrphanCategories}>Remove</button>
        </div>
      )}

      {/* the existing categories */}
      <h2 className="mb-2.5 mt-5 flex items-center justify-between text-[15px] font-bold">
        Your {type} categories <small className="text-xs font-medium bt-text-mute">{categories[type].length}</small>
      </h2>
      <div className="bt-glass bt-glass-list">
        {categories[type].map((c) => (
          <div key={c.id} className="flex items-center gap-2.5 py-2.5">
            <div className="grid h-[38px] w-[38px] place-items-center bt-tile" style={{ background: c.color + '28' }}>
              <Icon name={c.icon} size={19} color={c.color} />
            </div>
            <div className="min-w-0 flex-1">
              <b className="block text-[13px]">{c.name}</b>
              {(c.goalId && !isLeftover(c)) || c.system
                ? <small className="text-[11px] bt-text-mute">{c.system ? 'Used for savings plan transfers' : 'Savings plan · managed with the plan'}</small>
                : isLeftover(c) ? <small className="text-[11px] bt-text-mute">Leftover of a deleted savings plan</small>
                : null}
            </div>
            {/* a savings plan's category is deleted together with its plan, never on its own */}
            {((!c.goalId && !c.system) || isLeftover(c)) && (
              <button aria-label="Delete category" className="p-1.5 bt-text-danger" onClick={() => askDelete(c)}>
                <Icon name="trash" size={18} />
              </button>
            )}
          </div>
        ))}
        {categories[type].length === 0 && <div className="p-4 text-center text-[13px] bt-text-mute">No categories.</div>}
      </div>
    </div>
  );
}
