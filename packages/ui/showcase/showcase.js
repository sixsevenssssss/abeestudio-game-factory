/**
 * showcase.js — логика витрины @abeestudio/ui
 */

import { Button }               from '../src/components/Button.js';
import { Toggle, updateToggle } from '../src/components/Toggle.js';
import { Slider }               from '../src/components/Slider.js';
import { Tabs }                 from '../src/components/Tabs.js';
import { Input }                from '../src/components/Input.js';

const I18N = {
  ru: {
    'ctrl.theme': 'Тема', 'ctrl.variant': 'Вариант',
    'ctrl.dark': 'Тёмная', 'ctrl.light': 'Светлая', 'ctrl.viewport': 'Экран',
    'sec.buttons': 'Кнопки', 'sec.buttons.desc': 'primary, secondary, danger, icon, price, ad-reward',
    'sec.forms':   'Формы',  'sec.forms.desc':   'переключатели, ползунки, поля ввода, чекбоксы',
    'sec.tabs':    'Вкладки','sec.tabs.desc':     'горизонтальные вкладки с нижней линией',
    'sec.panels': 'Панели и карточки', 'sec.panels.desc': 'панель, карточка, кликабельная карточка',
    'sec.overlays': 'Оверлеи', 'sec.overlays.desc': 'модальное окно, нижняя шторка, подсказки',
    'sec.notifications': 'Уведомления', 'sec.notifications.desc': 'тосты, баннеры',
    'sec.progress': 'Прогресс и счётчики', 'sec.progress.desc': 'полосы прогресса, таймер, счётчик, бейдж, аватар, списки',
    'sec.game': 'Игровые элементы', 'sec.game.desc': 'карточки наград, сундук, ежедневные награды, достижения, лидерборд, магазин',
    'sec.effects': 'Эффекты и анимации', 'sec.effects.desc': 'переходы, тряска, цифры урона, монеты, конфетти, частицы, скелетоны',
    'wip': '🚧 В разработке',
    'btn.start': 'Начать игру', 'btn.settings': 'Настройки', 'btn.delete': 'Удалить',
    'btn.buy': 'Купить скин', 'btn.watch_ad': 'Получить награду', 'btn.price_100': '100 🪙',
    'tog.sound': 'Звуковые эффекты', 'tog.music': 'Музыка', 'tog.vibro': 'Вибрация', 'tog.notify': 'Уведомления',
    'sl.volume': 'Громкость', 'sl.music': 'Громкость музыки', 'sl.speed': 'Скорость',
    'tab.game': 'Игра', 'tab.settings': 'Настройки', 'tab.shop': 'Магазин',
    'tab.daily': 'Ежедневно', 'tab.rating': 'Рейтинг', 'tab.friends': 'Друзья',
    'inp.name': 'Имя игрока', 'inp.name.ph': 'Введите имя...',
    'inp.score': 'Рекорд',    'inp.score.ph': '0',
    'inp.search': 'Поиск',    'inp.search.ph': 'Поиск по игрокам...',
    'inp.err': 'Имя слишком короткое',
  },
  en: {
    'ctrl.theme': 'Theme', 'ctrl.variant': 'Variant',
    'ctrl.dark': 'Dark', 'ctrl.light': 'Light', 'ctrl.viewport': 'Viewport',
    'sec.buttons': 'Buttons', 'sec.buttons.desc': 'primary, secondary, danger, icon, price, ad-reward',
    'sec.forms':   'Form Controls', 'sec.forms.desc': 'toggles, sliders, text inputs, checkboxes',
    'sec.tabs':    'Tabs', 'sec.tabs.desc': 'horizontal tab bar with underline indicator',
    'sec.panels': 'Panels & Cards', 'sec.panels.desc': 'panel, card, clickable card with hover state',
    'sec.overlays': 'Overlays', 'sec.overlays.desc': 'modal dialog, bottom sheet, tooltip',
    'sec.notifications': 'Notifications', 'sec.notifications.desc': 'toast stack, banner notification',
    'sec.progress': 'Progress & Counters', 'sec.progress.desc': 'progress bars, countdown timer, animated counter, badge, avatar, scroll list',
    'sec.game': 'Game Elements', 'sec.game.desc': 'reward cards, chest reveal, daily rewards streak, achievement badge, leaderboard, shop, no-coins dialog',
    'sec.effects': 'Effects & Animations', 'sec.effects.desc': 'window transitions, screen shake, floating numbers, flying coins, confetti, particles, skeleton loaders',
    'wip': '🚧 Work in progress',
    'btn.start': 'Start Game', 'btn.settings': 'Settings', 'btn.delete': 'Delete',
    'btn.buy': 'Buy Skin', 'btn.watch_ad': 'Get Reward', 'btn.price_100': '100 🪙',
    'tog.sound': 'Sound Effects', 'tog.music': 'Background Music', 'tog.vibro': 'Vibration', 'tog.notify': 'Notifications',
    'sl.volume': 'Volume', 'sl.music': 'Music Volume', 'sl.speed': 'Speed',
    'tab.game': 'Game', 'tab.settings': 'Settings', 'tab.shop': 'Shop',
    'tab.daily': 'Daily', 'tab.rating': 'Rating', 'tab.friends': 'Friends',
    'inp.name': 'Player Name', 'inp.name.ph': 'Enter name...',
    'inp.score': 'High Score', 'inp.score.ph': '0',
    'inp.search': 'Search',    'inp.search.ph': 'Search players...',
    'inp.err': 'Name is too short',
  },
};

