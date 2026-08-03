/**
 * showcase.js — логика витрины @abeestudio/ui
 * Переключатели темы / варианта / языка / viewport.
 * Mock L10n — имитирует L10n.t() для демонстрации двуязычности.
 *
 * NB: английские строки намеренно длиннее русских — тест на обрезание.
 */

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
  },
};

// ── State ─────────────────────────────────────────────────────
let currentTheme   = 'theme-abee-default';
let currentVariant = 'dark';
let currentLang    = 'ru';
let currentViewport = 'desktop';

// ── Применить локализацию ─────────────────────────────────────
function applyLang(lang) {
  currentLang = lang;
  const dict = I18N[lang] || I18N.ru;
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.dataset.i18n;
    if (key && dict[key] !== undefined) el.textContent = dict[key];
  });
  document.querySelectorAll('[data-lang]').forEach(btn => {
    btn.classList.toggle('sc-btn--on', btn.dataset.lang === lang);
  });
  document.documentElement.lang = lang;
}

// ── Применить тему ────────────────────────────────────────────
function applyTheme(theme, variant) {
  currentTheme   = theme;
  currentVariant = variant;

  const html = document.documentElement;
  // Убираем все theme-* классы и варианты
  const classes = Array.from(html.classList).filter(
    c => !c.startsWith('theme-') && c !== 'dark' && c !== 'light'
  );
  html.className = classes.join(' ');
  html.classList.add(theme, variant);

  document.querySelectorAll('[data-theme]').forEach(btn => {
    btn.classList.toggle('sc-btn--on', btn.dataset.theme === theme);
  });
  document.querySelectorAll('[data-variant]').forEach(btn => {
    btn.classList.toggle('sc-btn--on', btn.dataset.variant === variant);
  });
}

// ── Применить viewport ────────────────────────────────────────
function applyViewport(vp) {
  currentViewport = vp;
  const frame = document.getElementById('sc-frame');
  if (frame) frame.dataset.viewport = vp;
  document.querySelectorAll('[data-viewport]').forEach(btn => {
    btn.classList.toggle('sc-btn--on', btn.dataset.viewport === vp);
  });
}

// ── Делегированный обработчик кликов ─────────────────────────
document.addEventListener('click', e => {
  const btn = e.target.closest('[data-theme],[data-variant],[data-lang],[data-viewport]');
  if (!btn) return;

  if ('theme'    in btn.dataset) applyTheme(btn.dataset.theme, currentVariant);
  if ('variant'  in btn.dataset) applyTheme(currentTheme, btn.dataset.variant);
  if ('lang'     in btn.dataset) applyLang(btn.dataset.lang);
  if ('viewport' in btn.dataset) applyViewport(btn.dataset.viewport);
});

// ── Инициализация ────────────────────────────────────────────
applyLang('ru');
applyViewport('desktop');
