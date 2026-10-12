// All charts of the Budget tab. Every chart is plain SVG, no chart library.
//
// 1. CHARTS      the menu: chart types and their "data fields". Budget.jsx builds its two popups from it.
// 2. small parts (empty message, centre label, legend)
// 3. five chart components: Rings, Donut, Bars, Trend line, Radar
// 4. ChartPanel  (default export) picks the right chart for the user's choice
//
// Data given to the charts:
//   rows        expense categories, each with  spent
//   incomeRows  income categories, each with   spent  (= amount received)
//   txs         transactions inside the selected period
//   range       the selected period (see utils/dates.js)
//   field       index of the chosen data field (0, 1, 2 ...)
import Icon from '../ui/Icon';
import { ICONS } from '../../constants/icons';
import { fmt } from '../../utils/format';
import { parseYmd } from '../../utils/dates';
import { categoryAverages } from '../../utils/averages';

// ----- 1. the menu -----
export const CHARTS = {
  rings: { label: 'Rings', icon: 'rings', sub: 'Share of your spending', fields: ['Share of spending'] },
  donut: { label: 'Donut', icon: 'donut', sub: 'Share by category', fields: ['Expenses by category', 'Income by category'] },
  bars: { label: 'Bar chart', icon: 'barchart', sub: 'Compare categories', fields: ['Spent', 'Average spent', 'Average income'] },
  line: { label: 'Trend line', icon: 'trendup', sub: 'Changes over time', fields: ['Expenses', 'Income', 'Savings'] },
  radar: { label: 'Radar', icon: 'radar', sub: 'Spread across categories', fields: ['Spent', 'Average spent'] },
};

// The average of every category in the selected period: its total / its number of transactions (see utils/averages.js).
// Returns a Map  category name -> average
function averagesFor(txs, type) {
  return new Map(categoryAverages(txs, type).map((row) => [row.name, row.average]));
}

// ----- 2. small parts -----
function EmptyMessage({ text = 'No data for this period yet.' }) {
  return <div className="p-4 text-center text-[13px] bt-text-mute">{text}</div>;
}

// Text in the middle of a ring/donut
function CenterLabel({ label, value }) {
  return (
    <div className="absolute text-center">
      <small className="text-[11px] bt-text-mute">{label}</small>
      <b className="block text-[19px]">{value}</b>
    </div>
  );
}

// List under a chart:  ● icon Category ........ ₹amount · extra text
function Legend({ items, extraText }) {
  return (
    <div className="mt-2">
      {items.map((item) => (
        <div key={item.id} className="flex items-center gap-2 py-1 text-xs">
          <i className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: item.color }} />
          <span className="flex flex-1 items-center gap-1.5">
            <Icon name={item.icon} size={14} color={item.color} /> {item.name}
          </span>
          <b>{fmt(item.spent)}{extraText ? ` · ${extraText(item)}` : ''}</b>
        </div>
      ))}
    </div>
  );
}

// ----- 3a. Rings: one ring per category, how big a share of all spending it is -----
function RingsChart({ rows }) {
  const total = rows.reduce((sum, row) => sum + row.spent, 0);
  const ringThickness = Math.min(14, 96 / Math.max(1, rows.length)); // more categories -> thinner rings

  return (
    <>
      <div className="relative my-1 grid place-items-center">
        {/* -rotate-90: so every ring starts at 12 o'clock */}
        <svg width="240" height="240" viewBox="0 0 240 240" className="-rotate-90">
          {rows.map((row, index) => {
            const radius = 112 - index * ringThickness;
            const circumference = 2 * Math.PI * radius;
            const filled = total ? row.spent / total : 0; // share of all spending (0 to 1)

            return (
              <g key={row.id}>
                <circle cx="120" cy="120" r={radius} fill="none" stroke="rgb(var(--bt-line))" strokeWidth={ringThickness - 4} />
                <circle
                  cx="120" cy="120" r={radius} fill="none" stroke={row.color}
                  strokeWidth={ringThickness - 4} strokeLinecap="round"
                  strokeDasharray={`${circumference * filled} ${circumference}`} // draws only the filled part of the circle
                />
              </g>
            );
          })}
        </svg>
        <CenterLabel label="Total spent" value={fmt(total)} />
      </div>

      <Legend items={rows} extraText={(row) => `${total ? Math.round((row.spent / total) * 100) : 0}%`} />
    </>
  );
}

