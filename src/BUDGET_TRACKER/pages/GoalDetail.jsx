// ONE SAVINGS PLAN, in full: progress, note, money added / taken out, a 6-month chart,
// a pace estimate and every transaction of the plan. Opened by tapping a plan on Home (or in Settings).
//
// "Add money" / "Take money out" open the normal Add-transaction popup with this plan's category already chosen:
//   income in the plan's category  -> the plan grows
//   expense in the plan's category -> the plan shrinks
import { useState } from 'react';
import Icon from '../components/ui/Icon';
import GoalSheet from '../components/GoalSheet';
import TransactionRow from '../components/TransactionRow';
import { useData } from '../hooks/useBudgetData';
import { fmt } from '../utils/format';
import { newestFirst } from '../utils/dates';
import { estimateCompletion, monthlyNetSince, planProgress, planStartDate } from '../utils/plans';

export default function GoalDetail({ goalId, onBack, onAddMoney, onWithdraw, onOpen, onEdit, onDelete }) {
  const { goals, transactions, updateGoal } = useData();
  const [editing, setEditing] = useState(false);

  const goal = goals.find((g) => g.id === goalId);
  if (!goal) {
    // the plan was deleted (maybe on another device)
    return (
      <div>
        <button className="mb-2 flex items-center gap-1 text-sm font-semibold" onClick={onBack}><Icon name="chevL" size={16} /> Back</button>
        <div className="p-4 text-center text-[13px] bt-text-mute">This plan no longer exists.</div>
      </div>
    );
  }

  const progress = planProgress(goal, transactions);
  const startDay = planStartDate(goal, progress.planTransactions);
  const months = monthlyNetSince(progress.planTransactions, startDay); // every month since the plan started
  const biggest = Math.max(1, ...months.map((m) => Math.abs(m.net)));
  const estimate = estimateCompletion(progress, progress.planTransactions);
  const planList = [...progress.planTransactions].sort(newestFirst);

  // The number cards: [icon, label, value]
  const cards = [
    ['down', 'Added so far', fmt(progress.added)],
    ['up', 'Taken out', fmt(progress.withdrawn)],
    ['wallet', 'Before tracking', fmt(progress.start)],
    ['target', 'Still to save', fmt(progress.remaining)],
  ];

  async function saveEdit(data) {
    await updateGoal(goal.id, data); // throws if the new name is already used: GoalSheet shows the message
    setEditing(false);
  }

  return (
    <div>
      <button className="mb-2 flex items-center gap-1 text-sm font-semibold" onClick={onBack}>
        <Icon name="chevL" size={16} /> Back
      </button>

      {/* header: icon, name, note, progress */}
      <div className="bt-glass">
        <div className="flex items-center gap-3">
          <span className="grid h-12 w-12 shrink-0 place-items-center bt-tile" style={{ background: goal.color + '28' }}>
            <Icon name={goal.icon || 'target'} size={24} color={goal.color} />
          </span>
          <div className="min-w-0 flex-1">
            <b className="block truncate text-base">{goal.name}</b>
            <small className="text-xs bt-text-mute">{fmt(progress.saved)} of {fmt(progress.target)}</small>
          </div>
          <b className="text-lg" style={{ color: goal.color }}>{Math.round(progress.percent)}%</b>
        </div>
        <div className="mt-3 h-2.5 overflow-hidden rounded-md bt-bg-line">
          <i className="block h-full rounded-md" style={{ width: `${progress.percent}%`, background: goal.color }} />
        </div>
        {goal.note && <p className="mt-3 whitespace-pre-line text-[13px] bt-text-mute">{goal.note}</p>}
        {progress.remaining === 0 && progress.target > 0 && (
          <p className="mt-3 flex items-center justify-center gap-1.5 rounded-xl bt-bg-sun px-3 py-2 text-[13px] font-semibold bt-text-plum">
            <Icon name="check" size={15} stroke={2.6} /> Goal reached
          </p>
        )}
      </div>

      {/* actions */}
      <div className="mt-2.5 grid grid-cols-2 gap-2.5">
        <button className="bt-btn-primary" onClick={() => onAddMoney(goal)}>Add money</button>
        <button className="bt-btn-ghost" onClick={() => onWithdraw(goal)}>Take money out</button>
      </div>

      {/* number cards */}
      <div className="mt-2.5 grid grid-cols-2 gap-2.5">
        {cards.map(([icon, label, value]) => (
          <div key={label} className="bt-glass">
            <small className="flex items-center gap-1.5 text-[11px] bt-text-mute"><Icon name={icon} size={14} /> {label}</small>
            <b className="mt-0.5 block text-base">{value}</b>
          </div>
        ))}
      </div>

      {/* pace estimate */}
      {estimate && (
        <div className="mt-2.5 rounded-2xl bt-bg-sky px-3.5 py-3 text-[13px]">
          At your current pace you will reach this goal in about <b>{estimate.months} month{estimate.months === 1 ? '' : 's'}</b>
          {' '}({estimate.date.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}).
        </div>
      )}

      {/* contributions since the plan started: money added minus money taken out, month by month */}
      <h2 className="mb-2.5 mt-5 flex items-center justify-between text-[15px] font-bold">
        Contributions since the start
        <small className="text-xs font-medium bt-text-mute">
          {new Date(`${startDay}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
        </small>
      </h2>
      <div className="bt-glass">
        <p className="mb-2 text-[12px] bt-text-mute">
          Started with {fmt(progress.start)} · contributed {fmt(progress.added - progress.withdrawn)} so far · {months.length} month{months.length === 1 ? '' : 's'}
        </p>
        {/* scrolls sideways when the plan is older than a few months */}
        <div className="overflow-x-auto">
          <div className="flex h-[130px] items-end gap-2.5" style={{ minWidth: Math.max(months.length * 46, 0) }}>
            {months.map((m) => (
              <div key={m.key} className="flex h-full min-w-[40px] flex-1 flex-col items-center justify-end gap-1 text-[10px] bt-text-mute">
                <span>{m.net !== 0 ? fmt(m.net) : ''}</span>
                <i
                  className="block w-full rounded-t-md"
                  style={{ height: `${Math.max(3, (Math.abs(m.net) / biggest) * 70)}%`, background: m.net < 0 ? '#f0605d' : goal.color }}
                />
                {m.label}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* every transaction of this plan */}
      <h2 className="mb-2.5 mt-5 flex items-center justify-between text-[15px] font-bold">
        Transactions <small className="text-xs font-medium bt-text-mute">{planList.length}</small>
      </h2>
      <div className="bt-glass bt-glass-list">
        {planList.length === 0 && <div className="p-4 text-center text-[13px] bt-text-mute">Nothing yet. Tap “Add money” to start.</div>}
        {planList.map((tx) => (
          <TransactionRow key={tx.id} tx={tx} onOpen={() => onOpen(tx)} onEdit={() => onEdit(tx)} onDelete={() => onDelete(tx)} />
        ))}
      </div>

      <button className="bt-btn-ghost mt-3 w-full" onClick={() => setEditing(true)}>Edit plan</button>
      {editing && <GoalSheet goal={goal} onClose={() => setEditing(false)} onSave={saveEdit} />}
    </div>
  );
}
