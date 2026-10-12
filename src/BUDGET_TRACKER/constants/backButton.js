// Settings of the phone's Back button (see hooks/useBackButton.js and services/backStack.js).
export const BACK_BUTTON = {
  exitOnDoubleBack: true,                  // on the Home screen: press Back twice quickly to leave the app
  exitWindowMs: 2000,                      // how quickly the second press must come
  exitHint: 'Press back again to exit',
  stayHint: 'You are on the Home screen',  // shown instead when exitOnDoubleBack is false
};
