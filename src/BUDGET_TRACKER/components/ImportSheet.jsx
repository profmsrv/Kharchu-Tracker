// The popup of Settings -> Import data from CSV. It shows what the file contains BEFORE anything is saved,
// then saves it with one tap. The analysis (utils/csv.js analyzeCsv) was done by Settings.jsx.
//
//   analysis = { total, rows, duplicates, invalid, invalidCount, newCategories, problem }
// The new transactions are saved on this device and, if Firebase is connected, uploaded in the background.
import { useState } from 'react';
import Sheet from './ui/Sheet';
import Icon from './ui/Icon';
import { useData } from '../hooks/useBudgetData';

function Line({ label, value, tone }) {
  return (
    <div className="flex justify-between gap-4 border-b bt-border-line py-2.5 text-[13px] last:border-0">
      <span className="bt-text-mute">{label}</span>
      <b className={tone || ''}>{value}</b>
    </div>
  );
}

export default function ImportSheet({ fileName, analysis, onClose }) {
  const { importData, mode } = useData();
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(null); // { transactions, categories }
  const [error, setError] = useState('');

  async function run() {
    setSaving(true);
    setError('');
    try {
      setDone(await importData({ transactions: analysis.rows, categories: analysis.newCategories }));
    } catch (err) {
      setError(err.message || 'Could not save the imported data.');
      setSaving(false);
    }
  }

  if (analysis.problem) {
    return (
      <Sheet onClose={onClose}>
        <b className="text-[17px]">Cannot import this file</b>
        <p className="text-[13px] bt-text-danger">{analysis.problem}</p>
        <p className="bt-hint">Use a CSV with the columns Date, Type, Category, Note, Amount (the file from “Export data as CSV” works).</p>
        <button className="bt-btn-primary" onClick={onClose}>Close</button>
      </Sheet>
    );
  }

  if (done) {
    return (
      <Sheet onClose={onClose}>
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bt-bg-blush"><Icon name="check" size={24} stroke={2.6} /></div>
        <b className="text-center text-[17px]">Imported {done.transactions} transaction{done.transactions === 1 ? '' : 's'}</b>
        <p className="text-center text-[13px] bt-text-mute">
          {done.categories > 0 && `${done.categories} new categor${done.categories === 1 ? 'y was' : 'ies were'} created. `}
          Saved on this device{mode === 'firebase' ? ' and uploading to your Firebase database in the background.' : '. Connect Firebase in Settings → Database to back them up.'}
        </p>
        <button className="bt-btn-primary" onClick={onClose}>Done</button>
      </Sheet>
    );
  }

  const count = analysis.rows.length;
  return (
    <Sheet onClose={onClose}>
      <b className="text-[17px]">Import from CSV</b>
      <small className="truncate text-xs bt-text-mute">{fileName} · {analysis.total} row{analysis.total === 1 ? '' : 's'}</small>

      <div>
        <Line label="New transactions" value={count} tone={count > 0 ? 'bt-text-success' : ''} />
        <Line label="Already in the app (skipped)" value={analysis.duplicates} />
        <Line label="Rows that cannot be read" value={analysis.invalidCount} tone={analysis.invalidCount > 0 ? 'bt-text-danger' : ''} />
        {analysis.newCategories.length > 0 && (
          <Line label="New categories" value={analysis.newCategories.map((category) => category.name).join(', ')} />
        )}
      </div>

      {analysis.invalid.length > 0 && (
        <div className="rounded-xl bt-bg-blush px-3 py-2 text-[11px] leading-relaxed">
          {analysis.invalid.slice(0, 4).map((item) => <div key={item.line}>Line {item.line}: {item.reason}</div>)}
          {analysis.invalidCount > 4 && <div className="bt-text-mute">and {analysis.invalidCount - 4} more…</div>}
        </div>
      )}

      {error && <p className="text-xs bt-text-danger">{error}</p>}
      <div className="grid grid-cols-2 gap-2.5">
        <button className="bt-btn-ghost" onClick={onClose}>Cancel</button>
        <button className="bt-btn-primary" disabled={count === 0 || saving} onClick={run}>
          {saving ? 'Importing…' : count === 0 ? 'Nothing to import' : `Import ${count}`}
        </button>
      </div>
    </Sheet>
  );
}
