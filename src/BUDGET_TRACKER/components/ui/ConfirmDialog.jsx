// "Are you sure?" popup. The confirm button is on the LEFT, Cancel on the RIGHT.
//
//   <ConfirmDialog title="Delete note?" text="..." confirmLabel="Delete" onConfirm={fn} onClose={fn} />
import Sheet from './Sheet';

export default function ConfirmDialog({ title, text, confirmLabel = 'Delete', onConfirm, onClose }) {
  function confirm() {
    onConfirm();
    onClose();
  }

  return (
    <Sheet center onClose={onClose}>
      <b className="text-[17px]">{title}</b>
      <p className="mb-5 mt-2 text-[13px] bt-text-mute">{text}</p>
      <div className="grid grid-cols-2 gap-2.5">
        <button className="bt-btn-danger" onClick={confirm}>{confirmLabel}</button>
        <button className="bt-btn-ghost" onClick={onClose}>Cancel</button>
      </div>
    </Sheet>
  );
}
