import React, { useState } from 'react';
import { Check, Flame, Heart, Pencil, Sparkles, Target, Trash2, Trophy, Wallet } from 'lucide-react';
import { asDate, dayLabel, keys, list, money, shift, streak, titleOf } from './model.js';
import { field, required } from './records.js';
import { Month, Week } from './planner.jsx';
import { Add, Empty, Heading, IconButton, Ring, Rows, Section } from './ui.jsx';

export function Habits({ habits, store, today, actions }) {
  const [selected, setSelected] = useState(today);
  const [monthOpen, setMonthOpen] = useState(false);
  const marks = {};
  habits.forEach(habit => (habit.dates || []).forEach(day => { marks[day] = 'Есть выполнения'; }));
  const done = habits.filter(habit => habit.dates?.includes(today)).length;
  const best = habits.reduce((record, habit) => {
    let current = 0;
    let previous = '';
    for (const date of [...new Set(habit.dates || [])].sort()) {
      current = previous && shift(previous, 1) === date ? current + 1 : 1;
      record = Math.max(current, record);
      previous = date;
    }
    return record;
  }, 0);
  const start = shift(selected, -((asDate(selected).getDay() + 6) % 7));
  const days = Array.from({ length: 7 }, (_, index) => shift(start, index));
  function toggle(row, day = selected) {
    actions.attempt(() => store.update(keys.habits, value => list(value).map(habit => {
      if (habit.id !== row.id) return habit;
      const dates = habit.dates || [];
      return { ...habit, dates: dates.includes(day) ? dates.filter(date => date !== day) : [...dates, day] };
    })));
  }
  return <div className="flow"><Heading title="Привычки" subtitle="Ежедневный ритм" icon={Flame}/>
    <section className="card habit-overview">
      <div className="habit-summary"><div><small>Сегодня</small><h2>{done} из {habits.length} выполнено</h2></div>
        <Ring value={habits.length ? Math.round(100 * done / habits.length) : 0}/></div>
      <div className="habit-bars" aria-label="Отметки за неделю">{days.map(day => {
        const count = habits.filter(habit => habit.dates?.includes(day)).length;
        return <button key={day} onClick={() => setSelected(day)} aria-pressed={selected === day}
          aria-label={dayLabel(day) + ' · выполнено ' + count}><i style={{ '--bar': (habits.length ? count / habits.length * 100 : 0) + '%' }}/><small>{dayLabel(day, { weekday: 'short' })}</small></button>;
      })}</div>
    </section>
    <Week selected={selected} onSelect={setSelected} active={day => marks[day]}/>
    <button className="secondary month-toggle" aria-expanded={monthOpen} onClick={() => setMonthOpen(!monthOpen)}>Календарь активности</button>
    {monthOpen && <Month selected={selected} onSelect={setSelected} marks={marks}/>}
    <Section title={'Отметки · ' + dayLabel(selected)} action={<Add onClick={() => actions.habit()}/>}>
      {!habits.length && <div className="card"><Empty>Записей пока нет.</Empty></div>}
      <div className="habit-list">{habits.map(habit => {
        const dates = habit.dates || [];
        return <article className="card habit-card" key={habit.id}>
          <div className="habit-card-head"><span className="glyph"><Flame size={19}/></span><div><strong>{titleOf(habit)}</strong>
            <small>Серия {streak(dates, today)} дн. · Всего {dates.length}</small></div>
            {selected <= today && <IconButton icon={Check} label={dates.includes(selected) ? 'Снять отметку' : 'Отметить выполнение'}
              aria-pressed={dates.includes(selected)} onClick={() => toggle(habit)}/>}
            <IconButton icon={Pencil} label={'Изменить: ' + titleOf(habit)} onClick={() => actions.habit(habit)}/>
            <IconButton icon={Trash2} label={'Удалить: ' + titleOf(habit)} onClick={() => actions.remove(keys.habits, habit)}/>
          </div>
          <div className="habit-dots">{days.map(day => <button disabled={day > today} key={day}
            aria-label={titleOf(habit) + ' · ' + dayLabel(day)} aria-pressed={dates.includes(day)} onClick={() => toggle(habit, day)}>
            <span>{dates.includes(day) ? <Check size={14}/> : Number(day.slice(-2))}</span>
          </button>)}</div>
        </article>;
      })}</div>
    </Section>
    <Section title="Достижения" className="card">
      <div className="medals">{[1, 5, 10].map((days, index) => {
        const Icon = [Sparkles, Flame, Trophy][index];
        return <div key={days} className={best >= days ? 'earned' : ''}><span><Icon size={24}/></span><strong>{days} {days === 1 ? 'день' : 'дней'}</strong>
          <small>{best >= days ? 'Получено' : 'Впереди'}</small></div>;
      })}</div>
    </Section>
  </div>;
}

