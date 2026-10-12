// Category averages for the selected period (Insights tab + the "Average" charts of the Budget tab).
//
//   average of a category = the SUM of its transactions in the period / the NUMBER of those transactions
//   Example: Food in October has 3 transactions of 100, 200 and 300  ->  total 600, count 3, average 200.
//
// Only the transactions of the selected period are given in (week, month, year or custom range), so every number
// follows the period. Savings-plan moves are not income or spending, so they are left out (same rule as the other statistics).

/**
 * Per category of one type ('expense' | 'income'):  [{ name, total, count, average }], biggest total first.
 *   txs   the transactions inside the selected period
 */
export function categoryAverages(txs, type) {
  const byName = new Map();
  for (const tx of txs) {
    if (tx.type !== type || tx.goalId) continue;
    const entry = byName.get(tx.category) || { name: tx.category, total: 0, count: 0 };
    entry.total += tx.amount;
    entry.count += 1;
    byName.set(tx.category, entry);
  }
  return [...byName.values()]
    .map((entry) => ({ ...entry, average: entry.total / entry.count }))
    .sort((a, b) => b.total - a.total);
}
