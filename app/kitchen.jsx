import React, { useState } from 'react';
import { ChefHat, ChevronRight, Refrigerator } from 'lucide-react';
import { FOOD_NUTRITION, RUSSIAN_RECIPES } from '../recipes-ru.js';
import { dayLabel, keys, kindOf, list, titleOf, uid, when } from './model.js';
import { field, required } from './records.js';
import { Add, Dialog, Empty, Heading, Rows, Section, Tabs } from './ui.jsx';

const modes = [['fridge', 'Холодильник'], ['shopping', 'Покупки'], ['recipes', 'Рецепты'], ['plan', 'Меню']];
const categories = {
  'Овощи и зелень': 'Картофель|Огурцы|Помидоры|Морковь|Свёкла|Лук|Чеснок|Капуста|Тыква|Брокколи|Болгарский перец|Укроп|Петрушка|Кабачки|Баклажаны|Шпинат|Сельдерей',
  'Фрукты и ягоды': 'Яблоки|Груши|Бананы|Лимон|Клубника|Черника|Апельсины|Авокадо|Виноград',
  'Молочные и яйца': 'Яйца|Молоко|Сыр|Творог|Сметана|Сливочное масло|Йогурт|Кефир|Сливки|Моцарелла',
  'Мясо и рыба': 'Курица|Говядина|Фарш|Рыба|Колбаса варёная|Сосиски|Ветчина|Индейка|Лосось|Тунец|Креветки',
  'Крупы и бакалея': 'Рис|Гречка|Овсянка|Перловка|Манка|Манная крупа|Мука|Макароны|Фасоль|Чечевица|Нут|Булгур|Киноа|Хлеб',
};
const byName = Object.fromEntries(Object.entries(categories).flatMap(([category, products]) => products.split('|').map(name => [name, category])));
const products = [...new Set([...Object.keys(byName), ...Object.keys(FOOD_NUTRITION), ...RUSSIAN_RECIPES.flatMap(recipe => recipe.parts.map(part => part.name))])]
  .sort((a, b) => a.localeCompare(b, 'ru'));
const normalize = value => String(value || '').trim().toLowerCase().replaceAll('ё', 'е');
const categoryOf = name => Object.hasOwn(byName, name) ? byName[name] : 'Прочее';
const categoryOptions = [...Object.keys(categories), 'Прочее'].map(value => [value, value]);
const units = [['г', 'г'], ['кг', 'кг'], ['мл', 'мл'], ['л', 'л'], ['шт', 'шт'], ['уп.', 'уп.']];
const quantity = field('quantity', 'Количество', 'number', { min: 0, step: 0.01 });
const unit = field('unit', 'Единица', null, { options: units });
const foodDetail = row => [row.quantity !== undefined && row.quantity !== '' ? `${row.quantity} ${row.unit || ''}` : '',
  row.expiry ? 'Годен до ' + dayLabel(row.expiry) : '', row.category].filter(Boolean).join(' · ');

