// CUSTOMIZE LOOK (Settings -> Customize look).
// Every option changes the app instantly. Choices are saved in the profile (so they sync with Firebase).
//
// The THEME (light / dark / midnight ...) is the first card here, see components/ThemePicker.jsx.
// To add an option:  1) add its default in constants/appearance.js
//                    2) add a row to GROUPS below
//                    3) add CSS for its values in budget-tracker.css (see "LOOK & FEEL OPTIONS")
//                    4) BUDGET_TRACKER.jsx turns it into a data-attribute (see ATTRIBUTES there)
import Icon from '../components/ui/Icon';
import Segmented from '../components/ui/Segmented';
import ChipGrid from '../components/ui/ChipGrid';
import ThemePicker from '../components/ThemePicker';
import { useData } from '../hooks/useBudgetData';
import { DEFAULT_APPEARANCE, PALETTE_SWATCHES } from '../constants/appearance';

// The options, in the order they appear. choices = [value, label]
const GROUPS = [
  { title: 'Category icons', key: 'iconShape', hint: 'Shape of the icon tiles', choices: [['round', 'Round'], ['soft', 'Soft'], ['square', 'Square']] },
  { title: 'Category border', key: 'catBorder', hint: 'Box around icons in Add transaction', choices: [['off', 'Off'], ['on', 'On']] },
  { title: 'Bottom bar layout', key: 'navType', hint: 'Where the add button sits', choices: [['notch', 'Notch'], ['flat', 'Flat'], ['floating', 'Floating']] },
  { title: 'Bottom bar colour', key: 'navStyle', choices: [['dark', 'Dark'], ['accent', 'Accent'], ['glass', 'Glass'], ['light', 'Light']] },
  { title: 'Add button', key: 'fab', hint: 'The button in the middle of the bar', choices: [['gold', 'Gold'], ['accent', 'Glow'], ['glass', 'Glass']] },
  { title: 'Accent colour', key: 'palette', swatches: true },
  { title: 'Corners', key: 'radius', hint: 'Cards, buttons and fields', choices: [['sharp', 'Sharp'], ['normal', 'Normal'], ['round', 'Round']] },
  { title: 'Background', key: 'background', hint: 'Four of them move', chips: true, choices: [['gradient', 'Gradient'], ['plain', 'Plain'], ['aurora', 'Aurora'], ['orbs', 'Orbs'], ['waves', 'Waves'], ['stars', 'Stars']] },
  { title: 'Balance card', key: 'balance', choices: [['gradient', 'Gradient'], ['solid', 'Solid'], ['outline', 'Outline']] },
  { title: 'List spacing', key: 'density', choices: [['compact', 'Compact'], ['comfortable', 'Comfortable'], ['spacious', 'Spacious']] },
  { title: 'Animations', key: 'motion', choices: [['on', 'On'], ['off', 'Off']] },
  { title: 'Currency symbol', key: 'currency', choices: [['₹', '₹ Rupee'], ['$', '$ Dollar'], ['€', '€ Euro'], ['£', '£ Pound']] },
];

export default function AppearanceSettings({ onBack }) {
  const { appearance, profile, saveProfile } = useData();

  // Save ONE changed option. We always save the complete object so nothing gets lost.
  function choose(key, value) {
    saveProfile({ appearance: { ...appearance, [key]: value } });
  }

  function resetAll() {
    saveProfile({ appearance: { ...DEFAULT_APPEARANCE } });
  }

  return (
    <div>
      <button className="mb-2 flex items-center gap-1 text-sm font-semibold" onClick={onBack}>
        <Icon name="chevL" size={16} /> Settings
      </button>
      <h2 className="mb-1 text-[15px] font-bold">Customize look</h2>
      <p className="bt-hint mb-3">Changes apply instantly.</p>

      <div className="flex flex-col gap-2.5">
        {/* theme: System, Light, Dark and the extra themes (constants/themes.js) */}
        <div data-tour="look-theme" className="bt-glass">
          <div className="mb-2 flex items-baseline justify-between">
            <b className="text-[13px]">Theme</b>
            <small className="text-[11px] bt-text-mute">Light, dark and more</small>
          </div>
          <ThemePicker value={profile.theme || 'system'} onChange={(theme) => saveProfile({ theme })} />
        </div>

        {GROUPS.map((group) => (
          <div key={group.key} data-tour={`look-${group.key}`} className="bt-glass">
            <div className="mb-2 flex items-baseline justify-between">
              <b className="text-[13px]">{group.title}</b>
              {group.hint && <small className="text-[11px] bt-text-mute">{group.hint}</small>}
            </div>

            {/* colour dots for the accent palette, pill buttons for everything else */}
            {group.swatches ? (
              <div className="flex flex-wrap gap-3">
                {Object.entries(PALETTE_SWATCHES).map(([name, colour]) => (
                  <button
                    key={name}
                    aria-label={name}
                    onClick={() => choose('palette', name)}
                    className={`grid h-9 w-9 place-items-center rounded-full border-[3px] ${appearance.palette === name ? 'bt-border-ink' : 'border-transparent'}`}
                    style={{ background: colour }}
                  >
                    {appearance.palette === name && <Icon name="check" size={16} stroke={3} color="#fff" />}
                  </button>
                ))}
              </div>
            ) : group.chips ? (
              <ChipGrid value={appearance[group.key]} onChange={(value) => choose(group.key, value)} options={group.choices.map(([value, label]) => ({ key: value, label }))} />
            ) : (
              <Segmented
                value={appearance[group.key]}
                onChange={(value) => choose(group.key, value)}
                options={group.choices.map(([value, label]) => ({ key: value, label }))}
              />
            )}
          </div>
        ))}
      </div>

      <button className="bt-btn-ghost mt-3 w-full" onClick={resetAll}>Reset to default look</button>
    </div>
  );
}
