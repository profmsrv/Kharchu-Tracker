// The period selector (Home, Budget and Insights all use it):   ‹   October 2026 ⌄   ›
//
//   ‹ ›     go to the previous / next period
//   middle  tap to choose Week / Month / Year / Custom range (popup)
//
// `period` and `setPeriod` live in App.jsx, so the choice filters EVERY screen.
//   period = { t: 'week' | 'month' | 'year', o }            o = offset (0 = now, -1 = previous ...)
//   period = { t: 'custom', from, to, o }                   a range the user picked
import { useState } from 'react';
import Icon from './ui/Icon';
import OptionSheet from './ui/OptionSheet';
import Sheet from './ui/Sheet';
import { TODAY, ymd } from '../utils/dates';

const PERIOD_OPTIONS = [
  { key: 'week', label: 'Week', icon: 'calendar', sub: 'Monday to Sunday' },
  { key: 'month', label: 'Month', icon: 'calendar', sub: 'Calendar month' },
  { key: 'year', label: 'Year', icon: 'calendar', sub: 'January to December' },
  { key: 'custom', label: 'Custom range', icon: 'calendar', sub: 'Pick your own dates' },
];

// The popup where the user picks the first and last day of a custom range
function CustomRangeSheet({ period, onApply, onClose }) {
  const today = ymd(TODAY);
  const monthStart = ymd(new Date(TODAY.getFullYear(), TODAY.getMonth(), 1));
  const [from, setFrom] = useState(period.t === 'custom' ? period.from : monthStart);
  const [to, setTo] = useState(period.t === 'custom' ? period.to : today);
  const valid = from && to && from <= to;

  return (
    <Sheet onClose={onClose}>
      <b className="text-[17px]">Custom range</b>
      <label className="text-xs bt-text-mute">From</label>
      <input className="bt-field" type="date" value={from} max={today} onChange={(e) => setFrom(e.target.value)} />
      <label className="text-xs bt-text-mute">To</label>
      <input className="bt-field" type="date" value={to} max={today} onChange={(e) => setTo(e.target.value)} />
      {!valid && <p className="text-xs bt-text-danger">“From” must be on or before “To”.</p>}
      <button className="bt-btn-primary" disabled={!valid} onClick={() => onApply(from, to)}>Show this range</button>
    </Sheet>
  );
}

export default function PeriodBar({ period, setPeriod, range }) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [rangeOpen, setRangeOpen] = useState(false);

  const arrowButton = 'grid h-[38px] w-[38px] place-items-center rounded-xl border bt-border-line bt-bg-surface80 disabled:opacity-30';
  const typeName = period.t[0].toUpperCase() + period.t.slice(1); // "month" -> "Month"

  // The user chose a type in the popup
  function choose(type) {
    if (type === 'custom') setRangeOpen(true); // custom needs two dates first
    else setPeriod({ t: type, o: 0 });         // choosing a type jumps back to the current period
  }

  return (
    <div data-tour="period-bar" className="my-2.5 flex items-center justify-between">
      {/* previous period: offset goes down by one */}
      <button aria-label="Previous" className={arrowButton} onClick={() => setPeriod({ ...period, o: period.o - 1 })}>
        <Icon name="chevL" />
      </button>

      {/* the label; tap to change the kind of period */}
      <button className="mx-2 flex-1 rounded-2xl px-2.5 py-1.5 text-center" onClick={() => setPickerOpen(true)}>
        <b className="block text-[15px]">{range.label}</b>
        <small className="flex items-center justify-center gap-1 text-[11px] bt-text-mute">
          {typeName}{range.sub && ` · ${range.sub}`}
          <Icon name="chevD" size={12} />
        </small>
      </button>

      {/* next period: disabled while we are already on the current one (no future periods) */}
      <button aria-label="Next" className={arrowButton} disabled={period.o >= 0} onClick={() => setPeriod({ ...period, o: period.o + 1 })}>
        <Icon name="chevR" />
      </button>

      {pickerOpen && (
        <OptionSheet title="Filter by" opts={PERIOD_OPTIONS} value={period.t} onPick={choose} onClose={() => setPickerOpen(false)} />
      )}
      {rangeOpen && (
        <CustomRangeSheet
          period={period}
          onApply={(from, to) => { setPeriod({ t: 'custom', from, to, o: 0 }); setRangeOpen(false); }}
          onClose={() => setRangeOpen(false)}
        />
      )}
    </div>
  );
}
