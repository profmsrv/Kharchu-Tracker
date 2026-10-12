// -----------------------------------------------------------------------------
// The user's Firebase config is NEVER part of the source code (this project is open source).
// The user pastes it in Settings -> Database and it is kept in THIS browser's localStorage
// under the key "bt-firebase".
// -----------------------------------------------------------------------------
const STORAGE_KEY = 'bt-firebase';

/** Returns { config, userId } if Firebase was connected before, otherwise null */
export function loadFirebaseSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    const valid = saved && saved.config && saved.config.apiKey && saved.config.projectId && saved.userId;
    return valid ? saved : null;
  } catch {
    return null;
  }
}

export function saveFirebaseSettings(settings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

export function clearFirebaseSettings() {
  localStorage.removeItem(STORAGE_KEY);
}

/**
 * Reads the config out of whatever the user pasted.
 * Works with the snippet Firebase shows (`const firebaseConfig = { apiKey: "...", ... }`) and with JSON.
 */
export function parseFirebaseConfig(text) {
  const config = {};
  // matches   apiKey: "abc"   or   "apiKey": 'abc'
  const pattern = /["']?(apiKey|authDomain|projectId|storageBucket|messagingSenderId|appId|measurementId)["']?\s*:\s*["'`]([^"'`]+)["'`]/g;
  let match = pattern.exec(text);
  while (match) {
    config[match[1]] = match[2];
    match = pattern.exec(text);
  }
  if (!config.apiKey || !config.projectId) {
    throw new Error('Could not find apiKey and projectId in the pasted text. Paste the whole firebaseConfig block.');
  }
  return config;
}

/** A long random "folder name" for the user's data inside Firestore (hard to guess = private) */
export function randomUserId() {
  if (globalThis.crypto && globalThis.crypto.randomUUID) {
    return 'bt-' + globalThis.crypto.randomUUID().replace(/-/g, '').slice(0, 20);
  }
  return 'bt-' + Math.random().toString(36).slice(2, 12) + Date.now().toString(36);
}

/** Firestore security rules that only allow access to the user's own folder */
export function rulesFor(userId) {
  return `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/{document=**} {
      allow read, write: if userId == '${userId}';
    }
  }
}`;
}

/** Hides the second half of a secret value:  "AIzaSyD123456"  ->  "AIzaSyD######"  (the screen never shows full keys) */
export function maskHalf(value) {
  const text = String(value || '');
  if (text.length < 2) return '#'.repeat(text.length);
  const visible = Math.ceil(text.length / 2);
  return text.slice(0, visible) + '#'.repeat(text.length - visible);
}
