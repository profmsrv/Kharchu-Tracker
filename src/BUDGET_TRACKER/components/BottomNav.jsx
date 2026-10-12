// The bottom bar: Home, Budget, [ add button ], Insights, Settings.
//
// The user can choose its LAYOUT (Settings -> Customize look -> Bottom bar):
//   'notch'     the add button floats half above the bar; the bar has a round notch cut out around it
//   'flat'      a normal full-width bar with the add button in the middle
//   'floating'  a rounded pill that floats above the bottom edge
// Its COLOURS (dark / accent / glass / light) are pure CSS: see the .bt-nav-* classes in budget-tracker.css.
import Icon from './ui/Icon';
import { useData } from '../hooks/useBudgetData';
import { getCurrencySymbol } from '../utils/format';

// [tab id, icon name, label]
const LEFT_TABS = [['home', 'home', 'Home'], ['budget', 'pie', 'Budget']];
const RIGHT_TABS = [['insights', 'trendup', 'Insights'], ['settings', 'sliders', 'Settings']];

// A circle cut out of the top-centre of the bar (transparent inside, solid outside)
const NOTCH_MASK = 'radial-gradient(circle 38px at 50% 0, #0000 97%, #000 100%)';

// The symbol inside the add button: the rupee icon, or the chosen currency symbol
function AddSymbol() {
  const symbol = getCurrencySymbol();
  if (symbol === '₹') return <Icon name="rupee" size={24} stroke={2.3} />;
  return <span className="text-[22px] font-bold leading-none">{symbol}</span>;
}

export default function BottomNav({ tab, onTab, onAdd }) {
  const { appearance } = useData();
  const type = appearance.navType;

  // Draws one tab button
  function renderTab([id, icon, label]) {
    const active = tab === id;
    return (
      <button
        key={id}
        onClick={() => onTab(id)}
        className={`bt-nav-tab flex w-[58px] flex-col items-center gap-px text-[10px] ${active ? 'bt-nav-active' : ''}`}
      >
        <Icon name={icon} size={20} stroke={active ? 2.2 : 1.8} />
        {label}
      </button>
    );
  }

  // The add button that sits INSIDE the bar (flat and floating layouts)
  const inlineAddButton = (
    <button
      onClick={onAdd}
      aria-label="Add transaction"
      className="grid h-11 w-11 place-items-center rounded-full bt-fab transition active:scale-95"
    >
      <AddSymbol />
    </button>
  );

  // ----- layout 1: notch (the add button floats above the bar) -----
  if (type === 'notch') {
    return (
      <div className="absolute inset-x-0 bottom-0 z-10">
        <button
          onClick={onAdd}
          aria-label="Add transaction"
          className="absolute left-1/2 top-[-27px] z-10 grid h-[54px] w-[54px] -translate-x-1/2 place-items-center rounded-full bt-fab transition active:scale-95"
        >
          <AddSymbol />
        </button>
        {/* Only a SMALL safe-area gap (max 6px) is added below the icons, so there is no big empty strip under them */}
        <nav
          className="bt-nav-bar flex items-center justify-around rounded-b-[28px] px-1.5"
          style={{
            height: 'calc(54px + min(env(safe-area-inset-bottom, 0px), 6px))',
            paddingBottom: 'min(env(safe-area-inset-bottom, 0px), 6px)',
            WebkitMask: NOTCH_MASK,
            mask: NOTCH_MASK,
          }}
        >
          {LEFT_TABS.map(renderTab)}
          <div className="w-[76px]" /> {/* empty space under the add button */}
          {RIGHT_TABS.map(renderTab)}
        </nav>
      </div>
    );
  }

  // ----- layout 2: flat (normal full-width bar) -----
  if (type === 'flat') {
    return (
      <div className="absolute inset-x-0 bottom-0 z-10">
        <nav className="bt-nav-bar flex h-[calc(60px+env(safe-area-inset-bottom))] items-center justify-around border-t bt-border-line px-1.5 pb-[env(safe-area-inset-bottom)]">
          {LEFT_TABS.map(renderTab)}
          {inlineAddButton}
          {RIGHT_TABS.map(renderTab)}
        </nav>
      </div>
    );
  }

  // ----- layout 3: floating pill -----
  return (
    <div className="absolute inset-x-0 bottom-0 z-10 px-3 pb-[calc(10px+env(safe-area-inset-bottom))]">
      <nav className="bt-nav-bar bt-nav-shadow flex h-[58px] items-center justify-around rounded-full px-2">
        {LEFT_TABS.map(renderTab)}
        {inlineAddButton}
        {RIGHT_TABS.map(renderTab)}
      </nav>
    </div>
  );
}
