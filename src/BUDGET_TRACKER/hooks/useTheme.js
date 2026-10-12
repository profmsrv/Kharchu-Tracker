// Decides light or dark.
//
//   preference = 'system' | 'light' | 'dark' | 'midnight' | 'aurora' | 'dusk' | 'sage' | 'mist'   (Settings)
//   returns true when the DARK colours should be used.
//
// Named themes (see constants/themes.js) say themselves whether they are dark. 'system' follows the phone.
// BUDGET_TRACKER.jsx puts the class "bt-dark" on the app's own root element when this returns true,
// and  data-theme="..."  for the named themes; budget-tracker.css swaps the colour variables.
// Nothing outside the app is touched.
import { useEffect, useState } from 'react';
import { THEMES } from '../constants/themes';

// The browser's own "dark mode" setting
function systemQuery() {
  return window.matchMedia('(prefers-color-scheme: dark)');
}

// true / false for a fixed theme, null when the phone decides ('system' or an unknown value)
function fixedDark(preference) {
  const theme = THEMES.find((item) => item.id === preference);
  return theme && theme.dark !== null ? theme.dark : null;
}

export function useTheme(preference = 'system') {
  const shouldBeDark = (query) => {
    const fixed = fixedDark(preference);
    return fixed !== null ? fixed : query.matches;
  };
  const [dark, setDark] = useState(() => shouldBeDark(systemQuery()));

  useEffect(() => {
    const query = systemQuery();
    const update = () => setDark(shouldBeDark(query));
    update();

    // In "system" mode, follow the device when it switches between light and dark
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preference]);

  return dark;
}
