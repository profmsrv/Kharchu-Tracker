// Small text helpers.
//
// Money:  12500 -> "₹12,500"  (Indian digit grouping).
// The currency symbol is a user setting (Settings -> Customize look -> Currency).
// BUDGET_TRACKER.jsx calls setCurrencySymbol() whenever that setting changes.
let currencySymbol = '₹';

export function setCurrencySymbol(symbol) {
  currencySymbol = symbol || '₹';
}

export function getCurrencySymbol() {
  return currencySymbol;
}

export function fmt(amount) {
  const sign = amount < 0 ? '-' : '';
  const rounded = Math.round(Math.abs(amount));
  return sign + currencySymbol + rounded.toLocaleString('en-IN');
}

/** "lunch with ravi" -> "Lunch with ravi" (only the first letter changes) */
export function capitalize(text) {
  const value = String(text || '');
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : value;
}
