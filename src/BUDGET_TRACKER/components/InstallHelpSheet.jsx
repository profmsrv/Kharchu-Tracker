// Step-by-step help for when the browser has no install dialog to open (iPhone, or the browser has not offered it yet).
import Sheet from './ui/Sheet';
import { useInstallApp } from '../hooks/useInstallApp';

export default function InstallHelpSheet({ onClose }) {
  const { isIos } = useInstallApp();
  const steps = isIos
    ? ['Open this page in Safari.', 'Tap the Share button (the square with an arrow).', 'Choose “Add to Home Screen”, then tap Add.']
    : [
        'Open the browser menu (the ⋮ button).',
        'Tap “Install app” or “Add to Home screen”.',
        'Confirm. If you do not see it: the app must be opened over HTTPS (or localhost) from the production build, and not be installed already.',
      ];
  return (
    <Sheet onClose={onClose}>
      <b className="text-[17px]">Install the app</b>
      <p className="text-[13px] bt-text-mute">Your browser did not offer the install dialog, so install it from the browser menu:</p>
      <ol className="list-decimal space-y-2 pl-5 pt-1 text-[13px] leading-relaxed">
        {steps.map((step) => <li key={step}>{step}</li>)}
      </ol>
      <button className="bt-btn-primary mt-1" onClick={onClose}>Got it</button>
    </Sheet>
  );
}
