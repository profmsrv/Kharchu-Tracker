// CSV export and import (Settings -> Export data as CSV / Import data from CSV).
//
// EXPORT columns:  Date, Type, Category, Note, Amount, Plan      (Plan = the savings plan of a plan move, else empty)
//
// IMPORT is forgiving. It reads this app's own export AND most bank / other-app files:
//   * separator  comma, semicolon or tab (detected), quoted text, "" inside quotes, BOM, Windows/Mac/Linux line ends
//   * columns    found by their header name (Date, Type, Category, Note/Description/Narration, Amount, Debit, Credit, Plan ...)
//   * dates      2026-10-10 · 10/10/2026 · 10-10-26 · 10 Oct 2026 · Oct 10, 2026   (day first, like in India, unless the numbers say otherwise)
//   * amounts    1,23,456.78 · ₹500 · (500) · -500 · 1.234,50
//   * type       Expense / Income / Debit / Credit / DR / CR ... or, when there is no Type column, the sign of the amount
//   * rows already in the app (same date, type, category, note and amount) are skipped, so importing a file twice adds nothing
// Nothing is written here: analyzeCsv() only READS and returns what WOULD be imported (see components/ImportSheet.jsx).
import { CATEGORY_SUGGESTIONS, COLORS } from '../constants/defaults';

// ------------------------------------------------------------------ export

// Wraps text in quotes and doubles any quote inside, so commas in notes can't break the file
const quote = (value) => `"${String(value).replace(/"/g, '""')}"`;

/** Transactions -> CSV text (oldest first). `goals` is used to write the plan name of plan moves. */
export function buildCsv(transactions, goals = []) {
  const planName = (id) => (goals.find((goal) => goal.id === id) || {}).name || '';
  const created = (tx) => (typeof tx.createdAt === 'number' ? tx.createdAt : 0);
  const sorted = [...transactions].sort((a, b) => a.date.localeCompare(b.date) || created(a) - created(b));
  const lines = sorted.map((t) => [t.date, t.type, quote(t.category), quote(t.title), t.amount, quote(t.goalId ? planName(t.goalId) : '')].join(','));
  return ['Date,Type,Category,Note,Amount,Plan', ...lines].join('\n');
}

/** Saves text as a file through a normal browser download */
export function downloadCsv(text, filename = 'budget-export.csv') {
  // "\uFEFF" is a marker that lets Excel read the ₹ symbol correctly
  const blob = new Blob(['\uFEFF' + text], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

// ------------------------------------------------------------------ reading the text

/** CSV text -> [{ cells: [...], line }] (blank lines skipped). Works with quotes, "" and line breaks inside quotes. */
export function parseCsv(text) {
  const source = String(text || '').replace(/^\uFEFF/, '');
  const firstLine = source.split(/\r\n|\n|\r/, 1)[0] || '';
  const count = (character) => firstLine.split(character).length - 1;
  const delimiter = [['\t', count('\t')], [';', count(';')], [',', count(',')]].sort((a, b) => b[1] - a[1])[0];
  const separator = delimiter[1] > 0 ? delimiter[0] : ',';

  const rows = [];
  let cells = [];
  let field = '';
  let inQuotes = false;
  let line = 1;
  let startLine = 1;

  const endRow = () => {
    cells.push(field);
    if (cells.some((cell) => cell.trim() !== '')) rows.push({ cells, line: startLine });
    cells = [];
    field = '';
  };

  for (let i = 0; i < source.length; i += 1) {
    const character = source[i];
    if (inQuotes) {
      if (character === '"') {
        if (source[i + 1] === '"') { field += '"'; i += 1; } else inQuotes = false;
      } else {
        if (character === '\n') line += 1;
        field += character;
      }
    } else if (character === '"' && field === '') {
      inQuotes = true;
    } else if (character === separator) {
      cells.push(field);
      field = '';
    } else if (character === '\n' || character === '\r') {
      if (character === '\r' && source[i + 1] === '\n') i += 1;
      endRow();
      line += 1;
      startLine = line;
    } else {
      field += character;
    }
  }
  if (field !== '' || cells.length > 0) endRow();
  return rows;
}

// ------------------------------------------------------------------ understanding the values

const pad = (n) => String(n).padStart(2, '0');
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

// A real calendar day -> "YYYY-MM-DD", otherwise null (so 31 Feb is refused)
function buildDate(year, month, day) {
  if (month < 1 || month > 12 || day < 1 || day > 31 || year < 1970 || year > 2100) return null;
  const check = new Date(year, month - 1, day);
  if (check.getFullYear() !== year || check.getMonth() !== month - 1 || check.getDate() !== day) return null;
  return `${year}-${pad(month)}-${pad(day)}`;
}

/** "10/10/2026", "2026-10-10", "10 Oct 2026" ... -> "2026-10-10", or null */
export function parseDate(raw) {
  const text = String(raw || '').trim();
  if (!text) return null;
  let match = text.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?!\d)/);
  if (match) return buildDate(+match[1], +match[2], +match[3]);

  match = text.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})(?!\d)/);
  if (match) {
    const first = +match[1];
    const second = +match[2];
    let year = +match[3];
    if (year < 100) year += 2000;
    // day first (India). Only when the second number cannot be a month is it read as month first.
    if (second > 12 && first <= 12) return buildDate(year, first, second);
    return buildDate(year, second, first);
  }

  match = text.match(/^(\d{1,2})[\s.-]+([A-Za-z]{3,9})[\s.,-]+(\d{2,4})(?!\d)/);
  if (match) {
    const month = MONTHS.indexOf(match[2].slice(0, 3).toLowerCase()) + 1;
    const year = +match[3] < 100 ? +match[3] + 2000 : +match[3];
    return month ? buildDate(year, month, +match[1]) : null;
  }

  match = text.match(/^([A-Za-z]{3,9})\s+(\d{1,2}),?\s+(\d{4})(?!\d)/);
  if (match) {
    const month = MONTHS.indexOf(match[1].slice(0, 3).toLowerCase()) + 1;
    return month ? buildDate(+match[3], month, +match[2]) : null;
  }
  return null;
}

