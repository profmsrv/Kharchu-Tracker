// DRAFTS: text the user typed but did not save yet. They live only in this browser (localStorage "bt-drafts").
// They exist so that nothing typed is ever lost if a popup is closed by accident, the page is left, or the phone locks.
// Drafts are NOT uploaded to Firebase. Only when the user taps Save does the data go to the real store
// (and from there to Firebase).
//
//   kind 'tx'    one unfinished "Add transaction" form        (key 'new')
//   kind 'note'  an unsaved note or unsaved changes of a note (key = the note id, or 'new')
const STORAGE_KEY = 'bt-drafts';

function readAll() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') || {};
  } catch {
    return {};
  }
}

function writeAll(all) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch { /* storage full: drafts are only a convenience */ }
}

/** The draft, or null. maxAgeMs: ignore drafts older than this (the "savedAt" time is refreshed on every change) */
export function getDraft(kind, key, maxAgeMs) {
  const draft = readAll()[kind] && readAll()[kind][key];
  if (!draft) return null;
  if (maxAgeMs && Date.now() - draft.savedAt > maxAgeMs) return null;
  return draft;
}

export function setDraft(kind, key, values) {
  const all = readAll();
  all[kind] = all[kind] || {};
  all[kind][key] = { ...values, savedAt: Date.now() };
  writeAll(all);
}

/** Keep a draft but mark it as "touched just now" (used when a popup closes) */
export function touchDraft(kind, key) {
  const draft = getDraft(kind, key);
  if (draft) setDraft(kind, key, draft);
}

export function clearDraft(kind, key) {
  const all = readAll();
  if (all[kind]) delete all[kind][key];
  writeAll(all);
}

/** All drafts of one kind: { key: draft } */
export function listDrafts(kind) {
  return readAll()[kind] || {};
}
