// The base of every popup.
//   <Sheet onClose={...}>...</Sheet>          slides up from the bottom
//   <Sheet center onClose={...}>...</Sheet>   small dialog in the middle of the screen
// Tapping the dark background calls onClose.
//
// The popup is sized to the VISIBLE part of the screen (see hooks/useVisualViewport.js),
// so on a phone it sits ABOVE the on-screen keyboard and its buttons never hide behind it.
// The phone's Back button closes it (hooks/useBackButton.js).
import { useVisualViewport } from '../../hooks/useVisualViewport';
import { useBackLayer } from '../../hooks/useBackButton';

export default function Sheet({ onClose, center = false, children }) {
  const viewport = useVisualViewport();
  useBackLayer(true, onClose); // the phone's Back button closes the popup instead of leaving the app
  const backdrop = center ? 'items-center p-6' : 'items-end';

  const panel = center
    ? 'w-full max-w-[320px] bt-anim-pop rounded-3xl bt-bg-surface p-6 text-center'
    : 'flex max-h-full w-full max-w-[430px] bt-anim-slide flex-col gap-2.5 overflow-y-auto rounded-t-[26px] bt-bg-bg1 px-4 pb-[calc(24px+env(safe-area-inset-bottom))] pt-5';

  return (
    <div
      className={`fixed inset-0 z-30 flex justify-center bg-black/40 ${backdrop}`}
      style={{ top: viewport.top, height: viewport.height, bottom: 'auto' }} // = the part of the screen above the keyboard
      onClick={onClose}
    >
      {/* stopPropagation: a tap INSIDE the popup must not close it */}
      <div className={panel} onClick={(e) => e.stopPropagation()}>
        {!center && <div className="mx-auto -mt-2 mb-1 h-1 w-10 shrink-0 rounded bt-bg-line" />}
        {children}
      </div>
    </div>
  );
}
