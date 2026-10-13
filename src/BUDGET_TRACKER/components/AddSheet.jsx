// The "Add transaction" / "Edit transaction" popup.
//   <AddSheet />                              -> add mode
//   <AddSheet initial={tx} />                 -> edit mode (fields start filled with the transaction)
//   <AddSheet preset={{ type, category }} />  -> add mode with type + category already chosen (used by savings plans)
//
// GUIDED FLOW in add mode:
//   1. Opens with "Expense" selected and the keyboard on the amount field.
//   2. Enter on the amount  -> keyboard closes, the CATEGORY grid is highlighted.
//   3. Pick a category      -> the cursor jumps to the NOTE field (the date picker is NOT opened).
//
// SAVINGS PLAN CATEGORIES: if the chosen category belongs to a savings plan, the user is asked to confirm that the
// entry is for that plan. Then ONE transaction with a bank icon is saved (see addPlanMove in services/localStore.js):
//   Income  -> money goes INTO the plan:  expense "Moved to plan: ..."  (balance down, plan up)
//   Expense -> money is TAKEN OUT of the plan (only if the plan holds that much):  income "From plan: ..." (balance up, plan down)
// A plan move that is edited later keeps its type and category; amount, date and note can change.
//
// NOTHING IS LOST: while typing, the form is saved as a DRAFT (services/drafts.js). If the popup is closed by
// accident (for example a tap outside it), reopening it within DRAFT_LIFETIME_MS restores everything.
// The draft is cleared when the transaction is saved.
import { useEffect, useRef, useState } from 'react';
import Sheet from './ui/Sheet';
import Icon from './ui/Icon';
import Segmented from './ui/Segmented';
import { useData } from '../hooks/useBudgetData';
import { TODAY, ymd } from '../utils/dates';
import { capitalize, fmt, getCurrencySymbol } from '../utils/format';
import { planProgress } from '../utils/plans';
import { rankCategories } from '../utils/categoryUsage';
import { clearDraft, getDraft, setDraft, touchDraft } from '../services/drafts';

const DRAFT_LIFETIME_MS = 30 * 1000; // change this number to keep unfinished entries longer

