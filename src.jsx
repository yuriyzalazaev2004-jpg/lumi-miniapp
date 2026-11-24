import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ArrowLeft, CalendarDays, Cloud, CloudOff, Grid2X2, House, Moon, Sparkles, Sun, UserRound, Wallet } from 'lucide-react';
import { dayKey, keys, list } from './app/model.js';
import { openStorage, readLocal } from './app/storage.js';
import { actions as recordActions, categories } from './app/records.js';
import { Dialog, Editor, IconButton } from './app/ui.jsx';
import { Home, Planner } from './app/planner.jsx';
import Finance from './app/finance.jsx';
import Kitchen from './app/kitchen.jsx';
import { Cycle, Goals, Habits } from './app/wellbeing.jsx';
import { Activity, defaultReminder, Directory, Journal, Profile, services, syncText, useReminders } from './app/services.jsx';
import './app.css';

const AUTH = 'https://umdoukuwhnzdywytcmun.supabase.co/functions/v1/telegram-auth';
const NAV = [['home', 'Главная', House], ['calendar', 'Мой день', CalendarDays], ['finance', 'Финансы', Wallet],
  ['services', 'Сервисы', Grid2X2], ['profile', 'Профиль', UserRound]];

function useTheme(tg) {
  const [theme, setTheme] = useState(() => readLocal('lumi-theme', 'system'));
  const [system, setSystem] = useState(() => tg?.colorScheme || (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'));
  const resolved = theme === 'system' ? system : theme === 'light' ? 'light' : 'dark';
  useEffect(() => {
    const query = matchMedia('(prefers-color-scheme: light)');
    const refresh = () => setSystem(tg?.colorScheme || (query.matches ? 'light' : 'dark'));
    query.addEventListener('change', refresh);
    tg?.onEvent?.('themeChanged', refresh);
    return () => { query.removeEventListener('change', refresh); tg?.offEvent?.('themeChanged', refresh); };
  }, [tg]);
  useEffect(() => {
    document.documentElement.dataset.theme = resolved;
    document.documentElement.style.colorScheme = resolved;
    const color = getComputedStyle(document.documentElement).getPropertyValue('--background').trim();
    document.querySelector('meta[name="theme-color"]').content = color;
    for (const method of ['setHeaderColor', 'setBackgroundColor', 'setBottomBarColor']) {
      try { tg?.[method]?.(color); } catch { /* Older Telegram versions. */ }
    }
  }, [resolved, tg]);
  const change = value => {
    try { localStorage.setItem('lumi-theme', JSON.stringify(value)); } catch { /* Theme is still applied in RAM. */ }
    setTheme(value);
  };
  return [theme, resolved, change];
}

function Root() {
  const tg = window.Telegram?.WebApp;
  const [auth, setAuth] = useState(() => ({ status: tg?.initData ? 'checking' : 'local' }));
  const [retry, setRetry] = useState(0);
  const [theme, resolved, changeTheme] = useTheme(tg);
  useEffect(() => {
    tg?.ready?.();
    tg?.expand?.();
    if (!tg?.initData) return;
    const controller = new AbortController();
    fetch(AUTH, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData: tg.initData }),
      signal: AbortSignal.any([controller.signal, AbortSignal.timeout(12000)]),
    }).then(async response => {
      const value = await response.json();
      if (!response.ok || !value.success || !/^\d+$/.test(String(value.user?.id))) throw new Error('Auth');
      if (!controller.signal.aborted) setAuth({ status: 'verified', user: value.user });
    }).catch(() => {
      if (!controller.signal.aborted) setAuth({ status: 'failed' });
    });
    return () => controller.abort();
  }, [retry, tg]);

  if (auth.status === 'checking' || auth.status === 'failed') return <div className="shell auth-screen">
    <div className="card"><span className="glyph"><Sparkles size={22}/></span><h1>LUMI</h1>
      <p role="status">{auth.status === 'checking' ? 'Проверяем вход через Telegram…' : 'Не удалось подтвердить вход через Telegram.'}</p>
      {auth.status === 'failed' && <button className="primary" onClick={() => {
        setAuth({ status: 'checking' }); setRetry(value => value + 1);
      }}>Повторить</button>}</div>
  </div>;
  return <App key={auth.user?.id || 'guest'} {...{ auth, tg, theme, resolved, changeTheme }}/>;
}

