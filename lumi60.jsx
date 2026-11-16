import React,{useMemo,useState,useEffect} from 'react';
import {persist} from './cloud-sync.js';
import './lumi60.css';
const get=(k,d)=>{try{return JSON.parse(localStorage.getItem(k))??d}catch{return d}};
const now=()=>new Date().toISOString().slice(0,10);
const money=n=>Number(n||0).toLocaleString('ru-RU')+' ₽';
const id=()=>globalThis.crypto?.randomUUID?.()||String(Date.now()+Math.random());
const sections=[['finance','Финансы'],['kitchen','Кухня'],['sport','Спорт'],['shared','Общие списки'],['tips','Советы'],['challenges','Испытания'],['awards','Достижения'],['wrapped','Итоги']];
const month=()=>now().slice(0,7);
const sum=a=>a.reduce((n,x)=>n+Number(x.amount||0),0);
const parseList=s=>s.split(/[,;\n]/).map(x=>x.trim()).filter(Boolean);
export default function Lumi60({items=[],habits=[],goals=[],initialTab='finance',onBack}){
 const [tab,setTab]=useState(initialTab);
 useEffect(()=>setTab(initialTab),[initialTab]);
 const [savings,setSavings]=useState(()=>get('lumi60-savings',[]));
 const [limits,setLimits]=useState(()=>get('lumi60-limits',[]));
 const [pantry,setPantry]=useState(()=>get('lumi60-pantry',[]));
 const [recipes,setRecipes]=useState(()=>get('lumi60-recipes',[]));
 const [training,setTraining]=useState(()=>get('lumi60-training',[]));
 const [sessions,setSessions]=useState(()=>get('lumi60-sessions',[]));
 const [lists,setLists]=useState(()=>get('lumi60-shared',[]));
 const [challenges,setChallenges]=useState(()=>get('lumi60-challenges',[]));
 const [fields,setFields]=useState({});
 const field=(k)=>fields[k]??'';
 const set=(k,v)=>setFields(o=>({...o,[k]:v}));
 const add=(setter,fieldsList,extra={})=>{const v=Object.fromEntries(fieldsList.map(k=>[k,field(k)]));if(!String(v[fieldsList[0]]||'').trim())return;setter(a=>[{id:id(),...v,...extra},...a]);setFields({})};
 useEffect(()=>persist('lumi60-savings',savings),[savings]);
 useEffect(()=>persist('lumi60-limits',limits),[limits]);
 useEffect(()=>persist('lumi60-pantry',pantry),[pantry]);
 useEffect(()=>persist('lumi60-recipes',recipes),[recipes]);
 useEffect(()=>persist('lumi60-training',training),[training]);
 useEffect(()=>persist('lumi60-sessions',sessions),[sessions]);
 useEffect(()=>persist('lumi60-shared',lists),[lists]);
 useEffect(()=>persist('lumi60-challenges',challenges),[challenges]);
 const expense=items.filter(x=>x.type==='finance'&&x.kind==='expense'&&x.date?.startsWith(month()));
 const income=items.filter(x=>x.type==='finance'&&x.kind==='income'&&x.date?.startsWith(month()));
 const spent=sum(expense),earned=sum(income);
 const balance=earned-spent;
 const remaining=limits.map(l=>({...l,used:sum(expense.filter(x=>(x.icon||'other')===l.category))}));
 const pantryNames=pantry.filter(x=>!x.expires||x.expires>=now()).map(x=>x.name.toLowerCase());
 const possible=recipes.map(r=>({...r,ingredients:parseList(r.ingredients),missing:parseList(r.ingredients).filter(n=>!pantryNames.some(p=>p.includes(n.toLowerCase())||n.toLowerCase().includes(p)))})).sort((a,b)=>a.missing.length-b.missing.length);
 const due=pantry.filter(x=>x.expires&&x.expires<=new Date(Date.now()+3*86400000).toISOString().slice(0,10));
 const monthlySessions=sessions.filter(x=>x.date?.startsWith(month()));
 const personalRecords=Object.values(sessions.reduce((acc,x)=>{const k=x.exercise||'Тренировка';if(!acc[k]||Number(x.weight)>Number(acc[k].weight))acc[k]=x;return acc},{}));
 const completed=items.filter(x=>x.done).length;
 const habitMarks=habits.reduce((n,h)=>n+(h.dates||[]).length,0);
 const awards=[['Первый шаг',items.length>=1,'Добавить первую запись'],['Десять дел',completed>=10,'Выполнить 10 задач'],['Сила привычки',habitMarks>=7,'Отметить привычки 7 раз'],['Спортивный старт',sessions.length>=1,'Записать тренировку'],['Контроль бюджета',limits.length>=1,'Установить лимит'],['Цель близко',savings.some(x=>Number(x.saved)>=Number(x.target)&&Number(x.target)>0),'Достичь финансовой цели'],['Мастер кухни',recipes.length>=3,'Добавить 3 рецепта'],['Планировщик',items.length>=30,'Добавить 30 записей']];
 const challengeDate=now();
 const daily=[{id:'plan',title:'Запланировать одно дело',done:items.some(x=>x.date===challengeDate)},{id:'finish',title:'Выполнить одно дело',done:items.some(x=>x.date===challengeDate&&x.done)},{id:'habit',title:'Отметить привычку',done:habits.some(h=>(h.dates||[]).includes(challengeDate))},{id:'finance',title:'Записать расход или доход',done:items.some(x=>x.type==='finance'&&x.date===challengeDate)}];
 const claimed=challenges.filter(x=>x.date===challengeDate);
 const monthItems=items.filter(x=>x.date?.startsWith(month()));
 const recs=[
  ...(balance<0?[`В этом месяце расходы превышают доходы на ${money(-balance)}.`]:[]),
  ...remaining.filter(l=>l.used>Number(l.amount)).map(l=>`Лимит «${l.category}» превышен на ${money(l.used-l.amount)}.`),
  ...(due.length?[`Проверьте сроки годности: ${due.map(x=>x.name).join(', ')}.`]:[]),
  ...(items.some(x=>x.date===now()&&!x.done)?['На сегодня есть незавершённые задачи.']:[]),
  ...(possible[0]?.missing.length===0?[`Можно приготовить «${possible[0].title}» из имеющихся продуктов.`]:[]),
  ...(sessions.length===0?['Запланируйте первую тренировку.']:[]),
  ...(savings.length===0?['Создайте финансовую цель для накоплений.']:[])
 ];
 const inp=(key,label,type='text',placeholder='')=><label className="l60-field"><span>{label}</span><input type={type} placeholder={placeholder} value={field(key)} onChange={e=>set(key,e.target.value)}/></label>;
 const del=(setter,key)=>setter(a=>a.filter(x=>x.id!==key));
 const item=(title,subtitle,action)=> <div className="l60-item"><div><strong>{title}</strong><small>{subtitle}</small></div>{action}</div>;
 const remove=(setter,key)=><button className="l60-quiet" onClick={()=>del(setter,key)} aria-label="Удалить">×</button>;
 const save=(title,fn)=><button className="l60-btn" onClick={fn}>{title}</button>;
 return <div className="l60-root">
  <div className="l60-heading"><button className="l60-quiet" onClick={onBack}>← Назад</button><h2>LUMI 6.0 <span>✦</span></h2><p>Расширенные инструменты</p></div>
  <div className="l60-tabs">{sections.map(([key,label])=><button key={key} className={tab===key?'active':''} onClick={()=>setTab(key)}>{label}</button>)}</div>
  {tab==='finance'&&<><div className="l60-grid"><div className="l60-stat"><small>Доходы за месяц</small><strong>{money(earned)}</strong></div><div className="l60-stat"><small>Расходы за месяц</small><strong>{money(spent)}</strong></div><div className="l60-stat"><small>Прогноз остатка*</small><strong>{money(balance)}</strong></div></div><p className="l60-note">* Остаток на основе записанных доходов и расходов текущего месяца, без учёта будущих операций.</p>
  <section className="l60-panel"><h3>Финансовые цели</h3>{savings.map(x=>item(x.name,`${money(x.saved)} из ${money(x.target)} · ${Math.min(100,Math.round(Number(x.saved||0)/Math.max(1,Number(x.target))*100))}%`,<div className="l60-actions"><button onClick={()=>{const n=prompt('Пополнить на сумму, ₽');if(n!==null&&Number(n)>0)setSavings(a=>a.map(y=>y.id===x.id?{...y,saved:Number(y.saved||0)+Number(n)}:y))}}>+ Пополнить</button>{remove(setSavings,x.id)}</div>))}{inp('name','Название цели')}{inp('target','Нужно накопить, ₽','number')}{save('Создать цель',()=>add(setSavings,['name','target'],{saved:0}))}</section>
  <section className="l60-panel"><h3>Лимиты расходов</h3>{remaining.map(x=>item(x.category,`${money(x.used)} из ${money(x.amount)} · ${Math.round(x.used/Math.max(1,Number(x.amount))*100)}%`,remove(setLimits,x.id)))}{inp('category','Код категории (например groceries, home, other)')}{inp('amount','Лимит в месяц, ₽','number')}{save('Добавить лимит',()=>add(setLimits,['category','amount']))}</section></>}
  {tab==='kitchen'&&<><section className="l60-panel"><h3>Продукты и сроки годности</h3>{due.length>0&&<p className="l60-warning">Скоро истечёт срок: {due.map(x=>x.name).join(', ')}</p>}{pantry.map(x=>item(x.name,x.expires?`Годен до ${x.expires}`:'Без даты',remove(setPantry,x.id)))}{inp('name','Продукт')}{inp('expires','Годен до','date')}{save('Добавить продукт',()=>add(setPantry,['name','expires']))}</section><section className="l60-panel"><h3>Рецепты из продуктов</h3>{possible.map(x=>item(x.title,x.missing.length?`Не хватает: ${x.missing.join(', ')}`:'Всё есть в холодильнике',<button onClick={()=>{const missing=x.missing;if(!missing.length)return;setLists(a=>[{id:id(),name:'Покупки для '+x.title,entries:missing.map(n=>({id:id(),title:n,done:false}))},...a]);setTab('shared')}}>В покупки</button>))}{inp('title','Название рецепта')}{inp('ingredients','Ингредиенты через запятую')}{save('Добавить рецепт',()=>add(setRecipes,['title','ingredients']))}</section></>}
  {tab==='sport'&&<><section className="l60-panel"><h3>Программы тренировок</h3>{training.map(x=>item(x.name,x.exercises,remove(setTraining,x.id)))}{inp('name','Название программы')}{inp('exercises','Упражнения через запятую')}{save('Создать программу',()=>add(setTraining,['name','exercises']))}</section><section className="l60-panel"><h3>Журнал тренировок</h3><p>Тренировок за месяц: {monthlySessions.length}</p>{sessions.slice(0,30).map(x=>item(`${x.exercise} · ${x.weight||0} кг`,`${x.date} · ${x.reps||0} повторений`,remove(setSessions,x.id)))}{inp('exercise','Упражнение')}{inp('weight','Вес, кг','number')}{inp('reps','Повторения','number')}{inp('date','Дата','date')}{save('Записать результат',()=>add(setSessions,['exercise','weight','reps','date']))}</section><section className="l60-panel"><h3>Личные рекорды</h3>{personalRecords.map(x=>item(x.exercise,`${x.weight||0} кг · ${x.date}`,null))}<h3>Прогресс за 6 месяцев</h3><div className="l60-bars">{Array.from({length:6},(_,i)=>{const d=new Date();d.setMonth(d.getMonth()-5+i);const key=d.toISOString().slice(0,7);const count=sessions.filter(x=>x.date?.startsWith(key)).length;return <div key={key}><div style={{height:Math.max(5,Math.min(100,count*14))+'%'}}/><small>{key.slice(5)}</small></div>})}</div></section></>}
  {tab==='shared'&&<><section className="l60-panel"><h3>Списки покупок, задачи и бюджет</h3><p className="l60-note">Списки хранятся в вашем аккаунте. Обмен с другим человеком — через экспорт и импорт JSON. Одновременное редактирование несколькими людьми пока не поддерживается.</p>{lists.map(x=><div className="l60-subpanel" key={x.id}><div className="l60-item"><strong>{x.name}</strong>{remove(setLists,x.id)}</div>{(x.entries||[]).map(e=><label className="l60-check" key={e.id}><input type="checkbox" checked={!!e.done} onChange={()=>setLists(a=>a.map(l=>l.id===x.id?{...l,entries:l.entries.map(y=>y.id===e.id?{...y,done:!y.done}:y)}:l))}/>{e.title}</label>)}<button className="l60-btn" onClick={()=>{const title=prompt('Добавить пункт');if(title?.trim())setLists(a=>a.map(l=>l.id===x.id?{...l,entries:[...l.entries,{id:id(),title:title.trim(),done:false}]}:l))}}>+ Пункт</button></div>)}{inp('name','Название списка')}{save('Создать список',()=>add(setLists,['name'],{entries:[]}))}<div className="l60-actions">{save('Скопировать JSON',()=>navigator.clipboard?.writeText(JSON.stringify(lists)))}{save('Импорт JSON',()=>{const raw=prompt('Вставьте JSON списков');if(!raw)return;try{const data=JSON.parse(raw);if(!Array.isArray(data)||!data.every(x=>typeof x.name==='string'&&Array.isArray(x.entries)))throw Error();setLists(a=>[...data.map(x=>({...x,id:id(),entries:x.entries.map(y=>({id:id(),title:String(y.title||''),done:!!y.done}))})),...a])}catch{alert('Неверный формат JSON')}})}</div></section></>}
  {tab==='tips'&&<section className="l60-panel"><h3>Рекомендации на основе ваших записей</h3>{(recs.length?recs:['Отличный момент запланировать новые цели и задачи.']).map((x,i)=>item('✦ Совет '+(i+1),x,null))}<p className="l60-note">Рекомендации формируются локально по правилам, без отправки данных в сторонний ИИ.</p></section>}
  {tab==='challenges'&&<section className="l60-panel"><h3>Испытания на сегодня</h3><p className="l60-note">За каждое выполненное испытание — 10 очков активности. Очки учитываются в этом разделе и не прибавляются к серверному рейтингу XP.</p>{daily.map(x=>item(x.title,x.done?'Условие выполнено':'Ещё не выполнено',<button disabled={!x.done||claimed.some(c=>c.key===x.id)} onClick={()=>setChallenges(a=>[...a,{id:id(),key:x.id,date:challengeDate,points:10}])}>{claimed.some(c=>c.key===x.id)?'Получено':'+10'}</button>))}<div className="l60-stat"><small>Очки испытаний</small><strong>{challenges.reduce((n,x)=>n+Number(x.points||0),0)}</strong></div></section>}
  {tab==='awards'&&<section className="l60-panel"><h3>Коллекция достижений</h3><p>Открыто {awards.filter(x=>x[1]).length} из {awards.length}</p><div className="l60-awards">{awards.map(([name,unlocked,desc])=><div className={unlocked?'':'locked'} key={name}><span>{unlocked?'🏆':'🔒'}</span><strong>{name}</strong><small>{desc}</small></div>)}</div></section>}
  {tab==='wrapped'&&<section className="l60-panel"><h3>Мой месяц · {month()}</h3><div className="l60-grid">{[['Записей',monthItems.length],['Выполнено',monthItems.filter(x=>x.done).length],['Расходы',money(spent)],['Доходы',money(earned)],['Тренировок',monthlySessions.length],['Привычек отмечено',habits.reduce((n,h)=>n+(h.dates||[]).filter(d=>d.startsWith(month())).length,0)]].map(([label,v])=><div className="l60-stat" key={label}><small>{label}</small><strong>{v}</strong></div>)}</div><h3>Итоги года</h3><div className="l60-grid"><div className="l60-stat"><small>Всего записей</small><strong>{items.filter(x=>x.date?.startsWith(now().slice(0,4))).length}</strong></div><div className="l60-stat"><small>Выполненных задач</small><strong>{items.filter(x=>x.done&&x.date?.startsWith(now().slice(0,4))).length}</strong></div></div></section>}
 </div>
}

export function Lumi60Widget({items=[],habits=[],goals=[],onOpen}){
 const done=items.filter(x=>x.done).length;
 const marks=habits.reduce((n,h)=>n+(h.dates||[]).length,0);
 return <section className="l60-panel l60-widget"><div className="l60-item"><div><strong>✦ Мой прогресс</strong><small>{done} выполнено · {marks} отметок привычек · {goals.length} целей</small></div><button className="l60-btn" onClick={onOpen}>Подробнее</button></div></section>;
}