// ----- 3b. Donut: one coloured slice per category -----
function DonutChart({ items, title }) {
  const total = items.reduce((sum, item) => sum + item.spent, 0);
  if (total === 0) return <EmptyMessage />;

  const circumference = 2 * Math.PI * 80;
  let startsAt = 0; // fraction of the circle already used by earlier slices

  const slices = items.map((item) => {
    const fraction = item.spent / total;
    const slice = (
      <circle
        key={item.id} cx="110" cy="110" r="80" fill="none" stroke={item.color} strokeWidth="30"
        strokeDasharray={`${circumference * fraction} ${circumference}`}
        strokeDashoffset={-startsAt * circumference} // moves the slice to where the previous one ended
      />
    );
    startsAt += fraction;
    return slice;
  });

  return (
    <div>
      <div className="relative my-1 grid place-items-center">
        <svg width="220" height="220" viewBox="0 0 220 220" className="-rotate-90">{slices}</svg>
        <CenterLabel label={title} value={fmt(total)} />
      </div>
      <Legend items={items.filter((item) => item.spent > 0)} extraText={(item) => `${Math.round((item.spent / total) * 100)}%`} />
    </div>
  );
}

// ----- 3c. Bars: one horizontal bar per category -----
//   field 0 Spent (total in the period)   field 1 Average spent   field 2 Average income  (average = total / number of transactions)
function BarsChart({ rows, incomeRows, txs, field }) {
  const average = field > 0 ? averagesFor(txs, field === 1 ? 'expense' : 'income') : null;
  const list = field === 2 ? incomeRows : rows;
  const items = list
    .map((row) => ({ ...row, value: average ? average.get(row.name) || 0 : row.spent }))
    .filter((row) => field === 0 || row.value > 0)
    .sort((a, b) => b.value - a.value);
  if (items.length === 0) return <EmptyMessage />;
  const longest = Math.max(1, ...items.map((row) => row.value));

  return (
    <div>
      {average && (
        <div className="mb-1 text-center text-[11px] bt-text-mute">
          {field === 1 ? 'Average spent' : 'Average income'} per transaction
        </div>
      )}
      {items.map((row) => (
        <div key={row.id} className="my-2 flex items-center gap-2 text-xs">
          <span className="flex w-[100px] shrink-0 items-center gap-1.5 truncate">
            <Icon name={row.icon} size={14} color={row.color} /> {row.name}
          </span>
          <div className="h-2.5 flex-1 overflow-hidden rounded-md bt-bg-line">
            <i className="block h-full rounded-md" style={{ width: `${(row.value / longest) * 100}%`, background: row.color }} />
          </div>
          <b className="w-[78px] text-right">{fmt(row.value)}</b>
        </div>
      ))}
    </div>
  );
}

// ----- 3d. Trend line: one point per day, or one point per month for long ranges -----
const ONE_DAY = 24 * 60 * 60 * 1000;

function TrendChart({ txs, range, field }) {
  // Year view and custom ranges longer than ~2 months use one point per MONTH; everything else one point per DAY
  const perMonth = range.t === 'year' || (range.t === 'custom' && range.days > 62);
  const monthsInRange = (range.e.getFullYear() - range.s.getFullYear()) * 12 + range.e.getMonth() - range.s.getMonth() + 1;
  const pointCount = perMonth ? monthsInRange : range.days;

  // values[i] = total for point i
  const values = Array(pointCount).fill(0);
  for (const tx of txs) {
    if (tx.goalId) continue; // moving money to/from a savings plan is not income or spending
    const date = parseYmd(tx.date);
    const index = perMonth
      ? (date.getFullYear() - range.s.getFullYear()) * 12 + date.getMonth() - range.s.getMonth()
      : Math.round((date - range.s) / ONE_DAY);
    if (index < 0 || index >= pointCount) continue;

    if (field === 0 && tx.type === 'expense') values[index] += tx.amount;
    if (field === 1 && tx.type === 'income') values[index] += tx.amount;
    if (field === 2) values[index] += tx.type === 'income' ? tx.amount : -tx.amount; // savings = income - expense
  }
  if (!values.some((v) => v !== 0)) return <EmptyMessage />;

  // Chart geometry: the drawing area is 320 x 170
  const width = 320, height = 170, padLeft = 8, padBottom = 22, padTop = 12;
  const lowest = Math.min(0, ...values);
  const highest = Math.max(1, ...values);
  const xOf = (i) => padLeft + i * ((width - 2 * padLeft) / Math.max(1, pointCount - 1));
  const yOf = (v) => padTop + (height - padTop - padBottom) * (1 - (v - lowest) / (highest - lowest));

  const colour = field === 0 ? '#f0605d' : field === 1 ? '#2eae7b' : '#6c4ad0';
  const points = values.map((v, i) => `${xOf(i)},${yOf(v)}`).join(' ');

  // text under a point (only some points get one, so the labels never overlap)
  function axisLabel(i) {
    if (range.t === 'week') return 'MTWTFSS'[i];
    if (range.t === 'year') return 'JFMAMJJASOND'[i];
    const step = Math.max(1, Math.ceil(pointCount / 7));
    if (i % step !== 0) return '';
    if (perMonth) return new Date(range.s.getFullYear(), range.s.getMonth() + i, 1).toLocaleDateString('en-IN', { month: 'short' });
    return new Date(range.s.getTime() + i * ONE_DAY).getDate(); // day of the month
  }

  return (
    <div>
      <svg viewBox="0 0 320 170" className="w-full">
        <line x1={padLeft} x2={width - padLeft} y1={yOf(0)} y2={yOf(0)} stroke="rgb(var(--bt-line))" />
        {/* soft fill under the line */}
        <polygon points={`${xOf(0)},${yOf(0)} ${points} ${xOf(pointCount - 1)},${yOf(0)}`} fill={colour} opacity=".15" />
        <polyline points={points} fill="none" stroke={colour} strokeWidth="2.5" strokeLinejoin="round" />
        {pointCount <= 12 && values.map((v, i) => <circle key={i} cx={xOf(i)} cy={yOf(v)} r="3.5" fill={colour} />)}
        {values.map((_, i) => (
          <text key={`label${i}`} x={xOf(i)} y="165" fontSize="9" textAnchor="middle" fill="rgb(var(--bt-mute))">{axisLabel(i)}</text>
        ))}
      </svg>
      <div className="mt-2 text-center text-xs bt-text-mute">Total: {fmt(values.reduce((sum, v) => sum + v, 0))}</div>
    </div>
  );
}

