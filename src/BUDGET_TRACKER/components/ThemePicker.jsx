// The theme chooser (Settings -> Appearance): a grid of small previews, one per theme in constants/themes.js.
// Tapping one saves it in the profile (so it also syncs with Firebase).
import Icon from './ui/Icon';
import { THEMES } from '../constants/themes';

// A tiny picture of the theme: page colour, a card, a line of text and the current accent dot
function Preview({ theme }) {
  const [page, card, text] = theme.swatch;
  // "System" shows a light half and a dark half
  const background = theme.split ? `linear-gradient(115deg, ${page} 50%, ${theme.split[0]} 50%)` : page;
  return (
    <div className="bt-theme-preview" style={{ background }}>
      <i style={{ left: 6, top: 7, width: '64%', height: 15, background: card }} />
      <i style={{ left: 6, top: 28, width: '38%', height: 5, background: text, opacity: 0.65 }} />
      <i style={{ right: 6, bottom: 6, width: 12, height: 12, borderRadius: '50%', background: 'rgb(var(--bt-accent))' }} />
    </div>
  );
}

export default function ThemePicker({ value, onChange }) {
  return (
    <div className="grid grid-cols-4 gap-1.5">
      {THEMES.map((theme) => {
        const selected = (value || 'system') === theme.id;
        return (
          <button key={theme.id} type="button" className="bt-theme-card" aria-pressed={selected} title={theme.sub} onClick={() => onChange(theme.id)}>
            <Preview theme={theme} />
            <span className="flex items-center justify-center gap-0.5">
              {selected && <Icon name="check" size={11} stroke={3} />}
              {theme.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
