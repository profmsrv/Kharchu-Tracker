// Sync safety tests: simulates two devices and a fake Firebase. Run from your project root with:  npx tsx src/BUDGET_TRACKER/tests/sync-test.mjs
// It proves: offline edits are kept, nothing is lost or duplicated, conflicts merge, savings plan moves stay consistent, and an unchanged start costs ONE read.
const mem = {};
globalThis.localStorage = { getItem: k => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); }, removeItem: k => { delete mem[k]; } };
const { createLocalStore } = await import('../services/localStore.js');
const { createSyncEngine } = await import('../services/syncEngine.js');

let pass = 0, fail = 0;
const ok = (name, cond) => { console.log((cond ? 'PASS ' : 'FAIL ') + name); cond ? pass++ : fail++; };

// ---- fake Firebase (shared by all devices) ----
function newCloud() { return { meta: null, cols: { transactions: new Map(), categories: new Map(), goals: new Map(), notes: new Map() }, profile: null, deleted: {}, clock: 1_000_000 }; }
function remoteFor(cloud) {
  const r = { id: 'fake/project', online: true, calls: { pushDeletions: 0, getDeletions: 0, getMeta: 0, getAll: 0, getChanged: 0, getProfile: 0, pushItems: 0, cas: 0 }, failPushAfter: null, beforeCas: null };
  const guard = () => { if (!r.online) throw new Error('Failed to get document because the client is offline.'); };
  const read = (map, since) => { const items = []; let newest = 0; for (const v of map.values()) { if (since == null || v.syncedAt > since) { const { syncedAt, ...f } = v; items.push(JSON.parse(JSON.stringify(f))); newest = Math.max(newest, syncedAt); } } return { items, newest }; };
  Object.assign(r, {
    async getMeta() { guard(); r.calls.getMeta++; return cloud.meta ? { ...cloud.meta } : null; },
    async getAll(n) { guard(); r.calls.getAll++; return read(cloud.cols[n], null); },
    async getChanged(n, s) { guard(); r.calls.getChanged++; return read(cloud.cols[n], s); },
    async getProfile() { guard(); r.calls.getProfile++; return cloud.profile ? { item: JSON.parse(JSON.stringify((({ syncedAt, ...f }) => f)(cloud.profile))), newest: cloud.profile.syncedAt } : null; },
    async pushItems(items) { guard(); r.calls.pushItems++; cloud.clock += 1000; let n = 0;
      for (const { name, id, data } of items) { if (r.failPushAfter != null && n >= r.failPushAfter) throw new Error('network error mid-upload'); const doc = { ...JSON.parse(JSON.stringify(data)), id, syncedAt: cloud.clock + n }; if (name === 'profile') cloud.profile = doc; else cloud.cols[name].set(id, doc); n++; } },
    // deleting for real: the document disappears, its id goes into the "deleted" list
    async pushDeletions(items) { guard(); r.calls.pushDeletions++; for (const { name, id, updatedAt } of items) { cloud.cols[name].delete(id); cloud.deleted[`${name}__${id}`] = updatedAt; } },
    async getDeletions() { guard(); r.calls.getDeletions++; return { ...cloud.deleted }; },
    async cleanupTombstones() { guard(); let n = 0; for (const [name, map] of Object.entries(cloud.cols)) for (const [id, doc] of [...map]) if (doc.deleted) { map.delete(id); cloud.deleted[`${name}__${id}`] = doc.updatedAt; n++; } return n; },
    async compareAndSetMeta(expected, nk) { guard(); r.calls.cas++; if (r.beforeCas) { const f = r.beforeCas; r.beforeCas = null; await f(); } const cur = cloud.meta ? cloud.meta.versionKey : null; if (cur !== (expected ?? null)) return { ok: false, meta: cloud.meta ? { ...cloud.meta } : null }; cloud.meta = { versionKey: nk }; return { ok: true }; },
  });
  return r;
}
function device(name, cloud) {
  const store = createLocalStore({ storageKey: 'dev-' + name });
  const remote = remoteFor(cloud);
  const engine = createSyncEngine({ store, getRemote: async () => remote, onStatus: () => {} });
  return { store, remote, engine, sync: () => engine.syncNow(), snap: () => store.snapshot() };
}
const tx = (title, amount = 100) => ({ type: 'expense', title, category: 'Food', amount, date: '2026-10-10' });
const titles = (d) => d.snap().transactions.map(t => t.title).sort();