/** "₹1,23,456.50", "(500)", "-500", "1.234,50" -> { value: 123456.5, negative: false } or null */
export function parseAmount(raw) {
  const text = String(raw === undefined || raw === null ? '' : raw).trim();
  if (!text) return null;
  const negative = text.includes('-') || (text.startsWith('(') && text.endsWith(')'));
  let digits = text.replace(/[^\d.,]/g, '');
  if (!/\d/.test(digits)) return null;

  const lastComma = digits.lastIndexOf(',');
  const lastDot = digits.lastIndexOf('.');
  if (lastComma >= 0 && lastDot >= 0) {
    // both present: the LAST one is the decimal point
    digits = lastComma > lastDot ? digits.replace(/\./g, '').replace(',', '.') : digits.replace(/,/g, '');
  } else if (lastComma >= 0) {
    // only commas: "1,234" / "1,23,456" are thousands, "12,5" is a decimal comma
    digits = /^\d{1,3}(,\d{2})*,\d{3}$/.test(digits) ? digits.replace(/,/g, '') : /,\d{1,2}$/.test(digits) ? digits.replace(',', '.') : digits.replace(/,/g, '');
  }
  const value = Number(digits);
  return Number.isFinite(value) ? { value: Math.round(value * 100) / 100, negative } : null;
}

const EXPENSE_WORDS = ['expense', 'expenses', 'exp', 'e', 'debit', 'dr', 'd', 'out', 'spent', 'spend', 'withdrawal', 'payment', 'paid', '-'];
const INCOME_WORDS = ['income', 'inc', 'i', 'credit', 'cr', 'c', 'in', 'received', 'receipt', 'deposit', 'earning', 'earnings', '+'];

function parseType(raw) {
  const word = String(raw || '').trim().toLowerCase();
  if (EXPENSE_WORDS.includes(word)) return 'expense';
  if (INCOME_WORDS.includes(word)) return 'income';
  return null;
}

// ------------------------------------------------------------------ columns

const COLUMN_NAMES = {
  date: ['date', 'transactiondate', 'txndate', 'valuedate', 'postingdate', 'day', 'when'],
  type: ['type', 'kind', 'transactiontype', 'txntype', 'drcr', 'crdr'],
  category: ['category', 'cat', 'head', 'group'],
  note: ['note', 'notes', 'title', 'description', 'narration', 'details', 'memo', 'remarks', 'particulars', 'payee', 'name'],
  amount: ['amount', 'amt', 'value', 'sum', 'total'],
  debit: ['debit', 'withdrawal', 'withdrawals', 'dr', 'paidout', 'moneyout', 'debitamount'],
  credit: ['credit', 'deposit', 'deposits', 'cr', 'paidin', 'moneyin', 'creditamount'],
  plan: ['plan', 'savingsplan', 'goal'],
};

const simplify = (text) => String(text || '').toLowerCase().replace(/[^a-z0-9]/g, '');

// header cells -> { date: 0, type: 1, ... } (-1 = not found)
function findColumns(headerCells) {
  const found = {};
  const simple = headerCells.map(simplify);
  for (const [key, names] of Object.entries(COLUMN_NAMES)) {
    found[key] = simple.findIndex((cell) => names.includes(cell));
  }
  return found;
}

// ------------------------------------------------------------------ the analysis

const TRANSFER = { expense: 'Moved to plan', income: 'From plan' };
const sameName = (a, b) => String(a).trim().toLowerCase() === String(b).trim().toLowerCase();

function signature(tx) {
  return [tx.date, tx.type, String(tx.category).trim().toLowerCase(), String(tx.title).trim().toLowerCase(), Math.round(Number(tx.amount) * 100)].join('|');
}

function suggestIcon(name) {
  const hit = CATEGORY_SUGGESTIONS.find((item) => sameName(item.name, name));
  return hit ? hit.icon : 'tag';
}

