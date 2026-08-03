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

    // Кнопки — метки состояний
    'btn.demo.start':    'Начать игру',
    'btn.demo.second':   'Настройки',
    'btn.demo.delete':   'Удалить',
    'btn.demo.disabled': 'Недоступно',
    'btn.demo.loading':  'Загрузка',
    'state.default':     'По умолчанию',
    'state.disabled':    'Заблокировано',
    'state.loading':     'Загрузка',
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

    'btn.demo.start':    'Start Game',
    'btn.demo.second':   'Settings',
    'btn.demo.delete':   'Delete',
    'btn.demo.disabled': 'Unavailable',
    'btn.demo.loading':  'Loading...',
    'state.default':     'Default',
    'state.disabled':    'Disabled',
    'state.loading':     'Loading',
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
    const key = el.dataset.i18n;
    const val = (I18N[lang] || I18N.ru)[key];
    if (val !== undefined) el.textContent = val;
  });
  document.querySelectorAll('[data-lang]').forEach(btn => {
    btn.classList.toggle('sc-btn--on', btn.dataset.lang === lang);
  });
  document.documentElement.lang = lang;
  _refreshButtonLabels();
}

// ── Тема ──────────────────────────────────────────────────────
function applyTheme(theme, variant) {
  currentTheme   = theme;
  currentVariant = variant;
  const html  = document.documentElement;
  const keep  = Array.from(html.classList).filter(
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

// ── Обработчик кликов ─────────────────────────────────────────
document.addEventListener('click', e => {
  const btn = e.target.closest('[data-theme],[data-variant],[data-lang],[data-viewport]');
  if (!btn) return;
  if ('theme'    in btn.dataset) applyTheme(btn.dataset.theme, currentVariant);
  if ('variant'  in btn.dataset) applyTheme(currentTheme, btn.dataset.variant);
  if ('lang'     in btn.dataset) applyLang(btn.dataset.lang);
  if ('viewport' in btn.dataset) applyViewport(btn.dataset.viewport);
});

// ── КОМПОНЕНТЫ: Кнопки ───────────────────────────────────────
// SVG-иконка для кнопок-иконок (простая звезда)
const ICON_STAR = `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
</svg>`;

// Хранилище кнопок с метками — для обновления при смене языка
const _demoButtons = [];

function initButtons() {
  const container = document.querySelector('#sec-buttons .sc-items');
  if (!container) return;
  container.innerHTML = '';
  _demoButtons.length = 0;

  // Группы: [вариант, ключ метки, иконка]
  const specs = [
    { variant: 'primary',   labelKey: 'btn.demo.start',  icon: null },
    { variant: 'secondary', labelKey: 'btn.demo.second', icon: null },
    { variant: 'danger',    labelKey: 'btn.demo.delete', icon: null },
    { variant: 'icon',      labelKey: 'btn.demo.start',  icon: ICON_STAR },
  ];

  specs.forEach(({ variant, labelKey, icon }) => {
    const group = document.createElement('div');
    group.className = 'sc-demo-group';

    // Заголовок варианта
    const heading = document.createElement('div');
    heading.className = 'sc-demo-variant';
    heading.textContent = variant;
    group.appendChild(heading);

    // Строка состояний
    const row = document.createElement('div');
    row.className = 'sc-demo-row';

    // default
    const btnDefault = Button({ label: t(labelKey), variant, icon });
    row.appendChild(btnDefault);
    _demoButtons.push({ el: btnDefault, key: labelKey });

    // disabled
    const btnDisabled = Button({ label: t(labelKey), variant, icon, disabled: true });
    row.appendChild(btnDisabled);
    _demoButtons.push({ el: btnDisabled, key: labelKey });

    // loading
    const btnLoading = Button({ label: t(labelKey), variant, icon, loading: true });
    row.appendChild(btnLoading);
    _demoButtons.push({ el: btnLoading, key: labelKey });

    group.appendChild(row);
    container.appendChild(group);
  });
}

function _refreshButtonLabels() {
  _demoButtons.forEach(({ el, key }) => {
    const labelEl = el.querySelector('.ui-btn__label');
    if (labelEl) labelEl.textContent = t(key);
    const ariaLabel = el.getAttribute('aria-label');
    if (ariaLabel) el.setAttribute('aria-label', t(key));
  });
}

// ── Инициализация ────────────────────────────────────────────
applyLang('ru');
applyViewport('desktop');
initButtons();
