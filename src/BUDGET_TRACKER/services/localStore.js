// -----------------------------------------------------------------------------
// THE LOCAL DATABASE. The app ALWAYS reads and writes here first (browser localStorage),
// so it opens instantly and works offline. If the user connected Firebase, services/syncEngine.js
// copies changes to Firebase in the background.
//
// What is stored (one JSON text under the key "bt-data"):
//   {
//     transactions: [], categories: [], goals: [], notes: [],   <- lists of items
//     profile: {},                                              <- name, theme, look & feel
//     sync: { key, syncedKey, cursor, outbox, lastSyncAt }      <- bookkeeping for Firebase sync
//   }
//
// Every item has:  id  and  updatedAt (milliseconds, the time of its last change).
// Deleting does NOT remove an item. It replaces it with a tiny "tombstone"  { id, deleted: true, updatedAt }
// so that the deletion can be synced to other devices. Screens never see tombstones.
// (In Firebase the document is really removed, see services/firebaseRemote.js; the tombstone is forgotten after 90 days.)
//
// SAVINGS PLANS: creating a plan also creates two categories with the plan's name (one income, one expense,
// ids "cat-income-plan-<goalId>" / "cat-expense-plan-<goalId>", field goalId). Income entered in that category
// adds to the plan, expenses take from it (see utils/plans.js). Renaming or deleting a plan updates them too.
//
// PLAN MOVES: putting money INTO a plan (or taking it OUT) is saved as ONE transaction with the field goalId:
//   into the plan    ->  expense "Moved to plan: <plan>"   (category "Moved to plan"): balance goes down, plan goes up
//   out of the plan  ->  income  "From plan: <plan>"       (category "From plan"):     balance goes up, plan goes down
// Both use the bank icon. Statistics ignore them (see sumBy in utils/dates.js); the balance counts them (balanceOf).
//
// SYNC BOOKKEEPING (the "identification key" idea):
//   sync.key        random text that CHANGES on every local edit        (version of this device's data)
//   sync.syncedKey  the key Firebase had the last time both sides matched
//   sync.outbox     list of items ("transactions/<id>") not yet uploaded to Firebase
//   sync.cursor     server time of the newest item we have downloaded
// Data and bookkeeping are saved in ONE write, so an edit can never be saved without being queued for upload.
// -----------------------------------------------------------------------------
import { DEFAULT_CATEGORIES, DEFAULT_PROFILE } from '../constants/defaults';
import { fmt } from '../utils/format';
import { planProgress } from '../utils/plans';

export const COLLECTIONS = ['transactions', 'categories', 'goals', 'notes'];

// A problem the USER can fix (name already used, amount too big ...). Screens show its message next to the form.
// Any other error (for example the browser storage is full) is shown in the red banner.
export class ValidationError extends Error {}

// A random text (used for ids and for the identification key)
export function randomText() {
  if (globalThis.crypto && globalThis.crypto.randomUUID) return globalThis.crypto.randomUUID();
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 12);
}

