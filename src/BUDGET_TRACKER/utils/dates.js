// Date helpers used by every screen.
//
// Dates are stored as plain text "YYYY-MM-DD" (e.g. "2026-10-10").
// That format sorts correctly as text, so comparing two dates is just  a >= b.

const pad = (n) => String(n).padStart(2, '0'); // 5 -> "05"

/** Date object -> "2026-10-10" (uses LOCAL time; toISOString() would shift the day in India) */
export function ymd(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** "2026-10-10" -> Date object at local midnight */
export function parseYmd(text) {
  return new Date(`${text}T00:00:00`);
}

/** "Now", captured once when the app loads */
export const TODAY = new Date();

/**
 * Turns the period picked on Home into a date range.
 *
 *   period = { t: 'week' | 'month' | 'year', o: offset }
 *   period = { t: 'custom', from: 'YYYY-MM-DD', to: 'YYYY-MM-DD', o: offset }   (a range the user picked)
 *   offset 0 = this period, -1 = the previous one, -2 = the one before that ...
 *   (for a custom range "the previous one" is the range of the same length just before it)
 *
 * Returns:
 *   a, b    first and last day as "YYYY-MM-DD" (both included)
 *   s, e    the same two days as Date objects
 *   label   text shown in the UI, e.g. "October 2026"
 *   sub     "This month" / "Last month" / ""
 *   days    number of days in the range
 */
export function getRange(period) {
  const { t, o } = period;
  const year = TODAY.getFullYear();
  const month = TODAY.getMonth(); // 0 = January
  const day = TODAY.getDate();

  let start;
  let end;
  if (t === 'week') {
    const daysSinceMonday = (TODAY.getDay() + 6) % 7; // getDay(): Sunday = 0, so shift to Monday = 0
    start = new Date(year, month, day - daysSinceMonday + 7 * o);
    end = new Date(year, month, day - daysSinceMonday + 7 * o + 6);
  } else if (t === 'month') {
    start = new Date(year, month + o, 1);
    end = new Date(year, month + o + 1, 0); // day 0 of next month = last day of this month
  } else if (t === 'custom') {
    const from = parseYmd(period.from);
    const to = parseYmd(period.to);
    const length = Math.round((to - from) / (24 * 60 * 60 * 1000)) + 1; // number of days
    start = new Date(from.getFullYear(), from.getMonth(), from.getDate() + o * length);
    end = new Date(to.getFullYear(), to.getMonth(), to.getDate() + o * length);
  } else {
    start = new Date(year + o, 0, 1);
    end = new Date(year + o, 11, 31);
  }

  const show = (date, options) => date.toLocaleDateString('en-IN', options);
  let label;
  if (t === 'week') label = `${show(start, { day: 'numeric', month: 'short' })} – ${show(end, { day: 'numeric', month: 'short' })}`;
  else if (t === 'month') label = show(start, { month: 'long', year: 'numeric' });
  else if (t === 'custom') {
    const startYear = start.getFullYear() === end.getFullYear() ? undefined : 'numeric'; // show the year twice only if it differs
    label = `${show(start, { day: 'numeric', month: 'short', year: startYear })} – ${show(end, { day: 'numeric', month: 'short', year: 'numeric' })}`;
  } else label = String(start.getFullYear());

  const days = Math.round((end - start) / (24 * 60 * 60 * 1000)) + 1;

  let sub = '';
  if (t === 'custom') sub = o === 0 ? 'Custom range' : o === -1 ? 'Previous range' : '';
  else if (o === 0) sub = `This ${t}`;
  else if (o === -1) sub = `Last ${t}`;


  return {
    t, s: start, e: end,
    a: ymd(start), b: ymd(end),
    label, sub, days,
  };
}

// When the transaction was created, in milliseconds (a number, or an old Firestore timestamp, or nothing)
function createdMillis(tx) {
  const created = tx.createdAt;
  if (typeof created === 'number') return created;
  if (created && created.seconds) return created.seconds * 1000;
  return 0;
}

/**
 * For sorting: newest first. Transactions are compared by DATE, and when two have the same date the one that was
 * created later comes first (so what you just added is always at the top).
 *   list.sort(newestFirst)
 */
export function newestFirst(a, b) {
  return b.date.localeCompare(a.date) || createdMillis(b) - createdMillis(a);
}

/** Is this transaction inside the range? */
export function inRange(tx, range) {
  return tx.date >= range.a && tx.date <= range.b;
}

/**
 * YOUR BALANCE = all income - all expenses (every transaction counts).
 * Money moved into a savings plan is an expense of the balance ("Moved to plan"): the balance goes DOWN.
 * Money taken out of a plan is an income to the balance ("From plan"): the balance goes UP.
 */
export function balanceOf(transactions) {
  let balance = 0;
  for (const tx of transactions) {
    balance += tx.type === 'income' ? tx.amount : -tx.amount;
  }
  return balance;
}

/**
 * Adds up the amounts of one type ('income' or 'expense') for the STATISTICS (Home tiles, Insights, charts).
 * Savings-plan moves (they have a goalId) are skipped: moving money to or from a plan is not real income or spending.
 * (The balance does follow them, see balanceOf above.)
 */
export function sumBy(transactions, type) {
  let total = 0;
  for (const tx of transactions) {
    if (tx.type === type && !tx.goalId) total += tx.amount;
  }
  return total;
}
