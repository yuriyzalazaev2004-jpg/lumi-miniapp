import React, { useEffect, useState } from 'react';
import { Cake, ChartNoAxesColumn, ChefHat, ChevronRight, Dumbbell, Flame, Grid2X2, HandCoins, Heart, Repeat2, Target, UserRound } from 'lucide-react';
import { adminApi } from '../lumi-admin.js';
import { dayLabel, doneOn, keys, kindOf, list, money, occurrence, repeats, shift, when } from './model.js';
import { field, required } from './records.js';
import { Add, Heading, Ring, Rows, Section, Tabs } from './ui.jsx';

export const services = {
  kitchen: ['Моя кухня', ChefHat, 'Запасы, рецепты и меню'],
  habits: ['Привычки', Flame, 'Серии и календарь активности'],
  goals: ['Мои цели', Target, 'Личные цели и накопления'],
  sport: ['Спорт', Dumbbell, 'Журнал тренировок'],
  subscriptions: ['Регулярные платежи', Repeat2, 'Подписки и счета'],
  debts: ['Долги', HandCoins, 'Суммы и погашения'],
  birthday: ['Дни рождения', Cake, 'Даты и поздравления'],
  stats: ['Аналитика', ChartNoAxesColumn, 'Активность и выполненные задачи'],
  cycle: ['Календарь цикла', Heart, 'История и прогноз'],
};
const recordKinds = { sport: 'sport', birthday: 'birthday', debts: 'debt', subscriptions: 'subscription' };

export function Directory({ navigate }) {
  return <div className="flow"><Heading title="Сервисы" subtitle="Организуйте важное" icon={Grid2X2}/>
    <div className="service-grid">{Object.entries(services).map(([page, [title, Icon, description]]) =>
      <button className="card service" data-service={page} key={page} onClick={() => navigate(page)}><span className="glyph"><Icon size={20}/></span>
        <strong>{title}</strong><small>{description}</small><ChevronRight className="service-arrow" size={16}/></button>)}</div>
  </div>;
}
export function Journal({ page, items, actions, store, today }) {
  const [title, Icon, subtitle] = services[page];
  const kind = recordKinds[page];
  const rows = items.filter(row => kindOf(row) === kind).sort(when);
  const balance = row => Math.max(0, Number(row.amount) - Number(row.paid || 0)) || 0;
  const upcoming = row => occurrence(row, today);
  function markPayment(row) {
    const date = upcoming(row) || row.date;
    if (!date) return;
    actions.attempt(() => store.update(keys.items, value => list(value).map(item => {
      if (item.id !== row.id) return item;
      if (!repeats(item)) return { ...item, done: !item.done };
      const dates = item.completedDates || [];
      return { ...item, done: item.date === date ? false : item.done,
        completedDates: doneOn(item, date) ? dates.filter(day => day !== date) : [...dates, date] };
    })));
  }
  const isRecurring = kind === 'subscription' || kind === 'birthday';
  if (isRecurring) rows.sort((a, b) => (upcoming(a) || '9999').localeCompare(upcoming(b) || '9999'));
  const nearest = isRecurring ? rows.find(upcoming) : null;
  const detail = row => [
    dayLabel(isRecurring ? upcoming(row) || row.date : row.date),
    row.time, kind === 'sport' && (row.minutes || row.duration) ? (row.minutes || row.duration) + ' мин' : '',
    kind === 'debt' && row.counterparty, kind === 'debt' && 'Погашено: ' + money(row.paid),
    kind === 'subscription' && ({ daily: 'Ежедневно', weekly: 'Еженедельно', monthly: 'Ежемесячно', yearly: 'Ежегодно' }[row.repeat] || 'Без повтора'), row.notes,
  ].filter(Boolean).join(' · ');
  const addLabels = { sport: 'Тренировка', subscription: 'Платёж', debt: 'Долг', birthday: 'День рождения' };
  return <div className="flow"><Heading title={title} subtitle={subtitle} icon={Icon}/>
    <div className="hero journal-cover"><div>
      <small>{{sport: 'Всего тренировок', birthday: 'Ближайший день рождения', subscription: 'Ближайший платёж', debt: 'Остаток по долгам'}[kind]}</small>
      <h2>{kind === 'debt' ? money(rows.reduce((sum, row) => sum + balance(row), 0))
        : kind === 'sport' ? rows.length : nearest?.title || 'Пока нет записей'}</h2>
      {nearest && <p>{dayLabel(upcoming(nearest))}</p>}
    </div><span className="journal-emblem"><Icon size={30}/></span></div>
    <Section title="Записи" action={<Add onClick={() => actions.item(kind)}>{addLabels[kind]}</Add>}>
      <Rows rows={kind === 'subscription' ? rows.map(row => ({ ...row, done: Boolean(doneOn(row, upcoming(row) || row.date)) })) : rows}
        {...actions.itemRows} leading={kind !== 'subscription' ? () => <span className="row-mark"><Icon size={15}/></span> : undefined}
        detail={detail} toggle={kind === 'subscription' ? markPayment : undefined}
        amount={kind === 'debt' ? row => money(balance(row)) : kind === 'subscription' ? row => money(row.amount) : undefined}/>
    </Section>
  </div>;
}