/**
 * Reads CSV text and works out what an import would do. Nothing is saved.
 *   current = { transactions, categories: { expense: [...], income: [...] }, goals }   (from useData())
 * Returns { total, rows, duplicates, invalid, invalidCount, newCategories, problem }
 *   rows           the transactions that WOULD be added  [{ type, category, title, amount, date, goalId? }]
 *   duplicates     rows skipped because the app already has the same transaction
 *   invalid        [{ line, reason }] rows that cannot be read (first 50)
 *   newCategories  [{ type, name, icon, color }] categories that would be created
 *   problem        a message when the whole file cannot be used
 */
export function analyzeCsv(text, current) {
  const result = { total: 0, rows: [], duplicates: 0, invalid: [], invalidCount: 0, newCategories: [], problem: '' };
  const table = parseCsv(text);
  if (table.length === 0) {
    result.problem = 'The file is empty.';
    return result;
  }

  // header row: the first row that contains a "date" column plus an amount (or debit/credit) column
  let columns = findColumns(table[0].cells);
  let body = table.slice(1);
  const hasHeader = columns.date >= 0 && (columns.amount >= 0 || columns.debit >= 0 || columns.credit >= 0);
  if (!hasHeader) {
    if (parseDate(table[0].cells[0]) && table[0].cells.length >= 2) {
      // no header at all: assume this app's own order  Date, Type, Category, Note, Amount, Plan
      columns = { date: 0, type: 1, category: 2, note: 3, amount: 4, debit: -1, credit: -1, plan: 5 };
      body = table;
    } else {
      result.problem = 'Could not find a Date column and an Amount column in the first row.';
      return result;
    }
  }

  const existing = {};
  for (const tx of current.transactions) {
    const key = signature(tx);
    existing[key] = (existing[key] || 0) + 1;
  }

  const lookup = (type, name) => (current.categories[type] || []).find((category) => sameName(category.name, name));
  const created = {}; // "expense:food" -> category being created
  const invalid = (line, reason) => {
    result.invalidCount += 1;
    if (result.invalid.length < 50) result.invalid.push({ line, reason });
  };

  for (const { cells, line } of body) {
    const get = (key) => (columns[key] >= 0 ? String(cells[columns[key]] === undefined ? '' : cells[columns[key]]).trim() : '');
    result.total += 1;

    const date = parseDate(get('date'));
    if (!date) { invalid(line, `Date not understood: “${get('date') || 'empty'}”`); continue; }

    // amount and type
    let type = null;
    let amount = null;
    if (columns.amount >= 0 && get('amount') !== '') {
      const parsed = parseAmount(get('amount'));
      if (parsed) amount = parsed.value;
      if (columns.type >= 0 && get('type') !== '') {
        type = parseType(get('type'));
        if (!type) { invalid(line, `Type must be Expense or Income, found “${get('type')}”`); continue; }
      } else if (parsed) {
        type = parsed.negative ? 'expense' : 'income'; // no Type column: a minus sign means money went out
      }
    } else if (columns.debit >= 0 || columns.credit >= 0) {
      const debit = parseAmount(get('debit'));
      const credit = parseAmount(get('credit'));
      if (debit && debit.value > 0) { type = 'expense'; amount = debit.value; }
      else if (credit && credit.value > 0) { type = 'income'; amount = credit.value; }
    }
    if (!(amount > 0) || !type) { invalid(line, 'Amount is missing or zero'); continue; }

    // category + note + savings plan
    let category = get('category');
    let title = get('note');
    let planName = get('plan');
    if (!planName) {
      // older exports have no Plan column, but the note says  "Moved to plan: Phone"  /  "From plan: Phone"
      const hint = title.match(/^(?:Moved to plan|From plan):\s*(.+?)(?:\s·\s.*)?$/);
      if (hint) planName = hint[1];
    }
    const goal = planName ? current.goals.find((item) => sameName(item.name, planName)) : null;
    if (goal) category = TRANSFER[type]; // a plan move always uses the two system categories
    if (!category) category = 'Other';
    if (!title) title = category;
    title = title.charAt(0).toUpperCase() + title.slice(1);

    // known category (use its exact spelling) or a new one
    const isTransfer = category === TRANSFER.expense || category === TRANSFER.income;
    const known = lookup(type, category);
    if (known) category = known.name;
    else if (!isTransfer) {
      const key = `${type}:${category.toLowerCase()}`;
      if (!created[key]) {
        const index = Object.keys(created).length;
        created[key] = { type, name: category, icon: suggestIcon(category), color: COLORS[index % COLORS.length] };
      } else category = created[key].name;
    }

    const row = { type, category, title, amount, date };
    if (goal) row.goalId = goal.id;

    // already in the app? (each existing transaction can cancel out only ONE row of the file)
    const key = signature(row);
    if (existing[key] > 0) {
      existing[key] -= 1;
      result.duplicates += 1;
      continue;
    }
    result.rows.push(row);
  }

  result.newCategories = Object.values(created).filter((category) => result.rows.some((row) => row.type === category.type && row.category === category.name));
  return result;
}