let currentTheme = 'theme-abee-default', currentVariant = 'dark',
    currentLang  = 'ru', currentViewport = 'desktop';

function t(k) { return (I18N[currentLang] || I18N.ru)[k] ?? k; }

function applyLang(lang) {
  currentLang = lang;
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const v = (I18N[lang] || I18N.ru)[el.dataset.i18n];
    if (v !== undefined) el.textContent = v;
  });
  document.querySelectorAll('[data-lang]').forEach(b =>
    b.classList.toggle('sc-btn--on', b.dataset.lang === lang));
  document.documentElement.lang = lang;
  _refreshDemoLabels();
}

function applyTheme(theme, variant) {
  currentTheme = theme; currentVariant = variant;
  const html = document.documentElement;
  html.className = Array.from(html.classList)
    .filter(c => !c.startsWith('theme-') && c !== 'dark' && c !== 'light').join(' ');
  html.classList.add(theme, variant);
  document.querySelectorAll('[data-theme]').forEach(b => b.classList.toggle('sc-btn--on', b.dataset.theme === theme));
  document.querySelectorAll('[data-variant]').forEach(b => b.classList.toggle('sc-btn--on', b.dataset.variant === variant));
}

function applyViewport(vp) {
  currentViewport = vp;
  const frame = document.getElementById('sc-frame');
  if (frame) frame.dataset.viewport = vp;
  document.querySelectorAll('[data-viewport]').forEach(b => b.classList.toggle('sc-btn--on', b.dataset.viewport === vp));
}

document.addEventListener('click', e => {
  const b = e.target.closest('[data-theme],[data-variant],[data-lang],[data-viewport]');
  if (!b) return;
  if ('theme'    in b.dataset) applyTheme(b.dataset.theme, currentVariant);
  if ('variant'  in b.dataset) applyTheme(currentTheme, b.dataset.variant);
  if ('lang'     in b.dataset) applyLang(b.dataset.lang);
  if ('viewport' in b.dataset) applyViewport(b.dataset.viewport);
});

const ICON_STAR = `<svg viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>`;
const ICON_COIN = `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2" fill="none"/><text x="12" y="16" text-anchor="middle" font-size="10" font-weight="bold" fill="currentColor">$</text></svg>`;
const ICON_SEARCH = `<svg viewBox="0 0 24 24"><path d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/></svg>`;

const _demoBtns = [], _demoToggles = [], _demoSliders = [], _demoTabs = [], _demoInputs = [];

