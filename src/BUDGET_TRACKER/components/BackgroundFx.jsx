// The ANIMATED page backgrounds (Customize look -> Background): aurora, orbs, waves, stars.
// It only draws a few empty shapes; budget-tracker.css gives them their colours and movement.
// 'gradient' and 'plain' are normal CSS backgrounds, so for them this draws nothing.
//
// Placed inside the phone frame (App.jsx), BEHIND every screen. It cannot be tapped (pointer-events: none).
import { useData } from '../hooks/useBudgetData';
import { ANIMATED_BACKGROUNDS } from '../constants/appearance';

// A fixed "random" number between 0 and 1 for each index, so the shapes do not jump around on every render
const noise = (n) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

const ORBS = Array.from({ length: 9 }, (_, i) => {
  const size = 46 + Math.round(noise(i + 1) * 110); // px
  return {
    left: `${Math.round(noise(i + 11) * 88)}%`,
    size,
    duration: 16 + Math.round(noise(i + 21) * 22),   // seconds to float up
    delay: -Math.round(noise(i + 31) * 30),          // negative = already on its way when the page opens
    rest: `${8 + Math.round(noise(i + 41) * 70)}%`,  // where it rests when animations are off
  };
});

const STARS = Array.from({ length: 38 }, (_, i) => ({
  left: `${Math.round(noise(i + 51) * 98)}%`,
  top: `${Math.round(noise(i + 61) * 98)}%`,
  size: 2 + Math.round(noise(i + 71) * 2),
  duration: 2.6 + noise(i + 81) * 4,
  delay: -noise(i + 91) * 6,
}));

export default function BackgroundFx() {
  const { appearance } = useData();
  const kind = appearance.background;
  if (!ANIMATED_BACKGROUNDS.includes(kind)) return null;

  return (
    <div className={`bt-bgfx bt-bgfx-${kind}`} aria-hidden="true">
      {kind === 'aurora' && (<><i /><i /><i /></>)}
      {kind === 'waves' && (<><i /><i /><i /></>)}
      {kind === 'orbs' && ORBS.map((orb, index) => (
        <i
          key={index}
          style={{ left: orb.left, width: orb.size, height: orb.size, animationDuration: `${orb.duration}s`, animationDelay: `${orb.delay}s`, '--rest': orb.rest }}
        />
      ))}
      {kind === 'stars' && STARS.map((star, index) => (
        <i
          key={index}
          style={{ left: star.left, top: star.top, width: star.size, height: star.size, animationDuration: `${star.duration}s`, animationDelay: `${star.delay}s` }}
        />
      ))}
    </div>
  );
}