// 1. fresh start: defaults only, nothing uploaded by itself
{
  const cloud = newCloud(); const A = device('a1', cloud);
  ok('1 seeds 10 categories and NO plans', A.snap().categories.length === 10 && A.snap().goals.length === 0);
  await A.sync();
  ok('1 first sync creates the key in Firebase', cloud.meta && cloud.meta.versionKey === A.store.getSync().syncedKey);
  A.engine.stop();
}
// 2. add offline -> nothing lost -> goes online -> uploaded exactly once
{
  const cloud = newCloud(); const A = device('a2', cloud); await A.sync();
  A.remote.online = false;
  await A.store.addTransaction(tx('offline-1')); await A.store.addTransaction(tx('offline-2'));
  await A.sync();
  ok('2 offline: edits stay in outbox', A.store.pendingCount() === 2 && titles(A).length === 2);
  ok('2 offline: key changed locally but Firebase key unchanged', A.store.getSync().key !== cloud.meta.versionKey);
  A.remote.online = true; await A.sync();
  ok('2 online: outbox empty, both in Firebase', A.store.pendingCount() === 0 && cloud.cols.transactions.size === 2);
  ok('2 online: keys match', cloud.meta.versionKey === A.store.getSync().key && A.store.getSync().syncedKey === cloud.meta.versionKey);
  await A.sync(); await A.sync();
  ok('2 no duplicates after extra syncs', cloud.cols.transactions.size === 2);
  A.engine.stop();
}
// 3. second device: pulls everything; later boot with no changes = exactly ONE read
{
  const cloud = newCloud(); const A = device('a3', cloud); await A.store.addTransaction(tx('from-A')); await A.sync();
  const B = device('b3', cloud); await B.sync();
  ok('3 B downloaded A data', titles(B).includes('from-A'));
  B.remote.calls = { getMeta: 0, getAll: 0, getChanged: 0, getProfile: 0, pushItems: 0, cas: 0 };
  await B.sync();
  const reads = B.remote.calls.getMeta + B.remote.calls.getAll + B.remote.calls.getChanged + B.remote.calls.getProfile;
  ok('3 nothing changed -> only 1 read (the key check)', reads === 1 && B.remote.calls.getMeta === 1);
  A.engine.stop(); B.engine.stop();
}
// 4. both devices edit different items offline -> merged, nothing lost
{
  const cloud = newCloud(); const A = device('a4', cloud); const B = device('b4', cloud);
  await A.store.addTransaction(tx('base')); await A.sync(); await B.sync();
  A.remote.online = false; B.remote.online = false;
  await A.store.addTransaction(tx('A-offline')); await B.store.addTransaction(tx('B-offline'));
  await A.store.addNote({ title: 'noteA', body: 'x' }); await B.store.saveProfile({ name: 'Ravi' });
  A.remote.online = true; B.remote.online = true;
  await A.sync(); await B.sync(); await A.sync();
  ok('4 both have all transactions', JSON.stringify(titles(A)) === JSON.stringify(['A-offline', 'B-offline', 'base']) && JSON.stringify(titles(B)) === JSON.stringify(titles(A)));
  ok('4 note + profile merged', B.snap().notes.length === 1 && A.snap().profile.name === 'Ravi');
  ok('4 Firebase has exactly 3 transactions', cloud.cols.transactions.size === 3);
  A.engine.stop(); B.engine.stop();
}
// 5. same item edited on both -> newest wins, no corruption
{
  const cloud = newCloud(); const A = device('a5', cloud); const B = device('b5', cloud);
  const id = await A.store.addTransaction(tx('shared', 10)); await A.sync(); await B.sync();
  A.remote.online = false; await A.store.updateTransaction(id, { amount: 111 });
  await new Promise(r => setTimeout(r, 5));
  await B.store.updateTransaction(id, { amount: 222 }); await B.sync();   // B is newer
  A.remote.online = true; await A.sync(); await B.sync();
  ok('5 newest edit (222) wins on both', A.snap().transactions[0].amount === 222 && B.snap().transactions[0].amount === 222);
  A.engine.stop(); B.engine.stop();
}
// 6. delete syncs and never comes back
{
  const cloud = newCloud(); const A = device('a6', cloud); const B = device('b6', cloud);
  const id = await A.store.addTransaction(tx('to-delete')); await A.sync(); await B.sync();
  ok('6 B has it', titles(B).includes('to-delete'));
  await B.store.deleteTransaction(id); await B.sync(); await A.sync();
  ok('6 deleted on A too', !titles(A).includes('to-delete'));
  await A.sync(); await B.sync();
  ok('6 stays deleted', titles(A).length === 0 && titles(B).length === 0);
  A.engine.stop(); B.engine.stop();
}
// 7. upload dies half-way -> nothing lost, retry finishes, no duplicates
{
  const cloud = newCloud(); const A = device('a7', cloud); await A.sync();
  for (let i = 0; i < 6; i++) await A.store.addTransaction(tx('bulk-' + i));
  A.remote.failPushAfter = 3; await A.sync();
  ok('7 failure keeps all 6 in outbox', A.store.pendingCount() === 6 && titles(A).length === 6);
  A.remote.failPushAfter = null; await A.sync();
  ok('7 retry uploads all 6 once', cloud.cols.transactions.size === 6 && A.store.pendingCount() === 0);
  A.engine.stop();
}
// 8. race: another device publishes while we are uploading
{
  const cloud = newCloud(); const A = device('a8', cloud); const B = device('b8', cloud); await A.sync(); await B.sync();
  await A.store.addTransaction(tx('A-race'));
  A.remote.beforeCas = async () => { await B.store.addTransaction(tx('B-race')); await B.sync(); };
  await A.sync(); await B.sync();
  ok('8 race: both items everywhere', JSON.stringify(titles(A)) === JSON.stringify(['A-race', 'B-race']) && JSON.stringify(titles(B)) === JSON.stringify(titles(A)));
  A.engine.stop(); B.engine.stop();
}
// 9. damaged main data -> restored from backup
{
  const cloud = newCloud(); const A = device('a9', cloud);
  await A.store.addTransaction(tx('keep-1')); await A.store.addTransaction(tx('keep-2'));
  mem['dev-a9'] = '{"transactions": [ BROKEN';
  const again = createLocalStore({ storageKey: 'dev-a9' });
  ok('9 restored previous copy (>=1 item survives, app still starts)', again.snapshot().transactions.length >= 1);
  A.engine.stop();
}
// 10. data saved by the OLD version (no updatedAt, random ids) loads and syncs
{
  mem['dev-a10'] = JSON.stringify({ transactions: [{ id: 'old-1', type: 'expense', title: 'legacy', category: 'Food', amount: 5, date: '2026-01-01', createdAt: 1700000000000 }], categories: [], goals: [], notes: [], profile: { name: 'Old', theme: 'dark', seeded: true } });
  const cloud = newCloud(); const A = device('a10', cloud);
  ok('10 legacy item visible, profile kept', A.snap().transactions.length === 1 && A.snap().profile.name === 'Old');
  await A.sync();
  ok('10 legacy item uploaded', cloud.cols.transactions.has('old-1'));
  A.engine.stop();
}
// 11. switching to a NEW Firebase account uploads everything there
{
  const cloud1 = newCloud(); const A = device('a11', cloud1); await A.store.addTransaction(tx('mine')); await A.sync();
  const cloud2 = newCloud();
  const remote2 = remoteFor(cloud2);
  const engine2 = createSyncEngine({ store: A.store, getRemote: async () => remote2, onStatus: () => {} });
  A.store.resetSync(); await engine2.syncNow();
  ok('11 new account received all data', cloud2.cols.transactions.size === 1 && cloud2.cols.categories.size === 10);
  A.engine.stop(); engine2.stop();
}
// 12. two devices that both start fresh do not duplicate default categories
{
  const cloud = newCloud(); const A = device('a12', cloud); const B = device('b12', cloud);
  await A.store.addTransaction(tx('x')); await A.sync(); await B.sync(); await B.store.addTransaction(tx('y')); await B.sync(); await A.sync();
  ok('12 still 10 categories on both devices', A.snap().categories.length === 10 && B.snap().categories.length === 10);
  A.engine.stop(); B.engine.stop();
}
// 13. savings plan creates 2 linked categories; syncs; rename cascades; delete removes them; no duplicates on 2nd device
{
  const cloud = newCloud(); const A = device('a13', cloud); const B = device('b13', cloud);
  const goalId = await A.store.addGoal({ name: 'Phone', target: 20000, start: 500, icon: 'phone', color: '#f00', note: 'new phone' });
  ok('13 plan makes income + expense categories', A.snap().categories.filter(c => c.goalId === goalId).length === 2 && A.snap().categories.length === 12);
  await A.store.addTransaction({ type: 'income', title: 'Phone', category: 'Phone', amount: 1000, date: '2026-10-10' });
  await A.sync(); await B.sync();
  ok('13 B has plan + 2 categories + transaction (no duplicates)', B.snap().goals.length === 1 && B.snap().categories.length === 12 && B.snap().transactions.length === 1);
  let nameError = null; try { await B.store.addGoal({ name: 'food', target: 1 }); } catch (e) { nameError = e.message; }
  ok('13 plan name clashing with a category is refused', /already exists/.test(nameError || ''));
  await A.store.updateGoal(goalId, { name: 'Mobile' }); await A.sync(); await B.sync();
  ok('13 rename moves transactions + categories on both devices', B.snap().transactions[0].category === 'Mobile' && B.snap().categories.filter(c => c.name === 'Mobile').length === 2);
  await new Promise(r => setTimeout(r, 30)); // edits by a person are seconds apart; the test is faster than that
  await B.store.deleteGoal(goalId); await B.sync(); await A.sync();
  ok('13 delete removes plan and its categories everywhere', A.snap().goals.length === 0 && A.snap().categories.length === 10);
  A.engine.stop(); B.engine.stop();
}
// 14. older saved plans (no categories) get their categories once, with fixed ids
{
  mem['dev-a14'] = JSON.stringify({ transactions: [], categories: [], goals: [{ id: 'g-old', name: 'Trip', target: 5000, saved: 1200, color: '#0f0', createdAt: 5 }], notes: [], profile: { name: 'x', seeded: true } });
  const cloud = newCloud(); const A = device('a14', cloud);
  const cats = A.snap().categories.filter(c => c.goalId === 'g-old');
  ok('14 old plan got its 2 categories (fixed ids)', cats.length === 2 && cats.every(c => c.id.startsWith('cat-') && c.id.endsWith('plan-g-old')));
  A.engine.stop();
}
// 15. plan moves: ONE transaction each (bank icon), balance follows, plan follows, limits, edit/delete, sync, migration
{
  const { sumBy, balanceOf } = await import('../utils/dates.js');
  const { planProgress } = await import('../utils/plans.js');
  const cloud = newCloud(); const A = device('a15', cloud); const B = device('b15', cloud);
  const goalId = await A.store.addGoal({ name: 'Bike', target: 10000, start: 0, icon: 'car', color: '#00f' });
  const inId = await A.store.addPlanMove({ goalId, direction: 'in', amount: 3000, date: '2026-10-10', note: '' });
  let txs = A.snap().transactions; const goal = A.snap().goals[0];
  ok('15 money into a plan = ONE transaction: expense "Moved to plan" with goalId', txs.length === 1 && txs[0].id === inId && txs[0].type === 'expense' && txs[0].category === 'Moved to plan' && txs[0].goalId === goalId && !txs[0].transferId);
  ok('15 plan grew by 3000 (calculated from that one transaction)', planProgress(goal, txs).saved === 3000);
  ok('15 BALANCE drops by 3000, statistics ignore the move', balanceOf(txs) === -3000 && sumBy(txs, 'expense') === 0 && sumBy(txs, 'income') === 0);
  let err = null; try { await A.store.addPlanMove({ goalId, direction: 'out', amount: 5000, date: '2026-10-10' }); } catch (e) { err = e.message; }
  ok('15 cannot take out more than the plan holds', /Only .*3,000/.test(err || '') && A.snap().transactions.length === 1);
  const outId = await A.store.addPlanMove({ goalId, direction: 'out', amount: 1000, date: '2026-10-11', note: 'repair' });
  txs = A.snap().transactions;
  ok('15 taking 1000 out = ONE income "From plan"; plan 2000; BALANCE -2000', txs.length === 2 && txs.find(t => t.id === outId).type === 'income' && txs.find(t => t.id === outId).category === 'From plan' && /repair/.test(txs.find(t => t.id === outId).title) && planProgress(goal, txs).saved === 2000 && balanceOf(txs) === -2000);
  await A.store.updateTransaction(inId, { amount: 4000, type: 'income', category: 'Food', goalId: 'x' });
  txs = A.snap().transactions;
  ok('15 editing a move changes its amount; type/category/plan stay', txs.find(t => t.id === inId).amount === 4000 && txs.find(t => t.id === inId).type === 'expense' && txs.find(t => t.id === inId).category === 'Moved to plan' && txs.find(t => t.id === inId).goalId === goalId);
  let err2 = null; try { await A.store.updateTransaction(outId, { amount: 9000 }); } catch (e) { err2 = e.message; }
  ok('15 raising a withdrawal above what the plan holds is refused', /Only/.test(err2 || ''));
  await A.sync(); await B.sync();
  ok('15 syncs: 2 transactions + system categories, no duplicates', B.snap().transactions.length === 2 && B.snap().categories.filter(c => c.system).length === 2);
  await A.store.updateGoal(goalId, { name: 'Scooter' });
  ok('15 renaming the plan updates the titles of its moves', A.snap().transactions.every(t => /Scooter/.test(t.title)) && !A.snap().transactions.some(t => /Bike/.test(t.title)));
  await new Promise(r => setTimeout(r, 30));
  await B.store.deleteTransaction(inId); await B.sync(); await A.sync();
  ok('15 deleting the move removes it everywhere; plan recalculates', A.snap().transactions.length === 1 && planProgress(A.snap().goals[0], A.snap().transactions).saved === -1000);
  A.engine.stop(); B.engine.stop();
}
// 16. data saved by the previous version (two linked entries) is converted into ONE transaction
{
  mem['dev-a16'] = JSON.stringify({
    transactions: [
      { id: 'p1', type: 'income', title: 'Saved to Phone', category: 'Phone', amount: 700, date: '2026-10-01', transferId: 'T1', createdAt: 10, updatedAt: 10 },
      { id: 'b1', type: 'expense', title: 'Moved to plan: Phone', category: 'Moved to plan', amount: 700, date: '2026-10-01', transferId: 'T1', createdAt: 11, updatedAt: 11 },
      { id: 'p2', type: 'expense', title: 'Taken from Phone', category: 'Phone', amount: 200, date: '2026-10-02', transferId: 'T2', createdAt: 12, updatedAt: 12 },
      { id: 'b2', type: 'income', title: 'From plan: Phone', category: 'From plan', amount: 200, date: '2026-10-02', transferId: 'T2', createdAt: 13, updatedAt: 13 },
    ],
    categories: [], goals: [{ id: 'gP', name: 'Phone', target: 5000, start: 100, createdAt: 5, updatedAt: 5 }], notes: [], profile: { name: 'x', seeded: true } });
  const { planProgress } = await import('../utils/plans.js');
  const { balanceOf } = await import('../utils/dates.js');
  const cloud = newCloud(); const A = device('a16', cloud);
  const t = A.snap().transactions;
  ok('16 four old entries became two single transactions with goalId, no transferId', t.length === 2 && t.every(x => x.goalId === 'gP' && !x.transferId) && t.map(x => x.category).sort().join() === 'From plan,Moved to plan');
  ok('16 plan amount unchanged (100 + 700 - 200) and balance = -500', planProgress(A.snap().goals[0], t).saved === 600 && balanceOf(t) === -500);
  await A.sync(); ok('16 converted data syncs', cloud.cols.transactions.size === 2 && Object.keys(cloud.deleted).length === 2); // 2 live; the 2 removed ones are gone and listed as deleted
  A.engine.stop();
}
// ---- DELETING: the document is really removed from Firebase, other devices still learn about it ----
{
  const cloud = newCloud(); const A = device('del-a', cloud); const B = device('del-b', cloud);
  await A.store.addTransaction(tx('keep')); await A.store.addTransaction(tx('remove-me'));
  await A.sync(); await B.sync();
  ok('D1 both devices have 2 transactions', titles(A).length === 2 && titles(B).length === 2 && cloud.cols.transactions.size === 2);

  const doomed = A.snap().transactions.find((t) => t.title === 'remove-me');
  await A.store.deleteTransaction(doomed.id); await A.sync();
  ok('D2 the document is GONE from Firebase (not a marker)', cloud.cols.transactions.size === 1 && !cloud.cols.transactions.has(doomed.id));
  ok('D3 the deletion is noted in the "deleted" list', Object.keys(cloud.deleted).includes(`transactions__${doomed.id}`));
  ok('D4 the deleting device is fully uploaded', A.store.pendingCount() === 0);

  await B.sync();
  ok('D5 the other device removes it too', titles(B).join() === 'keep');
  await B.sync(); await A.sync();
  ok('D6 nothing comes back after more syncs', titles(A).join() === 'keep' && titles(B).join() === 'keep' && cloud.cols.transactions.size === 1);

  // a brand-new device never sees it
  const C = device('del-c', cloud); await C.sync();
  ok('D7 a new device gets only what still exists', titles(C).join() === 'keep');

  // categories + plans (a plan deletes its two categories)
  const goalId = await A.store.addGoal({ name: 'Bike', icon: 'bike', color: '#f0605d', target: 5000, start: 0 }); await A.sync(); await B.sync();
  ok('D8 plan and its 2 categories reach the other device', B.snap().goals.length === 1 && B.snap().categories.filter((c) => c.goalId === goalId).length === 2);
  await A.store.deleteGoal(goalId); await A.sync(); await B.sync();
  ok('D9 deleting the plan removes plan + categories everywhere', cloud.cols.goals.size === 0 && B.snap().goals.length === 0 && B.snap().categories.filter((c) => c.goalId === goalId).length === 0 && ![...cloud.cols.categories.values()].some((c) => c.goalId === goalId));

  // legacy markers left by older versions are cleaned once
  cloud.cols.notes.set('old-note', { id: 'old-note', deleted: true, updatedAt: 5, syncedAt: 5 });
  const E = device('del-e', cloud); E.remote.id = 'fake/other-connection'; await E.sync(); // another connection: the one-time clean-up has not run for it yet
  ok('D10 old { deleted: true } marker documents are removed once', !cloud.cols.notes.has('old-note') && cloud.deleted['notes__old-note'] === 5);

  // deleted offline: the deletion waits and is applied later
  A.remote.online = false; const keepId = A.snap().transactions[0].id; await A.store.deleteTransaction(keepId); await A.sync();
  ok('D11 offline delete waits in the outbox', A.store.pendingCount() === 1 && cloud.cols.transactions.size === 1);
  A.remote.online = true; await A.sync();
  ok('D12 back online: removed from Firebase', cloud.cols.transactions.size === 0 && A.store.pendingCount() === 0);
  [A, B, C, E].forEach((d) => d.engine.stop());
}

