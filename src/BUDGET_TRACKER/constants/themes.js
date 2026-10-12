// The app themes (Settings -> Appearance). Saved as profile.theme.
//
//   dark: null   follow the phone (System)
//   dark: false  a light theme        dark: true  a dark theme
// The real colours live in budget-tracker.css  (.bt-root[data-theme='midnight'] ...).
// `swatch` = [page, card, text] only for the little preview in the theme picker.
//
// To add a theme: add it here, then add a  .bt-root[data-theme='<id>']  block in budget-tracker.css.
export const THEMES = [
  { id: 'system', label: 'System', sub: 'Follows your phone', dark: null, swatch: ['#efe6fb', '#ffffff', '#2a1233'], split: ['#1a0d22', '#2b1836', '#f5ecfa'] },
  { id: 'light', label: 'Light', sub: 'Classic and bright', dark: false, swatch: ['#efe6fb', '#ffffff', '#2a1233'] },
  { id: 'dark', label: 'Dark', sub: 'Classic dark', dark: true, swatch: ['#1a0d22', '#2b1836', '#f5ecfa'] },
  { id: 'midnight', label: 'Midnight', sub: 'Deep ink blue, easy at night', dark: true, swatch: ['#080a14', '#121628', '#e2e8f8'] },
  { id: 'aurora', label: 'Aurora', sub: 'Teal glow on dark', dark: true, swatch: ['#07161c', '#0e242c', '#daf4f0'] },
  { id: 'dusk', label: 'Dusk', sub: 'Soft twilight, low contrast', dark: true, swatch: ['#201c2c', '#2e283e', '#eee8f4'] },
  { id: 'sage', label: 'Sage', sub: 'Calm green, gentle on the eyes', dark: false, swatch: ['#e2ebe2', '#f8fbf6', '#203028'] },
  { id: 'mist', label: 'Mist', sub: 'Cool grey-blue, low glare', dark: false, swatch: ['#e2e8f2', '#f6f8fc', '#1c2438'] },
];

export const THEME_IDS = THEMES.map((theme) => theme.id);
