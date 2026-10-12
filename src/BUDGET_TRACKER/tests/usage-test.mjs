// Tests the category ordering of the Add-transaction popup (utils/categoryUsage.js).  Run: npx tsx tests/usage-test.mjs
const { rankCategories } = await import('../utils/categoryUsage.js');
let pass = 0, fail = 0;
const ok = (name, cond) => { console.log((cond ? 'PASS ' : 'FAIL ') + name); cond ? pass++ : fail++; };

const cats = ['Groceries', 'Shopping', 'Rent', 'Food', 'Travel', 'Bills', 'Other', 'Fuel'].map((name) => ({ id: name, name }));
const today = new Date(2026, 9, 12); // 12 Oct 2026
let n = 0;
const tx = (category, date, extra = {}) => ({ id: 't' + n, type: 'expense', category, title: category, amount: 10, date, createdAt: n++, ...extra });
const names = (list) => list.map((c) => c.name);

// no history: everything is "rest", in the normal order
let r = rankCategories(cats, [], 'expense', today);
ok('no history -> no quick row, normal order', r.quick.length === 0 && names(r.rest).join() === names(cats).join());

const history = [
  tx('Food', '2026-10-11'), tx('Fuel', '2026-10-10'), tx('Food', '2026-10-09'), tx('Travel', '2026-10-08'), tx('Bills', '2026-10-07'),
  tx('Groceries', '2026-09-20'), tx('Groceries', '2026-09-21'), tx('Groceries', '2026-09-25'), tx('Rent', '2026-09-20'), tx('Rent', '2026-09-22'),
  tx('Other', '2026-06-01'),                                  // too old for "last month"
  tx('Shopping', '2026-10-05', { type: 'income' }),           // other type: ignored
  tx('Fuel', '2026-10-12', { goalId: 'g1' }),                 // plan move: ignored
];
r = rankCategories(cats, history, 'expense', today);
ok('recent = newest first, one each (Food, Fuel, Travel, Bills)', names(r.quick).slice(0, 4).join() === 'Food,Fuel,Travel,Bills' && r.recentCount === 4);
ok('then most used last 30 days (Groceries 3, Rent 2)', names(r.quick).slice(4).join() === 'Groceries,Rent');
ok('old / other-type / plan-move entries do not count', !names(r.quick).includes('Other') && !names(r.quick).includes('Shopping'));
ok('rest keeps the normal order', names(r.rest).join() === 'Shopping,Other');
ok('every category appears exactly once', names([...r.quick, ...r.rest]).sort().join() === names(cats).sort().join());

const inc = rankCategories([{ id: 'S', name: 'Salary' }, { id: 'G', name: 'Gift' }], [tx('Salary', '2026-10-01', { type: 'income' })], 'income', today);
ok('income uses its own history', names(inc.quick).join() === 'Salary' && names(inc.rest).join() === 'Gift');
console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
