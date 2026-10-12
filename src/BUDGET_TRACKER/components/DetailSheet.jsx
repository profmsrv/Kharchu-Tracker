// The popup shown when a transaction is tapped: every detail, plus Edit and Delete buttons.
import Sheet from './ui/Sheet';
import Icon from './ui/Icon';
import { useData } from '../hooks/useBudgetData';
import { capitalize, fmt } from '../utils/format';
import { parseYmd } from '../utils/dates';

// One line of the details table:  Label ........ Value
function DetailRow({ label, value }) {
  return (
    <div className="flex justify-between gap-4 border-b bt-border-line py-[11px] text-[13px] last:border-0">
      <span className="bt-text-mute">{label}</span>
      <b className="text-right">{value}</b>
    </div>
  );
}

// createdAt is a number (local storage) or a Firestore Timestamp (Firebase). Return a Date or null.
function toDate(createdAt) {
  if (!createdAt) return null;
  if (createdAt.toDate) return createdAt.toDate();
  return new Date(createdAt);
}

export default function DetailSheet({ tx, onClose, onEdit, onDelete }) {
  const { getCategory, transactions, goals } = useData();
  const category = getCategory(tx.type, tx.category);
  const isExpense = tx.type === 'expense';

  // How much was spent/received in this category during the same month?
  const month = tx.date.slice(0, 7); // "2026-10"
  let monthTotal = 0;
  for (const other of transactions) {
    const sameKind = other.type === tx.type && other.category === tx.category;
    if (sameKind && other.date.slice(0, 7) === month) monthTotal += other.amount;
  }

  const created = toDate(tx.createdAt);
  const addedOn = created
    ? created.toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' })
    : '—';
  const fullDate = parseYmd(tx.date).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <Sheet onClose={onClose}>
      {/* header: icon, title, amount */}
      <div className="py-1 text-center">
        <div className="mx-auto mb-2.5 grid h-14 w-14 place-items-center bt-tile" style={{ background: category.color + '28' }}>
          <Icon name={category.icon} size={26} color={category.color} />
        </div>
        <div className="text-[15px] font-semibold">{capitalize(tx.title)}</div>
        <div className={`mt-0.5 text-[26px] font-extrabold ${isExpense ? 'bt-text-danger' : 'bt-text-success'}`}>
          {isExpense ? '-' : '+'} {fmt(tx.amount)}
        </div>
      </div>

      {/* details table */}
      <div>
        <DetailRow label="Type" value={isExpense ? 'Expense' : 'Income'} />
        <DetailRow label="Category" value={tx.category} />
        <DetailRow label="Date" value={fullDate} />
        <DetailRow label="Note" value={tx.title === tx.category ? '—' : capitalize(tx.title)} />
        <DetailRow label={`${tx.category} this month`} value={fmt(monthTotal)} />
        {tx.goalId && <DetailRow label="Savings plan" value={(goals.find((g) => g.id === tx.goalId) || {}).name || '—'} />}
        <DetailRow label="Added on" value={addedOn} />
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <button className="bt-btn-danger" onClick={onDelete}>Delete</button>
        <button className="bt-btn-primary" onClick={onEdit}>Edit</button>
      </div>
    </Sheet>
  );
}
