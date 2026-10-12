// APP = the controller. It decides WHAT is on screen.
//
//   - holds the "UI state": current tab, selected period, which popup is open
//   - filters the transactions by the selected period ONCE and gives the result to the pages,
//     so the period chosen on Home also filters Budget and Insights
//   - shows popups: add/edit, details, "are you sure?", and the first-launch question
//
// Data and actions come from useData() (hooks/useBudgetData.jsx).
//
// THE BACK BUTTON: the phone's Back button must go one step back INSIDE the app, never to the previous website.
// Every screen that sits "on top" registers a back layer (useBackLayer, see hooks/useBackButton.js):
//   popups (Sheet.jsx) -> sub-screens of Settings -> a savings plan opened in full -> any tab other than Home -> Home.
// On Home, Back shows "Press back again to exit"; a second quick Back leaves the app.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useData } from './hooks/useBudgetData';
import { getRange, inRange } from './utils/dates';
import { fmt } from './utils/format';
import { useBackButton, useBackLayer } from './hooks/useBackButton';
import { BACK_BUTTON } from './constants/backButton';
import BottomNav from './components/BottomNav';
import BackgroundFx from './components/BackgroundFx';
import BackToast from './components/BackToast';
import AddSheet from './components/AddSheet';
import DetailSheet from './components/DetailSheet';
import StoragePrompt from './components/StoragePrompt';
import ConfirmDialog from './components/ui/ConfirmDialog';
import Home from './pages/Home';
import Budget from './pages/Budget';
import Insights from './pages/Insights';
import Settings from './pages/Settings';
import CategoryManager from './pages/CategoryManager';
import GoalsManager from './pages/GoalsManager';
import NotesManager from './pages/NotesManager';
import FirebaseSetup from './pages/FirebaseSetup';
import GoalDetail from './pages/GoalDetail';
import AppearanceSettings from './pages/AppearanceSettings';

// Remembers (in localStorage) that the first-launch popup was already shown
const ONBOARDED_KEY = 'bt-onboarded';
function wasOnboarded() {
  try {
    return localStorage.getItem(ONBOARDED_KEY) === '1';
  } catch {
    return true; // storage unavailable: don't nag
  }
}

// The page that was open when the app was closed ("bt-last-page"): the app opens on it next time
const LAST_PAGE_KEY = 'bt-last-page';
const TABS = ['home', 'budget', 'insights', 'settings'];
const SETTINGS_VIEWS = ['main', 'appearance', 'categories', 'goals', 'notes', 'firebase'];
function readLastPage() {
  try {
    const saved = JSON.parse(localStorage.getItem(LAST_PAGE_KEY) || 'null') || {};
    const tab = TABS.includes(saved.tab) ? saved.tab : 'home';
    const settingsView = tab === 'settings' && SETTINGS_VIEWS.includes(saved.settingsView) ? saved.settingsView : 'main';
    return { tab, settingsView, goalViewId: typeof saved.goalViewId === 'string' ? saved.goalViewId : null };
  } catch {
    return { tab: 'home', settingsView: 'main', goalViewId: null };
  }
}

