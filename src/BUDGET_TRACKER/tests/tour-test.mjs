// Checks the tour: every language is complete and has a text for every step.  Run: npx tsx tests/tour-test.mjs
const { LANGUAGES, TOUR, TOUR_STEPS } = await import('../constants/tour.js');
const { ICONS } = await import('../constants/icons.js');
const { buildDemo } = await import('../constants/demoData.js');
const { planProgress } = await import('../utils/plans.js');
const { balanceOf, sumBy } = await import('../utils/dates.js');
let pass = 0, fail = 0;
const ok = (name, cond) => { console.log((cond ? 'PASS ' : 'FAIL ') + name); cond ? pass++ : fail++; };

const en = TOUR.en;
ok('step ids are unique', new Set(TOUR_STEPS.map((s) => s.id)).size === TOUR_STEPS.length);
ok('every language in the list has texts', LANGUAGES.every((l) => TOUR[l.id]));
for (const { id } of LANGUAGES) {
  const t = TOUR[id];
  ok(`${id}: all UI texts present`, ['chooseTitle', 'chooseSub', 'next', 'back', 'skip', 'language', 'letsGo', 'start', 'demo'].every((k) => typeof t[k] === 'string' && t[k].length > 0));
  ok(`${id}: intro has the same cards and points as English`, t.intro.length === en.intro.length && t.intro.every((c, i) => c.icon === en.intro[i].icon && c.points.length === en.intro[i].points.length && c.title));
  ok(`${id}: outro present`, t.outro.title && t.outro.body && ICONS[t.outro.icon]);
  ok(`${id}: a title and a text for every step`, TOUR_STEPS.every((s) => Array.isArray(t.steps[s.id]) && t.steps[s.id][0].length > 1 && t.steps[s.id][1].length > 10));
  ok(`${id}: no text for a step that does not exist`, Object.keys(t.steps).every((k) => TOUR_STEPS.some((s) => s.id === k)));
}
ok('all intro icons exist', en.intro.every((c) => ICONS[c.icon]));
ok('steps only use known tabs and views', TOUR_STEPS.every((s) => ['home', 'budget', 'insights', 'settings'].includes(s.tab) && ['main', 'appearance'].includes(s.view)));

// the sample data
const demo = buildDemo(new Date(2026, 9, 12));
const month = demo.transactions.filter((t) => t.date >= '2026-10-01');
ok('demo: entries this month, in the last 7 days and last month', month.length > 8 && demo.transactions.some((t) => t.date >= '2026-10-06') && demo.transactions.some((t) => t.date.startsWith('2026-09')));
ok('demo: every category used exists', demo.transactions.every((t) => demo.categories.some((c) => c.type === t.type && c.name === t.category)));
ok('demo: plans have progress between 0 and 100%', demo.goals.every((g) => { const p = planProgress(g, demo.transactions); return p.percent > 0 && p.percent < 100; }));
ok('demo: income and expenses both exist this month', sumBy(month, 'income') > 0 && sumBy(month, 'expense') > 0 && balanceOf(month) > 0);
const early = buildDemo(new Date(2026, 9, 1));
ok('demo: also fine on the 1st of a month (this-month entries stay in this month)', early.transactions.filter((t) => t.date >= '2026-10-01').length > 8);
console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