// quiet = opened by the app tour: no keyboard, no draft
export default function AddSheet({ initial, preset, quiet = false, onClose, onSaved, onAddCategory }) {
  const { categories, goals, transactions, addTransaction, addPlanMove, updateTransaction } = useData();
  const isEditing = Boolean(initial);
  const useDraft = !isEditing && !preset && !quiet; // only a plain "add" uses drafts
  const isLinked = isEditing && Boolean(initial.goalId); // a savings plan move: type and category are fixed

  // An unfinished entry from a moment ago (or null)
  const [draft] = useState(() => (useDraft ? getDraft('tx', 'new', DRAFT_LIFETIME_MS) : null));

  // ----- form fields: start from the edited transaction, the preset, the draft, or empty values -----
  // Categories the user can pick: the system ones (used for plan transfers) are hidden
  // (and the leftovers of deleted savings plans: a category that belongs to a plan that no longer exists)
  const pickable = (type) => categories[type].filter((c) => !c.system && (!c.goalId || goals.some((g) => g.id === c.goalId)));
  // The normal categories of a type, best first: recently used + most used in the last 30 days, then all the others
  const ranked = (type) => rankCategories(pickable(type).filter((c) => !c.goalId), transactions, type, TODAY);
  const first = (list) => (list.length > 0 ? list[0].name : '');
  const firstChoice = (type) => {
    const { quick, rest } = ranked(type);
    return first([...quick, ...rest]) || first(pickable(type)); // a plan category only when there is no normal one
  };
  const startType = initial ? initial.type : preset ? preset.type : draft ? draft.type : 'expense';
  const startCategory = initial
    ? initial.category
    : preset
      ? preset.category
      : draft && pickable(draft.type).some((c) => c.name === draft.category)
        ? draft.category
        : firstChoice(startType);

  const [type, setType] = useState(startType);
  const [amount, setAmount] = useState(initial ? String(initial.amount) : draft ? draft.amount : '');
  const [title, setTitle] = useState(initial ? initial.title : draft ? draft.title : '');
  const [category, setCategory] = useState(startCategory);
  const [date, setDate] = useState(initial ? initial.date : draft ? draft.date : ymd(TODAY));

  // Which part of the form is glowing right now: null | 'category' | 'extra' (note + date)
  const [highlight, setHighlight] = useState(null);
  const [saving, setSaving] = useState(false);
  const [restored, setRestored] = useState(Boolean(draft));
  const [error, setError] = useState('');
  const [planToConfirm, setPlanToConfirm] = useState(null); // the plan the user is being asked about

  // References to real DOM elements, so we can focus / scroll to them
  const amountInput = useRef(null);
  const noteInput = useRef(null);
  const categoryBox = useRef(null);
  const extraBox = useRef(null);

  // Put the cursor in the amount field (this opens the keyboard on phones)
  function focusAmount() {
    setTimeout(() => {
      if (amountInput.current) amountInput.current.focus();
    }, 60);
  }

  // When the popup opens, focus the amount.
  // IMPORTANT: a useEffect may only return a CLEANUP FUNCTION (or nothing).
  useEffect(() => {
    if (quiet) return undefined; // the tour must not open the keyboard
    const timer = setTimeout(() => {
      if (amountInput.current) amountInput.current.focus();
    }, 60);
    return () => clearTimeout(timer);
  }, []);

  // Keep the draft up to date while the user types
  useEffect(() => {
    if (!useDraft) return;
    if (amount || title) setDraft('tx', 'new', { type, amount, title, category, date });
    else clearDraft('tx', 'new');
  }, [useDraft, type, amount, title, category, date]);

  // When the popup closes, restart the draft's "30 seconds" clock from that moment
  useEffect(() => () => touchDraft('tx', 'new'), []);

  // Expense <-> Income switch
  function changeType(newType) {
    setType(newType);
    setCategory(firstChoice(newType)); // the old category does not exist in the other type
    setHighlight(null);
    focusAmount();
  }

  // Enter pressed in the amount field
  function afterAmount() {
    if (amountInput.current) amountInput.current.blur(); // blur = the keyboard closes
    if (preset) {
      focusNote(); // the category is already known (savings plan): go straight to the note
      return;
    }
    setHighlight('category'); // otherwise guide the user to the category grid
    setTimeout(() => {
      if (categoryBox.current) categoryBox.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 120);
  }

  // Move the cursor to the note field
  function focusNote() {
    setHighlight('extra');
    setTimeout(() => {
      if (extraBox.current) extraBox.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      if (noteInput.current) noteInput.current.focus();
    }, 150);
  }

  // A category was tapped
  function chooseCategory(name) {
    setCategory(name);
    if (isEditing) {
      setHighlight(null);
      return;
    }
    focusNote(); // add mode: the cursor jumps to the note field
  }

  // "Start fresh" on the restored-draft hint
  function discardDraft() {
    clearDraft('tx', 'new');
    setType('expense');
    setAmount('');
    setTitle('');
    setCategory(first(pickable('expense')));
    setDate(ymd(TODAY));
    setRestored(false);
    focusAmount();
  }

  // The savings plan that the chosen category belongs to (or null for a normal category)
  function chosenPlan() {
    const chosen = categories[type].find((c) => c.name === category);
    return chosen && chosen.goalId ? goals.find((g) => g.id === chosen.goalId) || null : null;
  }

  // Save button
  async function save() {
    const amountNumber = Number(amount);
    if (!(amountNumber > 0) || !category || saving) return; // needs an amount and a category
    setError('');

    // Entering something in a savings plan's category: check it, then ask the user (add mode only)
    const plan = chosenPlan();
    if (plan && !isEditing) {
      const available = planProgress(plan, transactions).saved;
      if (type === 'expense' && amountNumber > available) {
        setError(`Only ${fmt(available)} is available in "${plan.name}". Take out less, or choose another category.`);
        return;
      }
      if (!preset) {
        setPlanToConfirm(plan); // popup: "Is this for the plan?"
        return;
      }
      await saveToPlan(plan); // the plan screen's own buttons already made the intention clear
      return;
    }

    await saveNormally(amountNumber);
  }

  // A normal transaction (or the edit of one)
  async function saveNormally(amountNumber) {
    setSaving(true);
    const data = {
      type,
      title: capitalize(title.trim()) || category, // no note typed -> use the category name
      category,
      amount: amountNumber,
      date,
    };
    try {
      if (isEditing) await updateTransaction(initial.id, data);
      else await addTransaction(data);
      clearDraft('tx', 'new'); // saved for real: the draft is not needed any more
      onSaved();
    } catch (err) {
      console.error(err);
      setError(err.message || 'Could not save.');
      setSaving(false);
    }
  }

  // Money into / out of a savings plan: ONE transaction
  async function saveToPlan(plan) {
    setSaving(true);
    try {
      await addPlanMove({
        goalId: plan.id,
        direction: type === 'income' ? 'in' : 'out',
        amount: Number(amount),
        date,
        note: capitalize(title.trim()),
      });
      clearDraft('tx', 'new');
      onSaved();
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  // The user answered the "is this for the plan?" popup
  function answerPlanQuestion(isForPlan) {
    const plan = planToConfirm;
    setPlanToConfirm(null);
    if (isForPlan) {
      saveToPlan(plan);
      return;
    }
    // "No": let the user pick a different category
    setHighlight('category');
    if (categoryBox.current) categoryBox.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  // CSS classes that make a box glow (only when it is the highlighted one)
  const boxBase = '-m-1.5 rounded-[18px] border-2 border-transparent p-1.5 transition';

  return (
    <>
      <Sheet onClose={onClose}>
        <b className="text-[17px]">
          {isEditing ? 'Edit transaction' : preset ? `${preset.type === 'income' ? 'Add money to' : 'Take money from'} ${preset.category}` : 'Add transaction'}
        </b>

        {restored && (
          <div className="flex items-center justify-between gap-2 rounded-xl bt-bg-blush px-3 py-2 text-xs">
            <span>Restored your unfinished entry.</span>
            <button className="font-bold underline" onClick={discardDraft}>Start fresh</button>
          </div>
        )}

        {/* a linked savings plan entry cannot change its type or category */}
        {isLinked && (
          <div className="rounded-xl bt-bg-sky px-3 py-2 text-xs">
            Savings plan entry ({initial.category}). You can change the amount, date and note; type and category stay.
          </div>
        )}

        {/* 1. Expense or Income + 2. Amount */}
        <div data-tour="add-top" className="flex flex-col gap-2.5">
        {!isLinked && (
          <Segmented
            value={type}
            onChange={changeType}
            options={[{ key: 'expense', label: 'Expense' }, { key: 'income', label: 'Income' }]}
          />
        )}

        {/* 2. Amount */}
        <input
          ref={amountInput}
          className="bt-field"
          type="number"
          inputMode="decimal"
          enterKeyHint="next"
          placeholder={`Amount (${getCurrencySymbol()})`}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          onFocus={() => setHighlight(null)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              afterAmount();
            }
          }}
        />
        </div>

        {/* 3. Category grid (+ an "Add" tile that takes the user to Settings -> Categories) */}
        {!isLinked && (
        <div ref={categoryBox} data-tour="add-categories" className={`${boxBase} ${highlight === 'category' ? 'bt-highlight' : ''}`}>
          {/* normal categories: first the ones you use most, then all the others, then the "Add" tile */}
          {(() => {
            const { quick, rest } = ranked(type);
            const tile = (c) => {
              const selected = category === c.name;
              return (
                <button
                  key={c.id}
                  onClick={() => chooseCategory(c.name)}
                  className={`bt-cat flex flex-col items-center gap-1 rounded-2xl border-[1.5px] bt-bg-surface80 px-0.5 py-2 text-[11px] ${
                    selected ? 'bt-cat-on bt-border-accent bt-bg-blush' : 'bt-border-line'
                  }`}
                >
                  <span className="grid h-[34px] w-[34px] place-items-center bt-tile" style={{ background: c.color + '28' }}>
                    <Icon name={c.icon} size={18} color={c.color} />
                  </span>
                  {c.name}
                </button>
              );
            };
            const addTile = (
              <button
                key="add"
                onClick={() => onAddCategory(type)}
                className="bt-cat flex flex-col items-center gap-1 rounded-2xl border-[1.5px] border-dashed bt-border-line px-0.5 py-2 text-[11px] bt-text-mute"
              >
                <span className="grid h-[34px] w-[34px] place-items-center"><Icon name="plus" size={18} /></span>
                Add
              </button>
            );
            const label = (text, icon) => (
              <small className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide bt-text-mute">
                <Icon name={icon} size={13} /> {text}
              </small>
            );
            return (
              <>
                {quick.length > 0 && (
                  <div className="mb-3">
                    {label('Recent & most used', 'star')}
                    <div className="grid grid-cols-4 gap-2">{quick.map(tile)}</div>
                  </div>
                )}
                {quick.length > 0 && rest.length > 0 && label('All categories', 'tag')}
                <div className="grid grid-cols-4 gap-2">
                  {rest.map(tile)}
                  {addTile}
                </div>
              </>
            );
          })()}

          {/* SAVINGS PLANS: shown separately and styled differently (wide tiles, coloured dashed border, progress bar),
              so they are never mistaken for normal categories */}
          {pickable(type).some((c) => c.goalId) && (
            <div className="mt-3">
              <small className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide bt-text-mute">
                <Icon name="target" size={13} /> Savings plans · {type === 'income' ? 'add money to a plan' : 'take money out of a plan'}
              </small>
              <div className="grid grid-cols-2 gap-2">
                {pickable(type).filter((c) => c.goalId).map((c) => {
                  const plan = goals.find((g) => g.id === c.goalId);
                  if (!plan) return null;
                  const progress = planProgress(plan, transactions);
                  const selected = category === c.name;
                  return (
                    <button
                      key={c.id}
                      onClick={() => chooseCategory(c.name)}
                      className={`rounded-2xl border-2 border-dashed px-2.5 py-2 text-left ${selected ? 'bt-bg-blush' : 'bt-bg-surface80'}`}
                      style={{ borderColor: c.color }}
                    >
                      <span className="flex items-center gap-2 text-[12px] font-semibold">
                        <span className="grid h-7 w-7 shrink-0 place-items-center bt-tile" style={{ background: c.color + '28' }}>
                          <Icon name={c.icon} size={15} color={c.color} />
                        </span>
                        <span className="min-w-0 truncate">{c.name}</span>
                      </span>
                      <small className="mt-1 block text-[10px] bt-text-mute">{fmt(progress.saved)} / {fmt(progress.target)}</small>
                      <span className="mt-1 block h-1 overflow-hidden rounded bt-bg-line">
                        <i className="block h-full rounded" style={{ width: `${progress.percent}%`, background: c.color }} />
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
        )}

        {/* 4. Note + date */}
        <div ref={extraBox} data-tour="add-details" className={`${boxBase} flex flex-col gap-2.5 ${highlight === 'extra' ? 'bt-highlight' : ''}`}>
          <input
            ref={noteInput}
            className="bt-field"
            placeholder="Note (optional)"
            value={title}
            enterKeyHint="done"
            onChange={(e) => setTitle(e.target.value)}
            onFocus={() => setHighlight('extra')}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                e.target.blur(); // close the keyboard so the Save button is visible
              }
            }}
          />
          <input
            className="bt-field"
            type="date"
            value={date}
            max={ymd(TODAY)} // no future dates
            onChange={(e) => setDate(e.target.value)}
          />
        </div>

        {error && <p className="text-xs bt-text-danger">{error}</p>}

        <button data-tour="add-save" className="bt-btn-primary" onClick={save} disabled={saving}>
          {saving ? 'Saving…' : isEditing ? 'Update' : 'Save'}
        </button>
      </Sheet>

      {/* "Is this for the savings plan?" */}
      {planToConfirm && (
        <Sheet center onClose={() => answerPlanQuestion(false)}>
          <b className="text-[17px]">Is this for “{planToConfirm.name}”?</b>
          <p className="mb-5 mt-2 text-[13px] bt-text-mute">
            {type === 'income'
              ? `${fmt(Number(amount))} will be moved from your balance into the savings plan “${planToConfirm.name}”. It is saved as one transaction, “Moved to plan: ${planToConfirm.name}”, and your balance goes down by ${fmt(Number(amount))}.`
              : `${fmt(Number(amount))} will be taken out of the savings plan “${planToConfirm.name}” (available: ${fmt(planProgress(planToConfirm, transactions).saved)}) and added to your balance. It is saved as one transaction, “From plan: ${planToConfirm.name}”. Record where you spend it as a normal expense.`}
          </p>
          <div className="grid gap-2.5">
            <button className="bt-btn-primary" onClick={() => answerPlanQuestion(true)}>Yes, for this plan</button>
            <button className="bt-btn-ghost" onClick={() => answerPlanQuestion(false)}>No, choose another category</button>
          </div>
        </Sheet>
      )}
    </>
  );
}
