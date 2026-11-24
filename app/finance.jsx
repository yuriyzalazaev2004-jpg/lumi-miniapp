import React, { useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, Wallet } from 'lucide-react';
import { asDate, dayKey, dayLabel, kindOf, money, shift, total, when } from './model.js';
import { Add, Empty, Heading, Rows, Section, Tabs } from './ui.jsx';

const periodOptions = [['week', 'Неделя'], ['month', 'Месяц'], ['year', 'Год'], ['custom', 'Период']];
const colors = ['var(--accent)', 'var(--mint)', 'var(--pink)', 'var(--blue)', 'var(--gold)', 'var(--chart-other)'];

const series = [
  ['value', 'Результат', 'var(--accent)'],
  ['income', 'Доходы', 'var(--mint)'],
  ['expense', 'Расходы', 'var(--pink)'],
];
const compact = new Intl.NumberFormat('ru', { notation: 'compact', maximumFractionDigits: 1 });

function Trend({ points, from, to }) {
  const [active, setActive] = useState(null);
  const [visible, setVisible] = useState(['value', 'income', 'expense']);
  const enabled = series.filter(([key]) => visible.includes(key));
  const values = points.flatMap(point => enabled.map(([key]) => point[key]));
  const low = values.reduce((min, n) => Math.min(min, n), 0);
  const high = values.reduce((max, n) => Math.max(max, n), 0) || (low === 0 ? 1 : 0);
  const y = value => 146 - (value - low) * 125 / (high - low);
  const elapsed = date => +asDate(date);
  const duration = elapsed(to) - elapsed(from);
  const xAt = date => duration ? 7 + 278 * (elapsed(date) - elapsed(from)) / duration : 146;
  const markers = points.map(point => ({ ...point, x: xAt(point.date) }));
  const path = key => markers.flatMap((point, index) => [
    ...(index ? [point.x + ',' + y(markers[index - 1][key])] : []), point.x + ',' + y(point[key]),
  ]).join(' ');
  const selection = markers.find(point => point.date === active) || markers.at(-1);
  const axis = Array.from({length: 5}, (_, index) => high - index / 4 * (high - low));
  const ticks = [...new Set(Array.from({ length: 4 }, (_, index) => dayKey(new Date(elapsed(from) + duration * index / 3))))];

  function inspect(event) {
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(event.currentTarget.getScreenCTM().inverse());
    const nearest = markers.reduce((best, marker) => Math.abs(marker.x - point.x) < Math.abs(best.x - point.x) ? marker : best);
    setActive(nearest.date);
  }

  return <div className="trend">
    <div className="legend" role="group" aria-label="Ряды графика">{series.map(([key, label, color]) =>
      <button key={key} aria-pressed={visible.includes(key)} onClick={() => setVisible(current => current.includes(key)
        ? current.length > 1 ? current.filter(value => value !== key) : current : [...current, key])}>
        <i style={{background: color}}/>{label}
      </button>)}</div>
    <output className="chart-detail" aria-live="off"><small>{dayLabel(selection.date)}</small>
      {enabled.map(([key, label, color]) => <span key={key}><i style={{background: color}}/>{label} <strong>{money(selection[key])}</strong></span>)}</output>
    <div className="chart-frame">
      <svg viewBox="0 0 344 178" role="img" aria-label="Накопительный результат по операциям за период">
        <defs><linearGradient id="chart-fill" x2="0" y2="1"><stop stopColor="var(--accent)" stopOpacity=".26"/><stop offset="1" stopColor="var(--accent)" stopOpacity="0"/></linearGradient></defs>
        <g transform="translate(46 0)">
          {axis.map((value, index) => <g key={index}><line x1="-3" x2="291" y1={y(value)} y2={y(value)} stroke="var(--line)" strokeDasharray="4 4"/>
            <text x="-8" y={y(value)+3} textAnchor="end">{compact.format(value)}</text></g>)}
          {ticks.map((date, index) => {
            const x = xAt(date);
            return <g key={date}><line x1={x} x2={x} y1="20" y2="146" stroke="var(--line)"/>
              <text x={x} y="166" textAnchor={index === 0 && ticks.length > 1 ? 'start' : index === ticks.length - 1 && ticks.length > 1 ? 'end' : 'middle'}>{dayLabel(date)}</text></g>;
          })}
          {visible.includes('value') && <polygon points={`${markers[0].x},${y(0)} ${path('value')} ${markers.at(-1).x},${y(0)}`} fill="url(#chart-fill)"/>}
          {enabled.map(([key, , color]) => <polyline key={key} points={path(key)}
            fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round"/>)}
          <line x1={selection.x} x2={selection.x} y1="16" y2="146" stroke="var(--muted)" strokeDasharray="4 4"/>
          {enabled.map(([key, , color]) => <circle key={key} cx={selection.x} cy={y(selection[key])} r="4" fill={color} stroke="var(--surface)" strokeWidth="1.5"/>)}
          <rect className="chart-target" x="-3" y="12" width="294" height="140" fill="transparent"
            onPointerDown={event => { event.currentTarget.setPointerCapture(event.pointerId); inspect(event); }} onPointerMove={event => {
              if (event.pointerType === 'mouse' || event.currentTarget.hasPointerCapture(event.pointerId)) inspect(event);
            }}/>
        </g>
      </svg>
    </div>
    {points.length > 1 && <input aria-label="Дата на графике" aria-valuetext={dayLabel(selection.date)} type="range" min="0" max={points.length - 1}
      value={markers.indexOf(selection)} onChange={event => setActive(markers[Number(event.target.value)].date)}/>}
  </div>;
}

function Breakdown({ expenses }) {
  const [selected, setSelected] = useState(null);
  const sums = new Map();
  for (const row of expenses) {
    const category = row.category || 'Без категории';
    sums.set(category, (sums.get(category) || 0) + row.amount);
  }
  const values = [...sums].filter(([, amount]) => amount > 0).sort((a, b) => b[1] - a[1]);
  const categories = values.slice(0, 5);
  if (values.length > 5) categories.push(['Остальные категории', values.slice(5).reduce((sum, [, n]) => sum + n, 0)]);
  const sum = total(expenses);
  let offset = 0;
  const segments = categories.map(([, value], index) => {
    const start = offset;
    offset += value / sum * 100;
    return `${colors[index]} ${start}% ${offset}%`;
  });
  const focused = categories.find(([category]) => category === selected);
  return sum > 0 ? <div className="breakdown">
    <div className="donut" style={{ background: 'conic-gradient(' + segments.join(',') + ')' }}><strong>{money(focused ? focused[1] : sum)}<small>{focused ? Math.round(focused[1] / sum * 100) + '%' : 'Всего'}</small></strong></div>
    <ul>{categories.map(([category, value], index) => <li key={index}><button aria-pressed={selected === category} onClick={() => setSelected(selected === category ? null : category)}><i style={{ background: colors[index] }}/><span>{category}</span><b>{money(value)}</b></button></li>)}</ul>
  </div> : <Empty>В этом периоде нет расходов.</Empty>;
}

export default function Finance({ items, goals, actions, navigate, today }) {
  const [period, setPeriod] = useState('month');
  const [start, setStart] = useState(shift(today, -29));
  const [end, setEnd] = useState(today);
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const yearStart = asDate(today);
  yearStart.setFullYear(yearStart.getFullYear() - 1);
  const from = period === 'custom' ? start : period === 'year' ? shift(dayKey(yearStart), 1) : shift(today, period === 'week' ? -6 : -29);
  const to = period === 'custom' ? end : today;
  const valid = from && to && from <= to;
  const transactions = items.filter(row => ['income', 'expense'].includes(kindOf(row)))
    .map(row => ({ ...row, amount: Math.abs(Number(row.amount) || 0) }));
  const income = rows => total(rows.filter(row => kindOf(row) === 'income'));
  const expense = rows => total(rows.filter(row => kindOf(row) === 'expense'));
  const sliced = valid ? transactions.filter(row => row.date >= from && row.date <= to).sort(when) : [];
  const daily = new Map(valid ? [[from, []], [to, []]] : []);
  for (const row of sliced) {
    if (!daily.has(row.date)) daily.set(row.date, []);
    daily.get(row.date).push(row);
  }
  let cumulativeIncome = 0;
  let cumulativeExpense = 0;
  const points = [...daily].sort(([a], [b]) => a.localeCompare(b)).map(([date, rows]) => {
    cumulativeIncome += income(rows);
    cumulativeExpense += expense(rows);
    return { date, value: cumulativeIncome - cumulativeExpense, income: cumulativeIncome, expense: cumulativeExpense };
  });
  const history = [...sliced].reverse().filter(row => (filter === 'all' || kindOf(row) === filter) &&
    [row.title, row.category, row.notes].some(value => String(value || '').toLowerCase().includes(query.toLowerCase().trim())));
  return <div className="flow"><Heading title="Финансы" subtitle="Учёт и планирование" icon={Wallet}/>
    <section className="hero finance-hero ledger"><span className="ledger-mark"><Wallet size={96} strokeWidth={1}/></span><small>Общий баланс</small><strong>{money(income(transactions) - expense(transactions))}</strong>
      <div className="split"><Add onClick={() => actions.item('income')}>Доход</Add><Add onClick={() => actions.item('expense')}>Расход</Add></div>
    </section>
    <Tabs options={periodOptions} value={period} onChange={setPeriod} label="Период статистики"/>
    {period === 'custom' && <div className="filters"><label>С<input type="date" value={start} onChange={e => setStart(e.target.value)}/></label>
      <label>По<input type="date" value={end} onChange={e => setEnd(e.target.value)}/></label></div>}
    {!valid && <p className="error" role="alert">Укажите начало и конец периода в правильном порядке.</p>}
    <Section title="Движение денег" className="card chart-card">
      <div className="chart-summary">
        <div><ArrowDownLeft size={16}/><small>Доходы за период</small><strong>{money(income(sliced))}</strong></div>
        <div><ArrowUpRight size={16}/><small>Расходы за период</small><strong>{money(expense(sliced))}</strong></div>
      </div>{sliced.length ? <Trend points={points} from={from} to={to}/> : <Empty>Добавьте операции за выбранный период.</Empty>}</Section>
    <Section title="Категории расходов" className="card"><Breakdown expenses={sliced.filter(row => kindOf(row) === 'expense')}/></Section>
    <div className="quick-grid">
      <button onClick={() => navigate('debts')}>Долги</button><button onClick={() => navigate('subscriptions')}>Платежи</button>
      <button onClick={() => navigate('goals')}>Цели · {goals.filter(goal => goal.goalType !== 'personal').length}</button>
    </div>
    <Section title="История операций">
      <div className="filters"><label>Поиск<input type="search" value={query} onChange={e => setQuery(e.target.value)}/></label>
        <label>Тип<select value={filter} onChange={e => setFilter(e.target.value)}><option value="all">Все</option><option value="income">Доходы</option><option value="expense">Расходы</option></select></label></div>
      <Rows rows={history} {...actions.itemRows} leading={row => kindOf(row) === 'income'
        ? <span className="row-mark mint"><ArrowDownLeft size={15}/></span>
        : <span className="row-mark pink"><ArrowUpRight size={15}/></span>} detail={r => [dayLabel(r.date), r.category].filter(Boolean).join(' · ')}
        amount={r => (kindOf(r) === 'expense' ? '−' : '+') + money(r.amount)} empty="Операций по этому фильтру нет."/>
    </Section>
  </div>;
}
