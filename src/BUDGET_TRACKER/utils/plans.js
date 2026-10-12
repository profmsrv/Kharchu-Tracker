// Savings-plan maths. A plan is NOT stored with a "saved" number that has to be kept up to date.
// Instead the saved amount is CALCULATED from the transactions, so it can never go out of sync.
//
// Moving money into / out of a plan is ONE transaction with a bank icon and the field goalId:
//   "Moved to plan: Phone"  (an expense of your balance)   -> the plan GROWS
//   "From plan: Phone"      (an income to your balance)    -> the plan SHRINKS
//
//   saved = what was already saved before tracking (goal.start) + money moved in - money taken out
//
// (Entries saved by older versions directly in the plan's own category still count: income +, expense -.)
import { ymd } from './dates';

const DAY = 24 * 60 * 60 * 1000;

/** Everything the screens need to show about one plan */
export function planProgress(goal, transactions) {
  let added = 0;
  let withdrawn = 0;
  const planTransactions = [];

  for (const tx of transactions) {
    if (tx.goalId === goal.id) {
      // a move: expense "Moved to plan" = money INTO the plan, income "From plan" = money OUT of it
      planTransactions.push(tx);
      if (tx.type === 'expense') added += tx.amount;
      else withdrawn += tx.amount;
    } else if (!tx.goalId && !tx.transferId && tx.category === goal.name) {
      // older entries saved directly in the plan's own category
      planTransactions.push(tx);
      if (tx.type === 'income') added += tx.amount;
      else withdrawn += tx.amount;
    }
  }

  // older plans stored the opening amount in `saved`
  const start = goal.start !== undefined ? goal.start : goal.saved || 0;
  const saved = start + added - withdrawn;
  const target = goal.target || 0;
  const percent = target > 0 ? Math.max(0, Math.min(100, (saved / target) * 100)) : 0;

  return { start, added, withdrawn, saved, target, percent, remaining: Math.max(0, target - saved), planTransactions };
}

/** How much one transaction adds to the plan: + money moved in, - money taken out */
export function contribution(tx) {
  if (tx.goalId) return tx.type === 'expense' ? tx.amount : -tx.amount;  // "Moved to plan" = in, "From plan" = out
  return tx.type === 'income' ? tx.amount : -tx.amount;                  // older entries in the plan's own category
}

/** The day the plan started: its creation day, or its first transaction if that is earlier ("YYYY-MM-DD") */
export function planStartDate(goal, planTransactions) {
  const days = planTransactions.map((tx) => tx.date);
  if (typeof goal.createdAt === 'number' && goal.createdAt > 1e9) days.push(ymd(new Date(goal.createdAt)));
  if (days.length === 0) return ymd(new Date());
  return days.reduce((earliest, day) => (day < earliest ? day : earliest));
}

/** Net money added to the plan in EVERY month from the start month until now: [{ key, label, net }] (oldest first) */
export function monthlyNetSince(planTransactions, startDay) {
  const start = new Date(`${startDay}T00:00:00`);
  const today = new Date();
  const months = [];
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  while (cursor <= today) {
    const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`;
    const label = cursor.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' }); // "Oct 26"
    months.push({ key, label, net: 0 });
    cursor.setMonth(cursor.getMonth() + 1);
  }
  for (const tx of planTransactions) {
    const month = months.find((m) => m.key === tx.date.slice(0, 7));
    if (month) month.net += contribution(tx);
  }
  return months;
}

/** "At this pace you finish in about N months" -> { months, date } or null when it cannot be estimated */
export function estimateCompletion(progress, planTransactions) {
  if (progress.remaining <= 0 || planTransactions.length === 0) return null;
  const net = progress.added - progress.withdrawn;
  if (net <= 0) return null;

  const first = planTransactions.reduce((oldest, tx) => (tx.date < oldest ? tx.date : oldest), planTransactions[0].date);
  const daysActive = Math.max(30, Math.round((Date.now() - new Date(`${first}T00:00:00`).getTime()) / DAY));
  const perMonth = (net / daysActive) * 30;
  const months = Math.ceil(progress.remaining / perMonth);
  const date = new Date(Date.now() + months * 30 * DAY);
  return { months, date };
}
