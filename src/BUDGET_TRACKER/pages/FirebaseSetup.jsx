// DATABASE screen (Settings -> Database).
//
// Data is ALWAYS saved on this device. Here the user can ALSO connect their own Firebase database,
// so the data is backed up and shared between devices (see services/syncEngine.js).
// The Firebase config is pasted here and kept ONLY in this browser's localStorage, never in the source code.
//
//   not connected -> explanation + "ConnectForm"
//   connected     -> connection details (secret values half hidden with ###), sync status, "Sync now",
//                    "Change Firebase account", "Use this device only"
import { useState } from 'react';
import Icon from '../components/ui/Icon';
import { useData } from '../hooks/useBudgetData';
import { maskHalf, parseFirebaseConfig, randomUserId, rulesFor } from '../services/firebaseSettings';

// The form where a Firebase config is pasted. Used to connect AND to switch to another account.
function ConnectForm({ buttonText, initialUserId, onConnect }) {
  const [pasted, setPasted] = useState('');
  const [userId, setUserId] = useState(initialUserId);
  const [copied, setCopied] = useState(false);
  const [message, setMessage] = useState('');

  function connect() {
    try {
      const config = parseFirebaseConfig(pasted); // throws a readable error if the text is wrong
      if (!userId.trim()) throw new Error('Enter a User ID (any long random text).');
      onConnect(config, userId.trim());
      setPasted('');
      setMessage('');
    } catch (err) {
      setMessage(err.message);
    }
  }

  async function copyRules() {
    try {
      await navigator.clipboard.writeText(rulesFor(userId));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setMessage('Select the rules text and copy it manually.');
    }
  }

  return (
    <div className="bt-glass flex flex-col gap-2.5">
      <small className="text-xs bt-text-mute">Paste your firebaseConfig</small>
      <textarea
        className="bt-field bt-field-mono"
        rows={7}
        value={pasted}
        onChange={(e) => setPasted(e.target.value)}
        placeholder={'const firebaseConfig = {\n  apiKey: "...",\n  projectId: "...",\n  appId: "..."\n};'}
      />

      <small className="text-xs bt-text-mute">User ID (your private folder name in the database)</small>
      <div className="flex gap-2">
        <input className="bt-field" value={userId} onChange={(e) => setUserId(e.target.value)} />
        <button className="bt-btn-ghost shrink-0 text-xs" onClick={() => setUserId(randomUserId())}>New</button>
      </div>

      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <small className="text-xs bt-text-mute">Security rules to publish (Firestore → Rules)</small>
          <button className="flex items-center gap-1 text-xs font-semibold" onClick={copyRules}>
            <Icon name={copied ? 'check' : 'copy'} size={13} /> {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
        <pre className="overflow-x-auto rounded-xl border bt-border-line bt-bg-surface80 p-3 text-[11px] leading-relaxed">{rulesFor(userId)}</pre>
      </div>

      <button className="bt-btn-primary" onClick={connect} disabled={!pasted.trim()}>{buttonText}</button>
      {message && <p className="text-xs bt-text-danger">{message}</p>}
    </div>
  );
}

// Step-by-step instructions for someone who has never used Firebase (menu names can differ slightly between versions)
function FirebaseGuide({ defaultOpen }) {
  const step = 'mb-2.5';
  return (
    <details className="bt-glass my-3" open={defaultOpen}>
      <summary className="cursor-pointer text-sm font-bold">Step-by-step: create your own Firebase database (about 5 minutes, free)</summary>
      <ol className="mt-3 list-decimal space-y-2.5 pl-5 text-[13px] leading-relaxed">
        <li className={step}>
          <b>Open Firebase.</b> Go to <b>console.firebase.google.com</b> and sign in with your Google account.
        </li>
        <li className={step}>
          <b>Create a project.</b> Click <b>Create a project</b> (or <b>Add project</b>), type any name such as <i>my-budget-tracker</i> and press <b>Continue</b>.
          If it asks about Google Analytics you can switch it <b>off</b>, then press <b>Create project</b>. Wait until it says the project is ready and press <b>Continue</b>.
        </li>
        <li className={step}>
          <b>Create the database.</b> In the left menu open <b>Build → Firestore Database</b> (in newer versions: <b>Databases &amp; Storage → Firestore</b>) and press <b>Create database</b>.
        </li>
        <li className={step}>
          <b>Choose the location.</b> Keep the database ID as <i>(default)</i>. Pick the location nearest to you (in India: <b>asia-south1 (Mumbai)</b>). The location cannot be changed later. Press <b>Next</b>.
        </li>
        <li className={step}>
          <b>Security rules.</b> Choose <b>Start in production mode</b> and press <b>Create</b>. Wait about a minute until the database opens.
        </li>
        <li className={step}>
          <b>Publish the rules.</b> Open the <b>Rules</b> tab, delete everything in the editor, paste the rules from this screen (use the <b>Copy</b> button in the form below, they already contain your User ID) and press <b>Publish</b>.
        </li>
        <li className={step}>
          <b>Register a web app.</b> Click the gear icon next to “Project Overview” → <b>Project settings</b>. Scroll to <b>Your apps</b> and click the web icon <b>&lt;/&gt;</b>.
          Type a nickname (for example <i>budget-tracker</i>), leave “Firebase Hosting” unchecked and press <b>Register app</b>.
        </li>
        <li className={step}>
          <b>Copy the config.</b> You now see some code containing <i>const firebaseConfig = {'{'} apiKey: "...", ... {'}'};</i>. Select and copy <b>only that block</b>
          (from <i>const firebaseConfig</i> to the closing <i>{'};'}</i>). You do <b>not</b> need to install anything or write <i>initializeApp</i>: this app starts Firebase for you.
        </li>
        <li className={step}>
          <b>Connect.</b> Come back to this screen, paste the block in the box, keep the User ID and press <b>Connect Firebase</b>. The status should change to “Up to date”.
        </li>
        <li className={step}>
          <b>Check it.</b> In the Firebase console open <b>Firestore Database → Data</b>: a collection <b>users</b> appears, with your User ID inside it and your transactions, notes and plans.
        </li>
      </ol>
      <p className="bt-hint mt-2">
        The config is not a password: your data is protected by the security rules and your private User ID. Keep the User ID safe, it is the name of your data folder.
      </p>
    </details>
  );
}

// The saved connection, with the important values half-hidden:  AIzaSyD######
function ConnectionDetails({ settings }) {
  const [copied, setCopied] = useState(false);
  const [copiedId, setCopiedId] = useState(false);
  const { config, userId } = settings;

  // [label, text shown]. Secret values are masked, the project name and domains are shown in full.
  const rows = [
    ['Project ID', config.projectId],
    ['Auth domain', config.authDomain],
    ['Storage bucket', config.storageBucket],
    ['API key', maskHalf(config.apiKey)],
    ['App ID', maskHalf(config.appId)],
    ['Sender ID', maskHalf(config.messagingSenderId)],
  ].filter(([, value]) => value);

  async function copyUserId() {
    try {
      await navigator.clipboard.writeText(userId);
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 1500);
    } catch { /* clipboard blocked */ }
  }

  // The rules contain the full User ID, so they are copied but not displayed
  async function copyRules() {
    try {
      await navigator.clipboard.writeText(rulesFor(userId));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* clipboard blocked */ }
  }

  return (
    <div className="bt-glass mt-2.5">
      <b className="text-[13px]">Connection details</b>
      <div className="mt-2">
        {rows.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-3 border-b bt-border-line py-2 text-[12px] last:border-0">
            <span className="shrink-0 bt-text-mute">{label}</span>
            <span className="break-all text-right font-mono">{value}</span>
          </div>
        ))}
      </div>
      {/* the User ID is the name of YOUR folder in the database: shown in full so it can be checked and copied */}
      <div className="mt-1 rounded-xl border bt-border-line bt-bg-surface80 p-3">
        <small className="block text-[11px] bt-text-mute">User ID (your private folder name in the database)</small>
        <div className="mt-1 flex items-center gap-2">
          <span className="min-w-0 flex-1 break-all font-mono text-[12px] font-semibold">{userId}</span>
          <button className="flex shrink-0 items-center gap-1 text-xs font-semibold" onClick={copyUserId}>
            <Icon name={copiedId ? 'check' : 'copy'} size={13} /> {copiedId ? 'Copied' : 'Copy'}
          </button>
        </div>
      </div>
      <button className="bt-btn-ghost mt-2.5 flex w-full items-center justify-center gap-2 text-xs" onClick={copyRules}>
        <Icon name={copied ? 'check' : 'copy'} size={14} /> {copied ? 'Copied' : 'Copy security rules'}
      </button>
    </div>
  );
}

