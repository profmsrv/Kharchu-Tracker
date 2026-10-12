# BUDGET_TRACKER

A personal income & expense tracker for the browser: **React + Tailwind CSS**, mobile-first, no account needed.

- Data is **always saved on your device first** (localStorage), so the app opens instantly and works offline.
- Optionally connect **your own Firebase Firestore** (Settings → Database) for backup and sync between devices. Offline changes upload automatically when the internet returns.
- **No keys are stored in the source code.** Your Firebase config is pasted inside the app and kept in your own browser.

The whole app is **one self-contained folder** with a single default export, so it drops into any React + Tailwind project.

## Features

- **Phone Back button stays inside the app** – closes a popup, leaves a sub-screen, returns to Home; on Home a second quick Back exits
- **Home** – profile photo, balance, income/expense, savings plans, the last 7 days of transactions and **See all** = every transaction right on Home (grouped by day, 50 at a time)
- **Period filter** – Week / Month / Year / **Custom range** (pick any two dates). Shown on Home, Budget and Insights; the choice filters every screen
- **Transactions** – tap = details · swipe **left** = edit · swipe **right** = delete (with confirmation)
- **Add / edit sheet** – guided flow: amount → category → note & date
- **Budget** – 5 charts (Rings, Donut, Bar, Trend line, Radar) chosen from popup pickers
- **Insights** – savings rate, daily average, top category, biggest expense, previous-period comparison, search
- **Notes** – any number of notes in a **full-screen editor** (Save / Delete at the top, above the keyboard). Text is auto-kept as a draft while you type
- **Savings plans** – name, icon, colour, target, note. Each plan has its own category: **income** in it grows the plan, **expenses** reduce it. Tap a plan on Home for its full insights, including a month-by-month chart of the contributions **since the day the plan started**
- **Profile** – name and photo (uploaded photos are shrunk to a tiny low-quality text; or use an image web address) and **Log out**
- **Log out** – asks for confirmation, disconnects Firebase and deletes everything the app saved on this device. With Firebase connected, waiting changes are uploaded first; if they cannot be uploaded (offline) it asks again before discarding them
- **Never lose typing** – an unfinished "Add transaction" is restored if you reopen it within 30 seconds; notes keep drafts until you Save
- The Budget tab remembers the last chart type and data
- **Categories** – icon, colour and name (Settings → Manage categories; there are no category limits any more). 50+ icons (EMI, fashion, motorcycle, health, self development ...) and a **Quick add** list of common names (Phone, Work related Expenditure, EMI, Fuel, Groceries, Fashion, Regular Bills, Beverages, To Mother, Self Electrical Projects, Health, Body Care, Household Appliances, Vacation, Local Transport, Motorcycle, Unknown, Investment, Lent, Debt Clear, Self Dev, Donation ...): tap one to fill the form
- **Customize look** – 11 options, 11 accent colours, 4 animated backgrounds, 3 Add-button styles (see section 6)
- **Database** – connect, change or disconnect your Firebase account; live sync status
- **CSV export and import** (import reads this app's file and most bank files; duplicates are skipped; saved locally and uploaded to Firebase)
- **8 themes**: System, Light, Dark, Midnight, Aurora, Dusk, Sage, Mist · first-launch popup asking where data should live

---

## 1. Use it in your React project

Requirements: React 18, Tailwind CSS (v3 or v4) and the `firebase` package (v10+).
Firebase is loaded lazily and only runs if the user connects a database, but Vite needs it installed to build.

```bash
npm i firebase
```

1. Copy this folder to `src/BUDGET_TRACKER/`.
2. Make sure Tailwind scans it (the usual `./src/**/*.{js,jsx}` already does).
3. Render it:

```jsx
import BUDGET_TRACKER from './BUDGET_TRACKER/BUDGET_TRACKER.jsx';
ReactDOM.createRoot(document.getElementById('root')).render(<BUDGET_TRACKER />);
```

The app does not touch your `tailwind.config.js`, `index.css`, `<html>` or any other global. Its colours, cards,
buttons and animations are scoped under `.bt-root` in `budget-tracker.css`.

**Starting from nothing:** `npm create vite@latest my-budget -- --template react`, then `npm i firebase`,
`npm i -D tailwindcss@3 postcss autoprefixer && npx tailwindcss init -p`, set `content: ['./index.html', './src/**/*.{js,jsx}']`,
add the three `@tailwind` lines to `src/index.css`, copy this folder into `src/`, render `<BUDGET_TRACKER />`.

---

## 2. How the data is stored and synced

```
   screens ──read/write──►  LOCAL STORE (localStorage "bt-data")  ◄── always the source the UI uses
                                   │
                                   │ background, only if Firebase is connected
                                   ▼
                            SYNC ENGINE  ◄──►  your Firestore
```

### The identification key (version key)
- Every local edit gives the data a **new random key** (`sync.key`) and queues the changed item in the **outbox**.
- Firebase stores one tiny document, `settings/sync`, containing the key of the newest data (`versionKey`).
- The app remembers the key both sides had at the last sync (`sync.syncedKey`).

### At app start
1. The UI loads from localStorage immediately. **Nothing is downloaded.**
2. In the background the engine reads **only the key** from Firebase (one read).
3. Same key as remembered → nothing changed → done.
   Different key → another device changed data → download **only the new/modified items** (those uploaded after the last visit) and merge them.

### When you change data
1. The change is saved locally together with the queue entry and the new key (one single write).
2. About 1.5 s later (when online) the queued items are uploaded and the new key is published.
   The key is written with a **compare-and-set**: if another device published first, the engine downloads its changes, merges, and retries.

### When the internet is lost
Edits keep working. They are saved locally, the key changes, the outbox grows. The sync status shows *Offline · N changes waiting*.
When the connection returns (browser "online" event, tab becoming visible, or a 30-second retry) the engine compares keys, merges anything new
from Firebase, and uploads the outbox by itself.

### Why data is not lost or corrupted
| Risk | Protection |
|---|---|
| Crash between saving data and queueing the upload | data + outbox + key are saved in **one** localStorage write |
| Damaged local data | previous copy kept in `bt-data-prev`; used automatically if the main copy cannot be read |
| Upload interrupted half-way | the outbox is cleared only after success; uploads use fixed ids, so a retry **never duplicates** |
| Edit made while an upload is running | an item leaves the outbox only if it was not changed again meanwhile |
| Two devices upload at once | compare-and-set on the key → loser downloads, merges, retries |
| Deleting on one device | deletes are saved as small "tombstones" so they sync and never come back |
| Two devices create the default categories | defaults have fixed ids (`cat-expense-food`…) and the oldest possible timestamp, so real data always wins and no duplicates appear |
| Log out loses unsent changes | logout uploads waiting changes first and asks again if that is impossible |
| Storage full | the save fails loudly (red banner) and nothing is half-written |
| Popup closed by accident / page left | drafts (`bt-drafts`) keep unsaved notes and an unfinished transaction. Drafts are never uploaded; **Save** writes the real data, which then syncs |

**Conflict rule:** if the *same item* is edited on two devices, the **newer edit wins**; everything else is merged.
`tests/sync-test.mjs` checks all of this with two simulated devices and a fake Firebase (`npx tsx src/BUDGET_TRACKER/tests/sync-test.mjs`). `tests/csv-test.mjs` and `tests/back-test.mjs` (`node tests/back-test.mjs`) cover the CSV import and the Back button.

---

## 3. Connect Firebase (inside the app)

1. In the Firebase Console create a project and add **Build → Firestore Database** (production mode).
2. **Project settings → Your apps → Web (`</>`)** → copy the `firebaseConfig` block.
3. In the app open **Settings → Database**, paste the block, keep (or regenerate) the **User ID**, tap **Connect Firebase**.
4. Copy the **security rules** shown there (they contain your User ID) into **Firestore → Rules → Publish**.

Everything already on your device is uploaded automatically (and anything already in that database is merged in).

**Deleting:** when you delete a transaction, category, plan or note, its document is **really removed** from Firestore (nothing is left behind). So that your other devices also learn about it, the id is written to one small document `settings/deleted`; a device that syncs reads it and removes the item locally. Entries older than 60 days are dropped from that list (a device that stays offline for longer than that may still show the old item). The first sync after updating also removes the old `{ deleted: true }` marker documents once. Your security rules do not need to change.

**Connection details:** once connected, Settings → Database shows the saved connection with the secret values half hidden (`AIzaSyD######`). Project ID, auth domain and storage bucket are shown in full, and so is the **User ID** (with a Copy button). A *Copy security rules* button copies the rules (they contain your full User ID) without displaying it.

**Never used Firebase?** Settings → Database contains a detailed step-by-step guide (create project → create Firestore database → publish rules → register a web app → copy the config → connect).

### Change your Firebase account
Settings → Database → **Change Firebase account** → paste the other project's config → *Switch to this account*.
All data on this device is copied to the new project and merged with whatever is there. The old project's data stays untouched.
**Use this device only** disconnects (data stays; changes made while disconnected upload if you reconnect).

### Security notes (no login)
There is no authentication. The rules limit access to one path (`users/<User ID>/…`) and the User ID is long and random, which is fine for personal use.
Anyone who knows both your project config and your User ID could read/write that data, so keep them private. For real protection, add
Firebase Authentication and change the rule to `request.auth.uid == userId` (only `services/firebaseRemote.js` and the rules change).

---

## 4. Folder structure

```
BUDGET_TRACKER/
├── BUDGET_TRACKER.jsx        # ENTRY (default export): DataProvider -> Shell (theme + look) -> App
├── budget-tracker.css        # scoped styles (.bt-root): colours, dark theme, all look & feel options
├── App.jsx                   # controller: tab, period, popups, back layers; derives period-filtered transactions
├── services/
│   ├── localStore.js         # the local database (localStorage) + outbox/key bookkeeping + merge
│   ├── syncEngine.js         # the sync rules (pull, push, retry, offline handling)
│   ├── firebaseRemote.js     # the low-level Firestore calls (lazy-loaded)
│   ├── firebaseSettings.js   # save/load/parse the pasted config, security rules text
│   └── backStack.js          # the phone Back-button engine (history layers, no React)
├── hooks/
│   ├── useBudgetData.jsx     # DataProvider + useData(): local store + sync engine + actions
│   ├── useTheme.js           # theme id -> dark or light
│   └── useBackButton.js      # useBackButton() + useBackLayer(): React side of the Back button
├── constants/                # icons.js, defaults.js, appearance.js (look options), themes.js (the 8 themes), backButton.js (Back-button settings)
├── utils/                    # dates.js (week/month/year/custom), format.js (money, capitalize), csv.js, plans.js, image.js
├── services/drafts.js        # unsaved-text drafts (localStorage only)
├── components/
│   ├── TransactionRow · PeriodBar · BottomNav · AddSheet · DetailSheet · GoalSheet · Avatar · StoragePrompt
│   ├── BackgroundFx · BackToast · ThemePicker · ImportSheet
│   ├── charts/Charts.jsx     # CHARTS catalogue + 5 SVG charts
│   └── ui/                   # Icon, Sheet, OptionSheet, Pick, ConfirmDialog, Segmented, ChipGrid
├── pages/                    # Home, Budget, Insights, Settings, AppearanceSettings, CategoryManager,
│                             # GoalsManager, GoalDetail, NotesManager, FirebaseSetup
├── tests/                    # sync-test.mjs, back-test.mjs, csv-test.mjs, usage-test.mjs, averages-test.mjs
├── firestore.rules.example
└── LICENSE
```

**Reading order:** `BUDGET_TRACKER.jsx` → `hooks/useBudgetData.jsx` → `App.jsx` → one page (e.g. `pages/Home.jsx`) → `services/localStore.js` → `services/syncEngine.js`.
Every file starts with a comment explaining what it does.

---

## 5. Data flow (screens)

```
 LOCAL STORE ──subscribe()──► DataProvider state ──context──► useData() ──► screens
      ▲                                                                       │
      └────────────── actions (addTransaction, updateGoal, …) ◄───────────────┘
 App.jsx ── getRange(period) ──► txs = transactions in the period ──► Home, Budget, Insights
```

- **Period filter:** `period = { t: 'week'|'month'|'year', o: offset }` → `getRange()` → filtered `txs`. and year (×12).
- **Theme and look:** `profile.theme` / `profile.appearance` → `Shell` in `BUDGET_TRACKER.jsx` → class `bt-dark` and `data-*` attributes on `.bt-root` → CSS variables.
- **First run:** default categories, two savings plans and a profile are created once and never re-created.

---

## 6. Customize look (Settings → Customize look)

| Option | Values |
|---|---|
| Category icons | Round · Soft · Square |
| Bottom bar layout | Notch · Flat · Floating |
| Bottom bar colour | Dark · Accent · Glass · Light |
| **Add button** | Gold · Glow · Glass |
| Accent colour | Plum · Orchid · Rose · Crimson · Sunset · Amber · Forest · Teal · Ocean · Indigo · Graphite |
| Corners | Sharp · Normal · Round |
| **Background** | Gradient · Plain · **Aurora · Orbs · Waves · Stars** (animated, pure CSS) |
| Balance card | Gradient · Solid · Outline |
| **List spacing** | Compact · Comfortable · Spacious |
| Animations | On · Off (also freezes the animated backgrounds) |
| Currency symbol | ₹ · $ · € · £ |

The **theme** (System, Light, Dark, Midnight, Aurora, Dusk, Sage, Mist) is chosen in Settings → Appearance. Each theme is a block of colour variables in `budget-tracker.css`; add a theme in `constants/themes.js` plus a `.bt-root[data-theme='...']` block.

They are saved in the profile (so they sync with Firebase). To add an option: `constants/appearance.js` → a row in `pages/AppearanceSettings.jsx` → CSS in `budget-tracker.css` → a `data-` attribute in `BUDGET_TRACKER.jsx`.

---

## 7. Data model

Local (`localStorage` key `bt-data`) and Firestore use the same items:

| List | Fields |
|---|---|
| `transactions` | `id`, `type` ("expense"\|"income"), `title`, `category` (name), `amount`, `date` ("YYYY-MM-DD"), `createdAt`, `updatedAt`, `goalId` (only on a savings plan move) |
| `categories` | `id`, `type`, `name`, `icon`, `color`, `order`, `goalId` (set on the two categories every savings plan creates), `system` (true for *Moved to plan* / *From plan*), `updatedAt` |
| `goals` (savings plans) | `id`, `name`, `icon`, `color`, `target`, `start` (already saved before tracking), `note`, `updatedAt`. The saved amount is **calculated**: `start + income - expenses` of the plan's category (`utils/plans.js`) |
| `notes` | `id`, `title`, `body`, `createdAt`, `updatedAt` |
| `profile` | `name`, `photo` (small `data:image/jpeg` text or a web address), `theme`, `appearance`, `seeded`, `updatedAt` |
| deleted item | `{ id, deleted: true, updatedAt }` (hidden from screens) |

Firestore paths: `users/{User ID}/transactions|categories|goals|notes/{id}`, `users/{User ID}/settings/profile`, `users/{User ID}/settings/sync` (`{ versionKey }`).
Uploaded documents also get `syncedAt` (server time), used to download only what changed. Other localStorage keys: `bt-data-prev` (backup), `bt-firebase` (pasted config + User ID), `bt-onboarded`, `bt-drafts` (unsaved notes / transaction), `bt-chart` (last chart choice).

### Savings plans and their categories
Creating a plan *Phone* also creates an income category *Phone* and an expense category *Phone* (fixed ids `cat-income-plan-<id>`, `cat-expense-plan-<id>`).
Add money = an income in *Phone*; take money out = an expense in *Phone*. Renaming a plan renames its categories and moves its transactions; deleting a plan removes its categories.
A plan name must differ from every other category name.

### Money into / out of a plan (ONE transaction, bank icon)
Moving money between your balance and a plan is saved as **one transaction** (not two) with a bank icon and the plan's id (`goalId`):

| You add (category = the plan) | The single transaction that is saved | Balance | Plan |
|---|---|---|---|
| **Income** | expense **Moved to plan: &lt;plan&gt;** (category *Moved to plan*) | goes **down** | goes **up** |
| **Expense** (only if the plan holds that much) | income **From plan: &lt;plan&gt;** (category *From plan*) | goes **up** | goes **down** |

Example: put ₹1,000 into *Phone* → one entry "Moved to plan: Phone"; the plan grows by ₹1,000 and your balance drops by ₹1,000.
Take ₹200 out → one entry "From plan: Phone"; the plan drops by ₹200 and your balance rises by ₹200. Where you then spend that ₹200 is up to you: add it as a normal expense.

- The plan screen charts the net contribution of **every month since the plan's start** (creation day or first entry, whichever is earlier); the chart scrolls sideways for older plans.
- The plan's saved amount is **calculated** from these entries (`utils/plans.js`), so deleting or editing an entry simply recalculates the plan. There is no hidden second entry.
- In the normal Add popup, plan categories are shown in their **own "Savings plans" section** (wide tiles, coloured dashed border, progress bar), clearly different from normal categories. Before saving, the user is asked *"Is this for the savings plan?"* (No = pick another category). The plan screen's **Add money / Take money out** buttons skip the question.
- Taking out more than the plan holds is refused (also when editing an amount).
- A plan move keeps its type and category when edited (amount, date and note can change). Renaming a plan updates the titles of its moves.
- **Total Balance** (`balanceOf`) counts these entries. **Income/expense statistics** (Home tiles, Insights, charts) ignore them, because moving money is not income or spending.
- *Moved to plan* / *From plan* are hidden **system categories** (`system: true`): not offered in the Add popup, not deletable, not in Budget.
- Data saved by the previous version as two linked entries is converted automatically into one entry the first time the app starts.

---

## 7b. The Back button

The phone's Back button used to leave the page. Now every screen that sits on top registers a **back layer** (`useBackLayer`, `hooks/useBackButton.js`; engine in `services/backStack.js`):
popup → Settings sub-screen → savings plan → any tab other than Home → Home. On Home, Back shows "Press back again to exit"; a second Back within 2 seconds exits (an installed app closes). Set `exitOnDoubleBack: false` in `constants/backButton.js` to never exit on Back.
Browsers ignore history entries added before the first tap, so the engine starts after the first touch. `tests/back-test.mjs` checks it with a fake history.

## 7c. CSV import / export

Settings → **Export data as CSV** writes `Date, Type, Category, Note, Amount, Plan`.
Settings → **Import data from CSV** reads a file, shows a summary (new / already in the app / unreadable rows / new categories) and only saves after you tap Import.
It understands comma, semicolon and tab files; headers such as Date, Type, Category, Note/Description/Narration, Amount, Debit, Credit, Plan; dates like `2026-10-10`, `10/10/2026`, `10 Oct 2026`; amounts like `₹1,23,456.50` or `(500)`; and a minus sign when there is no Type column. Unknown categories are created. Plan moves are linked to their plan again. Everything is written in one save to localStorage and queued for Firebase, so a second import of the same file adds nothing. Limit: 4 MB per file.

## 8. Limitations
- localStorage holds roughly 5 MB per site: plenty for years of personal data. Export CSV for backups.
- Deleted items stay as tiny tombstones so deletions can sync.
- Two devices editing the *same item* at the same time: the newer edit wins.

## 9. Troubleshooting

| Problem | Fix |
|---|---|
| Status "Problem" / permission-denied | Rules not published, or the User ID in the rules ≠ the one in the app. Settings → Database shows the exact rules |
| "Could not find apiKey and projectId" | Paste the whole `firebaseConfig` block from the Firebase Console |
| A photo does not show | an image web address must be public and start with http(s)://; uploading a file always works |
| Status stays "Offline" | Check the internet; the app retries by itself every 30 s and when you open the tab |
| Looks unstyled | Make sure Tailwind scans `src/BUDGET_TRACKER/**/*.jsx` |
| Data differs after changing User ID | A new User ID is a new empty folder; the old data is under the old ID |

## License
MIT. See `LICENSE` (replace `<your name>`).

## Category averages

Insights → **Category averages** lists, for the selected period (week, month, year or custom range), every category with its **total**, its **number of transactions** and its **average** = total / number of transactions (spending and income separately). Example: Food has 100, 200 and 300 in October → total 600, 3 transactions, average 200. The Budget tab has the same numbers as the chart data **Average spent** and **Average income** (bar chart) and **Average spent** (radar). The maths is in `utils/averages.js`.
