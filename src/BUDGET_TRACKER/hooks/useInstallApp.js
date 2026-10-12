// "Install app" (Settings -> Install app). Works with the PWA you set up with vite-plugin-pwa.
//
//   const { installed, canInstall, isIos, install } = useInstallApp();
//
//   canInstall  true when the browser has said "this app can be installed" (the event below). Needs HTTPS or localhost,
//               a valid manifest + service worker (a production build), and the app not installed yet.
//   install()   opens the browser's install dialog; after the user taps Install the app is installed. Resolves true / false.
//   installed   true when the app is already installed (or is running as an installed app)
//   isIos       iPhone/iPad have no install dialog: the user must use Share -> Add to Home Screen
//
// A web page can never install itself silently: the browser always shows its own confirmation, that is how it is protected.
// The browser sends "beforeinstallprompt" only ONCE, early, so it is caught when this file is loaded (not when Settings opens).
import { useEffect, useState } from 'react';

let deferredPrompt = null;
let installedNow = false;
const listeners = new Set();
const notify = () => listeners.forEach((callback) => callback());

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault(); // keep it, so our own button can open the dialog later
    deferredPrompt = event;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    installedNow = true;
    notify();
  });
}

function isStandalone() {
  if (typeof window === 'undefined') return false;
  const media = window.matchMedia && window.matchMedia('(display-mode: standalone)').matches;
  return Boolean(media || window.navigator.standalone);
}

export function useInstallApp() {
  const [, refresh] = useState(0);
  useEffect(() => {
    const update = () => refresh((n) => n + 1);
    listeners.add(update);
    return () => listeners.delete(update);
  }, []);

  return {
    installed: installedNow || isStandalone(),
    canInstall: Boolean(deferredPrompt),
    isIos: typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent || ''),
    async install() {
      if (!deferredPrompt) return false;
      deferredPrompt.prompt();                      // the browser's install dialog
      const choice = await deferredPrompt.userChoice;
      deferredPrompt = null;                        // a prompt can only be used once
      notify();
      return Boolean(choice && choice.outcome === 'accepted');
    },
  };
}
