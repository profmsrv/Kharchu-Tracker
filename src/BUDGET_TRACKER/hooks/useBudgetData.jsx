// -----------------------------------------------------------------------------
// THE DATA LAYER of the app. Read this file to understand how data moves.
//
//   The app is LOCAL-FIRST:
//     * screens read and write the LOCAL store (browser localStorage) only, so everything is instant and works offline
//     * if the user connected Firebase, a sync engine copies changes to/from Firebase in the background
//       (see services/syncEngine.js for the rules)
//
//   READ :  local store --subscribe()--> state in DataProvider --context--> useData() in a screen
//   WRITE:  screen --action from useData()--> local store --notifies--> screens re-render
//                                                       \--> sync engine uploads it to Firebase later
//
// Any component can call:   const { transactions, addTransaction, syncStatus, ... } = useData();
// -----------------------------------------------------------------------------
import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { createLocalStore, ValidationError } from '../services/localStore';
import { createRemote } from '../services/firebaseRemote';
import { createSyncEngine } from '../services/syncEngine';
import { clearFirebaseSettings, loadFirebaseSettings, saveFirebaseSettings } from '../services/firebaseSettings';
import { resolveAppearance } from '../constants/appearance';

const DataContext = createContext(null);

/** Use this inside any component to get the data and the actions */
export function useData() {
  return useContext(DataContext);
}

// Shown for a transaction whose category was deleted
const UNKNOWN_CATEGORY = { name: '', icon: 'wallet', color: '#8a7a93' };

export function DataProvider({ children }) {
  // The local database. Created once. It already contains the default categories on the first run.
  const [store] = useState(() => createLocalStore());

  // Everything the screens show: { transactions, categories, goals, notes, profile }
  const [data, setData] = useState(() => store.snapshot());

  // null = local only, or { config, userId } = also synced with the user's Firebase
  const [firebase, setFirebase] = useState(loadFirebaseSettings);

  // What the sync engine is doing: { state, pending, lastSyncAt, message }
  const [syncStatus, setSyncStatus] = useState({ state: 'local', pending: 0, lastSyncAt: 0, message: '' });

  // A problem while saving on this device (for example the browser storage is full)
  const [error, setError] = useState(null);

  const engineRef = useRef(null);

  // Keep `data` up to date whenever the local store changes
  useEffect(() => {
    setData(store.snapshot());
    return store.subscribe(setData);
  }, [store]);

  // Start the sync engine while Firebase is connected; stop it when disconnected or changed
  useEffect(() => {
    if (!firebase) {
      setSyncStatus({ state: 'local', pending: 0, lastSyncAt: 0, message: '' });
      return undefined;
    }
    const engine = createSyncEngine({
      store,
      getRemote: () => createRemote(firebase), // Firebase code is only downloaded now
      onStatus: setSyncStatus,
    });
    engineRef.current = engine;
    engine.start();
    return () => {
      engine.stop();
      engineRef.current = null;
    };
  }, [firebase, store]);

  // Everything the screens can use. Rebuilt only when something changes.
  const value = useMemo(() => {
    // Split categories into two lists, oldest first: { expense: [...], income: [...] }
    const sorted = [...data.categories].sort((a, b) => (a.order || 0) - (b.order || 0));
    const categories = {
      expense: sorted.filter((c) => c.type === 'expense'),
      income: sorted.filter((c) => c.type === 'income'),
    };

    // Makes an action that calls the store and remembers a saving problem (if any)
    const action = (methodName) => async (...args) => {
      try {
        return await store[methodName](...args);
      } catch (err) {
        // problems the user can fix are shown by the form itself; only real failures get the red banner
        if (!(err instanceof ValidationError)) setError(err && err.message ? err.message : String(err));
        throw err;
      }
    };

    return {
      error,
      clearError: () => setError(null),
      mode: firebase ? 'firebase' : 'local',
      firebaseSettings: firebase,
      syncStatus,
      syncNow: () => (engineRef.current ? engineRef.current.syncNow() : undefined),

      // ----- data -----
      transactions: data.transactions,
      categories,
      goals: data.goals,
      notes: data.notes,
      profile: data.profile,
      appearance: resolveAppearance(data.profile.appearance), // look & feel, with defaults filled in

      /** Find a category by type + name. Deleted categories get a neutral wallet icon. */
      getCategory(type, name) {
        const found = categories[type].find((c) => c.name === name);
        return found || { ...UNKNOWN_CATEGORY, name };
      },

      // ----- actions (change data) -----
      addTransaction: action('addTransaction'),
      addPlanMove: action('addPlanMove'), // money into / out of a savings plan (ONE transaction with a bank icon)
      updateTransaction: action('updateTransaction'),
      deleteTransaction: action('deleteTransaction'),
      importData: action('importData'), // many transactions at once (Settings -> Import data from CSV)
      addCategory: action('addCategory'),
      deleteCategory: action('deleteCategory'),
      addGoal: action('addGoal'),
      updateGoal: action('updateGoal'),
      deleteGoal: action('deleteGoal'),
      deleteOrphanCategories: action('deleteOrphanCategories'), // leftovers of deleted savings plans
      addNote: action('addNote'),
      updateNote: action('updateNote'),
      deleteNote: action('deleteNote'),
      saveProfile: action('saveProfile'),

      // ----- Firebase connection (Settings -> Database) -----
      // Used both to connect for the first time and to switch to a DIFFERENT Firebase account.
      connectFirebase(config, userId) {
        const settings = { config, userId };
        // A different database needs ALL local data uploaded to it, so forget the old sync history
        const isDifferent = !firebase || firebase.config.projectId !== config.projectId || firebase.userId !== userId;
        if (isDifferent) store.resetSync();
        saveFirebaseSettings(settings);
        setFirebase(settings);
      },
      /**
       * LOG OUT: disconnect Firebase and delete EVERYTHING this app saved in this browser (all keys starting with "bt-").
       * With Firebase connected, waiting changes are uploaded first. If some cannot be uploaded (offline?), the result is
       * { ok: false, pending: N } and nothing is deleted, so the screen can ask the user. logout(true) deletes anyway.
       */
      async logout(force = false) {
        if (firebase && !force) {
          if (engineRef.current && store.pendingCount() > 0) {
            // give the upload up to 15 seconds
            await Promise.race([engineRef.current.syncNow(), new Promise((resolve) => setTimeout(resolve, 15000))]);
          }
          const pending = store.pendingCount();
          if (pending > 0) return { ok: false, pending };
        }
        if (engineRef.current) engineRef.current.stop();
        const keys = [];
        for (let i = 0; i < localStorage.length; i += 1) keys.push(localStorage.key(i));
        keys.filter((key) => key && key.startsWith('bt-')).forEach((key) => localStorage.removeItem(key));
        window.location.reload(); // start again from a clean state (shows the first-launch question)
        return { ok: true, pending: 0 };
      },

      // Back to "this device only". Local data is untouched; changes made meanwhile are remembered and upload on reconnect.
      disconnectFirebase() {
        clearFirebaseSettings();
        setFirebase(null);
      },
    };
  }, [data, error, firebase, syncStatus, store]);

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}