export const defaultReminder = { enabled: false, time: '09:00', daysBefore: 1 };
export function useReminders({ auth, tg, items, habits, settings, today, sync }) {
  const [status, setStatus] = useState('');
  const encoded = JSON.stringify(settings);
  const source = JSON.stringify(items);
  const habitSource = JSON.stringify(habits);
  useEffect(() => {
    if (auth.status !== 'verified' || sync !== 'synced') return;
    let ignore = false;
    const timer = setTimeout(async () => {
      const options = { ...JSON.parse(encoded), timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC' };
      const events = JSON.parse(source).filter(row => row.id && row.title && ['task', 'event', 'subscription', 'birthday'].includes(kindOf(row)) && (!row.done || repeats(row)))
        .filter(row => !doneOn(row, occurrence(row, today)))
        .map(row => ({ id: String(row.id), title: String(row.title).slice(0, 150), date: occurrence(row, today),
          kind: kindOf(row) === 'subscription' ? 'payment' : kindOf(row) === 'birthday' ? 'birthday' : 'task' }));
      const habitDay = shift(today, Number(options.daysBefore) || 0);
      for (const habit of JSON.parse(habitSource)) {
        if (!habit.id || !habit.title || habit.dates?.includes(habitDay)) continue;
        events.push({ id: 'habit-' + habit.id, title: String(habit.title).slice(0, 150), date: habitDay, kind: 'task' });
      }
      try {
        await adminApi(tg.initData, 'sync_reminders', { settings: options,
          events: events.filter(row => row.date).sort(when).slice(0, 100) });
        if (!ignore) setStatus('Настройки отправлены в Telegram.');
      } catch {
        if (!ignore) setStatus('Сервис Telegram-напоминаний недоступен. Настройки сохранены на устройстве.');
      }
    }, 1200);
    return () => { ignore = true; clearTimeout(timer); };
  }, [auth.status, encoded, habitSource, source, tg, today, sync]);
  return status;
}
export function Profile({ theme, changeTheme, auth, sync, reminderStatus, reminderSettings, actions, store, tg, onImport }) {
  const verified = auth.status === 'verified';
  function editReminder() {
    actions.setEditor({ title: 'Telegram-напоминания', initial: { ...reminderSettings, enabled: String(Boolean(reminderSettings.enabled)) },
      fields: [
        field('enabled', 'Уведомления', null, { options: [['false', 'Выключены'], ['true', 'Включены']] }),
        required('time', 'Время', 'time'), required('daysBefore', 'За сколько дней напоминать', 'number', { min: 0, max: 30 }),
      ],
      save: value => {
        store.update(keys.reminders, current => ({ ...current, ...value, enabled: value.enabled === 'true' }));
      } });
  }
  return <div className="flow"><Heading title="Профиль" subtitle="Настройки LUMI" icon={UserRound}/>
    <section className="card profile-cover"><span className="avatar-chip">{auth.user?.first_name?.slice(0, 1) || <UserRound size={28}/>}</span><span>
      <strong>{auth.user?.first_name || 'Гость'}</strong><small>{verified ? 'Вход через Telegram подтверждён' : 'Данные хранятся на этом устройстве'}</small>
    </span></section>
    <Section className="card" title="Оформление"><Tabs options={[[ 'dark', 'Тёмная'], ['light', 'Светлая'], ['system', 'Системная']]}
      value={theme} onChange={changeTheme} label="Тема оформления"/></Section>
    <Section title="Синхронизация" className="card"><p className="muted">{syncText(sync)}</p>{store.canImport() && <button className="secondary" onClick={onImport}>Перенести локальные записи</button>}</Section>
    <Section title="Напоминания" className="card">
      <p className="muted">{verified ? `Уведомления ${reminderSettings.enabled ? 'включены' : 'выключены'}.` : 'Откройте LUMI из Telegram, чтобы настроить уведомления.'}</p>
      {verified && <div className="button-row"><button className="secondary" onClick={editReminder}>Настроить</button>
        {typeof tg?.requestWriteAccess === 'function' && <button className="secondary" onClick={() => actions.attempt(() => tg.requestWriteAccess())}>Разрешить сообщения</button>}</div>}
      {verified && reminderStatus && <p role="status" className="muted">{reminderStatus}</p>}
    </Section>
  </div>;
}
export function syncText(sync) {
  return {
    synced: 'Данные синхронизированы', syncing: 'Синхронизация…', loading: 'Подключение к облаку…',
    local: 'Локальное сохранение', error: 'Синхронизация недоступна. Изменения сохранены на устройстве.',
  }[sync];
}

export function Activity({ items, habits, goals, today }) {
  const [period, setPeriod] = useState('week');
  const start = shift(today, period === 'week' ? -6 : -29);
  const rows = items.filter(row => row.date >= start && row.date <= today);
  const tasks = rows.filter(row => kindOf(row) === 'task');
  const workouts = rows.filter(row => kindOf(row) === 'sport');
  const taskCount = tasks.filter(row => row.done).length;
  const days = Array.from({ length: period === 'week' ? 7 : 30 }, (_, index) => shift(start, index));
  const activity = days.map(date => ({ date, count: rows.filter(row => row.date === date && (row.done || kindOf(row) === 'sport')).length +
    habits.filter(row => row.dates?.includes(date)).length }));
  const maximum = Math.max(1, ...activity.map(day => day.count));
  const counts = [
    ['Отметок привычек', habits.reduce((sum, habit) => sum + (habit.dates || []).filter(day => day >= start && day <= today).length, 0)],
    ['Тренировок', workouts.length],
    ['Целей достигнуто всего', goals.filter(goal => goal.target > 0 && Number(goal.amount) >= Number(goal.target)).length],
  ];
  return <div className="flow"><Heading title="Аналитика" subtitle="Активность и цели" icon={ChartNoAxesColumn}/>
    <Tabs options={[[ 'week', 'Неделя'], ['month', 'Месяц']]} value={period} onChange={setPeriod} label="Период активности"/>
    <div className="card habit-summary"><div><small>Задачи за период</small><h2>{taskCount} из {tasks.length}</h2></div>
      <Ring value={tasks.length ? Math.round(100 * taskCount / tasks.length) : 0}/></div>
    <Section title="Активность по дням" className="card"><div className="habit-bars activity-bars">{activity.map(({date, count}) =>
      <div key={date} title={dayLabel(date) + ' · ' + count}><i style={{'--bar': 100 * count / maximum + '%'}}/>
        {period === 'week' && <small>{date.slice(-2)}</small>}</div>)}</div></Section>
    <div className="split metrics">{counts.map(([label, value]) => <div className="card" key={label}><small>{label}</small><strong>{value}</strong></div>)}</div>
  </div>;
}
