// One transaction in a list. It reacts to three gestures:
//
//   tap          -> onOpen()    show the details popup
//   swipe LEFT   -> onEdit()    open the edit sheet
//   swipe RIGHT  -> onDelete()  ask "Delete transaction?"
//
// It uses "pointer events", so the same code works with a finger and with a mouse.
import { useRef, useState } from 'react';
import Icon from './ui/Icon';
import { useData } from '../hooks/useBudgetData';
import { capitalize, fmt } from '../utils/format';
import { parseYmd } from '../utils/dates';

const SWIPE_DISTANCE = 70; // how far (px) the row must be dragged before an action happens
const MAX_DRAG = 120;      // the row cannot be dragged further than this

export default function TransactionRow({ tx, onOpen, onEdit, onDelete, tourId }) {
  const { getCategory } = useData();
  const category = getCategory(tx.type, tx.category);
  const isExpense = tx.type === 'expense';
  const isPlan = Boolean(category.goalId);   // an older entry saved directly in a savings plan's category
  const isPlanMove = Boolean(tx.goalId);     // money moved into / out of a savings plan (bank icon)

  // offset = how many px the row is currently moved sideways (negative = left, positive = right)
  const [offset, setOffset] = useState(0);
  // remembers where the finger/mouse went down. null = nothing is pressed.
  const drag = useRef(null);

  function onPointerDown(event) {
    drag.current = { startX: event.clientX, startY: event.clientY, isSwipe: false };
  }

  function onPointerMove(event) {
    const current = drag.current;
    if (!current) return;

    const moveX = event.clientX - current.startX;
    const moveY = event.clientY - current.startY;

    // Count it as a swipe only when the move is clearly sideways. Otherwise the user is scrolling the page.
    const clearlySideways = Math.abs(moveX) > 8 && Math.abs(moveX) > Math.abs(moveY) * 1.5;
    if (!current.isSwipe && clearlySideways) {
      current.isSwipe = true;
      try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* not supported */ }
    }

    if (current.isSwipe) {
      setOffset(Math.max(-MAX_DRAG, Math.min(MAX_DRAG, moveX)));
    }
  }

  function onPointerUp() {
    const current = drag.current;
    drag.current = null;

    if (current && current.isSwipe) {
      if (offset < -SWIPE_DISTANCE) onEdit();
      else if (offset > SWIPE_DISTANCE) onDelete();
    } else if (current) {
      onOpen(); // finger went down and up without moving = a tap
    }
    setOffset(0); // the row slides back
  }

  function onPointerCancel() {
    drag.current = null; // the browser took over (e.g. page scroll)
    setOffset(0);
  }

  // Colour of the layer revealed behind the row: red for delete (right swipe), purple for edit (left swipe)
  const actionColour = offset > 0 ? 'bt-bg-danger' : 'bt-bg-plum2';

  return (
    <div data-tour={tourId} className="relative my-0.5 overflow-hidden rounded-2xl">
      {/* Layer BEHIND the row: shows "Delete" or "Edit" while swiping */}
      <div
        className={`absolute inset-0 flex items-center justify-between rounded-2xl px-4 text-[13px] font-bold text-white ${actionColour}`}
        style={{ opacity: offset === 0 ? 0 : 1 }}
      >
        <span className="flex items-center gap-1.5">
          {offset > 0 && (<><Icon name="trash" size={16} /> Delete</>)}
        </span>
        <span className="flex items-center gap-1.5">
          {offset < 0 && (<>Edit <Icon name="edit" size={16} /></>)}
        </span>
      </div>

      {/* The row itself (it moves sideways with the finger) */}
      <div
        className="relative flex cursor-grab touch-pan-y select-none items-center gap-2.5 rounded-2xl px-2 bt-row"
        style={{
          transform: `translateX(${offset}px)`,
          transition: drag.current ? 'none' : 'transform .2s',
          background: offset === 0 ? 'transparent' : 'rgb(var(--bt-surface))',
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
      >
        {/* category icon on a soft coloured square ("28" = transparency added to the hex colour) */}
        <div
          className="grid h-[38px] w-[38px] shrink-0 place-items-center bt-tile"
          style={{ background: category.color + '28', border: isPlan ? `1.5px dashed ${category.color}` : undefined }} // dashed outline = savings plan
        >
          <Icon name={category.icon} size={19} color={category.color} />
        </div>

        <div className="min-w-0 flex-1">
          <b className="block truncate text-[13px]">{capitalize(tx.title)}</b>
          <small className="text-[11px] bt-text-mute">
            {tx.category}{isPlan || isPlanMove ? ' · savings plan' : ''} · {parseYmd(tx.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
          </small>
        </div>

        <span className={`text-[13px] font-bold ${isExpense ? 'bt-text-danger' : 'bt-text-success'}`}>
          {isExpense ? '-' : '+'} {fmt(tx.amount)}
        </span>
      </div>
    </div>
  );
}
