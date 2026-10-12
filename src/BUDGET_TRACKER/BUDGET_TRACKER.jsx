// -----------------------------------------------------------------------------
// ENTRY POINT of the Budget Tracker. This is the only file your app has to import:
//
//     import BUDGET_TRACKER from './BUDGET_TRACKER/BUDGET_TRACKER.jsx'
//     <BUDGET_TRACKER />
//
// HOW THE CODE IS ORGANISED (read in this order):
//   1. BUDGET_TRACKER.jsx          (this file)  wraps everything and applies the user's look & feel
//   2. hooks/useBudgetData.jsx     loads / saves the data and shares it with all screens
//   3. App.jsx                     the controller: tabs, period filter, popups
//   4. pages/*.jsx                 one file per screen
//   5. components/*.jsx            reusable pieces (rows, sheets, charts, ...)
//   6. services/*.js               the local database, the sync engine and the Firebase connection
//   7. utils/*.js, constants/*.js  small helpers and fixed lists
//
// Data is ALWAYS saved on this device (localStorage). If the user connects their own Firebase
// database (Settings -> Database) it is also backed up and synced there. No keys are in this source code.
// -----------------------------------------------------------------------------
import './budget-tracker.css'; // all colours, themes and look & feel options, scoped to .bt-root
import App from './App';
import { DataProvider, useData } from './hooks/useBudgetData';
import { useTheme } from './hooks/useTheme';
import { setCurrencySymbol } from './utils/format';

// The outer box of the app. It:
//   - adds "bt-dark" when a dark theme is active, and data-theme="midnight" (etc.) for the named themes
//   - turns the user's look & feel choices into data-attributes (budget-tracker.css reacts to them)
// Nothing outside the app is touched.
function Shell() {
  const { profile, appearance } = useData();
  const isDark = useTheme(profile.theme);

  // Money formatting reads the symbol from here, so set it BEFORE the screens below render
  setCurrencySymbol(appearance.currency);

  const theme = profile.theme || 'system';

  return (
    <div
      className={`bt-root${isDark ? ' bt-dark' : ''}`}
      data-theme={theme}
      data-icon={appearance.iconShape}
      data-fab={appearance.fab}
      data-cat-border={appearance.catBorder}
      data-nav-style={appearance.navStyle}
      data-palette={appearance.palette}
      data-radius={appearance.radius}
      data-bg={appearance.background}
      data-balance={appearance.balance}
      data-density={appearance.density}
      data-motion={appearance.motion}
    >
      <App />
    </div>
  );
}

function BUDGET_TRACKER() {
  // DataProvider gives every component access to the data (via useData()).
  return (
    <DataProvider>
      <Shell />
    </DataProvider>
  );
}

export default BUDGET_TRACKER;