function _refreshDemoLabels() {
  _demoBtns.forEach(({ el, labelKey, priceKey }) => {
    const lbl = el.querySelector('.ui-btn__label');
    if (lbl) lbl.textContent = t(labelKey);
    if (el.classList.contains('ui-btn--icon')) el.setAttribute('aria-label', t(labelKey));
    const pr = el.querySelector('.ui-btn__price');
    if (pr && priceKey) pr.textContent = t(priceKey);
  });
  _demoToggles.forEach(({ el, labelKey }) => updateToggle(el, { label: t(labelKey) }));
  _demoSliders.forEach(({ el, labelKey }) => {
    const lbl = el.querySelector('.ui-slider__label'); if (lbl) lbl.textContent = t(labelKey);
  });
  _demoTabs.forEach(({ el, tabDefs }) => {
    tabDefs.forEach(({ id, key }) => {
      const btn = el.querySelector(`[data-tab-id="${id}"] .ui-tabs__label`);
      if (btn) btn.textContent = t(key);
    });
  });
  _demoInputs.forEach(({ el, labelKey, placeholderKey, errorKey }) => {
    const lbl = el.querySelector('.ui-input__label');
    const fld = el.querySelector('.ui-input__field');
    const err = el.querySelector('.ui-input__error-text');
    if (lbl) lbl.textContent = t(labelKey);
    if (fld && placeholderKey) fld.placeholder = t(placeholderKey);
    if (err && errorKey) err.textContent = t(errorKey);
  });
}

function _btnGroup(variant, labelKey, opts = {}) {
  const g = document.createElement('div'); g.className = 'sc-demo-group';
  const h = document.createElement('div'); h.className = 'sc-demo-variant'; h.textContent = variant; g.appendChild(h);
  const row = document.createElement('div'); row.className = 'sc-demo-row';
  const shared = { variant, label: t(labelKey), ...opts };
  const b0 = Button({ ...shared }), b1 = Button({ ...shared, disabled: true }), b2 = Button({ ...shared, loading: true });
  row.append(b0, b1, b2); g.appendChild(row);
  _demoBtns.push({ el: b0, labelKey, priceKey: opts.priceKey ?? null },
                  { el: b1, labelKey, priceKey: opts.priceKey ?? null },
                  { el: b2, labelKey, priceKey: opts.priceKey ?? null });
  return g;
}

function initButtons() {
  const c = document.querySelector('#sec-buttons .sc-items');
  if (!c) return; c.innerHTML = ''; _demoBtns.length = 0;
  c.append(
    _btnGroup('primary',   'btn.start'),
    _btnGroup('secondary', 'btn.settings'),
    _btnGroup('danger',    'btn.delete'),
    _btnGroup('icon',      'btn.start',  { icon: ICON_STAR }),
    _btnGroup('price',     'btn.buy',    { icon: ICON_COIN, price: t('btn.price_100'), priceKey: 'btn.price_100' }),
    _btnGroup('ad',        'btn.watch_ad'),
  );
}