export default function App() {
  const { error, clearError, mode, transactions, deleteTransaction, deleteCategory } = useData();

  // ----- UI state -----
  const [last] = useState(readLastPage);                      // where the app was closed last time
  const [tab, setTab] = useState(last.tab);                     // 'home' | 'budget' | 'insights' | 'settings'
  const [period, setPeriod] = useState({ t: 'month', o: 0 });   // the week/month/year filter
  const [settingsView, setSettingsView] = useState(last.settingsView); // 'main' | 'appearance' | 'categories' | 'goals' | 'notes' | 'firebase'
  const [categoryType, setCategoryType] = useState('expense');  // which toggle CategoryManager shows
  const [goalViewId, setGoalViewId] = useState(last.goalViewId);           // id of the savings plan shown full screen (null = none)

  // ----- the Back button (see the comment at the top) -----
  const [hint, setHint] = useState('');   // "Press back again to exit"
  const hintTimer = useRef(null);
  function showHint(text) {
    setHint(text);
    clearTimeout(hintTimer.current);
    hintTimer.current = setTimeout(() => setHint(''), BACK_BUTTON.exitWindowMs);
  }
  useBackButton(showHint);
  // Order matters: the layer declared LAST is closed FIRST.
  useBackLayer(tab !== 'home', () => { setTab('home'); setSettingsView('main'); });
  useBackLayer(tab === 'settings' && settingsView !== 'main', () => setSettingsView('main'));
  useBackLayer(Boolean(goalViewId), () => setGoalViewId(null));

  // Remember the open page, and start every page at its top (the scroll position of the page before must not carry over)
  const mainRef = useRef(null);
  useEffect(() => {
    try { localStorage.setItem(LAST_PAGE_KEY, JSON.stringify({ tab, settingsView, goalViewId })); } catch { /* storage full */ }
    if (mainRef.current) mainRef.current.scrollTo(0, 0);
  }, [tab, settingsView, goalViewId]);

  // ----- popups (null = closed) -----
  const [adding, setAdding] = useState(null);       // {} = add, { initial: tx } = edit, { preset: { type, category } } = add with category chosen
  const [detailId, setDetailId] = useState(null);   // id of the transaction shown in the details popup
  const [confirm, setConfirm] = useState(null);     // { title, text, confirmLabel?, onConfirm }
  const [askStorage, setAskStorage] = useState(() => !wasOnboarded()); // first-launch question

  // ----- derived data -----
  const range = useMemo(() => getRange(period), [period]);
  const txs = useMemo(() => transactions.filter((tx) => inRange(tx, range)), [transactions, range]);
  const detailTx = detailId ? transactions.find((tx) => tx.id === detailId) : null;

  // ----- helpers -----
  // Go to the Settings tab and open one of its sub-screens
  function openSettings(view) {
    setSettingsView(view);
    setTab('settings');
  }

  // Answer to the first-launch popup
  function answerStoragePrompt(wantsFirebase) {
    try { localStorage.setItem(ONBOARDED_KEY, '1'); } catch { /* ignore */ }
    setAskStorage(false);
    if (wantsFirebase) openSettings('firebase');
  }

  // Ask "Delete transaction?" (the actual delete happens only if the user confirms)
  function askDeleteTransaction(tx) {
    setConfirm({
      title: 'Delete transaction?',
      text: `${tx.title} · ${fmt(tx.amount)}` + (tx.goalId ? '. The savings plan is recalculated.' : ''),
      onConfirm: () => deleteTransaction(tx.id),
    });
  }

  function askDeleteCategory(category) {
    setConfirm({
      title: 'Delete category?',
      text: `${category.name} will be removed. Old transactions keep their name.`,
      onConfirm: () => deleteCategory(category.id),
    });
  }

  // Savings plan buttons: open the add popup with the plan's category already chosen
  function addToPlan(goal, type) {
    setAdding({ preset: { type, category: goal.name } });
  }

  // The "Add" tile in the Add-transaction popup sends the user to the category screen
  function goToCategories(type) {
    setAdding(null);
    setCategoryType(type);
    openSettings('categories');
  }

  // Props shared by the pages that list transactions (Home and Insights)
  const listProps = {
    txs, range, period, setPeriod,
    onOpen: (tx) => setDetailId(tx.id),
    onEdit: (tx) => setAdding({ initial: tx }),
    onDelete: askDeleteTransaction,
  };

  // ----- the app -----
  return (
    <div className="bt-phone">
      {/* animated page background (only drawn when Customize look -> Background is one of the animated ones) */}
      <BackgroundFx />

      {/* red banner when saving on this device failed (for example the browser storage is full) */}
      {error && (
        <div className="relative flex items-center justify-between gap-2 bt-bg-danger px-4 py-2 text-xs text-white">
          <span>Could not save: {error}</span>
          <button className="shrink-0 rounded-lg bg-white/20 px-2 py-1 font-semibold" onClick={clearError}>Dismiss</button>
        </div>
      )}

      {/* the current screen */}
      <main ref={mainRef} className="relative flex-1 overflow-y-auto px-4 pb-28 pt-[calc(18px+env(safe-area-inset-top))]">
        {/* a savings plan opened in full replaces the current screen until the user goes Back */}
        {goalViewId && (
          <GoalDetail
            goalId={goalViewId}
            onBack={() => setGoalViewId(null)}
            onAddMoney={(goal) => addToPlan(goal, 'income')}
            onWithdraw={(goal) => addToPlan(goal, 'expense')}
            onOpen={listProps.onOpen}
            onEdit={listProps.onEdit}
            onDelete={listProps.onDelete}
          />
        )}

        {!goalViewId && tab === 'home' && (
          <Home {...listProps} onManageGoals={() => openSettings('goals')} onOpenGoal={setGoalViewId} />
        )}
        {!goalViewId && tab === 'budget' && <Budget txs={txs} range={range} period={period} setPeriod={setPeriod} />}
        {!goalViewId && tab === 'insights' && <Insights {...listProps} />}

        {!goalViewId && tab === 'settings' && settingsView === 'main' && <Settings onOpen={setSettingsView} ask={setConfirm} />}
        {!goalViewId && tab === 'settings' && settingsView === 'appearance' && <AppearanceSettings onBack={() => setSettingsView('main')} />}
        {!goalViewId && tab === 'settings' && settingsView === 'categories' && (
          <CategoryManager type={categoryType} setType={setCategoryType} onBack={() => setSettingsView('main')} askDelete={askDeleteCategory} />
        )}
        {!goalViewId && tab === 'settings' && settingsView === 'goals' && <GoalsManager onBack={() => setSettingsView('main')} ask={setConfirm} onOpenGoal={setGoalViewId} />}
        {!goalViewId && tab === 'settings' && settingsView === 'notes' && <NotesManager onBack={() => setSettingsView('main')} ask={setConfirm} />}
        {!goalViewId && tab === 'settings' && settingsView === 'firebase' && <FirebaseSetup onBack={() => setSettingsView('main')} ask={setConfirm} />}
      </main>

      <BottomNav
        tab={tab}
        onTab={(id) => { setGoalViewId(null); setTab(id); if (id === 'settings') setSettingsView('main'); }}
        onAdd={() => setAdding({})}
      />

      {/* ----- popups ----- */}
      {adding && (
        <AddSheet
          key={adding.initial ? adding.initial.id : adding.preset ? `${adding.preset.type}-${adding.preset.category}` : 'new'} // a different key = a fresh form
          initial={adding.initial}
          preset={adding.preset}
          onClose={() => setAdding(null)}
          onSaved={() => setAdding(null)}
          onAddCategory={goToCategories}
        />
      )}

      {detailTx && (
        <DetailSheet
          tx={detailTx}
          onClose={() => setDetailId(null)}
          onEdit={() => { setDetailId(null); setAdding({ initial: detailTx }); }}
          onDelete={() => { setDetailId(null); askDeleteTransaction(detailTx); }}
        />
      )}

      {confirm && <ConfirmDialog {...confirm} onClose={() => setConfirm(null)} />}

      <BackToast message={hint} />

      {askStorage && mode === 'local' && (
        <StoragePrompt onFirebase={() => answerStoragePrompt(true)} onLocal={() => answerStoragePrompt(false)} />
      )}
    </div>
  );
}
