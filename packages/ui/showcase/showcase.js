/**
 * showcase.js — логика витрины @abeestudio/ui
 */

import { Button }              from '../src/components/Button.js';
import { Toggle, updateToggle } from '../src/components/Toggle.js';

// ── Mock L10n ─────────────────────────────────────────────────
const I18N = {
  ru: {
    'ctrl.theme':    'Тема',    'ctrl.variant':  'Вариант',
    'ctrl.dark':     'Тёмная',  'ctrl.light':    'Светлая',
    'ctrl.viewport': 'Экран',

    'sec.buttons':            'Кнопки',
    'sec.buttons.desc':       'primary, secondary, danger, icon, price, ad-reward',
    'sec.forms':              'Формы',
    'sec.forms.desc':         'переключатели, ползунки, поля ввода, чекбоксы',
    'sec.tabs':               'Вкладки',
    'sec.tabs.desc':          'горизонтальные вкладки с нижней линией',
    'sec.panels':             'Панели и карточки',
    'sec.panels.desc':        'панель, карточка, кликабельная карточка',
    'sec.overlays':           'Оверлеи',
    'sec.overlays.desc':      'модальное окно, нижняя шторка, подсказки',
    'sec.notifications':      'Уведомления',
    'sec.notifications.desc': 'тосты, баннеры',
    'sec.progress':           'Прогресс и счётчики',
    'sec.progress.desc':      'полосы прогресса, таймер, счётчик, бейдж, аватар, списки',
    'sec.game':               'Игровые элементы',
    'sec.game.desc':          'карточки наград, сундук, ежедневные награды, достижения, лидерборд, магазин',
    'sec.effects':            'Эффекты и анимации',
    'sec.effects.desc':       'переходы, тряска, цифры урона, монеты, конфетти, частицы, скелетоны',
    'wip': '🚧 В разработке',

    // Кнопки
    'btn.start':     'Начать игру',  'btn.settings': 'Настройки',
    'btn.delete':    'Удалить',       'btn.buy':      'Купить скин',
    'btn.watch_ad':  'Получить награду',
    'btn.price_100': '100 🪙',

    // Переключатели
    'tog.sound':   'Звуковые эффекты',
    'tog.music':   'Музыка',
    'tog.vibro':   'Вибрация',
    'tog.notify':  'Уведомления',
  },
  en: {
    'ctrl.theme':    'Theme',   'ctrl.variant':  'Variant',
    'ctrl.dark':     'Dark',    'ctrl.light':    'Light',
    'ctrl.viewport': 'Viewport',

    'sec.buttons':            'Buttons',
    'sec.buttons.desc':       'primary, secondary, danger, icon, price, ad-reward',
    'sec.forms':              'Form Controls',
    'sec.forms.desc':         'toggles, sliders, text inputs, checkboxes',
    'sec.tabs':               'Tabs',
    'sec.tabs.desc':          'horizontal tab bar with underline indicator',
    'sec.panels':             'Panels & Cards',
    'sec.panels.desc':        'panel, card, clickable card with hover state',
    'sec.overlays':           'Overlays',
    'sec.overlays.desc':      'modal dialog, bottom sheet, tooltip',
    'sec.notifications':      'Notifications',
    'sec.notifications.desc': 'toast stack, banner notification',
    'sec.progress':           'Progress & Counters',
    'sec.progress.desc':      'progress bars, countdown timer, animated counter, badge, avatar, scroll list',
    'sec.game':               'Game Elements',
    'sec.game.desc':          'reward cards, chest reveal, daily rewards streak, achievement badge, leaderboard, shop, no-coins dialog',
    'sec.effects':            'Effects & Animations',
    'sec.effects.desc':       'window transitions, screen shake, floating numbers, flying coins, confetti, particles, skeleton loaders',
    'wip': '🚧 Work in progress',

    'btn.start':     'Start Game',   'btn.settings': 'Settings',
    'btn.delete':    'Delete',        'btn.buy':      'Buy Skin',
    'btn.watch_ad':  'Get Reward',
    'btn.price_100': '100 🪙',

    'tog.sound':   'Sound Effects',
    'tog.music':   'Background Music',
    'tog.vibro':   'Vibration',
    'tog.notify':  'Notifications',
  },
};

let currentTheme = 'theme-abee-default', currentVariant = 'dark',
    currentLang  = 'ru', currentViewport = 'desktop';

function t(key) { return (I18N[currentLang] || I18N.ru)[key] ?? key; }

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
  const keep = Array.from(html.classList).filter(
    c => !c.startsWith('theme-') && c !== 'dark' && c !== 'light');
  html.className = keep.join(' ');
  html.classList.add(theme, variant);
  document.querySelectorAll('[data-theme]').forEach(b =>
    b.classList.toggle('sc-btn--on', b.dataset.theme === theme));
  document.querySelectorAll('[data-variant]').forEach(b =>
    b.classList.toggle('sc-btn--on', b.dataset.variant === variant));
}

function applyViewport(vp) {
  currentViewport = vp;
  const frame = document.getElementById('sc-frame');
  if (frame) frame.dataset.viewport = vp;
  document.querySelectorAll('[data-viewport]').forEach(b =>
    b.classList.toggle('sc-btn--on', b.dataset.viewport === vp));
}

