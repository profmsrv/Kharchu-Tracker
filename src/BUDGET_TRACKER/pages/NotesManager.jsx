// NOTES (Settings -> Notes): any number of notes. Tap a note to open it, "New note" to write one.
// A note is { id, title, body, createdAt, updatedAt }.
//
// The editor is FULL SCREEN and sized to the visible screen (above the phone keyboard), with the Save / Delete buttons
// at the TOP, so they never hide behind the keyboard.
//
// NOTHING IS LOST: while typing, the text is saved as a DRAFT on this device (services/drafts.js) every moment.
// Leave without tapping Save and the draft is still there next time (it shows in the list). Only the Save / Update
// button writes the real note, which is then also uploaded to Firebase (if connected). Drafts are never uploaded.
import { useEffect, useRef, useState } from 'react';
import Icon from '../components/ui/Icon';
import { useData } from '../hooks/useBudgetData';
import { useVisualViewport } from '../hooks/useVisualViewport';
import { useBackLayer } from '../hooks/useBackButton';
import { clearDraft, getDraft, listDrafts, setDraft } from '../services/drafts';
import { capitalize } from '../utils/format';

export default function NotesManager({ onBack, ask }) {
  const { notes, deleteNote } = useData();

  // The note being edited: null = none open, {} = a brand-new note, or an existing note
  const [editing, setEditing] = useState(null);

  // Most recently changed note first
  const sorted = [...notes].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

  // Unsaved drafts (read again every time this screen renders, e.g. after the editor closes)
  const drafts = listDrafts('note');
  const newDraft = drafts.new && (drafts.new.title || drafts.new.body) ? drafts.new : null;

  // Close the editor, then ask for confirmation (the confirm popup would otherwise sit behind the full-screen editor)
  function askDelete(note) {
    setEditing(null);
    ask({
      title: 'Delete note?',
      text: note.title || 'This note',
      onConfirm: () => { deleteNote(note.id); clearDraft('note', note.id); },
    });
  }

  return (
    <div>
      <button className="mb-2 flex items-center gap-1 text-sm font-semibold" onClick={onBack}>
        <Icon name="chevL" size={16} /> Settings
      </button>

      <div className="mb-2.5 flex items-center justify-between">
        <h2 className="text-[15px] font-bold">Notes</h2>
        <button className="flex items-center gap-1 rounded-xl bt-bg-plum px-3 py-1.5 text-xs font-bold text-white" onClick={() => setEditing({})}>
          <Icon name="plus" size={14} /> New note
        </button>
      </div>

      <div className="flex flex-col gap-2.5">
        {/* an unsaved new note */}
        {newDraft && (
          <button className="bt-glass border-dashed text-left" onClick={() => setEditing({})}>
            <b className="block truncate text-sm">{capitalize(newDraft.title) || 'Untitled'}</b>
            <p className="mt-1 line-clamp-2 whitespace-pre-line text-[12px] bt-text-mute">{newDraft.body}</p>
            <small className="mt-1.5 block text-[10px] font-semibold bt-text-danger">Unsaved draft · tap to continue</small>
          </button>
        )}

        {sorted.map((note) => (
          <button key={note.id} className="bt-glass text-left" onClick={() => setEditing(note)}>
            <b className="block truncate text-sm">{capitalize(note.title) || 'Untitled'}</b>
            {note.body && <p className="mt-1 line-clamp-2 whitespace-pre-line text-[12px] bt-text-mute">{note.body}</p>}
            <small className="mt-1.5 block text-[10px] bt-text-mute">
              {new Date(note.updatedAt || Date.now()).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
              {drafts[note.id] && <span className="ml-2 font-semibold bt-text-danger">Unsaved changes</span>}
            </small>
          </button>
        ))}

        {sorted.length === 0 && !newDraft && (
          <div className="p-4 text-center text-[13px] bt-text-mute">No notes yet. Tap “New note” to write one.</div>
        )}
      </div>

      {editing && <NoteEditor note={editing} onClose={() => setEditing(null)} onDelete={askDelete} />}
    </div>
  );
}

// The full-screen editor for one note
function NoteEditor({ note, onClose, onDelete }) {
  const { addNote, updateNote } = useData();
  const viewport = useVisualViewport(); // the screen minus the on-screen keyboard
  const isNew = !note.id;
  const draftKey = note.id || 'new';

  // If an unsaved draft exists, continue from it instead of from the saved note
  const [draft] = useState(() => getDraft('note', draftKey));
  const [title, setTitle] = useState(draft ? draft.title : note.title || '');
  const [body, setBody] = useState(draft ? draft.body : note.body || '');
  const [restored, setRestored] = useState(Boolean(draft));
  const [saving, setSaving] = useState(false);

  // `latest` always holds the newest text, so the draft can be written from anywhere (even while closing)
  const latest = useRef({ title, body });
  latest.current = { title, body };
  const finished = useRef(false); // true after Save / Delete: the draft must NOT be written again

  // Write (or remove) the draft
  function persistDraft() {
    if (finished.current) return;
    const text = latest.current;
    const unchanged = isNew
      ? text.title.trim() === '' && text.body.trim() === ''
      : text.title === (note.title || '') && text.body === (note.body || '');
    if (unchanged) clearDraft('note', draftKey);
    else setDraft('note', draftKey, text);
  }

  // Autosave while typing (a moment after the last key)
  useEffect(() => {
    const timer = setTimeout(persistDraft, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, body]);

  // Also save immediately when the editor closes or the phone puts the page in the background
  useEffect(() => {
    const onHide = () => persistDraft();
    window.addEventListener('pagehide', onHide);
    document.addEventListener('visibilitychange', onHide);
    return () => {
      window.removeEventListener('pagehide', onHide);
      document.removeEventListener('visibilitychange', onHide);
      persistDraft();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const canSave = (title.trim() !== '' || body.trim() !== '') && !saving;

  // Save / Update: write the real note (it then also uploads to Firebase), remove the draft, close
  async function save() {
    setSaving(true);
    const data = { title: title.trim(), body: body.trim() };
    try {
      if (isNew) await addNote(data);
      else await updateNote(note.id, data);
      finished.current = true;
      clearDraft('note', draftKey);
      onClose();
    } catch (error) {
      console.error(error);
      setSaving(false);
    }
  }

  // Back arrow: write the draft FIRST, then close (so the list can already show "Unsaved changes")
  function close() {
    persistDraft();
    onClose();
  }

  // The phone's Back button does the same as the arrow at the top
  useBackLayer(true, close);

  // "Discard changes" on the restored-draft banner: go back to the saved text
  function discard() {
    finished.current = false;
    clearDraft('note', draftKey);
    setTitle(note.title || '');
    setBody(note.body || '');
    setRestored(false);
  }

  return (
    <div
      className="fixed left-0 right-0 z-40 flex justify-center bt-bg-bg1"
      style={{ top: viewport.top, height: viewport.height }} // = the part of the screen above the keyboard
    >
      <div className="flex h-full w-full max-w-[640px] flex-col px-4 pt-[calc(10px+env(safe-area-inset-top))]">
        {/* top bar: Back · Delete · Save (always visible, never behind the keyboard) */}
        <div className="mb-2 flex shrink-0 items-center gap-2">
          <button className="flex items-center gap-1 text-sm font-semibold" onClick={close}>
            <Icon name="chevL" size={18} /> Notes
          </button>
          <div className="flex-1" />
          {!isNew && (
            <button aria-label="Delete note" className="p-2 bt-text-danger" onClick={() => onDelete(note)}>
              <Icon name="trash" size={20} />
            </button>
          )}
          <button className="bt-btn-primary !px-5 !py-2 text-sm" disabled={!canSave} onClick={save}>
            {isNew ? 'Save' : 'Update'}
          </button>
        </div>

        {restored && (
          <div className="mb-2 flex shrink-0 items-center justify-between gap-2 rounded-xl bt-bg-blush px-3 py-2 text-xs">
            <span>{isNew ? 'Continuing your unsaved draft.' : 'Your unsaved changes were restored.'}</span>
            <button className="font-bold underline" onClick={discard}>{isNew ? 'Clear' : 'Discard changes'}</button>
          </div>
        )}

        <input
          className="mb-2 w-full shrink-0 bg-transparent text-xl font-bold outline-none"
          placeholder="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          autoFocus={isNew}
        />

        {/* the text fills ALL the remaining space and scrolls inside itself */}
        <textarea
          className="min-h-0 w-full flex-1 resize-none bg-transparent pb-8 text-[15px] leading-relaxed outline-none"
          placeholder="Write your note…"
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />

        <div className="mt-2 shrink-0 border-t bt-border-line pt-3 pb-[calc(12px+env(safe-area-inset-bottom))] text-[11px] bt-text-mute">
          {body.length} characters · changes are kept on this device while you type; tap {isNew ? 'Save' : 'Update'} to finish
        </div>
      </div>
    </div>
  );
}
