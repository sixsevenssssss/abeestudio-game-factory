/**
 * Panel + Card — контейнеры @abeestudio/ui
 * src/components/Panel.js
 *
 * Panel — группирующая панель (настройки, инвентарь и т.п.)
 * Card  — карточка с тенью, рамкой, кликабельный вариант
 *
 * Использование:
 *   import { Panel, Card } from '../ui/src/components/Panel.js';
 *
 *   // Панель
 *   const panel = Panel({ title: L10n.t('ui.settings') });
 *   panel.body.appendChild(myToggle);
 *
 *   // Карточка (кликабельная)
 *   const card = Card({
 *     title:     L10n.t('ui.hero.axe'),
 *     variant:   'elevated',
 *     clickable: true,
 *     onClick:   () => openItem(id),
 *   });
 *   card.body.appendChild(itemContent);
 */

let _stylesLoaded = false;

// ─────────────────────────────────────────────────────────────
// PANEL
// ─────────────────────────────────────────────────────────────

/**
 * @param {object}   opts
 * @param {string}   [opts.title='']    — заголовок (null/'' = без заголовка)
 * @param {boolean}  [opts.padding=true]
 * @returns {{ root: HTMLDivElement, body: HTMLDivElement, setTitle(t): void }}
 */
export function Panel({
  title   = '',
  padding = true,
} = {}) {
  _loadStyles();

  const root = document.createElement('div');
  root.className = 'ui-panel';

  let titleEl = null;
  if (title) {
    const header = document.createElement('div');
    header.className = 'ui-panel__header';
    titleEl = document.createElement('h3');
    titleEl.className   = 'ui-panel__title';
    titleEl.textContent = title;
    header.appendChild(titleEl);
    root.appendChild(header);
  }

  const body = document.createElement('div');
  body.className = `ui-panel__body${padding ? '' : ' ui-panel__body--no-pad'}`;
  root.appendChild(body);

  return Object.assign(root, {
    body,
    setTitle(t) {
      if (titleEl) titleEl.textContent = t;
    },
  });
}

// ─────────────────────────────────────────────────────────────
// CARD
// ─────────────────────────────────────────────────────────────

/**
 * @param {object}   opts
 * @param {string}   [opts.title='']
 * @param {'default'|'outlined'|'elevated'} [opts.variant='default']
 * @param {boolean}  [opts.clickable=false]
 * @param {boolean}  [opts.padding=true]
 * @param {string}   [opts.id=null]
 * @param {function} [opts.onClick=null]
 * @returns {{ root: HTMLDivElement, body: HTMLDivElement, setTitle(t): void }}
 */
export function Card({
  title     = '',
  variant   = 'default',
  clickable = false,
  padding   = true,
  id        = null,
  onClick   = null,
} = {}) {
  _loadStyles();

  const root = document.createElement('div');
  root.className = `ui-card ui-card--${variant}`;
  if (clickable) {
    root.classList.add('ui-card--clickable');
    root.setAttribute('role', 'button');
    root.setAttribute('tabindex', '0');
    root.style.cursor = 'pointer';
  }
  if (id) root.dataset.id = id;

  let titleEl = null;
  if (title) {
    const header = document.createElement('div');
    header.className = 'ui-card__header';
    titleEl = document.createElement('h3');
    titleEl.className   = 'ui-card__title';
    titleEl.textContent = title;
    header.appendChild(titleEl);
    root.appendChild(header);
  }

  const body = document.createElement('div');
  body.className = `ui-card__body${padding ? '' : ' ui-card__body--no-pad'}`;
  root.appendChild(body);

  // Клик и клавиатура (для кликабельного варианта)
  if (clickable) {
    const fire = (e) => {
      onClick?.(e);
      document.dispatchEvent(new CustomEvent('ui:card:click', {
        detail: { id },
        bubbles: false,
      }));
    };
    root.addEventListener('click',   fire);
    root.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fire(e); }
    });
  }

  return Object.assign(root, {
    body,
    setTitle(t) {
      if (titleEl) titleEl.textContent = t;
    },
  });
}

// ── Автозагрузка стилей ──────────────────────────────────────
function _loadStyles() {
  if (_stylesLoaded || typeof document === 'undefined') return;
  _stylesLoaded = true;
  if (document.querySelector('[data-ui-styles="panel"]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.dataset.uiStyles = 'panel';
  link.href = new URL('./Panel.css', import.meta.url).href;
  document.head.appendChild(link);
}
