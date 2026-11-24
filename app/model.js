export const keys = {
  items: 'lumi-items', habits: 'lumi-habits-v1', goals: 'lumi-goals-v1',
  catalog: 'lumi-kitchen-catalog-v1', shopping: 'lumi-kitchen-shopping-v1',
  meals: 'lumi-kitchen-plans-v1', periods: 'lumi-cycle-periods-v1',
  cycleSettings: 'lumi-cycle-settings-v1', cycleNotes: 'lumi-cycle-notes-v1',
  reminders: 'lumi-reminder-settings-v1',
};

export const dayKey = (date = new Date()) => [
  date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'),
  String(date.getDate()).padStart(2, '0'),
].join('-');
export const asDate = day => new Date(day + 'T12:00:00');
export function shift(day, days) {
  const date = asDate(day);
  date.setDate(date.getDate() + days);
  return dayKey(date);
}
export const dayLabel = (day, options = { day: 'numeric', month: 'short' }) =>
  day && Number.isFinite(+asDate(day)) ? asDate(day).toLocaleDateString('ru-RU', options) : 'Без даты';
const rubles = new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 2 });
export const money = value => rubles.format(Number(value) || 0);
export const total = rows => rows.reduce((sum, row) => sum + (Number(row.amount) || 0), 0);
export const list = value => Array.isArray(value) ? value.filter(row => row && typeof row === 'object') : [];
export const uid = () => crypto.randomUUID?.() || String(Date.now() + Math.random());
export const titleOf = row => row.title || row.name || row.recipeName || row.recipe || 'Запись';
export const when = (a, b) => `${a.date || ''} ${a.time || ''}`.localeCompare(`${b.date || ''} ${b.time || ''}`);
export function kindOf(row) {
  if (row.icon === 'birthday' || row.type === 'birthday') return 'birthday';
  if (row.type === 'sport' || row.type === 'kitchen') return row.type;
  if (row.kind) return row.kind;
  if (row.type === 'finance') return row.income || Number(row.amount) >= 0 ? 'income' : 'expense';
  if (['event', 'subscription', 'debt'].includes(row.type)) return row.type;
  return 'task';
}
export const repeats = row => ['daily', 'weekly', 'monthly', 'yearly'].includes(row.repeat);
export const doneOn = (row, day) => repeats(row)
  ? row.completedDates?.includes(day) || (row.date === day && row.done) : row.done;
export function occurrence(row, from) {
  if (!row.date) return '';
  if (row.date >= from) return row.date;
  if (row.repeat === 'daily') return from;
  if (row.repeat === 'weekly') {
    const difference = (asDate(row.date).getDay() - asDate(from).getDay() + 7) % 7;
    return shift(from, difference);
  }
  const yearly = kindOf(row) === 'birthday' || row.repeat === 'yearly';
  if (!yearly && row.repeat !== 'monthly') return '';
  const original = asDate(row.date);
  const now = asDate(from);
  let year = now.getFullYear();
  let month = yearly ? original.getMonth() : now.getMonth();
  const at = () => dayKey(new Date(year, month, Math.min(original.getDate(), new Date(year, month + 1, 0).getDate()), 12));
  if (at() < from) {
    if (yearly) year += 1;
    else month += 1;
  }
  return at();
}
export function streak(dates, day) {
  const done = new Set(dates);
  let cursor = done.has(day) ? day : shift(day, -1);
  let count = 0;
  while (done.has(cursor)) {
    count += 1;
    cursor = shift(cursor, -1);
  }
  return count;
}
