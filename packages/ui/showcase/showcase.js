/**
 * showcase.js — логика витрины @abeestudio/ui
 * Переключатели темы / варианта / языка / viewport + рендер компонентов.
 */

import { Button } from '../src/components/Button.js';

// ── Mock локализация ──────────────────────────────────────────
const I18N = {
  ru: {
    'ctrl.theme':    'Тема',
    'ctrl.variant':  'Вариант',
    'ctrl.dark':     'Тёмная',
    'ctrl.light':    'Светлая',
    'ctrl.viewport': 'Экран',

    'sec.buttons':       'Кнопки',
    'sec.buttons.desc':  'primary, secondary, danger, icon, price, ad-reward',
    'sec.forms':         'Формы',
    'sec.forms.desc':    'переключатели, ползунки, поля ввода, чекбоксы',
    'sec.tabs':          'Вкладки',
    'sec.tabs.desc':     'горизонтальные вкладки с нижней линией',
    'sec.panels':        'Панели и карточки',
    'sec.panels.desc':   'панель, карточка, кликабельная карточка',
    'sec.overlays':      'Оверлеи',
    'sec.overlays.desc': 'модальное окно, нижняя шторка, подсказки',
    'sec.notifications':      'Уведомления',
    'sec.notifications.desc': 'тосты, баннеры',
    'sec.progress':      'Прогресс и счётчики',
    'sec.progress.desc': 'полосы прогресса, таймер, счётчик, бейдж, аватар, списки',
    'sec.game':          'Игровые элементы',
    'sec.game.desc':     'карточки наград, сундук, ежедневные награды, достижения, лидерборд, магазин',
    'sec.effects':       'Эффекты и анимации',
    'sec.effects.desc':  'переходы, тряска, цифры урона, монеты, конфетти, частицы, скелетоны',
    'wip': '🚧 В разработке',

    'btn.start':     'Начать игру',
    'btn.settings':  'Настройки',
    'btn.delete':    'Удалить',
    'btn.buy':       'Купить скин',
    'btn.watch_ad':  'Получить награду',
    'btn.price_100': '100 🪙',
    'btn.price_free':'Бесплатно',
    'state.default':  'По умолчанию',
    'state.disabled': 'Заблокировано',
    'state.loading':  'Загрузка',
  },
  en: {
    'ctrl.theme':    'Theme',
    'ctrl.variant':  'Variant',
    'ctrl.dark':     'Dark',
    'ctrl.light':    'Light',
    'ctrl.viewport': 'Viewport',

    'sec.buttons':       'Buttons',
    'sec.buttons.desc':  'primary, secondary, danger, icon, price, ad-reward',
    'sec.forms':         'Form Controls',
    'sec.forms.desc':    'toggles, sliders, text inputs, checkboxes',
    'sec.tabs':          'Tabs',
    'sec.tabs.desc':     'horizontal tab bar with underline indicator',
    'sec.panels':        'Panels & Cards',
    'sec.panels.desc':   'panel, card, clickable card with hover state',
    'sec.overlays':      'Overlays',
    'sec.overlays.desc': 'modal dialog, bottom sheet, tooltip',
    'sec.notifications':      'Notifications',
    'sec.notifications.desc': 'toast stack, banner notification',
    'sec.progress':      'Progress & Counters',
    'sec.progress.desc': 'progress bars, countdown timer, animated counter, badge, avatar, scroll list',
    'sec.game':          'Game Elements',
    'sec.game.desc':     'reward cards, chest reveal, daily rewards streak, achievement badge, leaderboard, shop, no-coins dialog',
    'sec.effects':       'Effects & Animations',
    'sec.effects.desc':  'window transitions, screen shake, floating numbers, flying coins, confetti, particles, skeleton loaders',
    'wip': '🚧 Work in progress',

    'btn.start':     'Start Game',
    'btn.settings':  'Settings',
    'btn.delete':    'Delete',
    'btn.buy':       'Buy Skin',
    'btn.watch_ad':  'Get Reward',
    'btn.price_100': '100 🪙',
    'btn.price_free':'Free',
    'state.default':  'Default',
    'state.disabled': 'Disabled',
    'state.loading':  'Loading',
  },
};

// ── State ─────────────────────────────────────────────────────
let currentTheme    = 'theme-abee-default';
let currentVariant  = 'dark';
let currentLang     = 'ru';
let currentViewport = 'desktop';

// ── Локализация ───────────────────────────────────────────────
function t(key) { return (I18N[currentLang] || I18N.ru)[key] ?? key; }

