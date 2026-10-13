// The APP TOUR, in the style of modern Android apps ("coach marks"):
//   language question -> a few intro cards (why the app helps) -> a guided walk through the REAL app -> "you are ready".
// During the walk the tour opens each tab (and the Add popup, and the Customize look screen), dims everything except the
// button or area it talks about (a spotlight with a pulsing ring), and shows a small card with the explanation.
// The app stays visible behind the dimmed layer; nothing is covered by a separate full screen.
//
// If the person has (almost) no data, sample data is shown while the tour is open (hooks/useBudgetData.jsx, demo mode):
// it is never saved, and the real data is not touched.
//
//   Where a step points:  data-tour="..." attributes in the screens (see TOUR_STEPS in constants/tour.js).
//   nav.apply({ tab, view, popup })  is given by App.jsx and opens the screen a step needs.
// The phone's Back button goes back one step (the layer is "pinned" so it is always the top one).
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import Icon from './ui/Icon';
import { LANGUAGES, TOUR, TOUR_STEPS } from '../constants/tour';
import { useBackLayer } from '../hooks/useBackButton';
import { useData } from '../hooks/useBudgetData';

const LANG_KEY = 'bt-tour-lang';
const PAD = 6;      // space between the spotlight and the button it points at
const GAP = 14;     // space between the spotlight and the card
const EDGE = 14;    // space between the card and the screen edge

function savedLanguage() {
  try {
    const id = localStorage.getItem(LANG_KEY);
    return TOUR[id] ? id : null;
  } catch {
    return null;
  }
}

// The nearest ancestor that really scrolls (so a target can be brought to the middle of its screen)
function scrollParent(element) {
  let parent = element.parentElement;
  while (parent && parent !== document.body) {
    const style = getComputedStyle(parent);
    if (/(auto|scroll)/.test(style.overflowY) && parent.scrollHeight > parent.clientHeight + 1) return parent;
    parent = parent.parentElement;
  }
  return null;
}

// One box around all the elements, in the coordinates of `origin` (the tour's own box)
function boxAround(elements, origin) {
  let left = Infinity; let top = Infinity; let right = -Infinity; let bottom = -Infinity;
  for (const element of elements) {
    const r = element.getBoundingClientRect();
    left = Math.min(left, r.left); top = Math.min(top, r.top); right = Math.max(right, r.right); bottom = Math.max(bottom, r.bottom);
  }
  return { x: Math.round(left - origin.left), y: Math.round(top - origin.top), w: Math.round(right - left), h: Math.round(bottom - top) };
}

const sameBox = (a, b) => a && b && Math.abs(a.x - b.x) < 2 && Math.abs(a.y - b.y) < 2 && Math.abs(a.w - b.w) < 2 && Math.abs(a.h - b.h) < 2;