// ---- #9 leftovers of deleted savings plans ----
{
  const cloud = newCloud(); const A = device('orph', cloud);
  await A.store.addCategory({ type: 'expense', name: 'Vacation', icon: 'umbrella', color: '#3b9be0', limit: 0, goalId: 'ghost-plan' });
  await A.store.addCategory({ type: 'income', name: 'Savings plan', icon: 'target', color: '#2eae7b', goalId: 'ghost-plan' });
  const names = () => A.snap().categories.map((c) => c.name);
  ok('O1 leftovers exist (plan "ghost-plan" does not)', names().includes('Vacation') && names().includes('Savings plan'));
  ok('O2 removing leftovers deletes exactly those', (await A.store.deleteOrphanCategories()) === 2 && !names().includes('Vacation') && !names().includes('Savings plan') && A.snap().categories.length === 10);

  const gid = await A.store.addGoal({ name: 'Car', icon: 'car', color: '#f0605d', target: 9000, start: 0 });
  await A.store.addCategory({ type: 'expense', name: 'Old car category', icon: 'car', color: '#f0605d', goalId: gid }); // an older version's own id
  ok('O3 a live plan\'s categories are NOT leftovers', (await A.store.deleteOrphanCategories()) === 0);
  await A.store.deleteGoal(gid);
  ok('O4 deleting a plan removes ALL its categories, also older ones', !names().includes('Car') && !names().includes('Old car category') && A.snap().categories.length === 10);
  A.engine.stop();
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
