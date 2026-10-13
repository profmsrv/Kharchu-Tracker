// BUDGET tab: a chart (type and data chosen from two popups) and a card per expense category.
// The last chart type + data choice is remembered in localStorage ("bt-chart"), so it is the same next time.
// "Show data" also has the AVERAGES of the selected period (per day / week / month, see utils/averages.js).
// Categories that belong to a savings plan (and the system categories for plan transfers) are left out here:
// plans have their own screen.
import { useEffect, useState } from 'react';
import Pick from '../components/ui/Pick';
import PeriodBar from '../components/PeriodBar';
import ChartPanel, { CHARTS } from '../components/charts/Charts';
import { useData } from '../hooks/useBudgetData';
import { fmt } from '../utils/format';
import Icon from '../components/ui/Icon';

const CHART_KEY = 'bt-chart';

// The chart choice saved last time (checked, in case the list of charts changed since)
function readSavedChart() {
  try {
    const saved = JSON.parse(localStorage.getItem(CHART_KEY) || 'null');
    if (saved && CHARTS[saved.type] && saved.field >= 0 && saved.field < CHARTS[saved.type].fields.length) return saved;
  } catch { /* ignore */ }
  return { type: 'rings', field: 0 };
}

export default function Budget({ txs, range, period, setPeriod }) {
  const { categories } = useData();

  const [chartType, setChartType] = useState(() => readSavedChart().type); // key of CHARTS
  const [field, setField] = useState(() => readSavedChart().field);          // index in CHARTS[chartType].fields

  // Remember the choice
  useEffect(() => {
    try { localStorage.setItem(CHART_KEY, JSON.stringify({ type: chartType, field })); } catch { /* ignore */ }
  }, [chartType, field]);

  // Total of one type for one category inside the period (savings-plan moves are not spending or income)
  function totalFor(category, type) {
    let total = 0;
    for (const tx of txs) {
      if (tx.type === type && !tx.goalId && tx.category === category.name) total += tx.amount;
    }
    return total;
  }

  // Expense categories + what was spent, biggest first
  const rows = categories.expense
    .filter((c) => !c.goalId && !c.system)
    .map((c) => ({ ...c, spent: totalFor(c, 'expense') }))
    .sort((a, b) => b.spent - a.spent);
  const incomeRows = categories.income.filter((c) => !c.goalId && !c.system).map((c) => ({ ...c, spent: totalFor(c, 'income') }));
  const totalSpent = rows.reduce((sum, row) => sum + row.spent, 0);

  // Two popups' options
  const chartOptions = Object.keys(CHARTS).map((key) => ({ key, label: CHARTS[key].label, icon: CHARTS[key].icon, sub: CHARTS[key].sub }));
  const fieldOptions = CHARTS[chartType].fields.map((label, index) => ({ key: index, label }));

  return (
    <div>
      <h2 className="mb-2.5 text-[15px] font-bold">Budget Management</h2>
      <PeriodBar period={period} setPeriod={setPeriod} range={range} />

      {/* the two popup pickers */}
      <div data-tour="budget-pickers" className="mb-3 grid grid-cols-2 gap-2.5">
        <Pick label="Chart type" value={chartType} opts={chartOptions} onPick={(key) => { setChartType(key); setField(0); }} />
        <Pick label="Show data" value={field} opts={fieldOptions} onPick={setField} />
      </div>

      <div data-tour="budget-chart" className="bt-glass">
        <ChartPanel type={chartType} field={field} rows={rows} incomeRows={incomeRows} txs={txs} range={range} />
      </div>

      {/* one card per expense category: what was spent and its share of all spending */}
      <div data-tour="budget-cards">
      <h2 className="mb-2.5 mt-5 flex items-center justify-between text-[15px] font-bold">
        Spending by category <small className="text-xs font-medium bt-text-mute">{fmt(totalSpent)}</small>
      </h2>
      <div className="grid grid-cols-2 gap-2.5">
        {rows.map((row) => {
          const share = totalSpent > 0 ? (row.spent / totalSpent) * 100 : 0;
          return (
            <div key={row.id} className="bt-glass">
              <div className="flex items-center gap-1.5 text-[13px] font-semibold">
                <Icon name={row.icon} size={16} color={row.color} /> {row.name}
              </div>
              <small className="text-[11px] bt-text-mute">{fmt(row.spent)} · {Math.round(share)}%</small>
              <div className="mt-2 h-1.5 overflow-hidden rounded-md bt-bg-line">
                <i className="block h-full rounded-md" style={{ width: `${share}%`, background: row.color }} />
              </div>
            </div>
          );
        })}
      </div>
      </div>
    </div>
  );
}
