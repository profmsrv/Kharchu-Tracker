// Tests CSV export/import (utils/csv.js + importData in services/localStore.js).
// Run:  npx tsx tests/csv-test.mjs
const mem = {};
globalThis.localStorage = { getItem: k => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); }, removeItem: k => { delete mem[k]; } };
const { analyzeCsv, buildCsv, parseCsv, parseDate, parseAmount } = await import('../utils/csv.js');
const { createLocalStore } = await import('../services/localStore.js');

let pass = 0, fail = 0;
const ok = (name, cond) => { console.log((cond ? 'PASS ' : 'FAIL ') + name); cond ? pass++ : fail++; };
const current = (store) => { const s = store.snapshot(); const c = { expense: [], income: [] }; s.categories.forEach((x) => c[x.type].push(x)); return { transactions: s.transactions, categories: c, goals: s.goals }; };

// parsing helpers
ok('dates', parseDate('2026-10-10') === '2026-10-10' && parseDate('10/10/2026') === '2026-10-10' && parseDate('25/12/26') === '2026-12-25' && parseDate('12/25/2026') === '2026-12-25' && parseDate('5 Oct 2026') === '2026-10-05' && parseDate('Oct 5, 2026') === '2026-10-05' && parseDate('31/02/2026') === null && parseDate('abc') === null);
ok('amounts', parseAmount('₹1,23,456.50').value === 123456.5 && parseAmount('(500)').negative && parseAmount('-500').value === 500 && parseAmount('1.234,50').value === 1234.5 && parseAmount('12,5').value === 12.5 && parseAmount('abc') === null);
ok('quotes, commas, newlines inside quotes', (() => { const r = parseCsv('a,b\r\n"x, y","he said ""hi""\nbye"\n'); return r.length === 2 && r[1].cells[0] === 'x, y' && r[1].cells[1] === 'he said "hi"\nbye'; })());
ok('semicolon separator', parseCsv('a;b;c\n1;2;3')[1].cells[2] === '3');

// round trip: export -> import into an EMPTY store
const A = createLocalStore({ storageKey: 'a' });
A.addTransaction({ type: 'expense', title: 'Lunch, with "Ravi"', category: 'Food', amount: 120, date: '2026-10-01' });
A.addTransaction({ type: 'income', title: 'Salary', category: 'Salary', amount: 50000, date: '2026-10-02' });
await new Promise((r) => setTimeout(r, 5));
const goalId = await A.addGoal({ name: 'Phone', icon: 'phone', color: '#f0605d', target: 20000, start: 0 });
await A.addPlanMove({ goalId, direction: 'in', amount: 3000, date: '2026-10-03', note: 'first' });
const csv = buildCsv(A.snapshot().transactions, A.snapshot().goals);
ok('export has Plan column', csv.split('\n')[0] === 'Date,Type,Category,Note,Amount,Plan' && csv.includes('"Phone"'));

const B = createLocalStore({ storageKey: 'b' });
await B.addGoal({ name: 'Phone', icon: 'phone', color: '#f0605d', target: 20000, start: 0 });
const first = analyzeCsv(csv, current(B));
ok('round trip: 3 rows, none invalid, plan move keeps its plan', first.rows.length === 3 && first.invalidCount === 0 && first.rows.filter((r) => r.goalId).length === 1);
const added = await B.importData({ transactions: first.rows, categories: first.newCategories });
const snap = B.snapshot();
ok('imported 3 transactions', added.transactions === 3 && snap.transactions.length === 3);
ok('plan move is linked again (plan shows 3000 saved)', snap.transactions.some((t) => t.goalId === snap.goals[0].id && t.amount === 3000));
ok('queued for Firebase upload (outbox has the items)', B.pendingCount() >= 3);
ok('importing the same file again adds nothing', analyzeCsv(csv, current(B)).rows.length === 0 && analyzeCsv(csv, current(B)).duplicates === 3);

// other formats
const bank = 'Txn Date;Description;Debit;Credit\n05/10/2026;Zomato order;450,00;\n06/10/2026;Salary credit;;45000\nbad;x;1;\n07/10/2026;Nothing;;\n';
const r2 = analyzeCsv(bank, current(B));
ok('bank style: debit/credit columns, day-first dates', r2.rows.length === 2 && r2.rows[0].type === 'expense' && r2.rows[0].amount === 450 && r2.rows[1].type === 'income' && r2.rows[1].date === '2026-10-06');
ok('bad rows reported with line numbers', r2.invalidCount === 2 && r2.invalid[0].line === 4);
ok('new categories created for unknown names', r2.newCategories.some((c) => c.name === 'Other' || c.name) );
const signed = 'Date,Amount,Note,Category\n2026-10-09,-250,Auto,Travel\n2026-10-09,900,Refund,Gift\n';
const r3 = analyzeCsv(signed, current(B));
ok('signed amount without Type column', r3.rows[0].type === 'expense' && r3.rows[1].type === 'income');
ok('known category keeps its exact spelling', analyzeCsv('Date,Type,Category,Note,Amount\n2026-10-09,expense,groceries,Veg,80', current(B)).rows[0].category === 'Groceries');
ok('unusable file gives a message', analyzeCsv('hello,world\n1,2', current(B)).problem.length > 0 && analyzeCsv('', current(B)).problem.length > 0);
ok('wrong Type value is refused with a reason', analyzeCsv('Date,Type,Amount\n2026-10-09,banana,5', current(B)).invalidCount === 1);
const big = 'Date,Type,Category,Note,Amount\n' + Array.from({ length: 5000 }, (_, i) => `2026-09-${String(1 + (i % 28)).padStart(2, '0')},expense,Food,Item ${i},${10 + i}`).join('\n');
const t0 = Date.now(); const r4 = analyzeCsv(big, current(B)); await B.importData({ transactions: r4.rows, categories: r4.newCategories });
ok('5000 rows import in one go (' + (Date.now() - t0) + ' ms)', r4.rows.length === 5000 && B.snapshot().transactions.length >= 5003);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
