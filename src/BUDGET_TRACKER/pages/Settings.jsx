// SETTINGS tab (main list). Each row opens a sub-screen that App.jsx shows:
//   Customize look -> AppearanceSettings · Database -> FirebaseSetup · Notes -> NotesManager
//   Categories -> CategoryManager · Savings plans -> GoalsManager
// Profile (name + photo), and CSV export / import are handled right here.
import { useRef, useState } from 'react';
import Icon from '../components/ui/Icon';
import Avatar from '../components/Avatar';
import ImportSheet from '../components/ImportSheet';
import InstallHelpSheet from '../components/InstallHelpSheet';
import { useInstallApp } from '../hooks/useInstallApp';
import { useData } from '../hooks/useBudgetData';
import { analyzeCsv, buildCsv, downloadCsv } from '../utils/csv';
import { fileToSmallDataUrl, isImageUrl } from '../utils/image';

// A tappable row:  [icon]  Title / small text  >
function SettingsRow({ icon, title, sub, onClick }) {
  return (
    <button onClick={onClick} className="mt-2.5 flex w-full items-center gap-3 rounded-2xl border bt-border-line bt-bg-surface80 p-3.5 text-left text-sm">
      <span className="grid h-[38px] w-[38px] place-items-center rounded-xl bt-bg-blush"><Icon name={icon} size={19} /></span>
      <div className="flex-1">
        {title}
        <small className="block text-[11px] bt-text-mute">{sub}</small>
      </div>
      <Icon name="chevR" size={18} />
    </button>
  );
}

