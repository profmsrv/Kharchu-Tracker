// Tests the Back-button engine (services/backStack.js) against a small fake browser history.
// Run:  node tests/back-test.mjs
import { createBackStack } from '../services/backStack.js';

let pass = 0, fail = 0;
const ok = (name, cond) => { console.log((cond ? 'PASS ' : 'FAIL ') + name); cond ? pass++ : fail++; };
const tick = (ms = 5) => new Promise((resolve) => setTimeout(resolve, ms));

// ---- fake window + history (entries, an index, async traversal like a real browser) ----
function fakeBrowser() {
  const entries = [{ state: null }];
  let index = 0;
  const listeners = {};
  let left = false;
  const win = {
    addEventListener: (n, f) => { (listeners[n] = listeners[n] || new Set()).add(f); },
    removeEventListener: (n, f) => { listeners[n] && listeners[n].delete(f); },
    history: {
      get state() { return entries[index].state; },
      pushState(state) { entries.splice(index + 1); entries.push({ state }); index += 1; },
      replaceState(state) { entries[index] = { state }; },
      go(delta) {
        setTimeout(() => {
          const next = index + delta;
          if (next < 0) { left = true; return; } // went past our first entry = the page is left
          index = next;
          (listeners.popstate || []).forEach((f) => f({ state: entries[index].state }));
        }, 0);
      },
      back() { this.go(-1); },
    },
  };
  return { win, entries, get index() { return index; }, get left() { return left; }, fire: (n) => (listeners[n] || []).forEach((f) => f({})), listeners };
}

const messages = [];
function app(options) {
  const b = fakeBrowser();
  const stack = createBackStack(b.win, { exitWindowMs: 300, ...options });
  stack.install((m) => messages.push(m));
  return { b, stack };
}
const press = async (b) => { b.win.history.back(); await tick(); };
const depthOf = (b) => b.entries[b.index].state && b.entries[b.index].state.btDepth;

// 1. before the first tap nothing is added; after the tap Home has its own entry
{
  const { b, stack } = app();
  ok('1a one entry before any tap (the guard)', b.entries.length === 1 && depthOf(b) === 0);
  b.fire('pointerup'); await tick();
  ok('1b Home entry added at first tap', b.entries.length === 2 && depthOf(b) === 1 && stack._state().armed);
}

// 2. a popup: Back closes it and stays in the app
{
  const { b, stack } = app(); b.fire('pointerup');
  let closed = 0;
  const release = stack.pushLayer(() => { closed++; release(); });
  await tick();
  ok('2a opening a layer adds a history entry', b.entries.length === 3 && depthOf(b) === 2);
  await press(b);
  ok('2b Back closed the layer', closed === 1);
  ok('2c still inside the app on Home', depthOf(b) === 1 && !b.left && stack._state().layers === 0);
}

// 3. the app closes a layer itself (Close button): history entry is removed, onClose NOT called by Back logic
{
  const { b, stack } = app(); b.fire('pointerup');
  let backClosed = 0;
  const release = stack.pushLayer(() => { backClosed++; });
  await tick();
  release(); await tick(20);
  ok('3a history shrinks back to Home', depthOf(b) === 1 && !b.left);
  ok('3b Back logic did not call close()', backClosed === 0);
  // and now Back on Home shows the hint instead of leaving
  messages.length = 0;
  await press(b);
  ok('3c Back on Home: hint shown, page not left', messages[0] === 'Press back again to exit' && !b.left && depthOf(b) === 1);
}

// 4. double Back on Home leaves; slow second press does not
{
  const { b } = app(); b.fire('pointerup'); await tick();
  messages.length = 0;
  await press(b); await press(b);
  ok('4a two quick Backs leave the page', b.left === true);
  const t = app(); t.b.fire('pointerup'); await tick();
  await press(t.b); await tick(350); await press(t.b);
  ok('4b a slow second Back only shows the hint again', t.b.left === false && messages.length === 3);
}

// 5. nested layers close top-down
{
  const { b, stack } = app(); b.fire('pointerup');
  const order = [];
  const r1 = stack.pushLayer(() => { order.push('A'); r1(); });
  const r2 = stack.pushLayer(() => { order.push('B'); r2(); });
  await tick();
  ok('5a two layers = depth 3', depthOf(b) === 3);
  await press(b); await press(b);
  ok('5b closed B then A', order.join('') === 'BA' && depthOf(b) === 1 && !b.left);
}

// 6. React StrictMode: mount, cleanup, mount in the same moment must not leave extra entries
{
  const { b, stack } = app(); b.fire('pointerup');
  let r = stack.pushLayer(() => {}); r(); r = stack.pushLayer(() => {});
  await tick(20);
  ok('6 strict-mode double mount = exactly one extra entry', depthOf(b) === 2 && b.entries.length === 3);
}

// 7. user jumps back two entries at once (history menu / long press): both layers close
{
  const { b, stack } = app(); b.fire('pointerup');
  let n = 0;
  const r1 = stack.pushLayer(() => { n++; r1(); });
  const r2 = stack.pushLayer(() => { n++; r2(); });
  await tick();
  b.win.history.go(-2); await tick();
  ok('7 two layers closed by one jump', n === 2 && depthOf(b) === 1 && !b.left);
}

// 8. closing the BOTTOM layer while the top one stays open: depth follows the layer count
{
  const { b, stack } = app(); b.fire('pointerup');
  const r1 = stack.pushLayer(() => {});
  const r2 = stack.pushLayer(() => {});
  await tick();
  r1(); await tick(20);
  ok('8a depth = Home + 1 layer', depthOf(b) === 2 && !b.left);
  r2(); await tick(20);
  ok('8b back on Home', depthOf(b) === 1);
}

// 9. page reload: the old entries are still there, extra ones are trimmed
{
  const b = fakeBrowser();
  b.entries[0] = { state: { btDepth: 0 } }; b.win.history.pushState({ btDepth: 1 }); b.win.history.pushState({ btDepth: 2 }); b.win.history.pushState({ btDepth: 3 });
  const stack = createBackStack(b.win, { exitWindowMs: 300 });
  stack.install(() => {}); b.fire('click'); await tick(30);
  ok('9 after reload extra entries are removed (Home only)', depthOf(b) === 1 && !b.left);
}

// 10. stay-in-app mode (exitOnDoubleBack = false) never leaves
{
  const { b } = app({ exitOnDoubleBack: false }); b.fire('pointerup'); await tick();
  messages.length = 0;
  await press(b); await press(b); await press(b);
  ok('10 never leaves, shows the stay hint', !b.left && messages.every((m) => m === 'You are on the Home screen') && messages.length === 3);
}

// 11. a PINNED layer (the tour) stays on top, also when other layers are added later
{
  const { b, stack } = app(); b.fire('pointerup');
  const order = [];
  const tour = stack.pushLayer(() => { order.push('tour'); tour(); }, true);
  const popup = stack.pushLayer(() => { order.push('popup'); popup(); });   // registered AFTER the tour, must still be below it
  await tick();
  await press(b); await press(b);
  ok('11 Back closes the pinned tour first, then the popup', order.join() === 'tour,popup' && depthOf(b) === 1 && !b.left);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
