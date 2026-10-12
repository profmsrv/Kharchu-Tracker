// -----------------------------------------------------------------------------
// SYNC ENGINE: keeps the local data (localStorage) and the user's Firebase database equal.
//
// GOLDEN RULES
//   1. The app never waits for Firebase. Screens only use local data. Syncing happens in the background.
//   2. App start fetches NOTHING. It reads one tiny value (the identification key) from Firebase and
//      compares it with the key it remembers. Same key = nothing changed = nothing to download.
//   3. Different key = another device changed data: download ONLY the new/changed items and merge them.
//   4. Every local edit changes the local key and queues the item in the "outbox".
//      When online, queued items are uploaded and the new key is written to Firebase.
//   5. Offline? Edits stay in the outbox (saved in localStorage). When the connection returns,
//      the engine syncs by itself. Nothing is lost, nothing is uploaded twice (uploads are idempotent).
//   6. Same item changed on two devices: the newer change wins. Everything else is merged.
//
// THE ONE SYNC (runOnce):
//     read Firebase key
//       no key at all  -> new database: download anything that exists, queue all local items
//       key differs    -> pull (download what changed, merge)
//     outbox not empty -> push (upload items, then compare-and-set the key)
// -----------------------------------------------------------------------------
import { COLLECTIONS } from './localStore';

const OVERLAP_MS = 5 * 60 * 1000;   // re-download the last 5 minutes too (clock safety). Merging twice is harmless.
const DEBOUNCE_MS = 1500;           // wait after an edit, so a burst of edits becomes one upload
const RETRY_MS = 30 * 1000;         // retry while something is waiting or we were offline
const ERROR_RETRY_MS = 2 * 60 * 1000;
const TIMEOUT_MS = 20 * 1000;
const UPLOAD_TIMEOUT_MS = 60 * 1000;
const TOMBSTONE_KEEP_MS = 90 * 24 * 60 * 60 * 1000; // local deletion markers older than this are forgotten

// Is this error "no internet / Firebase unreachable"?
function looksOffline(error) {
  const text = String((error && (error.code || error.message)) || '').toLowerCase();
  return ['offline', 'unavailable', 'network', 'timed out', 'failed to fetch', 'deadline'].some((word) => text.includes(word));
}

const isOnline = () => typeof navigator === 'undefined' || navigator.onLine !== false;

// Rejects if `promise` takes longer than `ms` (so a dead connection can't hang the engine)
function withTimeout(promise, ms, what) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`${what} timed out (offline?)`)), ms)),
  ]);
}

/**
 * store      the local store (services/localStore.js)
 * getRemote  async function that returns the Firebase connection (services/firebaseRemote.js)
 * onStatus   called with { state, pending, lastSyncAt, message } whenever the status changes
 *            state: 'syncing' | 'synced' | 'offline' | 'error'
 */
