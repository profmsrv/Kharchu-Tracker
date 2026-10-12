// A small floating message at the bottom of the screen, e.g. "Press back again to exit".
// App.jsx shows it for two seconds when Back is pressed on the Home screen.
export default function BackToast({ message }) {
  if (!message) return null;
  return <div className="bt-toast" role="status">{message}</div>;
}
