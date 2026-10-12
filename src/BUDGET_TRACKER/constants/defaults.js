// Starting data. It is written ONCE, the first time the app runs
// (see seedIfNeeded() in services/localStore.js).
// After that the user owns the data: they can edit or delete all of it.
//
// Every default has a FIXED id (e.g. "cat-expense-groceries"). That way, when the same user
// opens the app on a second device, both devices agree on which item is which and no duplicates appear.

// Colours offered when creating a category or a savings plan
export const COLORS = ['#f0605d', '#f3a33a', '#6c4ad0', '#2eae7b', '#3b9be0', '#d04aa0', '#8a7a93', '#14b8a6'];

// `icon` is a key from constants/icons.js.
export const DEFAULT_CATEGORIES = [
  { id: 'cat-expense-groceries', type: 'expense', name: 'Groceries', icon: 'cart', color: '#f0605d' },
  { id: 'cat-expense-shopping', type: 'expense', name: 'Shopping', icon: 'bag', color: '#f3a33a' },
  { id: 'cat-expense-rent', type: 'expense', name: 'Rent', icon: 'home', color: '#6c4ad0' },
  { id: 'cat-expense-food', type: 'expense', name: 'Food', icon: 'food', color: '#2eae7b' },
  { id: 'cat-expense-travel', type: 'expense', name: 'Travel', icon: 'bus', color: '#3b9be0' },
  { id: 'cat-expense-bills', type: 'expense', name: 'Bills', icon: 'bulb', color: '#d04aa0' },
  { id: 'cat-expense-other', type: 'expense', name: 'Other', icon: 'sparkle', color: '#8a7a93' },
  { id: 'cat-income-salary', type: 'income', name: 'Salary', icon: 'case', color: '#2eae7b' },
  { id: 'cat-income-freelance', type: 'income', name: 'Freelance', icon: 'laptop', color: '#3b9be0' },
  { id: 'cat-income-gift', type: 'income', name: 'Gift', icon: 'gift', color: '#d04aa0' },
];

// No starter savings plans: the user creates their own (Home -> Savings plan, or Settings -> Manage savings plans)

// Quick-add suggestions shown in Settings -> Manage categories (tap one to fill the form with its name and icon)
export const CATEGORY_SUGGESTIONS = [
  { name: 'Phone', icon: 'phone' },
  { name: 'Work related Expenditure', icon: 'case' },
  { name: 'EMI', icon: 'card' },
  { name: 'Fuel', icon: 'fuel' },
  { name: 'Groceries', icon: 'cart' },
  { name: 'Other expenditure', icon: 'dots' },
  { name: 'Food', icon: 'food' },
  { name: 'Fashion', icon: 'shirt' },
  { name: 'Regular Bills', icon: 'receipt' },
  { name: 'Beverages', icon: 'bottle' },
  { name: 'To Mother', icon: 'user' },
  { name: 'Self Electrical Projects', icon: 'chip' },
  { name: 'Health', icon: 'medical' },
  { name: 'Body Care', icon: 'drop' },
  { name: 'Household Appliances', icon: 'plug' },
  { name: 'Vacation', icon: 'umbrella' },
  { name: 'Local Transport', icon: 'bus' },
  { name: 'Motorcycle', icon: 'bike' },
  { name: 'Unknown', icon: 'help' },
  { name: 'Investment', icon: 'trendup' },
  { name: 'Lent', icon: 'lend' },
  { name: 'Debt Clear', icon: 'checkcircle' },
  { name: 'Self Dev', icon: 'sprout' },
  { name: 'Donation', icon: 'hand' },
];

// `seeded: true` is how we remember that the defaults were already written
export const DEFAULT_PROFILE = { name: 'Friend', theme: 'system', seeded: true };