// `onOpen('appearance' | 'categories' | 'goals' | 'notes' | 'firebase')` makes App.jsx show that sub-screen
// `ask(dialog)` shows the "are you sure?" popup (see App.jsx)
export default function Settings({ onOpen, ask }) {
  const { profile, saveProfile, transactions, categories, goals, notes, mode, firebaseSettings, syncStatus, logout } = useData();
  const [name, setName] = useState(profile.name);
  const [message, setMessage] = useState('');
  const [urlOpen, setUrlOpen] = useState(false);   // is the "photo web address" box open?
  const [photoUrl, setPhotoUrl] = useState('');
  const fileInput = useRef(null);
  const csvInput = useRef(null);
  const app = useInstallApp();                // "Install app" row
  const [installHelp, setInstallHelp] = useState(false);
  const [importing, setImporting] = useState(null); // { fileName, analysis } while the import popup is open

  // A photo file was picked: shrink it to a tiny low-quality text and save it in the profile
  async function onPhotoPicked(event) {
    const file = event.target.files && event.target.files[0];
    event.target.value = ''; // so the same file can be picked again later
    if (!file) return;
    try {
      const text = await fileToSmallDataUrl(file);
      await saveProfile({ photo: text });
      setMessage(`Photo saved (${(text.length / 1024).toFixed(1)} KB).`);
    } catch (error) {
      setMessage(error.message);
    }
  }

  // Use a picture from the internet instead (only the web address is saved)
  async function applyPhotoUrl() {
    if (!isImageUrl(photoUrl)) {
      setMessage('Enter a full web address starting with http:// or https://');
      return;
    }
    await saveProfile({ photo: photoUrl.trim() });
    setPhotoUrl('');
    setUrlOpen(false);
    setMessage('Photo set from the web address.');
  }

  function exportCsv() {
    downloadCsv(buildCsv(transactions, goals));
    setMessage('CSV downloaded ✓');
  }

  // A CSV file was picked: read it and show what it contains (nothing is saved until the user confirms)
  async function onCsvPicked(event) {
    const file = event.target.files && event.target.files[0];
    event.target.value = ''; // so the same file can be picked again later
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) {
      setMessage('That file is larger than 4 MB. Split it into smaller CSV files.');
      return;
    }
    try {
      const text = await file.text();
      setImporting({ fileName: file.name, analysis: analyzeCsv(text, { transactions, categories, goals }) });
      setMessage('');
    } catch {
      setMessage('That file could not be read.');
    }
  }

  // INSTALL APP: opens the browser's install dialog; when the browser has none, show the manual steps
  async function installApp() {
    if (app.installed) {
      setMessage('The app is already installed on this device ✓');
    } else if (app.canInstall) {
      const accepted = await app.install();
      setMessage(accepted ? 'Installing… the app will appear on your home screen ✓' : 'Install cancelled.');
    } else {
      setInstallHelp(true);
    }
  }

  // LOG OUT: disconnect Firebase and delete everything saved on this device
  function askLogout() {
    const connected = mode === 'firebase';
    ask({
      title: 'Log out?',
      text: connected
        ? 'You will be disconnected from Firebase and everything saved on this device will be removed. Your data stays safe in your Firebase database: connect again to bring it back.'
        : 'Everything saved on this device (transactions, notes, plans, photo and settings) will be deleted permanently. This cannot be undone. Export a CSV first if you need a copy.',
      confirmLabel: connected ? 'Log out' : 'Delete all & log out',
      onConfirm: async () => {
        const result = await logout(); // waiting changes are uploaded first when Firebase is connected
        if (!result.ok) {
          // some changes could not be uploaded (offline?): ask again before throwing them away
          ask({
            title: 'Some changes are not uploaded',
            text: `${result.pending} change${result.pending === 1 ? '' : 's'} could not be uploaded to Firebase (offline?). If you log out now they will be lost.`,
            confirmLabel: 'Log out anyway',
            onConfirm: () => logout(true),
          });
        }
      },
    });
  }

  // Text under "Database": where the data lives + sync state
  let databaseText = 'This device only · tap to connect Firebase';
  if (mode === 'firebase') {
    const waiting = syncStatus.pending > 0 ? ` · ${syncStatus.pending} waiting` : '';
    const state = syncStatus.state === 'offline' ? 'offline' : syncStatus.state === 'error' ? 'problem' : syncStatus.state === 'syncing' ? 'syncing' : 'synced';
    databaseText = `Firebase · ${state}${waiting}`;
  }

  return (
    <div>
      <h2 className="mb-2.5 text-[15px] font-bold">Settings</h2>

      {/* Notes are the first thing in Settings */}
      <SettingsRow icon="note" title="Notes" sub={`${notes.length} note${notes.length === 1 ? '' : 's'}`} onClick={() => onOpen('notes')} />

      {/* profile: photo + name (the name is saved when the field loses focus) */}
      <div className="bt-glass mt-2.5">
        <div className="flex items-center gap-3">
          <button aria-label="Change photo" onClick={() => fileInput.current && fileInput.current.click()}>
            <Avatar photo={profile.photo} name={profile.name} size={64} />
          </button>
          <div className="min-w-0 flex-1">
            <small className="text-xs bt-text-mute">Your name</small>
            <input
              className="bt-field mt-1"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => saveProfile({ name: name.trim() || 'Friend' })}
            />
          </div>
        </div>

        <input ref={fileInput} type="file" accept="image/*" className="hidden" onChange={onPhotoPicked} />
        <div className="mt-3 flex flex-wrap gap-2">
          <button className="bt-btn-ghost !px-3 !py-2 text-xs" onClick={() => fileInput.current && fileInput.current.click()}>Upload photo</button>
          <button className="bt-btn-ghost !px-3 !py-2 text-xs" onClick={() => setUrlOpen(!urlOpen)}>Use image address</button>
          {profile.photo && (
            <button className="bt-btn-ghost !px-3 !py-2 text-xs" onClick={() => saveProfile({ photo: '' })}>Remove photo</button>
          )}
        </div>

        {urlOpen && (
          <div className="mt-2.5 flex gap-2">
            <input className="bt-field" placeholder="https://example.com/me.jpg" value={photoUrl} onChange={(e) => setPhotoUrl(e.target.value)} />
            <button className="bt-btn-primary shrink-0 !px-4 !py-2 text-sm" onClick={applyPhotoUrl}>Use</button>
          </div>
        )}
        <p className="bt-hint mt-2">An uploaded photo is shrunk to 160×160 px at low quality, so it stays only a few KB.</p>

        {/* log out: disconnects Firebase and removes all data from this device */}
        <button className="bt-btn-ghost mt-3 w-full bt-text-danger" onClick={askLogout}>Log out</button>
      </div>

      <SettingsRow
        icon="phone"
        title="Install app"
        sub={app.installed ? 'Already installed ✓' : app.canInstall ? 'Tap to install on this device' : 'Add it to your home screen'}
        onClick={installApp}
      />
      <SettingsRow icon="sliders" title="Customize look" sub="Theme, icons, bottom bar, colours…" onClick={() => onOpen('appearance')} />
      <SettingsRow icon="database" title="Database" sub={databaseText} onClick={() => onOpen('firebase')} />
      <SettingsRow icon="tag" title="Manage categories" sub={`${categories.expense.length} expense · ${categories.income.length} income`} onClick={() => onOpen('categories')} />
      <SettingsRow icon="target" title="Manage savings plans" sub={`${goals.length} plan${goals.length === 1 ? '' : 's'}`} onClick={() => onOpen('goals')} />
      <SettingsRow icon="download" title="Export data as CSV" sub={`${transactions.length} transactions`} onClick={exportCsv} />
      <SettingsRow icon="upload" title="Import data from CSV" sub="Add transactions from a CSV file" onClick={() => csvInput.current && csvInput.current.click()} />
      <input ref={csvInput} type="file" accept=".csv,text/csv,text/plain" className="hidden" onChange={onCsvPicked} />

      {message && <p className="bt-hint mt-2">{message}</p>}

      {installHelp && <InstallHelpSheet onClose={() => setInstallHelp(false)} />}
      {importing && <ImportSheet fileName={importing.fileName} analysis={importing.analysis} onClose={() => setImporting(null)} />}
    </div>
  );
}
