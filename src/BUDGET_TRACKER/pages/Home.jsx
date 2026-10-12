// HOME tab: greeting + photo, period selector, balance card, income/expense, savings plans, recent transactions.
// "See all" opens EVERY transaction right here on Home (grouped by day, newest first); the phone's Back button
// (or "Show less") returns to the short list.
//
// Props come from App.jsx:
//   txs     transactions inside the selected period
//   range   the selected period (label, dates)
//   period, setPeriod   the selected period and the function that changes it
import { useMemo, useState } from 'react';
import Icon from '../components/ui/Icon';
import Avatar from '../components/Avatar';
import PeriodBar from '../components/PeriodBar';
import TransactionRow from '../components/TransactionRow';
import { useBackLayer } from '../hooks/useBackButton';
import { useData } from '../hooks/useBudgetData';
import { fmt, getCurrencySymbol } from '../utils/format';
import { TODAY, balanceOf, newestFirst, parseYmd, sumBy, ymd } from '../utils/dates';
import { planProgress } from '../utils/plans';

const PAGE_SIZE = 50; // how many transactions "See all" shows at a time (keeps long histories fast)

export default function Home({ txs, range, period, setPeriod, onManageGoals, onOpenGoal, onOpen, onEdit, onDelete }) {
  const { profile, transactions, goals } = useData();
  const [hideBalance, setHideBalance] = useState(false);
  const [showAll, setShowAll] = useState(false);   // false = last 7 days, true = every transaction
  const [shown, setShown] = useState(PAGE_SIZE);   // how many of them are on screen

  // While the full list is open, the phone's Back button closes it (instead of leaving the app)
  useBackLayer(showAll, () => setShowAll(false));
  function toggleAll() {
    setShown(PAGE_SIZE);
    setShowAll(!showAll);
  }

  // Totals for the selected period
  const income = sumBy(txs, 'income');
  const expense = sumBy(txs, 'expense');
  // The balance follows the selected week / month / year / custom range (txs = the transactions inside it).
  // Money moved into a savings plan lowers it, money taken out of a plan raises it (see balanceOf in utils/dates.js).
  const balance = balanceOf(txs);

  // RECENT = every transaction of the last 7 days (today and the 6 days before), newest first.
  // This does not depend on the period selected above.
  const sevenDaysAgo = ymd(new Date(TODAY.getFullYear(), TODAY.getMonth(), TODAY.getDate() - 6));
  const recent = transactions.filter((tx) => tx.date >= sevenDaysAgo).sort(newestFirst);

  // EVERY transaction (only worked out while the full list is open), cut into pages and grouped by day
  const everything = useMemo(() => (showAll ? [...transactions].sort(newestFirst) : []), [showAll, transactions]);
  const byDay = [];
  for (const tx of everything.slice(0, shown)) {
    const last = byDay[byDay.length - 1];
    if (last && last.date === tx.date) last.items.push(tx);
    else byDay.push({ date: tx.date, items: [tx] });
  }

  return (
    <div>
      {/* greeting */}
      <div className="mb-3 flex items-center gap-2.5">
        <Avatar photo={profile.photo} name={profile.name} size={40} />
        <div>
          <small className="block text-xs bt-text-mute">Hello,</small>
          <b>{profile.name}</b>
        </div>
      </div>

      {/* week / month / year selector */}
      <PeriodBar period={period} setPeriod={setPeriod} range={range} />

      {/* balance card */}
      <div className="relative overflow-hidden bt-r-card bt-grad-plum p-[18px] text-white">
        <div className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full bg-white/10" />
        <button aria-label="Show or hide balance" className="absolute right-4 top-4 z-10" onClick={() => setHideBalance(!hideBalance)}>
          <Icon name={hideBalance ? 'eyeoff' : 'eye'} size={18} />
        </button>
        <small className="text-xs opacity-70">Balance · {range.label}</small>
        <b className="my-1.5 block text-[30px]">{hideBalance ? `${getCurrencySymbol()} ••••••` : fmt(balance)}</b>
        <small className="text-xs opacity-70">Income − expenses: {fmt(income - expense)}</small>
      </div>

      {/* income + expense for the period */}
      <h2 className="mb-2.5 mt-5 flex items-center justify-between text-[15px] font-bold">
        Statistics <small className="text-xs font-medium bt-text-mute">{range.label}</small>
      </h2>
      <div className="grid grid-cols-2 gap-2.5">
        <div className="flex flex-col gap-0.5 bt-r-card bt-bg-sky px-3.5 py-3">
          <small className="flex items-center gap-1 text-[11px] bt-text-mute"><Icon name="down" size={13} /> Income</small>
          <b className="text-[17px]">{fmt(income)}</b>
        </div>
        <div className="flex flex-col gap-0.5 bt-r-card bt-bg-blush px-3.5 py-3">
          <small className="flex items-center gap-1 text-[11px] bt-text-mute"><Icon name="up" size={13} /> Expenses</small>
          <b className="text-[17px]">{fmt(expense)}</b>
        </div>
      </div>

      {/* savings plans: tap a card to see everything about that plan. With no plans, only a small "create" button is shown. */}
      {goals.length > 0 ? (
        <>
          <h2 className="mb-2.5 mt-5 flex items-center justify-between text-[15px] font-bold">
            My savings plan
            <button className="text-xs font-medium bt-text-mute" onClick={onManageGoals}>Manage</button>
          </h2>
          <div className="grid grid-cols-2 gap-2.5">
            {goals.map((goal) => {
              const progress = planProgress(goal, transactions); // saved amount is calculated from transactions
              return (
                <button key={goal.id} className="bt-glass text-left" onClick={() => onOpenGoal(goal.id)}>
                  <div className="flex items-center gap-2 text-[13px] font-semibold">
                    <span className="grid h-7 w-7 shrink-0 place-items-center bt-tile" style={{ background: goal.color + '28' }}>
                      <Icon name={goal.icon || 'target'} size={15} color={goal.color} />
                    </span>
                    <span className="truncate">{goal.name}</span>
                  </div>
                  <small className="mt-1.5 block text-[11px] bt-text-mute">{fmt(progress.saved)} / {fmt(progress.target)}</small>
                  {/* progress bar */}
                  <div className="mt-2 h-1.5 overflow-hidden rounded-md bt-bg-line">
                    <i className="block h-full rounded-md" style={{ width: `${progress.percent}%`, background: goal.color }} />
                  </div>
                </button>
              );
            })}
          </div>
        </>
      ) : (
        <button
          className="mt-5 flex w-full items-center justify-center gap-1.5 rounded-2xl border-[1.5px] border-dashed bt-border-line py-3 text-[13px] bt-text-mute"
          onClick={onManageGoals}
        >
          <Icon name="plus" size={15} /> Create a savings plan
        </button>
      )}

      {/* recent transactions, or ALL of them after "See all" */}
      <h2 className="mb-2.5 mt-5 flex items-center justify-between text-[15px] font-bold">
        {showAll ? (
          <span>All Transactions <small className="ml-1 text-xs font-medium bt-text-mute">{everything.length}</small></span>
        ) : (
          <span>Recent Transactions <small className="ml-1 text-xs font-medium bt-text-mute">Last 7 days</small></span>
        )}
        <button className="text-xs font-medium bt-text-mute" onClick={toggleAll}>{showAll ? 'Show less' : 'See all'}</button>
      </h2>

      {!showAll && (
        <>
          <div className="bt-glass bt-glass-list">
            {recent.length === 0 && (
              <div className="p-4 text-center text-[13px] bt-text-mute">No transactions in the last 7 days. Tap the add button to add one.</div>
            )}
            {recent.map((tx) => (
              <TransactionRow key={tx.id} tx={tx} onOpen={() => onOpen(tx)} onEdit={() => onEdit(tx)} onDelete={() => onDelete(tx)} />
            ))}
          </div>
          {recent.length > 0 && <p className="bt-hint mt-2 text-center">← swipe left to edit · swipe right to delete →</p>}
        </>
      )}

      {showAll && (
        <>
          {everything.length === 0 && <div className="bt-glass p-4 text-center text-[13px] bt-text-mute">No transactions yet. Tap the add button to add one.</div>}
          {byDay.map((group) => (
            <div key={group.date}>
              <div className="mb-1.5 mt-3.5 text-xs font-semibold bt-text-mute">
                {parseYmd(group.date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
              </div>
              <div className="bt-glass bt-glass-list">
                {group.items.map((tx) => (
                  <TransactionRow key={tx.id} tx={tx} onOpen={() => onOpen(tx)} onEdit={() => onEdit(tx)} onDelete={() => onDelete(tx)} />
                ))}
              </div>
            </div>
          ))}
          {everything.length > shown && (
            <button className="bt-btn-ghost mt-3 w-full" onClick={() => setShown(shown + PAGE_SIZE)}>
              Show more ({everything.length - shown} left)
            </button>
          )}
          {everything.length > 0 && <p className="bt-hint mt-2 text-center">← swipe left to edit · swipe right to delete →</p>}
        </>
      )}
    </div>
  );
}