export function createLocalStore(options = {}) {
  const DATA_KEY = options.storageKey || 'bt-data';
  const BACKUP_KEY = DATA_KEY + '-prev'; // the previous version of the data, used if the main copy is damaged

  // ---------------------------------------------------------------------------
  // 1. Reading and writing the JSON
  // ---------------------------------------------------------------------------
  function emptySync() {
    return { key: randomText(), syncedKey: null, cursor: 0, outbox: [], lastSyncAt: 0 };
  }

  function parseJson(text) {
    try {
      const value = JSON.parse(text);
      return value && typeof value === 'object' ? value : null;
    } catch {
      return null;
    }
  }

  // Makes sure old or incomplete saves have every list and every field the app expects
  function normalise(saved) {
    const data = { transactions: [], categories: [], goals: [], notes: [], profile: null, ...saved };
    for (const name of COLLECTIONS) {
      const list = Array.isArray(saved[name]) ? saved[name] : [];
      // saves from older versions have no updatedAt: use createdAt, or 1 (= very old)
      data[name] = list.map((item) => ({ ...item, updatedAt: item.updatedAt ?? item.createdAt ?? 1 }));
    }
    if (data.profile && data.profile.updatedAt == null) data.profile = { ...data.profile, updatedAt: 0 };
    data.sync = { ...emptySync(), ...(saved.sync || {}) };
    if (!Array.isArray(data.sync.outbox)) data.sync.outbox = [];
    return data;
  }

  // Reads everything. If the main copy is damaged, the backup copy is used instead.
  function readAll() {
    const main = parseJson(localStorage.getItem(DATA_KEY));
    if (main) return normalise(main);
    const backup = parseJson(localStorage.getItem(BACKUP_KEY));
    if (backup) {
      console.warn('Budget Tracker: main data was damaged, restored the previous copy.');
      return normalise(backup);
    }
    return normalise({});
  }

  // Saves everything. If saving fails (e.g. storage is full) an error is thrown and NOTHING changes.
  function writeAll(data) {
    const text = JSON.stringify(data);
    const previous = localStorage.getItem(DATA_KEY);
    localStorage.setItem(DATA_KEY, text);
    if (previous) {
      try { localStorage.setItem(BACKUP_KEY, previous); } catch { /* backup is optional */ }
    }
  }

  // Timestamps that always go up, even if two edits happen in the same millisecond
  let lastStamp = 0;
  function stamp() {
    lastStamp = Math.max(Date.now(), lastStamp + 1);
    return lastStamp;
  }

  // Queue an item for upload and give the data a new identification key
  function queueForUpload(data, name, id) {
    const entry = `${name}/${id}`;
    if (!data.sync.outbox.includes(entry)) data.sync.outbox.push(entry);
    data.sync.key = randomText();
  }

  // Save the data, tell the screens, and tell the sync engine that the user edited something
  function finish(data) {
    writeAll(data);
    notifyData();
    editListeners.forEach((callback) => callback());
  }

  const isVisible = (item) => !item.deleted;

  // ---------------------------------------------------------------------------
  // 2. Listeners: screens are told when data changes
  // ---------------------------------------------------------------------------
  const dataListeners = new Set();    // called with a fresh snapshot after ANY change
  const editListeners = new Set();    // called after the USER edits something (the sync engine listens here)

  // What the screens get: only visible items
  function snapshot() {
    const data = readAll();
    return {
      transactions: data.transactions.filter(isVisible),
      categories: data.categories.filter(isVisible),
      goals: data.goals.filter(isVisible),
      notes: data.notes.filter(isVisible),
      profile: data.profile || { ...DEFAULT_PROFILE },
    };
  }

  function notifyData() {
    const latest = snapshot();
    dataListeners.forEach((callback) => callback(latest));
  }

  // If the app is open in two browser tabs, changes made in one tab show up in the other
  function onStorageEvent(event) {
    if (event.key === DATA_KEY || event.key === null) notifyData();
  }

  // ---------------------------------------------------------------------------
  // 3. Changing data (every change: update item + queue upload + new key, in ONE write)
  // ---------------------------------------------------------------------------
  function addItem(name, fields) {
    const data = readAll();
    const id = fields.id || randomText();
    const now = stamp();
    data[name].push({ ...fields, id, createdAt: now, updatedAt: now });
    queueForUpload(data, name, id);
    finish(data);
    return id;
  }

  function updateItem(name, id, changes) {
    const data = readAll();
    const index = data[name].findIndex((item) => item.id === id);
    if (index < 0 || data[name][index].deleted) throw new ValidationError('This item no longer exists.');
    data[name][index] = { ...data[name][index], ...changes, updatedAt: stamp() };
    queueForUpload(data, name, id);
    finish(data);
  }

  function removeItem(name, id) {
    const data = readAll();
    const index = data[name].findIndex((item) => item.id === id);
    if (index < 0) return;
    data[name][index] = { id, deleted: true, updatedAt: stamp() }; // tombstone
    queueForUpload(data, name, id);
    finish(data);
  }

  // ---------------------------------------------------------------------------
  // 3b. Savings plans (a plan owns two categories, see the header comment)
  // ---------------------------------------------------------------------------
  const planCategoryId = (type, goalId) => `cat-${type}-plan-${goalId}`;

  // A plan name must not equal the name of any other category (transactions find categories by name)
  function assertPlanNameFree(data, name, goalId) {
    const taken = data.categories.some((c) => !c.deleted && c.goalId !== goalId && c.name.toLowerCase() === name.toLowerCase());
    if (taken) throw new ValidationError(`A category named "${name}" already exists. Choose a different plan name.`);
  }

  // Make sure the plan's income + expense categories exist and match the plan's name, icon and colour
  function syncPlanCategories(data, goal) {
    for (const type of ['income', 'expense']) {
      const id = planCategoryId(type, goal.id);
      const index = data.categories.findIndex((c) => c.id === id);
      const fields = { type, name: goal.name, icon: goal.icon || 'target', color: goal.color, goalId: goal.id };
      const old = index >= 0 ? data.categories[index] : null;

      if (old && !old.deleted && old.name === fields.name && old.icon === fields.icon && old.color === fields.color) continue; // already right

      const now = stamp();
      const category = { ...fields, id, order: Date.now(), createdAt: old && !old.deleted ? old.createdAt : now, updatedAt: now };
      if (index >= 0) data.categories[index] = category;
      else data.categories.push(category);
      queueForUpload(data, 'categories', id);
    }
  }

  function addGoal(fields) {
    const data = readAll();
    const id = randomText();
    assertPlanNameFree(data, fields.name, id);
    const now = stamp();
    const goal = { ...fields, id, createdAt: now, updatedAt: now };
    data.goals.push(goal);
    queueForUpload(data, 'goals', id);
    syncPlanCategories(data, goal);
    finish(data);
    return id;
  }

  function updateGoal(id, changes) {
    const data = readAll();
    const index = data.goals.findIndex((g) => g.id === id);
    if (index < 0 || data.goals[index].deleted) throw new ValidationError('This plan no longer exists.');
    const old = data.goals[index];
    const goal = { ...old, ...changes, updatedAt: stamp() };

    // Renamed plan: move its transactions to the new category name, so nothing gets detached
    if (goal.name !== old.name) {
      assertPlanNameFree(data, goal.name, id);
      data.transactions.forEach((tx, i) => {
        if (!tx.deleted && tx.category === old.name) {
          data.transactions[i] = { ...tx, category: goal.name, updatedAt: stamp() };
          queueForUpload(data, 'transactions', tx.id);
        }
      });
    }
    // The titles of this plan's moves contain its name ("Moved to plan: Phone"): update them too
    if (goal.name !== old.name) {
      data.transactions.forEach((tx, i) => {
        if (!tx.deleted && tx.goalId === id) {
          data.transactions[i] = { ...tx, title: tx.title.split(old.name).join(goal.name), updatedAt: stamp() };
          queueForUpload(data, 'transactions', tx.id);
        }
      });
    }
    data.goals[index] = goal;
    queueForUpload(data, 'goals', id);
    syncPlanCategories(data, goal);
    finish(data);
  }

  function deleteGoal(id) {
    const data = readAll();
    const index = data.goals.findIndex((g) => g.id === id);
    if (index < 0) return;
    data.goals[index] = { id, deleted: true, updatedAt: stamp() };
    queueForUpload(data, 'goals', id);
    // Remove EVERY category that belongs to this plan: the two standard ones and any older ones that carry its goalId
    data.categories.forEach((c, i) => {
      if (!c.deleted && (c.goalId === id || c.id === planCategoryId('income', id) || c.id === planCategoryId('expense', id))) {
        data.categories[i] = { id: c.id, deleted: true, updatedAt: stamp() };
        queueForUpload(data, 'categories', c.id);
      }
    });
    finish(data);
  }

  // Categories that still say "I belong to a savings plan" although that plan is gone (left behind by older versions).
  // They cannot be used or deleted from the screens, so this removes them. Returns how many were removed.
  function deleteOrphanCategories() {
    const data = readAll();
    const livePlans = new Set(data.goals.filter(isVisible).map((g) => g.id));
    let removed = 0;
    data.categories.forEach((c, i) => {
      if (!c.deleted && c.goalId && !livePlans.has(c.goalId)) {
        data.categories[i] = { id: c.id, deleted: true, updatedAt: stamp() };
        queueForUpload(data, 'categories', c.id);
        removed += 1;
      }
    });
    if (removed > 0) finish(data);
    return removed;
  }

  // ---------------------------------------------------------------------------
  // 3c. Plan transfers (see the header comment)
  // ---------------------------------------------------------------------------
  // Two fixed "system" categories hold the balance side of a transfer
  const TRANSFER_CATEGORIES = {
    expense: { id: 'cat-expense-plan-transfer', name: 'Moved to plan' },
    income: { id: 'cat-income-plan-transfer', name: 'From plan' },
  };

  function ensureTransferCategories(data) {
    for (const type of ['expense', 'income']) {
      const { id, name } = TRANSFER_CATEGORIES[type];
      const existing = data.categories.find((c) => c.id === id);
      if (existing && !existing.deleted) continue;
      const now = stamp();
      const category = { id, type, name, icon: 'bank', color: '#8a7a93', system: true, order: Date.now(), createdAt: now, updatedAt: now };
      if (existing) data.categories[data.categories.indexOf(existing)] = category;
      else data.categories.push(category);
      queueForUpload(data, 'categories', id);
    }
  }

  const visibleTransactions = (data) => data.transactions.filter(isVisible);

  // direction 'in' = money into the plan, 'out' = money taken out of the plan. Saves ONE transaction.
  function addPlanMove({ goalId, direction, amount, date, note }) {
    const data = readAll();
    const goal = data.goals.find((g) => g.id === goalId && !g.deleted);
    if (!goal) throw new ValidationError('This plan no longer exists.');
    const value = Number(amount);
    if (!(value > 0)) throw new ValidationError('Enter an amount.');

    if (direction === 'out') {
      const available = planProgress(goal, visibleTransactions(data)).saved;
      if (value > available) throw new ValidationError(`Only ${fmt(available)} is available in "${goal.name}".`);
    }
    ensureTransferCategories(data);

    const into = direction === 'in';
    const id = randomText();
    const now = stamp();
    data.transactions.push({
      id,
      goalId,
      type: into ? 'expense' : 'income',
      category: into ? TRANSFER_CATEGORIES.expense.name : TRANSFER_CATEGORIES.income.name,
      title: (into ? `Moved to plan: ${goal.name}` : `From plan: ${goal.name}`) + (note ? ` · ${note}` : ''),
      amount: value,
      date,
      createdAt: now,
      updatedAt: now,
    });
    queueForUpload(data, 'transactions', id);
    finish(data);
    return id;
  }

  // Change a transaction. A plan move keeps its type, category and plan; amount, date and note can change.
  function updateTransaction(id, changes) {
    const data = readAll();
    const old = data.transactions.find((t) => t.id === id);
    if (!old || old.deleted) throw new ValidationError('This item no longer exists.');
    if (!old.goalId) {
      updateItem('transactions', id, changes);
      return;
    }

    const { type, category, goalId, ...allowed } = changes;
    // Taking money OUT of a plan: the new amount must still fit in the plan
    if (allowed.amount !== undefined && old.type === 'income') {
      const goal = data.goals.find((g) => g.id === old.goalId && !g.deleted);
      if (goal) {
        const available = planProgress(goal, visibleTransactions(data)).saved + old.amount;
        if (Number(allowed.amount) > available) throw new ValidationError(`Only ${fmt(available)} is available in "${goal.name}".`);
      }
    }
    updateItem('transactions', id, allowed);
  }

  // Entries from the previous version saved a plan move as TWO linked transactions (transferId).
  // Convert each pair into the single transaction: the balance side stays (with goalId), the plan side is removed.
  function migrateTransfers() {
    const data = readAll();
    const groups = {};
    data.transactions.forEach((tx) => {
      if (!tx.deleted && tx.transferId) (groups[tx.transferId] = groups[tx.transferId] || []).push(tx);
    });
    let changed = false;

    Object.values(groups).forEach((legs) => {
      const balanceSide = legs.find((t) => t.category === 'Moved to plan' || t.category === 'From plan');
      const planSide = legs.find((t) => t !== balanceSide);
      const goal = planSide && data.goals.find((g) => !g.deleted && g.name === planSide.category);
      const indexOf = (tx) => data.transactions.findIndex((t) => t.id === tx.id);

      if (balanceSide && planSide && goal) {
        const { transferId, ...rest } = balanceSide;
        data.transactions[indexOf(balanceSide)] = { ...rest, goalId: goal.id, updatedAt: stamp() };
        data.transactions[indexOf(planSide)] = { id: planSide.id, deleted: true, updatedAt: stamp() };
        queueForUpload(data, 'transactions', balanceSide.id);
        queueForUpload(data, 'transactions', planSide.id);
      } else {
        // the plan no longer exists: keep the entries as normal transactions
        legs.forEach((tx) => {
          const { transferId, ...rest } = tx;
          data.transactions[indexOf(tx)] = { ...rest, updatedAt: stamp() };
          queueForUpload(data, 'transactions', tx.id);
        });
      }
      changed = true;
    });

    if (changed) {
      data.sync.key = randomText();
      writeAll(data);
    }
  }

  // Plans created by an older version have no categories yet: create them once
  function migratePlans() {
    const data = readAll();
    const before = data.sync.outbox.length;
    for (const goal of data.goals.filter(isVisible)) {
      const hasBoth = ['income', 'expense'].every((type) => data.categories.some((c) => c.id === planCategoryId(type, goal.id) && !c.deleted));
      if (hasBoth) continue;
      try {
        assertPlanNameFree(data, goal.name, goal.id);
        syncPlanCategories(data, goal);
      } catch { /* name clash with another category: leave this plan unlinked */ }
    }
    if (data.sync.outbox.length !== before) {
      data.sync.key = randomText();
      writeAll(data);
    }
  }

  // ---------------------------------------------------------------------------
  // 3d. Import (Settings -> Import data from CSV)
  // ---------------------------------------------------------------------------
  // Adds many transactions (and the categories they need) in ONE write: one save, one new key, one sync.
  // utils/csv.js has already checked every row, so this only stores them.
  //   categories:   [{ type, name, icon, color }]   created only if no category with that type + name exists
  //   transactions: [{ type, category, title, amount, date, goalId? }]
  // A goalId that no longer exists is dropped (the entry becomes a normal transaction). Returns what was added.
  function importData({ transactions = [], categories = [] }) {
    const data = readAll();
    const added = { transactions: 0, categories: 0 };
    let order = Date.now();

    for (const category of categories) {
      const exists = data.categories.some((c) => !c.deleted && c.type === category.type && c.name.toLowerCase() === category.name.toLowerCase());
      if (exists) continue;
      const id = randomText();
      const now = stamp();
      const item = { id, type: category.type, name: category.name, icon: category.icon || 'tag', color: category.color || '#8a7a93', order: order, createdAt: now, updatedAt: now };
      order += 1;
      data.categories.push(item);
      queueForUpload(data, 'categories', id);
      added.categories += 1;
    }

    if (transactions.some((tx) => tx.category === TRANSFER_CATEGORIES.expense.name || tx.category === TRANSFER_CATEGORIES.income.name)) {
      ensureTransferCategories(data);
    }

    for (const tx of transactions) {
      const amount = Number(tx.amount);
      if (!(amount > 0) || !tx.date || (tx.type !== 'expense' && tx.type !== 'income')) continue;
      const id = randomText();
      const now = stamp();
      const item = { id, type: tx.type, title: tx.title || tx.category, category: tx.category, amount, date: tx.date, createdAt: now, updatedAt: now };
      if (tx.goalId && data.goals.some((g) => g.id === tx.goalId && !g.deleted)) item.goalId = tx.goalId;
      data.transactions.push(item);
      queueForUpload(data, 'transactions', id);
      added.transactions += 1;
    }

    if (added.transactions > 0 || added.categories > 0) finish(data);
    return added;
  }

  // ---------------------------------------------------------------------------
  // 4. First run: default categories and plans
  // ---------------------------------------------------------------------------
  // The defaults get updatedAt = 0 ("oldest possible"), so if the same account already has real
  // data in Firebase, that data always wins over these defaults.
  function seedIfNeeded() {
    const data = readAll();
    if (data.profile && data.profile.seeded) return;

    data.profile = { ...DEFAULT_PROFILE, ...(data.profile || {}), updatedAt: 0 };
    DEFAULT_CATEGORIES.forEach((category, index) => {
      if (!data.categories.some((c) => c.id === category.id)) {
        data.categories.push({ ...category, order: index, createdAt: 0, updatedAt: 0 });
      }
    });
    writeAll(data);
  }
  seedIfNeeded();
  migratePlans();
  migrateTransfers();

  // ---------------------------------------------------------------------------
  // 5. The object the rest of the app uses
  // ---------------------------------------------------------------------------
  return {
    snapshot,

    // Screens subscribe here. Returns an "unsubscribe" function.
    subscribe(callback) {
      if (dataListeners.size === 0 && typeof window !== 'undefined') window.addEventListener('storage', onStorageEvent);
      dataListeners.add(callback);
      return () => {
        dataListeners.delete(callback);
        if (dataListeners.size === 0 && typeof window !== 'undefined') window.removeEventListener('storage', onStorageEvent);
      };
    },

    // The sync engine subscribes here to know when the user edited something
    onLocalEdit(callback) {
      editListeners.add(callback);
      return () => editListeners.delete(callback);
    },

    // ----- actions used by screens -----
    async addTransaction(tx) { return addItem('transactions', tx); },
    async updateTransaction(id, changes) { updateTransaction(id, changes); },
    async deleteTransaction(id) { removeItem('transactions', id); },
    // money into / out of a savings plan: ONE transaction (bank icon)
    async addPlanMove(details) { return addPlanMove(details); },

    // many transactions at once (CSV import)
    async importData(payload) { return importData(payload); },

    async addCategory(category) { return addItem('categories', { ...category, order: Date.now() }); },
    async deleteCategory(id) { removeItem('categories', id); },

    // savings plans (they also manage their two categories)
    async addGoal(goal) { return addGoal(goal); },
    async updateGoal(id, changes) { updateGoal(id, changes); },
    async deleteOrphanCategories() { return deleteOrphanCategories(); },
    async deleteGoal(id) { deleteGoal(id); },

    async addNote(note) { return addItem('notes', note); },
    async updateNote(id, changes) { updateItem('notes', id, changes); },
    async deleteNote(id) { removeItem('notes', id); },

    // name, theme, look & feel
    async saveProfile(changes) {
      const data = readAll();
      data.profile = { ...(data.profile || DEFAULT_PROFILE), ...changes, updatedAt: stamp() };
      queueForUpload(data, 'profile', 'profile');
      finish(data);
    },

    // -------------------------------------------------------------------------
    // Used only by services/syncEngine.js
    // -------------------------------------------------------------------------
    getSync() {
      return readAll().sync;
    },

    // Change the bookkeeping:  store.updateSync((sync) => { sync.cursor = 5; })
    updateSync(change) {
      const data = readAll();
      change(data.sync);
      writeAll(data);
    },

    pendingCount() {
      return readAll().sync.outbox.length;
    },

    // The items waiting for upload, as [{ name, id, data, stamp }]
    collectPending() {
      const data = readAll();
      const pending = [];
      for (const entry of data.sync.outbox) {
        const slash = entry.indexOf('/');
        const name = entry.slice(0, slash);
        const id = entry.slice(slash + 1);
        const item = name === 'profile' ? data.profile : (data[name] || []).find((i) => i.id === id);
        if (item) pending.push({ name, id, data: item, stamp: item.updatedAt });
      }
      return pending;
    },

    // Upload succeeded: remove items from the queue (unless the user changed them again meanwhile)
    markPushed(pushed, publishedKey) {
      const data = readAll();
      for (const p of pushed) {
        const current = p.name === 'profile' ? data.profile : data[p.name].find((i) => i.id === p.id);
        if (!current || current.updatedAt === p.stamp) {
          data.sync.outbox = data.sync.outbox.filter((entry) => entry !== `${p.name}/${p.id}`);
        }
      }
      data.sync.syncedKey = publishedKey;
      data.sync.lastSyncAt = Date.now();
      writeAll(data);
    },

    // Forget deletion markers (tombstones) older than `maxAgeMs` that are already uploaded. Returns how many were removed.
    pruneTombstones(maxAgeMs) {
      const data = readAll();
      const cutoff = Date.now() - maxAgeMs;
      let removed = 0;
      for (const name of COLLECTIONS) {
        data[name] = data[name].filter((item) => {
          const old = item.deleted && item.updatedAt < cutoff && !data.sync.outbox.includes(`${name}/${item.id}`);
          if (old) removed += 1;
          return !old;
        });
      }
      if (removed > 0) writeAll(data);
      return removed;
    },

    // Queue EVERYTHING for upload (used when connecting to a new Firebase database)
    queueEverything() {
      const data = readAll();
      const entries = [];
      for (const name of COLLECTIONS) data[name].forEach((item) => entries.push(`${name}/${item.id}`));
      if (data.profile) entries.push('profile/profile');
      data.sync.outbox = entries;
      data.sync.key = randomText();
      writeAll(data);
    },

    // Forget the sync history (used when the user connects a different Firebase account)
    resetSync() {
      const data = readAll();
      data.sync = { ...emptySync(), key: data.sync.key };
      writeAll(data);
      this.queueEverything();
    },

    /**
     * Merge data downloaded from Firebase into the local data.
     * Rule for each item: the one with the NEWER updatedAt wins. Items we don't have yet are added.
     * Returns how many items changed.
     */
    mergeRemote(remote) {
      const data = readAll();
      let changed = 0;

      for (const name of COLLECTIONS) {
        const list = data[name];
        for (const incoming of remote.collections[name] || []) {
          const index = list.findIndex((item) => item.id === incoming.id);
          if (index < 0) {
            // A category/plan with the same name but a different id is the same thing created on two devices: skip the copy
            const sameNameExists = (name === 'categories' || name === 'goals') && !incoming.deleted &&
              list.some((item) => !item.deleted && item.name === incoming.name && item.type === incoming.type);
            if (sameNameExists) continue;
            list.push(incoming);
            changed += 1;
          } else if (incoming.updatedAt > list[index].updatedAt) {
            list[index] = incoming;
            data.sync.outbox = data.sync.outbox.filter((entry) => entry !== `${name}/${incoming.id}`); // remote won: no need to upload ours
            changed += 1;
          }
        }
      }

      const incomingProfile = remote.profile;
      if (incomingProfile && incomingProfile.updatedAt > ((data.profile && data.profile.updatedAt) || 0)) {
        data.profile = { ...(data.profile || {}), ...incomingProfile };
        data.sync.outbox = data.sync.outbox.filter((entry) => entry !== 'profile/profile');
        changed += 1;
      }

      if (changed > 0) {
        writeAll(data);
        notifyData();
      }
      return changed;
    },
  };
}
