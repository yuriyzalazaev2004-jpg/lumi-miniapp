import React, { useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, Wallet } from 'lucide-react';
import { asDate, dayKey, dayLabel, kindOf, money, shift, total, when } from './model.js';
import { Add, Empty, Heading, Rows, Section, Tabs } from './ui.jsx';

const periodOptions = [['week', 'Неделя'], ['month', 'Месяц'], ['year', 'Год'], ['custom', 'Период']];
const colors = ['var(--accent)', 'var(--mint)', 'var(--pink)', 'var(--blue)', 'var(--gold)', 'var(--chart-other)'];

function Trend({ points, from, to }) {
  const [active, setActive] = useState(null);
  const low = Math.min(0, ...points.map(point => point.value));
  const high = Math.max(0, ...points.map(point => point.value));
  const span = high - low || 1;
  const y = value => 150 - (value - low) * 128 / span;
  const elapsed = date => +asDate(date);
  const duration = elapsed(to) - elapsed(from);
  const markers = points.map(point => ({ ...point, x: duration ? 12 + 296 * (elapsed(point.date) - elapsed(from)) / duration : 160, y: y(point.value) }));
  const selection = markers.find(point => point.date === active) || markers.at(-1);
  const axis = [high, (high + low) / 2, low];
  return <div className="trend">
    <output className="chart-detail">{dayLabel(selection.date)} <strong>{money(selection.value)}</strong></output>
    <div className="chart-frame"><div className="axis-labels">{axis.map((value, index) =>
      <small key={index}>{new Intl.NumberFormat('ru', { notation: 'compact', maximumFractionDigits: 1 }).format(value)} ₽</small>)}</div>
    <svg viewBox="0 0 320 165" role="img" aria-label="Накопительный результат по операциям за период">
      <defs><linearGradient id="chart-fill" x2="0" y2="1"><stop stopColor="var(--accent)" stopOpacity=".34"/><stop offset="1" stopColor="var(--accent)" stopOpacity="0"/></linearGradient></defs>
      {axis.map((value, index) => <line key={index} x1="0" x2="320" y1={y(value)} y2={y(value)} stroke="var(--line)" strokeDasharray="5 5"/>)}
      <polygon points={`${markers[0].x},150 ${markers.map(p => p.x + ',' + p.y).join(' ')} ${markers.at(-1).x},150`} fill="url(#chart-fill)"/>
      <polyline points={markers.map(p => p.x + ',' + p.y).join(' ')} fill="none" stroke="var(--accent)" strokeWidth="3" strokeLinejoin="round"/>
      <line x1={selection.x} x2={selection.x} y1="10" y2="150" stroke="var(--muted)" strokeDasharray="4 4"/>
      <circle cx={selection.x} cy={selection.y} r="5" fill="var(--accent)" stroke="var(--text)" strokeWidth="2"/>
      <rect width="320" height="165" fill="transparent" onPointerMove={event => {
        const bounds = event.currentTarget.ownerSVGElement.getBoundingClientRect();
        const x = (event.clientX - bounds.left) * 320 / bounds.width;
        setActive(markers.reduce((nearest, point) => Math.abs(point.x - x) < Math.abs(nearest.x - x) ? point : nearest).date);
      }}/>
    </svg></div>
    <div className="chart-dates"><small>{dayLabel(from)}</small>{from !== to && <small>{dayLabel(to)}</small>}</div>
    {points.length > 1 && <input aria-label="Дата на графике" type="range" min="0" max={points.length - 1}
      value={markers.indexOf(selection)} onChange={event => setActive(markers[Number(event.target.value)].date)}/>}
  </div>;
}

function Breakdown({ expenses }) {
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
  return sum > 0 ? <div className="breakdown">
    <div className="donut" style={{ background: 'conic-gradient(' + segments.join(',') + ')' }}><strong>{money(sum)}</strong></div>
    <ul>{categories.map(([category, value], index) => <li key={index}><i style={{ background: colors[index] }}/><span>{category}</span><b>{money(value)}</b></li>)}</ul>
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
  const daily = new Map(valid ? [[from, 0], [to, 0]] : []);
  for (const row of sliced) daily.set(row.date, (daily.get(row.date) || 0) + row.amount * (kindOf(row) === 'income' ? 1 : -1));
  let running = 0;
  const points = [...daily].sort(([a], [b]) => a.localeCompare(b)).map(([date, value]) => ({ date, value: running += value }));
  const history = [...sliced].reverse().filter(row => (filter === 'all' || kindOf(row) === filter) &&
    [row.title, row.category, row.notes].some(value => String(value || '').toLowerCase().includes(query.toLowerCase().trim())));
  return <div className="flow"><Heading title="Финансы" subtitle="Учёт и планирование" icon={Wallet}/>
    <section className="hero finance-hero"><small>Общий баланс</small><strong>{money(income(transactions) - expense(transactions))}</strong>
      <div className="split"><Add onClick={() => actions.item('income')}>Доход</Add><Add onClick={() => actions.item('expense')}>Расход</Add></div>
    </section>
    <Tabs options={periodOptions} value={period} onChange={setPeriod} label="Период статистики"/>
    {period === 'custom' && <div className="filters"><label>С<input type="date" value={start} onChange={e => setStart(e.target.value)}/></label>
      <label>По<input type="date" value={end} onChange={e => setEnd(e.target.value)}/></label></div>}
    {!valid && <p className="error" role="alert">Укажите начало и конец периода в правильном порядке.</p>}
    <div className="split metrics">
      <div className="card"><ArrowDownLeft/><small>Доходы за период</small><strong>{money(income(sliced))}</strong></div>
      <div className="card"><ArrowUpRight/><small>Расходы за период</small><strong>{money(expense(sliced))}</strong></div>
    </div>
    <Section title="Движение денег" className="card">{sliced.length ? <Trend points={points} from={from} to={to}/> : <Empty>Добавьте операции за выбранный период.</Empty>}</Section>
    <Section title="Категории расходов" className="card"><Breakdown expenses={sliced.filter(row => kindOf(row) === 'expense')}/></Section>
    <div className="quick-grid">
      <button onClick={() => navigate('debts')}>Долги</button><button onClick={() => navigate('subscriptions')}>Платежи</button>
      <button onClick={() => navigate('goals')}>Цели · {goals.filter(goal => goal.goalType !== 'personal').length}</button>
    </div>
    <Section title="История операций">
      <div className="filters"><label>Поиск<input type="search" value={query} onChange={e => setQuery(e.target.value)}/></label>
        <label>Тип<select value={filter} onChange={e => setFilter(e.target.value)}><option value="all">Все</option><option value="income">Доходы</option><option value="expense">Расходы</option></select></label></div>
      <Rows rows={history} {...actions.itemRows} detail={r => [dayLabel(r.date), r.category].filter(Boolean).join(' · ')}
        amount={r => (kindOf(r) === 'expense' ? '−' : '+') + money(r.amount)} empty="Операций по этому фильтру нет."/>
    </Section>
  </div>;
}