document.addEventListener('click', e => {
  const b = e.target.closest('[data-theme],[data-variant],[data-lang],[data-viewport]');
  if (!b) return;
  if ('theme'    in b.dataset) applyTheme(b.dataset.theme, currentVariant);
  if ('variant'  in b.dataset) applyTheme(currentTheme, b.dataset.variant);
  if ('lang'     in b.dataset) applyLang(b.dataset.lang);
  if ('viewport' in b.dataset) applyViewport(b.dataset.viewport);
});

// ── ИКОНКИ ───────────────────────────────────────────────────
const ICON_STAR = `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
</svg>`;
const ICON_COIN = `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
  <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2" fill="none"/>
  <text x="12" y="16" text-anchor="middle" font-size="10" font-weight="bold" fill="currentColor">$</text>
</svg>`;

// ── Реестр демо-элементов ─────────────────────────────────────
const _demoBtns    = [];  // { el, labelKey, priceKey? }
const _demoToggles = [];  // { el, labelKey }

function _refreshDemoLabels() {
  _demoBtns.forEach(({ el, labelKey, priceKey }) => {
    const lbl = el.querySelector('.ui-btn__label');
    if (lbl) lbl.textContent = t(labelKey);
    if (el.classList.contains('ui-btn--icon')) el.setAttribute('aria-label', t(labelKey));
    const pr = el.querySelector('.ui-btn__price');
    if (pr && priceKey) pr.textContent = t(priceKey);
  });
  _demoToggles.forEach(({ el, labelKey }) =>
    updateToggle(el, { label: t(labelKey) }));
}

// ── Фабрики ──────────────────────────────────────────────────
function _btnGroup(variant, labelKey, opts = {}) {
  const g = document.createElement('div');
  g.className = 'sc-demo-group';
  const h = document.createElement('div');
  h.className = 'sc-demo-variant'; h.textContent = variant; g.appendChild(h);
  const row = document.createElement('div'); row.className = 'sc-demo-row';
  const shared = { variant, label: t(labelKey), ...opts };
  const b0 = Button({ ...shared });
  const b1 = Button({ ...shared, disabled: true });
  const b2 = Button({ ...shared, loading: true });
  row.append(b0, b1, b2); g.appendChild(row);
  _demoBtns.push(
    { el: b0, labelKey, priceKey: opts.priceKey ?? null },
    { el: b1, labelKey, priceKey: opts.priceKey ?? null },
    { el: b2, labelKey, priceKey: opts.priceKey ?? null },
  );
  return g;
}

// ── Секции ────────────────────────────────────────────────────
function initButtons() {
  const c = document.querySelector('#sec-buttons .sc-items');
  if (!c) return;
  c.innerHTML = ''; _demoBtns.length = 0;
  c.append(
    _btnGroup('primary',   'btn.start'),
    _btnGroup('secondary', 'btn.settings'),
    _btnGroup('danger',    'btn.delete'),
    _btnGroup('icon',      'btn.start',    { icon: ICON_STAR }),
    _btnGroup('price',     'btn.buy',      { icon: ICON_COIN, price: t('btn.price_100'), priceKey: 'btn.price_100' }),
    _btnGroup('ad',        'btn.watch_ad'),
  );
}

function initForms() {
  const c = document.querySelector('#sec-forms .sc-items');
  if (!c) return;
  c.innerHTML = ''; _demoToggles.length = 0;

  // Переключатели — 4 варианта
  const toggleDefs = [
    { labelKey: 'tog.sound',  checked: true  },
    { labelKey: 'tog.music',  checked: false },
    { labelKey: 'tog.vibro',  checked: true  },
    { labelKey: 'tog.notify', checked: false },
  ];

  // Группа: включённые / выключенные
  const onGroup = document.createElement('div');
  onGroup.className = 'sc-demo-group';
  const onHead = document.createElement('div');
  onHead.className = 'sc-demo-variant'; onHead.textContent = 'toggle'; onGroup.appendChild(onHead);
  const onRow = document.createElement('div'); onRow.className = 'sc-demo-row sc-demo-row--col';

  toggleDefs.forEach(({ labelKey, checked }) => {
    const tog = Toggle({ label: t(labelKey), checked });
    onRow.appendChild(tog);
    _demoToggles.push({ el: tog, labelKey });
  });

  // Disabled toggle
  const disabledGroup = document.createElement('div');
  disabledGroup.className = 'sc-demo-group';
  const disHead = document.createElement('div');
  disHead.className = 'sc-demo-variant'; disHead.textContent = 'toggle (disabled)'; disabledGroup.appendChild(disHead);
  const disRow = document.createElement('div'); disRow.className = 'sc-demo-row sc-demo-row--col';

  const togDis0 = Toggle({ label: t('tog.sound'), checked: true,  disabled: true });
  const togDis1 = Toggle({ label: t('tog.music'), checked: false, disabled: true });
  disRow.append(togDis0, togDis1);
  _demoToggles.push({ el: togDis0, labelKey: 'tog.sound' }, { el: togDis1, labelKey: 'tog.music' });

  onGroup.appendChild(onRow);
  disabledGroup.appendChild(disRow);
  c.append(onGroup, disabledGroup);
}

// ── Инициализация ────────────────────────────────────────────
applyLang('ru');
applyViewport('desktop');
initButtons();
initForms();
