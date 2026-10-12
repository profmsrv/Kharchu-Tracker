// SAVINGS PLANS list (Settings -> Manage savings plans, or "Manage" on Home).
// Create, edit and delete plans. Tap a plan to open its full insights (GoalDetail).
// A plan is { id, name, icon, color, target, start, note }. The saved amount is calculated (utils/plans.js).
import { useState } from 'react';
import Icon from '../components/ui/Icon';
import GoalSheet from '../components/GoalSheet';
import { useData } from '../hooks/useBudgetData';
import { fmt } from '../utils/format';
import { planProgress } from '../utils/plans';

export default function GoalsManager({ onBack, ask, onOpenGoal }) {
  const { goals, transactions, addGoal, updateGoal, deleteGoal } = useData();

  // null = editor closed, {} = a new plan, or an existing plan being edited
  const [editing, setEditing] = useState(null);

  // Called by GoalSheet. If it throws (e.g. name already used) the sheet shows the message and stays open.
  async function saveGoal(data) {
    if (editing.id) await updateGoal(editing.id, data);
    else await addGoal(data);
    setEditing(null);
  }

  function askDelete(goal) {
    ask({
      title: 'Delete plan?',
      text: `${goal.name} and its two categories will be removed. Transactions you entered stay, but are no longer linked to a plan.`,
      onConfirm: () => deleteGoal(goal.id),
    });
  }

  return (
    <div>
      <button className="mb-2 flex items-center gap-1 text-sm font-semibold" onClick={onBack}>
        <Icon name="chevL" size={16} /> Settings
      </button>

      <div className="mb-2.5 flex items-center justify-between">
        <h2 className="text-[15px] font-bold">Savings plans</h2>
        <button className="flex items-center gap-1 rounded-xl bt-bg-plum px-3 py-1.5 text-xs font-bold text-white" onClick={() => setEditing({})}>
          <Icon name="plus" size={14} /> New plan
        </button>
      </div>

      <div className="flex flex-col gap-2.5">
        {goals.map((goal) => {
          const progress = planProgress(goal, transactions);
          return (
            <div key={goal.id} className="bt-glass">
              <div className="flex items-center gap-2.5">
                {/* tap the plan itself to open its insights */}
                <button className="flex min-w-0 flex-1 items-center gap-2.5 text-left" onClick={() => onOpenGoal(goal.id)}>
                  <span className="grid h-[38px] w-[38px] shrink-0 place-items-center bt-tile" style={{ background: goal.color + '28' }}>
                    <Icon name={goal.icon || 'target'} size={19} color={goal.color} />
                  </span>
                  <span className="min-w-0">
                    <b className="block truncate text-sm">{goal.name}</b>
                    <small className="text-[11px] bt-text-mute">{fmt(progress.saved)} of {fmt(progress.target)}</small>
                  </span>
                </button>
                <button aria-label="Edit plan" className="p-1.5" onClick={() => setEditing(goal)}><Icon name="edit" size={18} /></button>
                <button aria-label="Delete plan" className="p-1.5 bt-text-danger" onClick={() => askDelete(goal)}><Icon name="trash" size={18} /></button>
              </div>
              {goal.note && <p className="mt-2 line-clamp-2 text-[12px] bt-text-mute">{goal.note}</p>}
              <div className="mt-2.5 h-1.5 overflow-hidden rounded-md bt-bg-line">
                <i className="block h-full rounded-md" style={{ width: `${progress.percent}%`, background: goal.color }} />
              </div>
            </div>
          );
        })}
        {goals.length === 0 && <div className="p-4 text-center text-[13px] bt-text-mute">No plans yet. Tap “New plan” to add one.</div>}
      </div>

      {editing && <GoalSheet goal={editing} onClose={() => setEditing(null)} onSave={saveGoal} />}
    </div>
  );
}
