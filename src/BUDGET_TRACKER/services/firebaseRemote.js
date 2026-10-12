// -----------------------------------------------------------------------------
// The low-level connection to the user's Firebase Firestore database.
// It only does simple things (read the version key, download items, upload items).
// The decisions (what to fetch, when to upload) are made in services/syncEngine.js.
//
// Firebase is loaded lazily (dynamic import), so people who only use local storage never download it.
//
// Where data lives in Firestore:
//   users/{userId}/transactions/{id}   one document per item (same fields as the local items)
//   users/{userId}/categories/{id}
//   users/{userId}/goals/{id}
//   users/{userId}/notes/{id}
//   users/{userId}/settings/profile    name, theme, look & feel
//   users/{userId}/settings/sync       { versionKey }  <- the identification key of the newest data
//   users/{userId}/settings/deleted    { ids: { "transactions__<id>": deletedAtMs, ... } }
//
// DELETING: when the user deletes something, its document is REALLY removed from Firestore (nothing is left behind).
// Other devices still need to learn about it, so the id is also written to settings/deleted. A device that syncs reads
// that small list and removes the item from its own copy. Entries older than 60 days are dropped from the list.
//
// Every uploaded document also gets  syncedAt  = the SERVER's clock at upload time. Other devices use
// it to download only what changed since their last visit.
// -----------------------------------------------------------------------------
const BATCH_SIZE = 400; // Firestore allows 500 writes per batch; stay below
const DELETED_KEEP_MS = 60 * 24 * 60 * 60 * 1000; // how long a deletion stays in the "deleted" list
const COLLECTIONS = ['transactions', 'categories', 'goals', 'notes'];

export async function createRemote({ config, userId }) {
  const appModule = await import('firebase/app');
  const fs = await import('firebase/firestore');

  // One named Firebase app per project, so we never clash with other apps on the page
  const appName = `budget-tracker-${config.projectId}`;
  const existing = appModule.getApps().find((app) => app.name === appName);
  const app = existing || appModule.initializeApp(config, appName);
  const db = fs.getFirestore(app);

  // ----- paths -----
  const collectionRef = (name) => fs.collection(db, 'users', userId, name);
  const profileRef = () => fs.doc(db, 'users', userId, 'settings', 'profile');
  const metaRef = () => fs.doc(db, 'users', userId, 'settings', 'sync');
  const deletedRef = () => fs.doc(db, 'users', userId, 'settings', 'deleted');
  const deletedKey = (name, id) => `${name}__${id}`;

  // A Firestore Timestamp -> milliseconds (0 if missing)
  const toMillis = (timestamp) => (timestamp && timestamp.toMillis ? timestamp.toMillis() : 0);

  // Query result -> { items, newest } (newest = latest syncedAt among the items)
  function readDocuments(snapshot) {
    const items = [];
    let newest = 0;
    snapshot.forEach((document) => {
      const { syncedAt, ...fields } = document.data();
      newest = Math.max(newest, toMillis(syncedAt));
      items.push({ ...fields, id: document.id });
    });
    return { items, newest };
  }

  // The list of deleted items: { "transactions__<id>": deletedAtMs }
  async function readDeletions() {
    const snapshot = await fs.getDoc(deletedRef());
    return snapshot.exists() ? snapshot.data().ids || {} : {};
  }

  // Really remove the documents, and note their ids in the "deleted" list. Safe to repeat.
  async function removeItems(items) {
    if (items.length === 0) return;
    const cutoff = Date.now() - DELETED_KEEP_MS;
    const stale = Object.entries(await readDeletions()).filter(([, when]) => when < cutoff).map(([key]) => key);

    for (let start = 0; start < items.length; start += BATCH_SIZE) {
      const batch = fs.writeBatch(db);
      const ids = {};
      for (const { name, id, updatedAt } of items.slice(start, start + BATCH_SIZE)) {
        batch.delete(fs.doc(collectionRef(name), id));
        ids[deletedKey(name, id)] = updatedAt || Date.now();
      }
      if (start === 0) stale.forEach((key) => { ids[key] = fs.deleteField(); }); // forget very old deletions
      batch.set(deletedRef(), { ids, syncedAt: fs.serverTimestamp() }, { merge: true });
      await batch.commit();
    }
  }

  return {
    // A readable name of this connection (used to remember that the one-time clean-up was done)
    id: `${config.projectId}/${userId}`,

    // The identification key stored in Firebase (ONE small read). null = nothing uploaded yet.
    async getMeta() {
      const snapshot = await fs.getDoc(metaRef());
      return snapshot.exists() ? snapshot.data() : null;
    },

    // Every item of a collection (only used the first time)
    async getAll(name) {
      return readDocuments(await fs.getDocs(collectionRef(name)));
    },

    // Only the items uploaded since `sinceMs` (server time)
    async getChanged(name, sinceMs) {
      const query = fs.query(collectionRef(name), fs.where('syncedAt', '>', fs.Timestamp.fromMillis(sinceMs)));
      return readDocuments(await fs.getDocs(query));
    },

    async getProfile() {
      const snapshot = await fs.getDoc(profileRef());
      if (!snapshot.exists()) return null;
      const { syncedAt, ...fields } = snapshot.data();
      return { item: fields, newest: toMillis(syncedAt) };
    },

    // Upload items: [{ name, id, data }]. Safe to repeat (same id = same document, never a duplicate).
    async pushItems(items) {
      for (let start = 0; start < items.length; start += BATCH_SIZE) {
        const batch = fs.writeBatch(db);
        for (const { name, id, data } of items.slice(start, start + BATCH_SIZE)) {
          const reference = name === 'profile' ? profileRef() : fs.doc(collectionRef(name), id);
          const clean = JSON.parse(JSON.stringify(data)); // Firestore does not accept undefined values
          batch.set(reference, { ...clean, id, syncedAt: fs.serverTimestamp() });
        }
        await batch.commit();
      }
    },

    // Items the user deleted: [{ name, id, updatedAt }]. Removes the documents for real.
    pushDeletions: removeItems,

    // The "deleted" list: { "transactions__<id>": deletedAtMs }
    getDeletions: readDeletions,

    // One-time clean-up of older versions, which left a marker document { deleted: true } behind for every deletion.
    // Removes those markers (and records them in the "deleted" list). Returns how many were removed.
    async cleanupTombstones() {
      const found = [];
      for (const name of COLLECTIONS) {
        const snapshot = await fs.getDocs(fs.query(collectionRef(name), fs.where('deleted', '==', true)));
        snapshot.forEach((document) => found.push({ name, id: document.id, updatedAt: document.data().updatedAt }));
      }
      await removeItems(found);
      return found.length;
    },

    // "Compare and set": write the new key ONLY IF the key in Firebase is still `expectedKey`.
    // If another device uploaded in the meantime the key differs and we get { ok: false }.
    async compareAndSetMeta(expectedKey, newKey) {
      return fs.runTransaction(db, async (transaction) => {
        const snapshot = await transaction.get(metaRef());
        const currentKey = snapshot.exists() ? snapshot.data().versionKey : null;
        if (currentKey !== (expectedKey ?? null)) {
          return { ok: false, meta: snapshot.exists() ? snapshot.data() : null };
        }
        transaction.set(metaRef(), { versionKey: newKey, updatedAt: Date.now() });
        return { ok: true };
      });
    },
  };
}