// Turns the sync status into text for the status card
function describeStatus(syncStatus) {
  const waiting = syncStatus.pending > 0 ? ` · ${syncStatus.pending} change${syncStatus.pending === 1 ? '' : 's'} waiting` : '';
  if (syncStatus.state === 'syncing') return 'Syncing…' + waiting;
  if (syncStatus.state === 'offline') return 'Offline' + waiting;
  if (syncStatus.state === 'error') return 'Problem' + waiting;
  if (syncStatus.lastSyncAt) return `Up to date · ${new Date(syncStatus.lastSyncAt).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}${waiting}`;
  return 'Connected' + waiting;
}

export default function FirebaseSetup({ onBack, ask }) {
  const { mode, firebaseSettings, syncStatus, syncNow, connectFirebase, disconnectFirebase } = useData();
  const connected = mode === 'firebase';
  const [changing, setChanging] = useState(false); // is the "change account" form open?

  return (
    <div>
      <button className="mb-2 flex items-center gap-1 text-sm font-semibold" onClick={onBack}>
        <Icon name="chevL" size={16} /> Settings
      </button>
      <h2 className="mb-2.5 text-[15px] font-bold">Database</h2>

      {/* status card */}
      <div className="bt-glass flex items-center gap-3">
        <span className="grid h-[38px] w-[38px] place-items-center rounded-xl bt-bg-blush"><Icon name="database" size={19} /></span>
        <div className="min-w-0 flex-1">
          <b className="block text-sm">{connected ? 'Firebase' : 'This device only'}</b>
          <small className="block truncate text-[11px] bt-text-mute">
            {connected ? `${firebaseSettings.config.projectId} · ${describeStatus(syncStatus)}` : 'Saved in this browser (localStorage)'}
          </small>
        </div>
        {connected && (
          <button className="bt-btn-ghost shrink-0 !px-3 !py-2 text-xs" onClick={syncNow} disabled={syncStatus.state === 'syncing'}>Sync now</button>
        )}
      </div>
      {connected && syncStatus.message && (
        <p className={`mt-2 text-xs ${syncStatus.state === 'error' ? 'bt-text-danger' : 'bt-text-mute'}`}>{syncStatus.message}</p>
      )}

      {/* what is saved (keys half hidden) */}
      {connected && <ConnectionDetails settings={firebaseSettings} />}

      {/* how it works */}
      <p className="bt-hint my-3">
        Your data is always saved on this device first, so the app opens instantly and works offline.
        With Firebase connected, changes are also uploaded in the background. Offline changes wait and upload
        by themselves when the internet is back. Nothing is downloaded at start unless another device changed the data.
      </p>

      {/* detailed instructions for people who have never used Firebase */}
      <FirebaseGuide defaultOpen={!connected} />

      {/* not connected: first-time setup */}
      {!connected && (
        <>
          <ConnectForm buttonText="Connect Firebase" initialUserId={randomUserId()} onConnect={connectFirebase} />
        </>
      )}

      {/* connected: account tools */}
      {connected && (
        <div className="flex flex-col gap-2.5">
          {!changing ? (
            <button className="bt-btn-ghost" onClick={() => setChanging(true)}>Change Firebase account</button>
          ) : (
            <>
              <p className="bt-hint">
                Paste the config of the other Firebase project. Everything on this device is copied to it
                (and anything already there is merged in). Your old Firebase data stays where it is.
              </p>
              <ConnectForm
                buttonText="Switch to this account"
                initialUserId={randomUserId()}
                onConnect={(config, userId) => { connectFirebase(config, userId); setChanging(false); }}
              />
              <button className="bt-btn-ghost" onClick={() => setChanging(false)}>Cancel</button>
            </>
          )}

          <button
            className="bt-btn-ghost"
            onClick={() => ask({
              title: 'Disconnect Firebase?',
              text: 'The app keeps working with the data on this device. Your Firebase data is not deleted.',
              confirmLabel: 'Disconnect',
              onConfirm: disconnectFirebase,
            })}
          >Use this device only</button>
        </div>
      )}

      <p className="bt-hint mt-4">
        Your Firebase config is stored only in this browser (localStorage). It is never sent anywhere except to Firebase.
      </p>
    </div>
  );
}