function applyLang(lang) {
  currentLang = lang;
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const val = (I18N[lang] || I18N.ru)[el.dataset.i18n];
    if (val !== undefined) el.textContent = val;
  });
  document.querySelectorAll('[data-lang]').forEach(b =>
    b.classList.toggle('sc-btn--on', b.dataset.lang === lang));
  document.documentElement.lang = lang;
  _refreshButtons();
}

// ── Тема ──────────────────────────────────────────────────────
function applyTheme(theme, variant) {
  currentTheme   = theme;
  currentVariant = variant;
  const html = document.documentElement;
  const keep = Array.from(html.classList).filter(
    c => !c.startsWith('theme-') && c !== 'dark' && c !== 'light'
  );
  html.className = keep.join(' ');
  html.classList.add(theme, variant);
  document.querySelectorAll('[data-theme]').forEach(b =>
    b.classList.toggle('sc-btn--on', b.dataset.theme === theme));
  document.querySelectorAll('[data-variant]').forEach(b =>
    b.classList.toggle('sc-btn--on', b.dataset.variant === variant));
}

// ── Viewport ──────────────────────────────────────────────────
function applyViewport(vp) {
  currentViewport = vp;
  const frame = document.getElementById('sc-frame');
  if (frame) frame.dataset.viewport = vp;
  document.querySelectorAll('[data-viewport]').forEach(b =>
    b.classList.toggle('sc-btn--on', b.dataset.viewport === vp));
}

// ── Клики ─────────────────────────────────────────────────────
document.addEventListener('click', e => {
  const btn = e.target.closest('[data-theme],[data-variant],[data-lang],[data-viewport]');
  if (!btn) return;
  if ('theme'    in btn.dataset) applyTheme(btn.dataset.theme, currentVariant);
  if ('variant'  in btn.dataset) applyTheme(currentTheme, btn.dataset.variant);
  if ('lang'     in btn.dataset) applyLang(btn.dataset.lang);
  if ('viewport' in btn.dataset) applyViewport(btn.dataset.viewport);
});

// ── ИКОНКИ ДЛЯ ДЕМО ──────────────────────────────────────────
const ICON_STAR = `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
</svg>`;

const ICON_COIN = `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
  <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2" fill="none"/>
  <text x="12" y="16" text-anchor="middle" font-size="10" font-weight="bold" fill="currentColor">$</text>
</svg>`;

// ── Реестр кнопок для обновления при смене языка ──────────────
// { el, labelKey, priceKey }
const _btns = [];

function _refreshButtons() {
  _btns.forEach(({ el, labelKey, priceKey }) => {
    const labelEl = el.querySelector('.ui-btn__label');
    if (labelEl) labelEl.textContent = t(labelKey);
    if (el.classList.contains('ui-btn--icon')) el.setAttribute('aria-label', t(labelKey));
    const priceEl = el.querySelector('.ui-btn__price');
    if (priceEl && priceKey) priceEl.textContent = t(priceKey);
  });
}

// ── Фабрика демо-группы ───────────────────────────────────────
function _demoGroup(variant, labelKey, opts = {}) {
  const group = document.createElement('div');
  group.className = 'sc-demo-group';

  const heading = document.createElement('div');
  heading.className = 'sc-demo-variant';
  heading.textContent = variant;
  group.appendChild(heading);

  const row = document.createElement('div');
  row.className = 'sc-demo-row';

  const sharedOpts = { variant, label: t(labelKey), ...opts };

  const b0 = Button({ ...sharedOpts });
  const b1 = Button({ ...sharedOpts, disabled: true });
  const b2 = Button({ ...sharedOpts, loading: true });

  row.append(b0, b1, b2);
  group.appendChild(row);

  _btns.push(
    { el: b0, labelKey, priceKey: opts.priceKey ?? null },
    { el: b1, labelKey, priceKey: opts.priceKey ?? null },
    { el: b2, labelKey, priceKey: opts.priceKey ?? null },
  );
  return group;
}

// ── Секция Кнопки ─────────────────────────────────────────────
function initButtons() {
  const container = document.querySelector('#sec-buttons .sc-items');
  if (!container) return;
  container.innerHTML = '';
  _btns.length = 0;

  container.append(
    _demoGroup('primary',   'btn.start'),
    _demoGroup('secondary', 'btn.settings'),
    _demoGroup('danger',    'btn.delete'),
    _demoGroup('icon',      'btn.start',    { icon: ICON_STAR }),
    _demoGroup('price',     'btn.buy',      { icon: ICON_COIN, price: t('btn.price_100'), priceKey: 'btn.price_100' }),
    _demoGroup('ad',        'btn.watch_ad'),
  );
}

// ── Инициализация ────────────────────────────────────────────
applyLang('ru');
applyViewport('desktop');
initButtons();
