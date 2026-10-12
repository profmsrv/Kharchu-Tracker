// First-launch question: keep data on this device (default) or connect your own Firebase database?
// App.jsx shows it once. "Set up Firebase" takes the user to Settings -> Database.
import Sheet from './ui/Sheet';
import Icon from './ui/Icon';

export default function StoragePrompt({ onFirebase, onLocal }) {
  return (
    <Sheet center onClose={onLocal}>
      <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bt-bg-blush">
        <Icon name="database" size={24} />
      </div>
      <b className="text-[17px]">Where should your data live?</b>
      <p className="mb-5 mt-2 text-[13px] bt-text-mute">
        By default everything is saved on this device, in your browser. Connect your own Firebase database to sync
        across devices and keep a backup. You can change this any time in Settings.
      </p>
      <div className="grid gap-2.5">
        <button className="bt-btn-primary" onClick={onFirebase}>Set up Firebase</button>
        <button className="bt-btn-ghost" onClick={onLocal}>Use this device only</button>
      </div>
    </Sheet>
  );
}
