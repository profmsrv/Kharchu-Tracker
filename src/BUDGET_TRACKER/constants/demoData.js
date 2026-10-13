// SAMPLE DATA for the app tour. Used only while the tour is open and only when the person has (almost) no data of their own
// (fewer than 5 transactions). It is never saved: it replaces what the screens SEE for a moment (see hooks/useBudgetData.jsx),
// and the actions do nothing while it is shown, so the real data is never touched.
//
// Dates are worked out from "today" so the sample always has entries in this month, the last 7 days and last month.
import { DEFAULT_CATEGORIES } from './defaults';
import { ymd } from '../utils/dates';

export const DEMO_MIN_REAL_TRANSACTIONS = 5; // with this many real transactions or more, the tour shows the person's own data

export function buildDemo(today = new Date()) {
  const y = today.getFullYear();
  const m = today.getMonth();
  const d = today.getDate();

  // a day of THIS month: `back` days before today, but never before the 1st
  const thisMonth = (back) => ymd(new Date(y, m, Math.max(1, d - back)));
  // a day of LAST month
  const lastMonth = (day) => ymd(new Date(y, m - 1, day));

  let n = 0;
  const tx = (type, category, title, amount, date, extra = {}) => {
    n += 1;
    return { id: `demo-tx-${n}`, type, category, title, amount, date, createdAt: 1000 + n, updatedAt: 1000 + n, ...extra };
  };

  const transactions = [
    // the last few days
    tx('expense', 'Food', 'Lunch with friends', 220, thisMonth(0)),
    tx('expense', 'Travel', 'Auto to office', 80, thisMonth(1)),
    tx('expense', 'Groceries', 'Vegetables and fruits', 640, thisMonth(1)),
    tx('expense', 'Bills', 'Mobile recharge', 399, thisMonth(2)),
    tx('expense', 'Shopping', 'T-shirt', 1499, thisMonth(3)),
    tx('expense', 'Food', 'Tea and snacks', 90, thisMonth(4)),
    tx('income', 'Freelance', 'Logo design', 6000, thisMonth(5)),
    tx('expense', 'Travel', 'Bus pass', 250, thisMonth(6)),
    // earlier this month
    tx('income', 'Salary', 'Monthly salary', 35000, thisMonth(9)),
    tx('expense', 'Rent', 'House rent', 12000, thisMonth(9)),
    tx('expense', 'Groceries', 'Monthly groceries', 2100, thisMonth(12)),
    tx('expense', 'Food', 'Dinner out', 780, thisMonth(14)),
    tx('expense', 'Bills', 'Electricity bill', 1800, thisMonth(16)),
    tx('expense', 'Other', 'Gift wrapping', 300, thisMonth(18)),
    // savings plan moves (money moved into a plan)
    tx('expense', 'Moved to plan', 'Moved to plan: New phone', 3000, thisMonth(8), { goalId: 'demo-goal-phone' }),
    tx('expense', 'Moved to plan', 'Moved to plan: Goa trip', 1500, thisMonth(7), { goalId: 'demo-goal-trip' }),
    tx('expense', 'Moved to plan', 'Moved to plan: New phone', 2000, lastMonth(20), { goalId: 'demo-goal-phone' }),
    // last month (so the comparison with the previous period has something to compare)
    tx('income', 'Salary', 'Monthly salary', 35000, lastMonth(5)),
    tx('expense', 'Rent', 'House rent', 12000, lastMonth(5)),
    tx('expense', 'Groceries', 'Monthly groceries', 2400, lastMonth(8)),
    tx('expense', 'Food', 'Restaurants', 1100, lastMonth(12)),
    tx('expense', 'Travel', 'Train tickets', 900, lastMonth(15)),
    tx('expense', 'Bills', 'Electricity bill', 1700, lastMonth(18)),
    tx('expense', 'Shopping', 'Shoes', 2200, lastMonth(22)),
  ];

  const base = DEFAULT_CATEGORIES.map((c, i) => ({ ...c, order: i + 1, createdAt: 1, updatedAt: 1 }));
  const planCategory = (type, goalId, name, icon, color, order) => ({
    id: `demo-cat-${type}-${goalId}`, type, name, icon, color, goalId, order, createdAt: 1, updatedAt: 1,
  });
  const categories = [
    ...base,
    { id: 'demo-cat-expense-transfer', type: 'expense', name: 'Moved to plan', icon: 'bank', color: '#8a7a93', system: true, order: 90, createdAt: 1, updatedAt: 1 },
    { id: 'demo-cat-income-transfer', type: 'income', name: 'From plan', icon: 'bank', color: '#8a7a93', system: true, order: 91, createdAt: 1, updatedAt: 1 },
    planCategory('expense', 'demo-goal-phone', 'New phone', 'phone', '#3b9be0', 92),
    planCategory('income', 'demo-goal-phone', 'New phone', 'phone', '#3b9be0', 93),
    planCategory('expense', 'demo-goal-trip', 'Goa trip', 'plane', '#f3a33a', 94),
    planCategory('income', 'demo-goal-trip', 'Goa trip', 'plane', '#f3a33a', 95),
  ];

  const goals = [
    { id: 'demo-goal-phone', name: 'New phone', icon: 'phone', color: '#3b9be0', target: 30000, start: 4000, note: 'Saving for a new phone', createdAt: Date.now() - 40 * 86400000, updatedAt: 1 },
    { id: 'demo-goal-trip', name: 'Goa trip', icon: 'plane', color: '#f3a33a', target: 15000, start: 1500, note: 'A weekend with friends', createdAt: Date.now() - 20 * 86400000, updatedAt: 1 },
  ];

  const notes = [
    { id: 'demo-note-1', title: 'Monthly plan', body: 'Pay rent on the 1st.\nKeep 20% for savings.', createdAt: 1000, updatedAt: 3000 },
    { id: 'demo-note-2', title: 'Shopping list', body: 'Rice, dal, milk, fruits', createdAt: 1000, updatedAt: 2000 },
  ];

  return { transactions, categories, goals, notes };
}
