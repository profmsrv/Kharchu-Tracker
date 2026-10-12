// Tests utils/averages.js.  Run: npx tsx tests/averages-test.mjs
const { categoryAverages } = await import('../utils/averages.js');
let pass = 0, fail = 0;
const ok = (name, cond) => { console.log((cond ? 'PASS ' : 'FAIL ') + name); cond ? pass++ : fail++; };

const tx = (type, category, amount, extra = {}) => ({ type, category, amount, ...extra });
const txs = [
  tx('expense', 'Food', 100), tx('expense', 'Food', 200), tx('expense', 'Food', 300),
  tx('expense', 'Rent', 6000), tx('income', 'Salary', 30000), tx('income', 'Salary', 10000),
  tx('expense', 'Phone', 999, { goalId: 'g' }), // a savings-plan move: ignored
];

const spend = categoryAverages(txs, 'expense');
ok('biggest total first, plan moves ignored', spend.map((r) => r.name).join() === 'Rent,Food');
const food = spend.find((r) => r.name === 'Food');
ok('Food: total 600, 3 transactions, average 200', food.total === 600 && food.count === 3 && food.average === 200);
ok('Rent: one transaction, average = its amount', spend[0].count === 1 && spend[0].average === 6000);
const income = categoryAverages(txs, 'income');
ok('income has its own list: 40000 / 2 = 20000', income.length === 1 && income[0].total === 40000 && income[0].average === 20000);
ok('nothing in the period -> empty list', categoryAverages([], 'expense').length === 0);
// the period is decided by WHICH transactions are given in: a smaller period = different numbers
const lessFood = categoryAverages(txs.slice(0, 2), 'expense');
ok('a shorter period gives its own average (100 + 200) / 2 = 150', lessFood[0].average === 150 && lessFood[0].count === 2);
console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
