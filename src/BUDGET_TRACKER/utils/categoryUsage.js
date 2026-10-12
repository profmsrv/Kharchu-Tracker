// Which categories to show FIRST in the Add-transaction popup.
//
//   recent    the categories of your latest transactions (newest first), at most 4
//   frequent  the categories you used MOST during the last 30 days (counted by number of transactions), at most 4,
//             not already in "recent"
//   rest      every other category, in the normal order
//
// Only transactions of the same type (expense / income) count, and savings-plan moves are ignored.
import { newestFirst, ymd } from './dates';

const RECENT_COUNT = 4;
const FREQUENT_COUNT = 4;
const FREQUENT_DAYS = 30;

/**
 * categories    the categories that can be picked (normal ones only)
 * transactions  all transactions
 * type          'expense' | 'income'
 * today         a Date
 * Returns { quick: [category...], recentCount, rest: [category...] }   (quick = recent first, then frequent)
 */
export function rankCategories(categories, transactions, type, today = new Date()) {
  const byName = new Map(categories.map((category) => [category.name, category]));
  const mine = transactions.filter((tx) => tx.type === type && !tx.goalId && byName.has(tx.category));

  // recently used: walk the transactions from the newest and keep each category once
  const recent = [];
  for (const tx of [...mine].sort(newestFirst)) {
    if (!recent.includes(tx.category)) recent.push(tx.category);
    if (recent.length === RECENT_COUNT) break;
  }

  // most used in the last 30 days
  const since = ymd(new Date(today.getFullYear(), today.getMonth(), today.getDate() - FREQUENT_DAYS));
  const counts = new Map();
  for (const tx of mine) {
    if (tx.date >= since) counts.set(tx.category, (counts.get(tx.category) || 0) + 1);
  }
  const frequent = [...counts.entries()]
    .filter(([name]) => !recent.includes(name))
    .sort((a, b) => b[1] - a[1] || categories.findIndex((c) => c.name === a[0]) - categories.findIndex((c) => c.name === b[0]))
    .slice(0, FREQUENT_COUNT)
    .map(([name]) => name);

  const quickNames = [...recent, ...frequent];
  return {
    quick: quickNames.map((name) => byName.get(name)),
    recentCount: recent.length,
    rest: categories.filter((category) => !quickNames.includes(category.name)),
  };
}