function initForms() {
  const c = document.querySelector('#sec-forms .sc-items');
  if (!c) return; c.innerHTML = ''; _demoToggles.length = 0; _demoSliders.length = 0; _demoInputs.length = 0;

  // Toggles
  const togG = document.createElement('div'); togG.className = 'sc-demo-group';
  const togH = document.createElement('div'); togH.className = 'sc-demo-variant'; togH.textContent = 'toggle'; togG.appendChild(togH);
  const togR = document.createElement('div'); togR.className = 'sc-demo-row sc-demo-row--col';
  [{ lk: 'tog.sound', on: true }, { lk: 'tog.music', on: false },
   { lk: 'tog.vibro', on: true }, { lk: 'tog.notify', on: false }].forEach(({ lk, on }) => {
    const tog = Toggle({ label: t(lk), checked: on }); togR.appendChild(tog); _demoToggles.push({ el: tog, labelKey: lk });
  });
  const togDG = document.createElement('div'); togDG.className = 'sc-demo-group';
  const togDH = document.createElement('div'); togDH.className = 'sc-demo-variant'; togDH.textContent = 'toggle (disabled)'; togDG.appendChild(togDH);
  const togDR = document.createElement('div'); togDR.className = 'sc-demo-row sc-demo-row--col';
  const togD0 = Toggle({ label: t('tog.sound'), checked: true,  disabled: true });
  const togD1 = Toggle({ label: t('tog.music'), checked: false, disabled: true });
  togDR.append(togD0, togD1); _demoToggles.push({ el: togD0, labelKey: 'tog.sound' }, { el: togD1, labelKey: 'tog.music' });

  // Sliders
  const slG = document.createElement('div'); slG.className = 'sc-demo-group sc-demo-group--wide';
  const slH = document.createElement('div'); slH.className = 'sc-demo-variant'; slH.textContent = 'slider'; slG.appendChild(slH);
  const slC = document.createElement('div'); slC.className = 'sc-demo-col';
  [{ lk: 'sl.volume', v: 70 }, { lk: 'sl.music', v: 30 }, { lk: 'sl.speed', v: 50, dis: true }].forEach(({ lk, v, dis }) => {
    const sl = Slider({ label: t(lk), value: v, disabled: !!dis }); slC.appendChild(sl); _demoSliders.push({ el: sl, labelKey: lk });
  });

  // Inputs
  const inpG = document.createElement('div'); inpG.className = 'sc-demo-group sc-demo-group--wide';
  const inpH = document.createElement('div'); inpH.className = 'sc-demo-variant'; inpH.textContent = 'input'; inpG.appendChild(inpH);
  const inpC = document.createElement('div'); inpC.className = 'sc-demo-col';

  const inp0 = Input({ label: t('inp.name'),   placeholder: t('inp.name.ph'),   type: 'text' });
  const inp1 = Input({ label: t('inp.search'),  placeholder: t('inp.search.ph'), type: 'text', icon: ICON_SEARCH });
  const inp2 = Input({ label: t('inp.name'),    placeholder: t('inp.name.ph'),   type: 'text', value: 'X', error: t('inp.err') });
  const inp3 = Input({ label: t('inp.score'),   placeholder: t('inp.score.ph'),  type: 'number', disabled: true });

  inpC.append(inp0, inp1, inp2, inp3);
  _demoInputs.push(
    { el: inp0, labelKey: 'inp.name',   placeholderKey: 'inp.name.ph'   },
    { el: inp1, labelKey: 'inp.search', placeholderKey: 'inp.search.ph' },
    { el: inp2, labelKey: 'inp.name',   placeholderKey: 'inp.name.ph',  errorKey: 'inp.err' },
    { el: inp3, labelKey: 'inp.score',  placeholderKey: 'inp.score.ph'  },
  );

  togG.appendChild(togR); togDG.appendChild(togDR); slG.appendChild(slC); inpG.appendChild(inpC);
  c.append(togG, togDG, slG, inpG);
}

function initTabsSection() {
  const c = document.querySelector('#sec-tabs .sc-items');
  if (!c) return; c.innerHTML = ''; _demoTabs.length = 0;

  const tabDefs1 = [{ id: 'game', key: 'tab.game' }, { id: 'settings', key: 'tab.settings' }, { id: 'shop', key: 'tab.shop' }];
  const g1 = document.createElement('div'); g1.className = 'sc-demo-group sc-demo-group--wide';
  const h1 = document.createElement('div'); h1.className = 'sc-demo-variant'; h1.textContent = 'tabs (3)'; g1.appendChild(h1);
  const t1 = Tabs({ tabs: tabDefs1.map(d => ({ id: d.id, label: t(d.key) })), active: 'game' });
  g1.appendChild(t1); _demoTabs.push({ el: t1, tabDefs: tabDefs1 });

  const tabDefs2 = [{ id: 'daily', key: 'tab.daily' }, { id: 'rating', key: 'tab.rating' }, { id: 'friends', key: 'tab.friends' }, { id: 'shop2', key: 'tab.shop' }];
  const g2 = document.createElement('div'); g2.className = 'sc-demo-group sc-demo-group--wide';
  const h2 = document.createElement('div'); h2.className = 'sc-demo-variant'; h2.textContent = 'tabs (4)'; g2.appendChild(h2);
  const t2 = Tabs({ tabs: tabDefs2.map(d => ({ id: d.id, label: t(d.key) })), active: 'rating' });
  g2.appendChild(t2); _demoTabs.push({ el: t2, tabDefs: tabDefs2 });

  const g3 = document.createElement('div'); g3.className = 'sc-demo-group sc-demo-group--wide';
  const h3 = document.createElement('div'); h3.className = 'sc-demo-variant'; h3.textContent = 'tabs (disabled)'; g3.appendChild(h3);
  const t3 = Tabs({ tabs: tabDefs1.map(d => ({ id: d.id, label: t(d.key) })), active: 'game', disabled: true });
  g3.appendChild(t3); _demoTabs.push({ el: t3, tabDefs: tabDefs1 });

  c.append(g1, g2, g3);
}

applyLang('ru');
applyViewport('desktop');
initButtons();
initForms();
initTabsSection();
