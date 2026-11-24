import React, { useEffect, useState } from 'react';
import { ArrowUpRight, CalendarDays, ChefHat, ChevronLeft, ChevronRight, Clock3, Flame, Pencil, Target, Trash2, UserRound, Wallet } from 'lucide-react';
import { asDate, dayKey, dayLabel, doneOn, keys, kindOf, list, money, occurrence, repeats, shift, total, when } from './model.js';
import { Add, Heading, IconButton, Ring, Rows, Section, Tabs } from './ui.jsx';

export function Month({ selected, onSelect, marks = {} }) {
  const [month, setMonth] = useState(() => selected.slice(0, 7) + '-01');
  useEffect(() => setMonth(selected.slice(0, 7) + '-01'), [selected]);
  const first = asDate(month);
  const offset = (first.getDay() + 6) % 7;
  const monthDays = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const dayMark = day => typeof marks === 'function' ? marks(day) : marks[day];
  const days = Math.ceil((offset + monthDays) / 7) * 7;
  function change(delta) {
    setMonth(dayKey(new Date(first.getFullYear(), first.getMonth() + delta, 1, 12)));
  }
  return <div className="card month">
    <div className="section-head"><IconButton icon={ChevronLeft} label="Предыдущий месяц" onClick={() => change(-1)}/>
      <strong>{first.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })}</strong>
      <IconButton icon={ChevronRight} label="Следующий месяц" onClick={() => change(1)}/></div>
    <div className="month-grid">{['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map(label => <small key={label}>{label}</small>)}
      {Array.from({ length: days }, (_, index) => {
        const day = shift(month, index - offset);
        const mark = dayMark(day);
        return <button key={day} aria-pressed={selected === day} aria-current={day === dayKey() ? 'date' : undefined}
          aria-label={dayLabel(day, { day: 'numeric', month: 'long', year: 'numeric' }) + (mark ? ' · ' + mark : '')}
          className={day.slice(0, 7) === month.slice(0, 7) ? '' : 'outside'} onClick={() => onSelect(day)}>
          {Number(day.slice(-2))}{mark && <i className={mark === 'Прогноз' ? 'predicted' : ''}/>}</button>;
      })}</div>
  </div>;
}
export function Week({ selected, onSelect, active }) {
  const start = shift(selected, -((asDate(selected).getDay() + 6) % 7));
  return <div className="week-strip" role="group" aria-label="Дни недели">
    {Array.from({ length: 7 }, (_, index) => {
      const day = shift(start, index);
      return <button key={day} aria-label={dayLabel(day, { weekday: 'long', day: 'numeric', month: 'long' })}
        aria-pressed={day === selected} onClick={() => onSelect(day)}>
        <small>{dayLabel(day, { weekday: 'short' })}</small><strong>{Number(day.slice(-2))}</strong>
        <i className={active?.(day) ? 'marked' : ''}/>
      </button>;
    })}
  </div>;
}

const plannerKinds = new Set(['task', 'event', 'birthday', 'sport', 'subscription']);
function onDay(items, day) {
  return items.filter(row => plannerKinds.has(kindOf(row)) && occurrence(row, day) === day).sort(when);
}
function itemDetail(row) {
  return [row.time || 'Без времени', row.notes].filter(Boolean).join(' · ');
}
function Schedule({ items, actions, selected, store }) {
  const rows = onDay(items, selected);
  const tasks = rows.filter(row => kindOf(row) === 'task').map(row => ({ ...row, done: doneOn(row, selected) }));
  function toggle(row) {
    if (!repeats(row)) { actions.toggle(keys.items, row); return; }
    actions.attempt(() => store.update(keys.items, value => list(value).map(item => {
      if (item.id !== row.id) return item;
      const checked = doneOn(item, selected);
      const dates = item.completedDates || [];
      return { ...item, done: item.date === selected ? false : item.done,
        completedDates: checked ? dates.filter(day => day !== selected) : [...dates, selected] };
    })));
  }
  const events = rows.filter(row => kindOf(row) !== 'task');
  return <>
    <Section title="Задачи" action={<Add onClick={() => actions.item('task', null, selected)}>Задача</Add>}>
      <Rows rows={tasks} {...actions.itemRows} toggle={toggle} detail={itemDetail} empty="На этот день задач нет."/>
    </Section>
    <Section title="Расписание" action={<Add onClick={() => actions.item('event', null, selected)}>Событие</Add>}>
      {events.length ? <ol className="timeline">{events.map(row => <li key={row.id}>
        <time>{row.time || '—'}</time><article className="slot">
          <div><strong>{row.title}</strong><small>{row.notes || ({ event: 'Событие', sport: 'Тренировка', birthday: 'День рождения', subscription: 'Платёж' })[kindOf(row)]}</small></div>
          <IconButton icon={Pencil} label={'Изменить: ' + row.title} onClick={() => actions.itemRows.edit(row)}/>
          <IconButton icon={Trash2} label={'Удалить: ' + row.title} onClick={() => actions.itemRows.remove(row)}/>
        </article>
      </li>)}</ol> : <Rows rows={[]} empty="Свободный день. Добавьте событие или временной слот."/>}
    </Section>
  </>;
}

export function Planner({ items, actions, today, selected, setSelected, store }) {
  const [view, setView] = useState('day');
  const marks = day => onDay(items, day).length ? 'Есть записи' : '';
  return <div className="flow"><Heading title="Мой день" subtitle="Задачи и расписание" icon={CalendarDays}/>
    <Tabs options={[[ 'day', 'День'], ['week', 'Неделя'], ['month', 'Календарь']]} value={view} onChange={setView} label="Вид расписания"/>
    {view === 'month' && <Month selected={selected} onSelect={setSelected} marks={marks}/>}
    <div className="card day-switch"><IconButton icon={ChevronLeft} label="Предыдущий день" onClick={() => setSelected(shift(selected, -1))}/>
      <button className="link" onClick={() => setSelected(today)} title="Вернуться к сегодняшнему дню">
        {selected === today ? 'Сегодня · ' : ''}{dayLabel(selected, { weekday: 'short', day: 'numeric', month: 'long' })}</button>
      <IconButton icon={ChevronRight} label="Следующий день" onClick={() => setSelected(shift(selected, 1))}/></div>
    {view !== 'month' && <Week selected={selected} onSelect={setSelected} active={marks}/>}
    {view === 'week' && <div className="week-overview">{Array.from({ length: 7 }, (_, index) => {
      const day = shift(selected, index - (asDate(selected).getDay() + 6) % 7);
      return <button key={day} onClick={() => setSelected(day)} aria-pressed={selected === day}>
        <span>{dayLabel(day, { weekday: 'short', day: 'numeric' })}</span><strong>{onDay(items, day).length}</strong></button>;
    })}</div>}
    <Schedule items={items} selected={selected} actions={actions} store={store}/>
  </div>;
}

export function Home({ user, items, habits, meals, today, navigate, actions, store }) {
  const tasks = onDay(items, today).filter(row => kindOf(row) === 'task');
  const done = tasks.filter(row => doneOn(row, today)).length;
  const checked = habits.filter(habit => habit.dates?.includes(today)).length;
  const incomes = items.filter(row => kindOf(row) === 'income');
  const expenses = items.filter(row => kindOf(row) === 'expense');
  const next = kind => items.filter(row => kindOf(row) === kind && (!row.done || repeats(row)))
    .map(row => ({ ...row, date: occurrence(row, today) }))
    .filter(row => row.date && row.date <= shift(today, 30) && !row.completedDates?.includes(row.date)).sort(when);
  const upcoming = [...next('event'), ...next('birthday'), ...next('sport')].sort(when);
  const featured = upcoming[0];
  return <div className="flow home-screen">
    <header className="home-intro">
      <button className="avatar-chip" onClick={() => navigate('profile')} aria-label="Открыть профиль">
        {user?.first_name ? user.first_name.slice(0, 1) : <UserRound size={19}/>}
      </button>
      <div><small>{dayLabel(today, { weekday: 'long', day: 'numeric', month: 'long' })}</small>
        <h1>Привет, {user?.first_name || 'друг'}</h1></div>
    </header>
    <section className="agenda-panel">
      <Week selected={today} active={day => onDay(items, day).length} onSelect={day => navigate('calendar', day)}/>
      <div className="agenda-focus">
        <div><small>Ближайшее событие</small><h2>{featured?.title || 'Свободное расписание'}</h2>
          {featured && <p><Clock3 size={14}/>{[dayLabel(featured.date), featured.time].filter(Boolean).join(' · ')}</p>}
          <button className="hero-link" onClick={() => navigate('calendar', featured?.date || today)}>Открыть расписание <ArrowUpRight size={16}/></button>
        </div>
        <Ring value={tasks.length ? Math.round(done / tasks.length * 100) : 0} label="задачи"/>
      </div>
      <p className="agenda-caption">{done} из {tasks.length} задач выполнено</p>
    </section>
    <div className="split dashboard">
      <button className="card" onClick={() => navigate('finance')}><span className="glyph mint"><Wallet size={19}/></span>
        <small>Баланс</small><strong>{money(total(incomes) - expenses.reduce((sum, row) => sum + Math.abs(Number(row.amount) || 0), 0))}</strong></button>
      <button className="card" onClick={() => navigate('habits')}><span className="glyph pink"><Flame size={19}/></span>
        <small>Привычки сегодня</small><strong>{checked} / {habits.length}</strong></button>
    </div>
    <div className="quick-grid shortcuts"><button onClick={() => navigate('kitchen')}><ChefHat size={16}/>Кухня</button>
      <button onClick={() => navigate('goals')}><Target size={16}/>Цели</button><button onClick={() => navigate('services')}>Все сервисы <ArrowUpRight size={15}/></button></div>
    <Schedule items={items} selected={today} actions={actions} store={store}/>
    <Section title="Меню на сегодня"><Rows rows={meals.filter(row => row.date === today)} detail={row => row.meal}
      empty="На сегодня блюда не запланированы."/></Section>
    <Section title="Ближайшие события"><Rows rows={upcoming.slice(0, 5)}
      detail={row => [dayLabel(row.date), row.time].filter(Boolean).join(' · ')} empty="В ближайшие 30 дней событий нет."/></Section>
    <Section title="Предстоящие платежи"><Rows rows={next('subscription').slice(0, 5)} detail={row => dayLabel(row.date)} amount={row => money(row.amount)}
      empty="В ближайшие 30 дней платежей нет."/></Section>
  </div>;
}