export default function Kitchen({ store, items, actions, today }) {
  const [mode, setMode] = useState('fridge');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [meal, setMeal] = useState('');
  const [opened, setOpened] = useState(null);
  const [servings, setServings] = useState(1);
  const [date, setDate] = useState(today);
  const [notice, setNotice] = useState('');
  const savedCatalog = store.read(keys.catalog);
  const catalog = savedCatalog && typeof savedCatalog === 'object' && !Array.isArray(savedCatalog) ? savedCatalog : {};
  const fridge = [
    ...Object.entries(catalog).filter(([, row]) => row?.have).map(([name, row]) => ({ ...row, id: name, name, title: name, category: row.category || categoryOf(name) })),
    ...items.filter(row => kindOf(row) === 'kitchen' && !['shopping', 'purchase'].includes(row.kind))
      .map(row => ({ ...row, expiry: row.expiry ?? row.due, category: row.category || categoryOf(titleOf(row)) })),
  ];
  const shopping = list(store.read(keys.shopping));
  const plans = list(store.read(keys.meals)).sort(when);
  const match = name => normalize(name).includes(normalize(query));
  const available = fridge.filter(row => (!row.expiry || row.expiry >= today) && (row.quantity == null || row.quantity === '' || Number(row.quantity) > 0));
  function missingParts(recipe, count = recipe.servings) {
    return recipe.parts.filter(part => {
      const food = available.filter(row => normalize(titleOf(row)) === normalize(part.name));
      if (!food.length) return true;
      if (food.some(row => row.quantity == null || row.quantity === '' || !['г', 'кг'].includes(row.unit))) return false;
      return food.reduce((sum, row) => sum + Number(row.quantity) * (row.unit === 'кг' ? 1000 : 1), 0) < part.g * count / recipe.servings;
    });
  }
  const ranked = RUSSIAN_RECIPES.filter(recipe => match(recipe.name) && (!meal || recipe.meal === meal))
    .map(recipe => ({ recipe, missing: missingParts(recipe).length }))
    .sort((a, b) => a.missing - b.missing || a.recipe.minutes - b.recipe.minutes);
  const shownStock = fridge.filter(row => match(titleOf(row)) && (!category || row.category === category));

  function stock(name, row) {
    actions.setEditor({ title: row ? 'Изменить продукт' : 'Добавить в холодильник',
      fields: [required('title', 'Продукт', null, { list: 'product-catalog' }), quantity, unit, field('expiry', 'Годен до', 'date'),
        field('category', 'Категория', null, { options: [['', 'Автоматически'], ...categoryOptions] })],
      initial: { title: name, category: name ? categoryOf(name) : '', ...row },
      save: value => {
        const category = value.category || categoryOf(value.title);
        if (row?.type === 'kitchen' || row?.kind === 'kitchen') { actions.upsert(keys.items, { ...value, category }, row); return; }
        store.update(keys.catalog, current => {
          const next = { ...current };
          const existing = Object.keys(next).find(key => normalize(key) === normalize(value.title));
          const target = existing || value.title;
          if (row && row.id !== target) next[row.id] = { ...next[row.id], have: false };
          const { title, id, name, ...properties } = value;
          return { ...next, [target]: { ...(Object.hasOwn(next, target) ? next[target] : {}), ...properties, category, have: true, eat: true } };
        });
      } });
  }

  function removeStock(row) {
    if ((row.type === 'kitchen' || row.kind === 'kitchen')) { actions.remove(keys.items, row); return; }
    if (!window.confirm('Убрать «' + row.title + '» из холодильника?')) return;
    actions.attempt(() => store.update(keys.catalog, value => ({ ...value, [row.id]: { ...value[row.id], have: false } })));
  }

  function addMissing() {
    try {
      store.update(keys.shopping, current => {
        const rows = list(current);
        const items = missingParts(opened, servings).filter(part => !rows.some(row => !row.done && normalize(titleOf(row)) === normalize(part.name)));
        return [...rows, ...items.map(part => ({ id: uid(), title: part.name, name: part.name, done: false }))];
      });
      setNotice('Список покупок обновлён');
    } catch { setNotice('Не удалось обновить список покупок'); }
  }

  return <div className="flow">
    <Heading title="Моя кухня" subtitle="Запасы и меню" icon={ChefHat}/>
    <Tabs options={modes} value={mode} onChange={value => { setMode(value); setQuery(''); }} label="Раздел кухни"/>
    {mode === 'fridge' && <>
      <Section title="Запасы" action={<Add onClick={() => stock('')}/>}>
        <div className="filters"><label>Поиск продуктов<input type="search" value={query} onChange={event => setQuery(event.target.value)}/></label>
          <label>Категория<select value={category} onChange={event => setCategory(event.target.value)}><option value="">Все</option>
            {categoryOptions.map(([value]) => <option key={value}>{value}</option>)}</select></label></div>
        <Rows rows={shownStock} edit={row => stock(titleOf(row), row)} remove={removeStock} detail={foodDetail} empty="В холодильнике нет подходящих продуктов."/>
      </Section>
      <Section title="Каталог продуктов" className="card">
        <div className="product-grid">{[...new Set([...products, ...Object.keys(catalog)])]
          .filter(name => match(name) && (!category || (catalog[name]?.category || categoryOf(name)) === category))
          .map(name => <button key={name} onClick={() => stock(name, fridge.find(row => normalize(titleOf(row)) === normalize(name)))}><Refrigerator size={15}/>{name}</button>)}</div>
      </Section>
      <datalist id="product-catalog">{products.map(name => <option key={name} value={name}/>)}</datalist>
    </>}
    {mode === 'shopping' && <Section title="Список покупок" action={<Add onClick={() => shoppingEditor()}/>}>
      <Rows rows={shopping} edit={shoppingEditor} toggle={row => actions.toggle(keys.shopping, row)}
        remove={row => actions.remove(keys.shopping, row)} detail={foodDetail} empty="Список покупок пуст."/>
    </Section>}
    {mode === 'recipes' && <>
      <div className="filters"><label>Поиск рецептов<input type="search" value={query} onChange={event => setQuery(event.target.value)}/></label>
        <label>Приём пищи<select value={meal} onChange={event => setMeal(event.target.value)}><option value="">Все</option>
          {[...new Set(RUSSIAN_RECIPES.map(row => row.meal))].map(value => <option key={value}>{value}</option>)}</select></label></div>
      <Section title="Что приготовить" className="card">
        {!ranked.length && <Empty>Рецепты по этому фильтру не найдены.</Empty>}
        <div className="recipe-list">{ranked.map(({ recipe, missing }) => <button key={recipe.name} onClick={() => {
          setServings(recipe.servings); setOpened(recipe); setNotice('');
        }}><span className="glyph"><ChefHat size={19}/></span><span><strong>{recipe.name}</strong>
          <small>{recipe.meal} · {recipe.minutes} мин · {missing ? 'Не хватает: ' + missing : 'Всё есть'}</small></span><ChevronRight size={18}/></button>)}</div>
      </Section>
    </>}
    {mode === 'plan' && <Section title="План питания" action={<Add onClick={() => setMode('recipes')}>Выбрать рецепт</Add>}>
      <Rows rows={plans} edit={row => mealEditor(row)} remove={row => actions.remove(keys.meals, row)}
        detail={row => [dayLabel(row.date), row.meal, row.servings && 'Порций: ' + row.servings].filter(Boolean).join(' · ')}
        empty="Выберите рецепт и добавьте его в меню."/>
    </Section>}
    {opened && <Dialog title={opened.name} close={() => setOpened(null)}>
      <p className="muted">{opened.meal} · {opened.minutes} мин</p>
      <label>Порций<input type="number" min="1" max="30" value={servings} onChange={event => setServings(Math.max(1, Math.min(30, Number(event.target.value) || 1)))}/></label>
      <h3>Ингредиенты</h3>
      <ul className="ingredients">{opened.parts.map(part => <li key={part.name}>{part.name} · {Math.round(part.g * servings / opened.servings)} г
        {missingParts(opened, servings).includes(part) && <small>Нужно докупить</small>}</li>)}</ul>
      <h3>Приготовление</h3><ol className="steps">{opened.steps.map(step => <li key={step}>{step}</li>)}</ol>
      {missingParts(opened, servings).length > 0 && <button className="secondary" onClick={addMissing}>Добавить недостающее в покупки</button>}
      <form className="form" onSubmit={event => {
        event.preventDefault();
        try { actions.upsert(keys.meals, { name: opened.name, date, meal: opened.meal, servings }); setOpened(null); setMode('plan'); }
        catch { setNotice('Не удалось сохранить план'); }
      }}><label>Дата в меню<input required type="date" value={date} onChange={event => setDate(event.target.value)}/></label>
        <button className="primary" type="submit">Запланировать</button></form>
      {notice && <p role="status">{notice}</p>}
    </Dialog>}
  </div>;

  function shoppingEditor(row) {
    actions.edit(keys.shopping, { title: row ? 'Изменить покупку' : 'Добавить покупку', original: row,
      initial: { done: false, ...row, title: row ? titleOf(row) : '' },
      fields: [required('title', 'Продукт'), quantity, unit] });
  }
  function mealEditor(row) {
    actions.edit(keys.meals, { title: 'Изменить план питания', original: row, initial: row,
      fields: [required('date', 'Дата', 'date'), required('servings', 'Порций', 'number', { min: 1, max: 30 }),
        required('meal', 'Приём пищи', null, { options: [...new Set(RUSSIAN_RECIPES.map(recipe => recipe.meal))].map(value => [value, value]) })] });
  }
}