// ----- 3e. Radar: a web with one spoke per category -----
//   field 0 = what was spent in the period, field 1 = the average spent per transaction
function RadarChart({ rows, txs, field }) {
  const count = rows.length;
  if (count < 3) return <EmptyMessage text="Add at least 3 expense categories for the radar chart." />;

  const average = field === 1 ? averagesFor(txs, 'expense') : null;
  const valueOf = (row) => (average ? average.get(row.name) || 0 : row.spent);
  const biggest = Math.max(1, ...rows.map(valueOf));
  const centre = 130;
  const radius = 88;

  // Position of spoke `i` at `scale` (1 = outer edge)
  function pointAt(scale, i) {
    const angle = (i * 2 * Math.PI) / count - Math.PI / 2; // start at the top
    return [centre + radius * scale * Math.cos(angle), centre + radius * scale * Math.sin(angle)];
  }
  const shape = rows.map((row, i) => pointAt(valueOf(row) / biggest, i).join(',')).join(' ');

  return (
    <div>
      <svg viewBox="0 0 260 260" className="mx-auto block w-full max-w-[300px]">
        {/* the web: 4 rings and one line per category */}
        {[0.25, 0.5, 0.75, 1].map((scale) => (
          <polygon key={scale} points={rows.map((_, i) => pointAt(scale, i).join(',')).join(' ')} fill="none" stroke="rgb(var(--bt-line))" />
        ))}
        {rows.map((_, i) => (
          <line key={i} x1={centre} y1={centre} x2={pointAt(1, i)[0]} y2={pointAt(1, i)[1]} stroke="rgb(var(--bt-line))" />
        ))}

        <polygon points={shape} fill="#f0605d" fillOpacity=".25" stroke="#f0605d" strokeWidth="2" />

        {/* category icons at the end of each spoke */}
        {rows.map((row, i) => {
          const [x, y] = pointAt(1.22, i);
          return (
            <g key={row.id} transform={`translate(${x - 8},${y - 8})`}>
              <svg
                width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={row.color}
                strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                dangerouslySetInnerHTML={{ __html: ICONS[row.icon] || ICONS.wallet }}
              />
            </g>
          );
        })}
      </svg>
      <div className="mt-2 flex justify-center gap-3 text-xs">
        <span className="bt-text-danger">● {average ? 'Average spent per transaction' : 'Spent'}</span>
      </div>
    </div>
  );
}

// ----- 4. picks the chart -----
export default function ChartPanel({ type, field, rows, incomeRows, txs, range }) {
  if (type === 'rings') return <RingsChart rows={rows} />;
  if (type === 'donut') {
    // field 0 = expenses, field 1 = income
    return <DonutChart items={field === 0 ? rows : incomeRows} title={field === 0 ? 'Expenses' : 'Income'} />;
  }
  if (type === 'bars') return <BarsChart rows={rows} incomeRows={incomeRows} txs={txs} field={field} />;
  if (type === 'line') return <TrendChart txs={txs} range={range} field={field} />;
  return <RadarChart rows={rows} txs={txs} field={field} />;
}
