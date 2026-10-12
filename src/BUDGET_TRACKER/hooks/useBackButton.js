// React side of the Back-button handling (the logic is in services/backStack.js).
//
//   useBackButton(showHint)       call ONCE in App.jsx. showHint(text) shows "Press back again to exit".
//   useBackLayer(active, close)   call in anything that sits "on top": a popup, a full-screen editor,
//                                 a sub-screen. While `active` is true, the phone's Back button calls close().
//
// Sheet.jsx already does this for every popup, so most code never needs to call it.
import { useEffect, useRef } from 'react';
import { createBackStack } from '../services/backStack';
import { BACK_BUTTON } from '../constants/backButton';

const stack = typeof window !== 'undefined' ? createBackStack(window, BACK_BUTTON) : null;

export function useBackButton(showHint) {
  const latest = useRef(showHint);
  latest.current = showHint;
  useEffect(() => (stack ? stack.install((text) => latest.current && latest.current(text)) : undefined), []);
}

export function useBackLayer(active, onClose) {
  const latest = useRef(onClose);
  latest.current = onClose;
  useEffect(() => {
    if (!active || !stack) return undefined;
    return stack.pushLayer(() => latest.current && latest.current());
  }, [active]);
}