export default function Tour({ onClose, nav }) {
  const { demo, setDemoMode } = useData();
  const [lang, setLang] = useState(savedLanguage);
  const [phase, setPhase] = useState('language'); // 'language' | 'intro' | 'steps' | 'outro'
  const [index, setIndex] = useState(0);
  const text = TOUR[lang || 'en'];
  const step = phase === 'steps' ? TOUR_STEPS[index] : null;

  const rootRef = useRef(null);
  const cardRef = useRef(null);
  const direction = useRef(1);                 // which way the person is going (to skip an optional step the right way)
  const [box, setBox] = useState(null);        // the spotlight: { x, y, w, h, radius }
  const [size, setSize] = useState({ w: 390, h: 800 });
  const [cardHeight, setCardHeight] = useState(200);

  // Sample data while the tour is open (only if the person has almost no data of their own)
  useEffect(() => {
    setDemoMode(true);
    return () => setDemoMode(false);
  }, [setDemoMode]);

  // Open the screen the current step needs. The language, intro and outro cards sit on top of Home.
  useEffect(() => {
    nav.apply(step ? { tab: step.tab, view: step.view, popup: step.popup } : { tab: 'home', view: 'main', popup: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, index]);

  // ----- find the target of the step, bring it to the middle of the screen and follow it -----
  useEffect(() => {
    if (!step) { setBox(null); return undefined; }
    const ids = [].concat(step.target);
    let cancelled = false;
    let tries = 0;
    let scrolled = false;
    let lastRaw = null;
    let stable = 0;

    const tick = () => {
      if (cancelled || !rootRef.current) return;
      const origin = rootRef.current.getBoundingClientRect();
      setSize((old) => (old.w === Math.round(origin.width) && old.h === Math.round(origin.height) ? old : { w: Math.round(origin.width), h: Math.round(origin.height) }));

      const elements = ids.map((id) => document.querySelector(`[data-tour="${id}"]`)).filter(Boolean);
      if (elements.length === 0) {
        tries += 1;
        if (tries > 22) { // about 1.5 seconds: it is not there
          if (step.optional) go(direction.current);
          else setBox(null);
        }
        return;
      }

      // a very tall target is only lit up in its upper part, so there is always room for the card
      const maxHeight = Math.round(origin.height * 0.46);

      // once: scroll so the target is in the middle of its scrolling area (a tall one: with its top near the top)
      if (!scrolled) {
        scrolled = true;
        const parent = scrollParent(elements[0]);
        if (parent) {
          const inParent = boxAround(elements, parent.getBoundingClientRect());
          parent.scrollTop += inParent.h > maxHeight ? inParent.y - 84 : inParent.y + inParent.h / 2 - parent.clientHeight / 2;
        }
        return;
      }

      const raw = boxAround(elements, origin);
      raw.h = Math.min(raw.h, maxHeight);
      // accept a position only when it stopped moving (a popup that is still sliding in is skipped)
      stable = sameBox(raw, lastRaw) ? stable + 1 : 0;
      lastRaw = raw;
      if (stable >= 2) {
        const radius = parseFloat(getComputedStyle(elements[0]).borderTopLeftRadius) || 14;
        setBox((old) => (sameBox(old, raw) ? old : { ...raw, radius: Math.min(radius, 28) + PAD }));
      }
    };

    const timer = setInterval(tick, 70);
    tick();

    // the "swipe" hint: the first transaction row moves a little to the left and right
    const wiggler = step.wiggle ? document.querySelector(`[data-tour="${ids[0]}"]`) : null;
    if (wiggler) wiggler.classList.add('bt-tour-wiggle');

    return () => {
      cancelled = true;
      clearInterval(timer);
      document.querySelectorAll('.bt-tour-wiggle').forEach((element) => element.classList.remove('bt-tour-wiggle'));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, index]);

  // the height of the card (to place it above or below the spotlight)
  useLayoutEffect(() => {
    if (cardRef.current) {
      const height = Math.round(cardRef.current.getBoundingClientRect().height);
      setCardHeight((old) => (Math.abs(old - height) > 1 ? height : old));
    }
  });

  // ----- moving through the tour -----
  function go(delta) {
    direction.current = delta;
    if (phase === 'language') return;
    if (phase === 'intro') {
      if (delta > 0 && index < text.intro.length - 1) setIndex(index + 1);
      else if (delta > 0) { setPhase('steps'); setIndex(0); }
      else if (index > 0) setIndex(index - 1);
      else setPhase('language');
    } else if (phase === 'steps') {
      const next = index + delta;
      if (next < 0) { setPhase('intro'); setIndex(text.intro.length - 1); }
      else if (next >= TOUR_STEPS.length) { setPhase('outro'); setIndex(0); }
      else setIndex(next);
    } else if (phase === 'outro' && delta < 0) {
      setPhase('steps'); setIndex(TOUR_STEPS.length - 1);
    }
  }

  function pickLanguage(id) {
    setLang(id);
    try { localStorage.setItem(LANG_KEY, id); } catch { /* ignore */ }
    direction.current = 1;
    setPhase('intro');
    setIndex(0);
  }

  // The phone's Back button = one step back (the layer renews itself after every step, and stays on top)
  useBackLayer(true, () => (phase === 'language' ? onClose() : go(-1)), `${phase}:${index}`, true);

  // ----- where things go -----
  const spot = step && box
    ? { left: box.x - PAD, top: box.y - PAD, width: box.w + PAD * 2, height: box.h + PAD * 2, borderRadius: box.radius }
    : { left: size.w / 2, top: size.h / 2, width: 0, height: 0, borderRadius: 0 };

  // the card: below the spotlight, else above it, else docked at the bottom/top of the screen
  let cardStyle = { left: EDGE, right: EDGE, bottom: `calc(${EDGE}px + env(safe-area-inset-bottom))` };
  let arrow = null;
  if (step && box) {
    const below = size.h - (box.y + box.h + PAD);
    const above = box.y - PAD;
    const centreX = box.x + box.w / 2;
    if (below >= cardHeight + GAP + EDGE) {
      cardStyle = { left: EDGE, right: EDGE, top: box.y + box.h + PAD + GAP };
      arrow = { side: 'top', x: centreX };
    } else if (above >= cardHeight + GAP + EDGE) {
      cardStyle = { left: EDGE, right: EDGE, top: box.y - PAD - GAP - cardHeight };
      arrow = { side: 'bottom', x: centreX };
    } else if (box.y + box.h / 2 < size.h / 2) {
      cardStyle = { left: EDGE, right: EDGE, bottom: `calc(${EDGE}px + env(safe-area-inset-bottom))` }; // target high up: card at the bottom
    } else {
      cardStyle = { left: EDGE, right: EDGE, top: `calc(${EDGE + 34}px + env(safe-area-inset-top))` };  // target low down: card at the top
    }
  }
  const arrowLeft = arrow ? Math.max(26, Math.min(size.w - EDGE * 2 - 26, arrow.x - EDGE)) : 0;

  const total = TOUR_STEPS.length;
  const intro = phase === 'intro' ? text.intro[index] : null;

  return (
    <div ref={rootRef} className="bt-tour absolute inset-0 z-[60] select-none" onClick={(event) => event.stopPropagation()}>
      {/* the dimmed layer with a hole (the spotlight); the box-shadow does the dimming */}
      <div className="bt-tour-spot" style={spot}>{step && box && <i className="bt-tour-ring" />}</div>

      {/* 1. language */}
      {phase === 'language' && (
        <div className="bt-tour-card bt-tour-pop" style={cardStyle}>
          <div className="mb-3 flex items-center gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bt-grad-plum text-white"><Icon name="rupee" size={22} stroke={2.3} /></span>
            <div>
              <b className="block text-[16px]">Kharchu</b>
              <small className="block text-[12px] leading-snug bt-text-mute">Choose your language · మీ భాషను ఎంచుకోండి · अपनी भाषा चुनें</small>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            {LANGUAGES.map((language) => (
              <button key={language.id} type="button" className="bt-chip !rounded-2xl !py-3 !text-left" aria-pressed={lang === language.id} onClick={() => pickLanguage(language.id)}>
                <span className="block text-[17px] font-bold bt-text-ink">{language.native}</span>
                <span className="block text-[11px] font-medium bt-text-mute">{language.hint}</span>
              </button>
            ))}
          </div>
          <button className="mx-auto mt-3 block px-2 py-1 text-[13px] font-semibold bt-text-mute" onClick={onClose}>Skip · స్కిప్ · छोड़ें</button>
        </div>
      )}

      {/* 2. intro cards */}
      {intro && (
        <div key={`intro${index}`} className="bt-tour-card bt-tour-pop" style={cardStyle}>
          <div className="mb-2 flex items-center justify-between">
            <button className="rounded-lg py-1 text-[12px] font-semibold bt-text-mute" onClick={() => setPhase('language')}>
              {LANGUAGES.find((item) => item.id === lang).native} · {text.language}
            </button>
            <button className="py-1 text-[13px] font-semibold bt-text-mute" onClick={onClose}>{text.skip}</button>
          </div>
          <div className="max-h-[52vh] overflow-y-auto">
            <span className="mb-2.5 grid h-12 w-12 place-items-center rounded-2xl bt-grad-plum text-white"><Icon name={intro.icon} size={24} stroke={2.1} /></span>
            <b className="block text-[18px] leading-snug">{intro.title}</b>
            {intro.body && <p className="mt-1.5 text-[14px] leading-relaxed bt-text-mute">{intro.body}</p>}
            {intro.points.length > 0 && (
              <ul className="mt-2.5 flex flex-col gap-2">
                {intro.points.map((point) => (
                  <li key={point} className="flex gap-2 text-[13px] leading-relaxed">
                    <span className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full bt-bg-plum text-white"><Icon name="check" size={10} stroke={3.4} /></span>
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="mt-3 flex items-center justify-between gap-3">
            <div className="flex gap-1.5" aria-hidden="true">
              {text.intro.map((_, i) => <i key={i} className={`h-1.5 rounded-full transition-all ${i === index ? 'w-5 bt-bg-plum' : 'w-1.5 bt-bg-line'}`} />)}
            </div>
            <div className="flex gap-2">
              <button className="bt-btn-ghost !px-4 !py-2.5 text-[13px]" onClick={() => go(-1)}>{text.back}</button>
              <button className="bt-btn-primary !rounded-xl !px-5 !py-2.5 text-[13px]" onClick={() => go(1)}>{index === text.intro.length - 1 ? text.letsGo : text.next}</button>
            </div>
          </div>
        </div>
      )}

      {/* 3. a step of the walk */}
      {step && (
        <div key={`step${index}`} ref={cardRef} className="bt-tour-card bt-tour-pop" style={cardStyle}>
          {arrow && <i className={`bt-tour-arrow bt-tour-arrow-${arrow.side}`} style={{ left: arrowLeft }} />}
          <div className="mb-1.5 flex items-center justify-between">
            <small className="text-[11px] font-bold tracking-wide bt-text-accent">{index + 1} / {total}</small>
            {demo && <span className="bt-tour-badge">{text.demo}</span>}
            <button className="py-0.5 text-[12px] font-semibold bt-text-mute" onClick={onClose}>{text.skip}</button>
          </div>
          <b className="block text-[16px] leading-snug">{text.steps[step.id][0]}</b>
          <p className="mt-1 text-[13px] leading-relaxed bt-text-mute">{text.steps[step.id][1]}</p>
          <div className="mt-2.5 h-1 overflow-hidden rounded-full bt-bg-line"><i className="block h-full rounded-full bt-bg-plum transition-all" style={{ width: `${((index + 1) / total) * 100}%` }} /></div>
          <div className="mt-3 flex justify-end gap-2">
            <button className="bt-btn-ghost !px-4 !py-2.5 text-[13px]" onClick={() => go(-1)}>{text.back}</button>
            <button className="bt-btn-primary !rounded-xl !px-6 !py-2.5 text-[13px]" onClick={() => go(1)}>{text.next}</button>
          </div>
        </div>
      )}

      {/* 4. outro */}
      {phase === 'outro' && (
        <div className="bt-tour-card bt-tour-pop" style={cardStyle}>
          <span className="mb-2.5 grid h-12 w-12 place-items-center rounded-2xl bt-grad-plum text-white"><Icon name={text.outro.icon} size={24} stroke={2.6} /></span>
          <b className="block text-[18px] leading-snug">{text.outro.title}</b>
          <p className="mt-1.5 text-[14px] leading-relaxed bt-text-mute">{text.outro.body}</p>
          <div className="mt-3 grid grid-cols-[1fr_2fr] gap-2">
            <button className="bt-btn-ghost !py-2.5 text-[13px]" onClick={() => go(-1)}>{text.back}</button>
            <button className="bt-btn-primary !rounded-xl !py-2.5 text-[13px]" onClick={onClose}>{text.start}</button>
          </div>
        </div>
      )}
    </div>
  );
}
