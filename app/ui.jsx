import React, { useEffect, useRef, useState } from 'react';
import { Check, Circle, Pencil, Plus, Trash2, X } from 'lucide-react';
import { titleOf } from './model.js';

export function Heading({ title, subtitle, icon: Icon }) {
  return <header className="heading">{Icon && <span className="glyph"><Icon size={22}/></span>}
    {subtitle && <p>{subtitle}</p>}<h1>{title}</h1>
  </header>;
}
export function Empty({ children }) {
  return <p className="empty">{children}</p>;
}
export function Section({ title, action, children, className = '' }) {
  return <section className={className}><div className="section-head"><h2>{title}</h2>{action}</div>{children}</section>;
}
export function Add({ onClick, children = 'Добавить' }) {
  return <button className="primary" onClick={onClick}><Plus size={17}/>{children}</button>;
}
export function IconButton({ icon: Icon, label, ...props }) {
  return <button type="button" className="icon-button" aria-label={label} title={label} {...props}><Icon size={18}/></button>;
}
export function Tabs({ options, value, onChange, label }) {
  return <div className="tabs" role="group" aria-label={label}>{options.map(([key, title]) =>
    <button key={key} aria-pressed={value === key} onClick={() => onChange(key)}>{title}</button>)}</div>;
}
export function Ring({ value, label }) {
  return <div className="ring" style={{ '--progress': Math.max(0, Math.min(100, value)) + '%' }}>
    <div><strong>{value}%</strong>{label && <small>{label}</small>}</div>
  </div>;
}
export function Rows({ rows, empty, edit, remove, toggle, detail, amount }) {
  if (!rows.length) return <div className="card"><Empty>{empty || 'Записей пока нет.'}</Empty></div>;
  return <ul className="card rows">{rows.map((row, index) => <li key={row.id ?? index}>
    {toggle && <IconButton icon={row.done ? Check : Circle} label={row.done ? 'Снять отметку' : 'Отметить выполнение'}
      aria-pressed={Boolean(row.done)} onClick={() => toggle(row)}/>}
    <div className="row-copy"><strong>{titleOf(row)}</strong>{detail && <small>{detail(row)}</small>}</div>
    {amount && <span className="row-amount">{amount(row)}</span>}
    {edit && <IconButton icon={Pencil} label={'Изменить: ' + titleOf(row)} onClick={() => edit(row)}/>}
    {remove && <IconButton icon={Trash2} label={'Удалить: ' + titleOf(row)} onClick={() => remove(row)}/>}
  </li>)}</ul>;
}
export function Dialog({ title, close, children }) {
  const dialog = useRef(null);
  useEffect(() => {
    const element = dialog.current;
    element.showModal();
    return () => element.close();
  }, []);
  return <dialog className="sheet" ref={dialog} aria-label={title} onCancel={event => { event.preventDefault(); close(); }}
    onClick={event => { if (event.target === dialog.current) close(); }}>
    <div className="sheet-body"><div className="section-head"><h2>{title}</h2><IconButton icon={X} label="Закрыть" onClick={close}/></div>{children}</div>
  </dialog>;
}
export function Editor({ config, close }) {
  const [error, setError] = useState('');
  function submit(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const values = {};
    for (const field of config.fields) {
      const raw = String(form.get(field.name) ?? '').trim();
      if (field.required && !raw) { setError('Заполните поле «' + field.label + '»'); return; }
      values[field.name] = field.type === 'number' && raw !== '' ? Number(raw) : raw;
    }
    try { config.save(config.keepInitial ? { ...config.initial, ...values } : values); close(); }
    catch (failure) { setError(failure.message || 'Не удалось сохранить запись'); }
  }
  return <Dialog title={config.title} close={close}><form className="form" onSubmit={submit}>
    {config.fields.map(field => <label key={field.name}>{field.label}
      {field.options ? <select name={field.name} required={field.required} defaultValue={config.initial[field.name] ?? ''}>
        {field.options.map(([key, label]) => <option value={key} key={key}>{label}</option>)}
      </select> : field.type === 'textarea' ? <textarea required={field.required} name={field.name} defaultValue={config.initial[field.name] ?? ''} maxLength={1000}/>
        : <input name={field.name} type={field.type || 'text'} required={field.required} defaultValue={config.initial[field.name] ?? ''}
          min={field.min} max={field.max} step={field.step} list={field.list} maxLength={160}/>}
    </label>)}
    {error && <p role="alert" className="error">{error}</p>}
    <button className="primary" type="submit">Сохранить</button>
  </form></Dialog>;
}
