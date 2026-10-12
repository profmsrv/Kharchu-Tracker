// -----------------------------------------------------------------------------
// BACK BUTTON ENGINE (no React in here, so it can be tested on its own).
//
// PROBLEM: this app is ONE web page. Without help, the phone's Back button leaves the page and goes to
// whatever website was open before. We want Back to mean "one step back INSIDE the app".
//
// IDEA: every screen or popup that is "on top" of the previous one registers a LAYER (pushLayer).
//   - a layer adds one entry to the browser history
//   - Back removes that entry, and we close the top layer instead of leaving the page
//   - if the layer is closed by the app itself (a Close button, tapping outside ...), the extra history
//     entry is removed again, so the history always matches what is on screen
//
// HISTORY SHAPE:   [ guard(0) ][ home(1) ][ layer 1 (2) ][ layer 2 (3) ] ...
//   The "guard" entry sits under Home. Pressing Back on Home lands on it, and we answer with a hint
//   ("Press back again to exit"). A second quick Back goes past the guard = the app really closes.
//
// Browsers (Chrome) ignore history entries that were added before the person touched the page, so the extra
// entries are only added after the first tap / key press ("armed").
// -----------------------------------------------------------------------------
const HOME = 1; // history depth of the Home screen (depth 0 is the guard under it)

export function createBackStack(win, options = {}) {
  const config = {
    exitOnDoubleBack: true,
    exitWindowMs: 2000,
    exitHint: 'Press back again to exit',
    stayHint: 'You are on the Home screen',
    ...options,
  };

  const layers = [];       // open layers, the last one is on top
  let depth = HOME;        // the depth of the history entry we are on right now
  let armed = false;       // true after the first tap / key press
  let busy = false;        // true while our own history.go() is travelling (its popstate must be ignored)
  let busyTimer = null;
  let scheduled = null;
  let installed = false;
  let lastRootBack = 0;
  let onRootBack = null;
  const gestureEvents = ['pointerup', 'keydown', 'click'];

  const history = win.history;
  const mark = (value) => ({ ...(history.state || {}), btDepth: value });

  // Make the history length match the number of open layers
  function reconcile() {
    if (!installed || !armed || busy) return;
    const want = HOME + layers.length;
    if (depth < want) {
      while (depth < want) {
        depth += 1;
        history.pushState(mark(depth), '');
      }
    } else if (depth > want) {
      const steps = depth - want;
      busy = true;
      depth = want;
      clearTimeout(busyTimer);
      busyTimer = setTimeout(() => { busy = false; reconcile(); }, 600); // safety: never stay stuck
      history.go(-steps);
    }
  }

  function schedule() {
    clearTimeout(scheduled);
    scheduled = setTimeout(reconcile, 0);
  }

  function arm() {
    if (armed) return;
    armed = true;
    gestureEvents.forEach((name) => win.removeEventListener(name, arm, true));
    // Home needs its own entry above the guard
    if (depth < HOME) {
      depth = HOME;
      history.pushState(mark(depth), '');
    }
    reconcile();
  }

  // The user pressed Back (or Forward, or used the browser's history menu)
  function onPopState(event) {
    const target = event.state && typeof event.state.btDepth === 'number' ? event.state.btDepth : null;

    if (busy) { // the echo of our own history.go()
      busy = false;
      clearTimeout(busyTimer);
      if (target !== null) depth = target;
      reconcile();
      return;
    }
    if (target === null) return; // an entry that is not ours (the page is being left): do nothing

    depth = target;
    // close as many layers as history entries were removed
    while (layers.length > 0 && HOME + layers.length > depth) {
      const layer = layers.pop();
      layer.close();
    }
    if (depth < HOME) {
      handleRootBack();
      return;
    }
    reconcile();
  }

  // Back was pressed while only the Home screen was open
  function handleRootBack() {
    const now = Date.now();
    if (config.exitOnDoubleBack && now - lastRootBack < config.exitWindowMs) {
      lastRootBack = 0;
      history.back(); // second quick press: leave (an installed app closes)
      return;
    }
    lastRootBack = now;
    depth = HOME;
    history.pushState(mark(depth), ''); // stay in the app
    if (onRootBack) onRootBack(config.exitOnDoubleBack ? config.exitHint : config.stayHint);
  }

  return {
    // Start listening. `rootBackCallback(message)` shows the hint. Returns a function that stops everything.
    install(rootBackCallback) {
      onRootBack = rootBackCallback || null;
      if (installed) return () => {};
      installed = true;
      const state = history.state;
      if (state && typeof state.btDepth === 'number') {
        depth = state.btDepth; // page reload: the entries are still there
      } else {
        history.replaceState(mark(0), ''); // the page's first entry becomes the guard...
        depth = 0;                          // ...and Home's own entry is added at the first tap
      }
      win.addEventListener('popstate', onPopState);
      gestureEvents.forEach((name) => win.addEventListener(name, arm, true));
      return () => {
        installed = false;
        armed = false;
        win.removeEventListener('popstate', onPopState);
        gestureEvents.forEach((name) => win.removeEventListener(name, arm, true));
        clearTimeout(scheduled);
        clearTimeout(busyTimer);
      };
    },

    // Register a layer. `close()` is called when Back is pressed. Returns a function that removes the layer.
    pushLayer(close) {
      const layer = { close };
      layers.push(layer);
      schedule();
      return () => {
        const index = layers.indexOf(layer);
        if (index >= 0) layers.splice(index, 1);
        schedule();
      };
    },

    // for tests
    _state: () => ({ depth, layers: layers.length, armed, busy }),
    _arm: arm,
  };
}