export function createSyncEngine({ store, getRemote, onStatus }) {
  let remote = null;          // the Firebase connection (created on first use)
  let running = false;        // is a sync in progress?
  let runAgain = false;       // an edit happened during a sync: sync again afterwards
  let stopped = false;
  let debounceTimer = null;
  let retryTimer = null;
  let status = { state: 'idle', pending: store.pendingCount(), lastSyncAt: store.getSync().lastSyncAt, message: '' };

  function setStatus(changes) {
    status = { ...status, ...changes, pending: store.pendingCount() };
    onStatus(status);
  }

  // ---------------------------------------------------------------------------
  // PULL: download what changed in Firebase and merge it into the local data
  // ---------------------------------------------------------------------------
  async function pull(meta) {
    const sync = store.getSync();
    // First time (cursor 0): download everything. Later: only items uploaded after our last visit.
    const since = sync.cursor > 0 ? sync.cursor - OVERLAP_MS : null;

    const collections = {};
    let newest = sync.cursor;
    for (const name of COLLECTIONS) {
      const result = since === null
        ? await withTimeout(remote.getAll(name), TIMEOUT_MS, 'download')
        : await withTimeout(remote.getChanged(name, since), TIMEOUT_MS, 'download');
      collections[name] = result.items;
      newest = Math.max(newest, result.newest);
    }
    const profile = await withTimeout(remote.getProfile(), TIMEOUT_MS, 'download');
    if (profile) newest = Math.max(newest, profile.newest);

    // Items deleted on another device no longer exist in Firebase: the small "deleted" list tells us about them.
    // Each one becomes a tombstone, which the merge applies like any other newer change.
    if (remote.getDeletions) {
      const deleted = await withTimeout(remote.getDeletions(), TIMEOUT_MS, 'download');
      for (const [key, updatedAt] of Object.entries(deleted)) {
        const split = key.indexOf('__');
        const name = key.slice(0, split);
        const id = key.slice(split + 2);
        if (collections[name] && !collections[name].some((item) => item.id === id)) {
          collections[name].push({ id, deleted: true, updatedAt });
        }
      }
    }

    store.mergeRemote({ collections, profile: profile ? profile.item : null });

    store.updateSync((s) => {
      s.cursor = newest;
      s.lastSyncAt = Date.now();
      if (meta) {
        s.syncedKey = meta.versionKey; // we now match Firebase's version
        if (s.outbox.length === 0) s.key = meta.versionKey; // and have no extra local changes
      }
    });
  }

  // ---------------------------------------------------------------------------
  // PUSH: upload the outbox, then publish the new identification key
  // ---------------------------------------------------------------------------
  async function push() {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const items = store.collectPending();
      if (items.length === 0) return;
      const keyToPublish = store.getSync().key;
      const expectedKey = store.getSync().syncedKey;

      // 1. upload the items (safe to repeat: same id = same document).
      //    Deleted items are not uploaded: their documents are REMOVED from Firebase (and noted in the "deleted" list).
      const canDelete = Boolean(remote.pushDeletions);
      const deletions = canDelete ? items.filter((item) => item.name !== 'profile' && item.data.deleted) : [];
      const uploads = items.filter((item) => !deletions.includes(item));
      if (uploads.length > 0) {
        await withTimeout(
          remote.pushItems(uploads.map(({ name, id, data }) => ({ name, id, data }))),
          UPLOAD_TIMEOUT_MS,
          'upload',
        );
      }
      if (deletions.length > 0) {
        await withTimeout(
          remote.pushDeletions(deletions.map(({ name, id, data }) => ({ name, id, updatedAt: data.updatedAt }))),
          UPLOAD_TIMEOUT_MS,
          'removing deleted items',
        );
      }

      // 2. publish the new key, but only if nobody else published one while we were uploading
      const result = await withTimeout(remote.compareAndSetMeta(expectedKey, keyToPublish), TIMEOUT_MS, 'finishing upload');
      if (result.ok) {
        store.markPushed(items, keyToPublish);
        return;
      }

      // 3. another device was faster: download its changes, merge, and try again
      if (!result.meta) store.updateSync((s) => { s.syncedKey = null; });
      await pull(result.meta);
    }
    throw new Error('Data keeps changing on another device. Will retry shortly.');
  }

  // ---------------------------------------------------------------------------
  // ONE FULL SYNC
  // ---------------------------------------------------------------------------
  async function runOnce() {
    const meta = await withTimeout(remote.getMeta(), TIMEOUT_MS, 'checking version'); // the ONLY read when nothing changed
    const sync = store.getSync();

    if (!meta) {
      // Brand-new Firebase database: take whatever is already there, then upload everything we have
      await pull(null);
      store.queueEverything();
    } else if (meta.versionKey !== sync.syncedKey) {
      // Firebase has newer data than we last saw
      await pull(meta);
    }

    if (store.pendingCount() > 0) {
      await push();
    } else {
      store.updateSync((s) => { s.lastSyncAt = Date.now(); });
    }
  }

  // Older versions left a marker document behind for every deletion. Remove them ONCE per Firebase connection.
  async function cleanOldMarkers() {
    if (!remote.cleanupTombstones || !remote.id || typeof localStorage === 'undefined') return;
    const flag = `bt-markers-cleaned:${remote.id}`;
    try {
      if (localStorage.getItem(flag)) return;
      await withTimeout(remote.cleanupTombstones(), UPLOAD_TIMEOUT_MS, 'clean-up');
      localStorage.setItem(flag, '1');
    } catch (error) {
      console.warn('Old deletion markers were not cleaned yet:', error); // tried again at the next sync
    }
  }

  // Public: run a sync now (does nothing if one is already running; it then runs again right after)
  async function syncNow() {
    if (stopped) return;
    if (running) {
      runAgain = true;
      return;
    }
    running = true;
    setStatus({ state: 'syncing', message: '' });
    try {
      if (!isOnline()) throw new Error('offline');
      if (!remote) remote = await withTimeout(getRemote(), TIMEOUT_MS, 'connecting');
      await runOnce();
      if (store.pendingCount() === 0) {
        await cleanOldMarkers();
        store.pruneTombstones(TOMBSTONE_KEEP_MS); // forget very old local deletion markers too
      }
      setStatus({ state: 'synced', lastSyncAt: store.getSync().lastSyncAt, message: '' });
    } catch (error) {
      if (looksOffline(error) || !isOnline()) {
        setStatus({ state: 'offline', message: 'Offline. Your changes are saved on this device and will sync automatically.' });
      } else {
        console.error(error);
        setStatus({ state: 'error', message: (error && error.message) || String(error) });
      }
    } finally {
      running = false;
      if (runAgain) {
        runAgain = false;
        schedule(DEBOUNCE_MS);
      }
      scheduleRetry();
    }
  }

  // Sync soon (waits a moment so several edits are sent together)
  function schedule(delay) {
    if (stopped) return;
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(syncNow, delay);
  }

  // If something is still waiting or we are offline/errored, try again later
  function scheduleRetry() {
    clearTimeout(retryTimer);
    if (stopped) return;
    if (status.state === 'offline' || store.pendingCount() > 0) retryTimer = setTimeout(syncNow, RETRY_MS);
    else if (status.state === 'error') retryTimer = setTimeout(syncNow, ERROR_RETRY_MS);
  }

  // ---------------------------------------------------------------------------
  // Start / stop. Syncing is triggered by: app start, every local edit, internet coming back,
  // and the tab becoming visible again.
  // ---------------------------------------------------------------------------
  let stopListeningToEdits = null;
  const onOnline = () => syncNow();
  const onVisible = () => {
    if (typeof document !== 'undefined' && document.visibilityState === 'visible') schedule(500);
  };

  return {
    start() {
      stopped = false;
      stopListeningToEdits = store.onLocalEdit(() => {
        setStatus({}); // refresh the "pending" number right away
        schedule(DEBOUNCE_MS);
      });
      if (typeof window !== 'undefined') window.addEventListener('online', onOnline);
      if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onVisible);
      syncNow();
    },
    stop() {
      stopped = true;
      clearTimeout(debounceTimer);
      clearTimeout(retryTimer);
      if (stopListeningToEdits) stopListeningToEdits();
      if (typeof window !== 'undefined') window.removeEventListener('online', onOnline);
      if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVisible);
    },
    syncNow,
    getStatus: () => status,
  };
}
