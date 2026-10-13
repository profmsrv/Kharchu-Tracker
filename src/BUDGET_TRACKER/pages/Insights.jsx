// INSIGHTS tab: a few useful numbers about the selected period, the total / count / AVERAGE of every category (spending and income),
// and a searchable list of its transactions.
import { useState } from 'react';
import Icon from '../components/ui/Icon';
import PeriodBar from '../components/PeriodBar';
import TransactionRow from '../components/TransactionRow';
import { useData } from '../hooks/useBudgetData';
import { capitalize, fmt } from '../utils/format';
import { categoryAverages } from '../utils/averages';
import { TODAY, getRange, inRange, newestFirst, parseYmd, sumBy } from '../utils/dates';

const ONE_DAY = 24 * 60 * 60 * 1000; // milliseconds

// One card: for every category of one type in the selected period, its total, number of transactions and AVERAGE
// (average = total / number of transactions)
function AverageCard({ title, type, txs }) {
  const { getCategory } = useData();
  const rows = categoryAverages(txs, type);
  const grandTotal = rows.reduce((sum, row) => sum + row.total, 0);
  const biggest = Math.max(1, ...rows.map((row) => row.average));
  const colour = type === 'expense' ? 'bt-text-danger' : 'bt-text-success';

  return (
    <div className="bt-glass mt-2.5">
      <div className="mb-1 flex items-baseline justify-between">
        <b className="text-[13px]">{title}</b>
        <small className={`text-[11px] font-semibold ${colour}`}>{fmt(grandTotal)} in total</small>
      </div>
      {rows.length === 0 && <div className="py-3 text-center text-[13px] bt-text-mute">Nothing in this period.</div>}
      {rows.map((row) => {
        const category = getCategory(type, row.name);
        return (
          <div key={row.name} className="py-2">
            <div className="flex items-center gap-2.5">
              <span className="grid h-[30px] w-[30px] shrink-0 place-items-center bt-tile" style={{ background: category.color + '28' }}>
                <Icon name={category.icon} size={16} color={category.color} />
              </span>
              <div className="min-w-0 flex-1">
                <b className="block truncate text-[13px]">{row.name}</b>
                <small className="text-[11px] bt-text-mute">{fmt(row.total)} · {row.count} transaction{row.count === 1 ? '' : 's'}</small>
              </div>
              <div className="text-right">
                <b className="block text-[13px]">{fmt(row.average)}</b>
                <small className="text-[10px] bt-text-mute">average</small>
              </div>
            </div>
            <div className="mt-1.5 h-1 overflow-hidden rounded-md bt-bg-line">
              <i className="block h-full rounded-md" style={{ width: `${(row.average / biggest) * 100}%`, background: category.color }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Works out all the numbers shown on the cards
function calculateStats(txs, allTransactions, range, period) {
  const income = sumBy(txs, 'income');
  const expense = sumBy(txs, 'expense');

  // Spending in the PREVIOUS period (for the "higher / lower than before" banner)
  const previousRange = getRange({ ...period, o: period.o - 1 });
  const previousExpense = sumBy(allTransactions.filter((tx) => inRange(tx, previousRange)), 'expense');
  let changePercent = null; // null = nothing to compare with
  if (previousExpense > 0) changePercent = Math.round(((expense - previousExpense) / previousExpense) * 100);

  // Days that have passed so far (so the daily average of the CURRENT month is fair)
  const daysPassed = Math.floor((TODAY - range.s) / ONE_DAY) + 1;
  const days = Math.max(1, Math.min(range.days, daysPassed));

  // Spending per category -> find the biggest one
  const perCategory = {};
  const expenses = txs.filter((tx) => tx.type === 'expense' && !tx.goalId); // moving money to a savings plan is not real spending
  for (const tx of expenses) {
    perCategory[tx.category] = (perCategory[tx.category] || 0) + tx.amount;
  }
  const topCategory = Object.entries(perCategory).sort((a, b) => b[1] - a[1])[0]; // [name, total] or undefined
  const biggestExpense = [...expenses].sort((a, b) => b.amount - a.amount)[0];

  return { income, expense, days, changePercent, topCategory, biggestExpense };
}

export default function Insights({ txs, range, period, setPeriod, onOpen, onEdit, onDelete }) {
  const { transactions } = useData();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all'); // 'all' | 'expense' | 'income'

  const stats = calculateStats(txs, transactions, range, period);

  // The cards at the top: [icon, label, value]
  const savingsRate = stats.income > 0 ? `${Math.round(((stats.income - stats.expense) / stats.income) * 100)}%` : '—';
  const cards = [
    ['wallet', 'Savings rate', savingsRate],
    ['calendar', 'Daily average', fmt(stats.expense / stats.days)],
    ['star', 'Top category', stats.topCategory ? `${stats.topCategory[0]} · ${fmt(stats.topCategory[1])}` : '—'],
    ['bolt', 'Biggest expense', stats.biggestExpense ? `${capitalize(stats.biggestExpense.title)} · ${fmt(stats.biggestExpense.amount)}` : '—'],
    ['receipt', 'Transactions', txs.length],
    ['scale', 'Net', fmt(stats.income - stats.expense)],
  ];

  // The list below: apply the type filter and the search text, newest first
  const text = search.toLowerCase();
  const visible = txs
    .filter((tx) => typeFilter === 'all' || tx.type === typeFilter)
    .filter((tx) => `${tx.title} ${tx.category}`.toLowerCase().includes(text))
    .sort(newestFirst);

  // Group by day:  { "2026-10-10": [tx, tx], "2026-10-09": [tx] }
  const byDay = {};
  for (const tx of visible) {
    if (!byDay[tx.date]) byDay[tx.date] = [];
    byDay[tx.date].push(tx);
  }

  return (
    <div>
      <h2 className="mb-2.5 text-[15px] font-bold">Insights</h2>
      <PeriodBar period={period} setPeriod={setPeriod} range={range} />

      {/* yellow banner: spending compared with the previous period */}
      {stats.changePercent !== null && (
        <div className="mb-3 rounded-2xl bt-bg-sun px-3.5 py-3 text-center text-[13px] font-semibold bt-text-plum">
          Spending is {Math.abs(stats.changePercent)}% {stats.changePercent >= 0 ? 'higher' : 'lower'} than the previous {period.t}
        </div>
      )}

      {/* number cards */}
      <div data-tour="insights-cards" className="grid grid-cols-2 gap-2.5">
        {cards.map(([icon, label, value]) => (
          <div key={label} className="bt-glass">
            <small className="flex items-center gap-1.5 text-[11px] bt-text-mute"><Icon name={icon} size={14} /> {label}</small>
            <b className="mt-0.5 block text-base">{value}</b>
          </div>
        ))}
      </div>

      {/* the average of every category for the selected period */}
      <div data-tour="insights-averages">
      <h2 className="mb-2.5 mt-5 flex items-center justify-between text-[15px] font-bold">
        Category averages <small className="text-xs font-medium bt-text-mute">{range.label}</small>
      </h2>
      <AverageCard title="Spending by category" type="expense" txs={txs} />
      <AverageCard title="Income by category" type="income" txs={txs} />
      </div>

      {/* search + filter */}
      <div data-tour="insights-search">
      <h2 className="mb-2.5 mt-5 text-[15px] font-bold">All transactions</h2>
      <input className="bt-field" placeholder="Search note or category" value={search} onChange={(e) => setSearch(e.target.value)} />
      <div className="my-2.5 flex gap-2">
        {[['all', 'All'], ['expense', 'Expense'], ['income', 'Income']].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTypeFilter(key)}
            className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold ${
              typeFilter === key ? 'bt-border-plum bt-bg-plum text-white' : 'bt-border-line bt-bg-surface80'
            }`}
          >{label}</button>
        ))}
      </div>
      </div>

      {/* the list, one card per day */}
      {visible.length === 0 && <div className="p-4 text-center text-[13px] bt-text-mute">Nothing found.</div>}
      {Object.keys(byDay).map((day) => (
        <div key={day}>
          <div className="mb-1.5 mt-3.5 text-xs font-semibold bt-text-mute">
            {parseYmd(day).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
          </div>
          <div className="bt-glass bt-glass-list">
            {byDay[day].map((tx) => (
              <TransactionRow key={tx.id} tx={tx} onOpen={() => onOpen(tx)} onEdit={() => onEdit(tx)} onDelete={() => onDelete(tx)} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
