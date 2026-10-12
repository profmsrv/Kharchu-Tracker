// Look & feel options (Settings -> Customize look).
// They are saved inside the profile (so they sync with Firebase too).
// BUDGET_TRACKER.jsx turns each value into a  data-xxx  attribute on the app's root element,
// and budget-tracker.css reacts to those attributes. To add an option: add it here, add a
// row for it in pages/AppearanceSettings.jsx, and add CSS for its values.

export const DEFAULT_APPEARANCE = {
  iconShape: 'soft',      // category icon tiles:  'round' | 'soft' | 'square'
  catBorder: 'off',       // box + border around each category in Add transaction: 'off' | 'on'
  navType: 'notch',       // bottom bar layout:    'notch' | 'flat' | 'floating'
  navStyle: 'dark',       // bottom bar colours:   'dark' | 'accent' | 'glass' | 'light'
  fab: 'gold',            // the Add button:       'gold' | 'accent' | 'glass'
  palette: 'plum',        // accent colours:       see PALETTE_SWATCHES below
  radius: 'normal',       // corner roundness:     'sharp' | 'normal' | 'round'
  background: 'gradient', // page background:      'gradient' | 'plain' | 'aurora' | 'orbs' | 'waves' | 'stars'
  balance: 'gradient',    // balance card:         'gradient' | 'solid' | 'outline'
  density: 'comfortable', // list spacing:         'compact' | 'comfortable' | 'spacious'
  motion: 'on',           // animations:           'on' | 'off'
  currency: '₹',          // money symbol:         '₹' | '$' | '€' | '£'
};

// Colour dots shown in the palette picker (the real colours are in budget-tracker.css)
export const PALETTE_SWATCHES = {
  plum: '#5a1470',
  orchid: '#a21caf',
  rose: '#be185d',
  crimson: '#b91c1c',
  sunset: '#c2410c',
  amber: '#a16207',
  forest: '#1f7a52',
  teal: '#0f766e',
  ocean: '#0e7490',
  indigo: '#3730a3',
  graphite: '#334155',
};

// Backgrounds that move (they are switched off by "Animations: Off" and by the phone's reduce-motion setting)
export const ANIMATED_BACKGROUNDS = ['aurora', 'orbs', 'waves', 'stars'];

/** The saved appearance, with defaults filled in for anything missing */
export function resolveAppearance(saved) {
  return { ...DEFAULT_APPEARANCE, ...(saved || {}) };
}