function App({ auth, tg, theme, resolved, changeTheme }) {
  const owner = auth.user?.id ? String(auth.user.id) : 'guest';
  const store = useMemo(() => openStorage(owner), [owner]);
  const [sync, setSync] = useState(owner === 'guest' ? 'local' : 'loading');
  const [, refresh] = useState(0);
  const [page, setPage] = useState('home');
  const [today, setToday] = useState(dayKey);
  const [selected, setSelected] = useState(dayKey);
  const [editor, setEditor] = useState(null);
  const [error, setError] = useState('');
  const [importOpen, setImportOpen] = useState(() => store.canImport());
  const actions = recordActions(store, setEditor, setError);

  useEffect(() => store.subscribe(() => refresh(value => value + 1)), [store]);
  useEffect(() => {
    if (auth.status === 'verified' && tg?.initData) return store.connect(tg.initData, setSync);
  }, [auth.status, store, tg]);
  useEffect(() => {
    const clock = setInterval(() => setToday(dayKey()), 30000);
    return () => clearInterval(clock);
  }, []);

  function navigate(next) {
    if (next === 'calendar' && page === 'home') setSelected(today);
    setPage(next);
    window.scrollTo(0, 0);
  }
  useEffect(() => {
    const back = tg?.BackButton;
    if (!back) return;
    const goBack = () => editor ? setEditor(null) : navigate(services[page] ? 'services' : 'home');
    if (page !== 'home' || editor) back.show();
    else back.hide();
    back.onClick(goBack);
    return () => back.offClick(goBack);
  }, [editor, page, tg]);

  const items = list(store.read(keys.items));
  const habits = list(store.read(keys.habits));
  const goals = list(store.read(keys.goals));
  const meals = list(store.read(keys.meals));
  const reminderSettings = { ...defaultReminder, ...store.read(keys.reminders) };
  const reminderStatus = useReminders({ auth, tg, items, habits, settings: reminderSettings, today, sync });
  const props = { user: auth.user, items, habits, goals, meals, today, selected, setSelected, navigate, actions, store };
  let screen;
  switch (page) {
    case 'home': screen = <Home {...props}/>; break;
    case 'calendar': screen = <Planner {...props}/>; break;
    case 'finance': screen = <Finance {...props}/>; break;
    case 'services': screen = <Directory navigate={navigate}/>; break;
    case 'kitchen': screen = <Kitchen {...props}/>; break;
    case 'habits': screen = <Habits {...props}/>; break;
    case 'goals': screen = <Goals {...props}/>; break;
    case 'stats': screen = <Activity {...props}/>; break;
    case 'cycle': screen = <Cycle {...props}/>; break;
    case 'profile': screen = <Profile {...props} {...{ theme, changeTheme, auth, sync, reminderSettings, reminderStatus, tg }} onImport={() => setImportOpen(true)}/>; break;
    default: screen = <Journal key={page} {...props} page={page}/>;
  }
  return <div className="shell">
    <header className="topbar">
      {services[page] ? <IconButton icon={ArrowLeft} label="К сервисам" onClick={() => navigate('services')}/>
        : <button className="wordmark" onClick={() => navigate('home')}><Sparkles size={21}/> LUMI</button>}
      <div className="top-actions">
        <span className={'cloud ' + sync} role="status" aria-label={syncText(sync)} title={syncText(sync)}>
          {sync === 'local' || sync === 'error' ? <CloudOff size={18}/> : <Cloud size={18}/>}</span>
        <IconButton icon={resolved === 'dark' ? Sun : Moon} label="Переключить тему" onClick={() => changeTheme(resolved === 'dark' ? 'light' : 'dark')}/>
      </div>
    </header>
    <main key={page} id="main" aria-busy={sync === 'loading' || undefined}>{screen}</main>
    <nav className="bottom-nav" aria-label="Главная навигация">{NAV.map(([key, label, Icon]) => {
      const active = page === key || key === 'services' && services[page];
      return <button key={key} aria-current={active ? 'page' : undefined} onClick={() => navigate(key)}><Icon size={21}/><span>{label}</span></button>;
    })}</nav>
    <datalist id="finance-categories">{categories.map(value => <option value={value} key={value}/>)}</datalist>
    {importOpen && <Dialog title="Перенос локальных записей" close={() => setImportOpen(false)}>
      <p>На этом устройстве есть записи из предыдущей версии LUMI. Переносите их, только если они принадлежат вам.</p>
      <button className="primary" onClick={() => {
        try { store.importLegacy(); setImportOpen(false); }
        catch { setError('Не удалось перенести записи.'); }
      }}>Перенести в мой аккаунт</button>
      <button className="secondary" onClick={() => setImportOpen(false)}>Позже</button>
    </Dialog>}
    {editor && <Editor config={editor} close={() => setEditor(null)}/>}
    {error && <div className="toast" role="alert">{error} <button className="link" onClick={() => setError('')}>Закрыть</button></div>}
  </div>;
}

createRoot(document.getElementById('root')).render(<Root/>);
