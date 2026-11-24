import { dayKey, keys, kindOf, list, titleOf, uid } from './model.js';

export const names = {
  task: 'Задача', event: 'Событие', income: 'Доход', expense: 'Расход', debt: 'Долг',
  subscription: 'Платёж', birthday: 'День рождения', sport: 'Тренировка', kitchen: 'Продукт',
};
export const field = (name, label, type, extra) => ({ name, label, type, ...extra });
export const required = (name, label, type, extra) => field(name, label, type, { required: true, ...extra });
const amount = required('amount', 'Сумма, ₽', 'number', { min: 0.01, step: 0.01 });
const categories = ['Продукты', 'Дом', 'Транспорт', 'Здоровье', 'Досуг', 'Работа', 'Прочее'];

export function actions(store, setEditor, setError) {
  function attempt(work) {
    try { work(); } catch { setError('Не удалось сохранить данные на устройстве.'); }
  }
  function upsert(key, row, original) {
    store.update(key, value => original
      ? list(value).map(x => x.id === original.id ? { ...x, ...row } : x)
      : [{ ...row, id: uid() }, ...list(value)]);
  }
  function remove(key, row, label = titleOf(row)) {
    if (window.confirm('Удалить «' + label + '»?')) attempt(() => {
      store.update(key, value => list(value).filter(x => x.id !== row.id));
    });
  }
  function toggle(key, row) {
    attempt(() => store.update(key, value => list(value).map(x => x.id === row.id ? { ...x, done: !x.done } : x)));
  }
  function edit(key, { title, fields, initial, original, validate }) {
    setEditor({ title, fields, initial, keepInitial: !original, save: value => {
      validate?.(value);
      upsert(key, value, original);
    } });
  }
  function item(kind, original, date = dayKey()) {
    const finance = ['income', 'expense', 'debt', 'subscription'].includes(kind);
    const initial = { date, kind, type: finance ? 'finance' : kind === 'task' ? 'general' : kind,
      createdAt: dayKey(), done: false, repeat: kind === 'subscription' ? 'monthly' : '', ...original };
    if (kind === 'sport' && original) initial.minutes = original.minutes ?? original.duration;
    if (finance && original) initial.amount = Math.abs(Number(original.amount) || 0);
    const fields = [required('title', kind === 'birthday' ? 'Имя' : 'Название'), required('date', 'Дата', 'date')];
    if (finance) fields.push(amount);
    if (kind === 'debt') fields.push(field('counterparty', 'Кому / от кого'), field('paid', 'Уже погашено, ₽', 'number', { min: 0, step: 0.01 }));
    if (['income', 'expense'].includes(kind)) fields.push(field('category', 'Категория', 'text', { list: 'finance-categories' }));
    if (['subscription', 'task', 'event', 'sport'].includes(kind)) fields.push(field('repeat', 'Повтор', null, {
      options: [['', 'Один раз'], ['daily', 'Каждый день'], ['weekly', 'Каждую неделю'], ['monthly', 'Каждый месяц'], ['yearly', 'Каждый год']],
    }));
    if (['task', 'event', 'sport', 'subscription'].includes(kind)) fields.push(field('time', 'Время', 'time'));
    if (kind === 'sport') fields.push(field('minutes', 'Длительность, мин', 'number', { min: 1 }));
    fields.push(field('notes', 'Заметка', 'textarea'));
    edit(keys.items, { title: (original ? 'Изменить' : 'Добавить') + ' · ' + names[kind],
      initial: { ...initial, kind }, original, fields,
      validate: row => {
        row.kind = kind;
        if (kind === 'debt' && Number(row.paid) > row.amount) throw new Error('Погашенная сумма превышает долг.');
      } });
  }
  function habit(original) {
    edit(keys.habits, { title: original ? 'Изменить привычку' : 'Новая привычка',
      initial: { dates: [], ...original }, original, fields: [required('title', 'Название')] });
  }
  function goal(original, defaultType = 'personal') {
    edit(keys.goals, { title: original ? 'Изменить цель' : 'Новая цель', original,
      initial: { goalType: original ? 'savings' : defaultType, amount: 0, ...original },
      fields: [required('title', 'Название'), field('goalType', 'Тип цели', null, { options: [['personal', 'Личная'], ['savings', 'Накопления']] }),
        required('target', 'Целевое значение', 'number', { min: 0.01, step: 0.01 }),
        required('amount', 'Текущее значение', 'number', { min: 0, step: 0.01 }),
        field('date', 'Срок', 'date'), field('notes', 'Заметка', 'textarea')] });
  }
  return { item, habit, goal, edit, upsert, remove, toggle, attempt, setEditor,
    itemRows: { edit: row => item(kindOf(row), row), remove: row => remove(keys.items, row) } };
}
export { categories };