export function Goals({ goals, actions }) {
  const completed = goals.filter(goal => Number(goal.target) > 0 && Number(goal.amount) >= Number(goal.target)).length;
  const savings = goals.filter(row => row.goalType !== 'personal');
  return <div className="flow"><Heading title="Мои цели" subtitle="Личные цели и накопления" icon={Target}/>
    <div className="hero finance-hero ledger"><span className="ledger-mark"><Trophy size={96} strokeWidth={1}/></span><small>Всего накоплено</small>
      <strong>{money(savings.reduce((sum, goal) => sum + (Number(goal.amount) || 0), 0))}</strong>
      <p>{completed} из {goals.length} целей достигнуто</p></div>
    {[[ 'personal', 'Личные цели'], ['savings', 'Накопления']].map(([type, title]) =>
      <Section key={type} title={title} action={<Add onClick={() => actions.goal(null, type)}/>}>
        {!goals.some(row => (row.goalType || 'savings') === type) && <div className="card"><Empty>Записей пока нет.</Empty></div>}
        <div className="goal-grid">{goals.filter(row => (row.goalType || 'savings') === type).map(row => {
          const value = type === 'savings' ? money : number => Number(number) || 0;
          const percent = row.target > 0 ? Math.round(100 * (Number(row.amount) || 0) / row.target) : 0;
          const Icon = type === 'savings' ? Wallet : Target;
          return <article className="card goal-card" key={row.id}><div className="goal-top"><span className="glyph"><Icon size={19}/></span>
            <IconButton icon={Pencil} label={'Изменить: ' + titleOf(row)} onClick={() => actions.goal(row)}/>
            <IconButton icon={Trash2} label={'Удалить: ' + titleOf(row)} onClick={() => actions.remove(keys.goals, row)}/></div>
            <h3>{titleOf(row)}</h3><small>{row.date ? dayLabel(row.date) : title}</small>
            <div className="goal-values"><span><small>Достигнуто</small><strong>{value(row.amount)}</strong></span>
              <span><small>Цель</small><strong>{value(row.target)}</strong></span></div>
            <div className="progress-track"><i style={{ '--bar': Math.min(100, Math.max(0, percent)) + '%' }}/></div>
            <small>{percent}%</small>{row.notes && <small>{row.notes}</small>}
          </article>;
        })}</div>
      </Section>)}
  </div>;
}

export function Cycle({ store, today, actions }) {
  const [selected, setSelected] = useState(today);
  const periods = list(store.read(keys.periods)).filter(row => row.start).sort((a, b) => b.start.localeCompare(a.start));
  const notes = list(store.read(keys.cycleNotes));
  const settings = { length: 28, duration: 5, ...store.read(keys.cycleSettings) };
  const length = Math.max(15, Math.min(90, Number(settings.length) || 28));
  const duration = Math.max(1, Math.min(15, Number(settings.duration) || 5));
  const last = periods.find(row => row.start <= today);
  let upcoming = last ? shift(last.start, length) : '';
  while (upcoming && upcoming < today) upcoming = shift(upcoming, length);
  const marks = {};
  if (upcoming) for (let index = 0; index < duration; index++) marks[shift(upcoming, index)] = 'Прогноз';
  for (const row of periods) {
    const end = row.end || shift(row.start, duration - 1);
    for (let day = row.start, count = 0; day <= end && count < 370; day = shift(day, 1), count++) marks[day] = 'Менструация';
  }
  function periodEditor(row) {
    actions.edit(keys.periods, { title: row ? 'Изменить период' : 'Добавить период', original: row,
      initial: { start: selected, ...row }, fields: [required('start', 'Начало', 'date', { max: today }), field('end', 'Окончание', 'date', { max: today })],
      validate: values => { if (values.end && values.end < values.start) throw new Error('Окончание указано раньше начала.'); } });
  }
  function noteEditor(row) {
    actions.edit(keys.cycleNotes, { title: row ? 'Изменить заметку' : 'Новая заметка', original: row,
      initial: { date: selected, ...row }, fields: [required('date', 'Дата', 'date'), required('text', 'Самочувствие и симптомы', 'textarea')] });
  }
  function editSettings() {
    actions.setEditor({ title: 'Настройки цикла', initial: settings, fields: [
      required('length', 'Длина цикла, дн.', 'number', { min: 15, max: 90 }),
      required('duration', 'Длительность менструации, дн.', 'number', { min: 1, max: 15 }),
    ], save: value => store.update(keys.cycleSettings, current => ({ ...current, ...value })) });
  }
  return <div className="flow"><Heading title="Календарь цикла" subtitle="Журнал самочувствия" icon={Heart}/>
    <div className="hero cycle-hero"><span className="cycle-orbit"><Heart size={28}/></span><div><small>Ориентировочное начало</small><h2>{upcoming ? dayLabel(upcoming) : 'Добавьте период'}</h2>
      <button className="hero-link" onClick={editSettings}>Настройки цикла</button></div></div>
    <Month selected={selected} onSelect={setSelected} marks={marks}/>
    <p className="muted">Точка — запись. Кольцо — прогноз по указанной длине цикла.</p>
    <Section title="Менструации" action={<Add onClick={() => periodEditor()}/>}>
      <Rows rows={periods.map(row => ({ ...row, title: dayLabel(row.start) }))} edit={periodEditor}
        remove={row => actions.remove(keys.periods, row)} detail={row => row.end ? 'До ' + dayLabel(row.end) : 'Дата окончания не указана'}/>
    </Section>
    <Section title={'Самочувствие · ' + dayLabel(selected)} action={<Add onClick={() => noteEditor()}>Заметка</Add>}>
      <Rows rows={notes.filter(row => row.date === selected).map(row => ({ ...row, title: row.text }))} edit={noteEditor}
        remove={row => actions.remove(keys.cycleNotes, row)}/>
    </Section>
  </div>;
}
