import React, { useState } from 'react';
import { Flame, Heart, Target, Trophy } from 'lucide-react';
import { dayLabel, keys, list, money, shift, streak } from './model.js';
import { field, required } from './records.js';
import { Month } from './planner.jsx';
import { Add, Empty, Heading, Ring, Rows, Section } from './ui.jsx';

export function Habits({ habits, store, today, actions }) {
  const [selected, setSelected] = useState(today);
  const marks = {};
  habits.forEach(habit => (habit.dates || []).forEach(day => { marks[day] = 'Есть выполнения'; }));
  const done = habits.filter(habit => habit.dates?.includes(today)).length;
  const best = Math.max(0, ...habits.map(habit => streak(habit.dates || [], today)));
  function toggle(row) {
    actions.attempt(() => store.update(keys.habits, value => list(value).map(habit => {
      if (habit.id !== row.id) return habit;
      const dates = habit.dates || [];
      return { ...habit, dates: dates.includes(selected) ? dates.filter(day => day !== selected) : [...dates, selected] };
    })));
  }
  return <div className="flow"><Heading title="Привычки" subtitle="Ежедневный ритм" icon={Flame}/>
    <section className="hero day-hero"><div><h2>Сегодня</h2><p>{done} из {habits.length} выполнено</p></div>
      <Ring value={habits.length ? Math.round(100 * done / habits.length) : 0}/></section>
    <Section title="Календарь активности"><Month selected={selected} onSelect={setSelected} marks={marks}/></Section>
    <Section title={'Отметки · ' + dayLabel(selected)} action={<Add onClick={() => actions.habit()}/>}>
      <Rows rows={habits.map(habit => ({ ...habit, done: habit.dates?.includes(selected) }))}
        edit={actions.habit} remove={row => actions.remove(keys.habits, row)} toggle={selected <= today ? toggle : undefined}
        detail={row => `Серия: ${streak(row.dates || [], today)} дн. · Всего: ${(row.dates || []).length}`}/>
    </Section>
    <Section title="Достижения" className="card">
      {best ? <div className="achievement"><Trophy/><span><strong>{best} дн. подряд</strong><small>Лучшая текущая серия</small></span></div>
        : <Empty>Первая серия появится после отметки привычки.</Empty>}
    </Section>
  </div>;
}

export function Goals({ goals, actions }) {
  const completed = goals.filter(goal => Number(goal.target) > 0 && Number(goal.amount) >= Number(goal.target)).length;
  return <div className="flow"><Heading title="Мои цели" subtitle="Личные цели и накопления" icon={Target}/>
    <div className="card achievement"><Trophy/><span><strong>{completed} / {goals.length}</strong><small>Целей достигнуто</small></span></div>
    {[[ 'personal', 'Личные цели'], ['savings', 'Накопления']].map(([type, title]) =>
      <Section key={type} title={title} action={<Add onClick={() => actions.goal(null, type)}/>}>
        <Rows rows={goals.filter(row => (row.goalType || 'savings') === type)} edit={actions.goal}
          remove={row => actions.remove(keys.goals, row)} detail={row => {
            const values = type === 'savings' ? money : value => Number(value) || 0;
            return [`${values(row.amount)} из ${values(row.target)}`, row.date && dayLabel(row.date), row.notes].filter(Boolean).join(' · ');
          }} amount={row => <Ring value={row.target > 0 ? Math.round((Number(row.amount) || 0) / row.target * 100) : 0}/>}/>
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
    <div className="hero cycle-hero"><div><small>Ориентировочное начало</small><h2>{upcoming ? dayLabel(upcoming) : 'Добавьте период'}</h2>
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
