/**
 * Button — кнопка @abeestudio/ui
 * src/components/Button.js
 *
 * Использование:
 *   import { Button } from '../ui/src/components/Button.js';
 *
 *   const btn = Button({
 *     label:    L10n.t('ui.btn.start'),  // переведённая строка
 *     variant:  'primary',               // 'primary'|'secondary'|'danger'|'icon'
 *     disabled: false,
 *     loading:  false,
 *     icon:     '<svg>...</svg>',        // опционально
 *     id:       'start-btn',            // для событий
 *     onClick:  () => startGame(),
 *   });
 *   container.appendChild(btn);
 *
 * Событие на document: 'ui:button:click'  { detail: { id, variant } }
 */

let _stylesLoaded = false;

/**
 * @param {object}   opts
 * @param {string}   opts.label
 * @param {'primary'|'secondary'|'danger'|'icon'} [opts.variant='primary']
 * @param {boolean}  [opts.disabled=false]
 * @param {boolean}  [opts.loading=false]
 * @param {string}   [opts.icon=null]     — SVG-строка иконки
 * @param {string}   [opts.id=null]
 * @param {function} [opts.onClick=null]
 * @returns {HTMLButtonElement}
 */
export function Button({
  label    = '',
  variant  = 'primary',
  disabled = false,
  loading  = false,
  icon     = null,
  id       = null,
  onClick  = null,
} = {}) {
  _loadStyles();

  const btn = document.createElement('button');
  btn.type      = 'button';
  btn.className = `ui-btn ui-btn--${variant}`;
  if (id) btn.dataset.id = id;

  // Иконка (опционально, для любого варианта; обязательна для 'icon')
  if (icon) {
    const iconEl = document.createElement('span');
    iconEl.className = 'ui-btn__icon';
    iconEl.setAttribute('aria-hidden', 'true');
    iconEl.innerHTML = icon;
    btn.appendChild(iconEl);
  }

  // Текст (не показываем для варианта 'icon')
  if (variant !== 'icon' && label) {
    const labelEl = document.createElement('span');
    labelEl.className = 'ui-btn__label';
    labelEl.textContent = label;
    btn.appendChild(labelEl);
  } else if (variant === 'icon') {
    // aria-label для доступности кнопки-иконки
    if (label) btn.setAttribute('aria-label', label);
  }

  // Спиннер — скрыт в обычном состоянии, виден при loading
  const spinner = document.createElement('span');
  spinner.className = 'ui-btn__spinner';
  spinner.setAttribute('aria-hidden', 'true');
  btn.appendChild(spinner);

  // Начальные состояния
  if (disabled) {
    btn.disabled = true;
    btn.setAttribute('aria-disabled', 'true');
  }
  if (loading) {
    btn.classList.add('ui-btn--loading');
    btn.disabled = true;
  }

  // Обработчик клика
  btn.addEventListener('click', e => {
    if (btn.disabled) return;
    onClick?.(e);
    document.dispatchEvent(new CustomEvent('ui:button:click', {
      detail: { id, variant },
      bubbles: false,
    }));
  });

  return btn;
}

/**
 * Обновляет кнопку без перерендеринга.
 * @param {HTMLButtonElement} btn
 * @param {{ label?, disabled?, loading? }} changes
 */
export function updateButton(btn, { label, disabled, loading } = {}) {
  if (label !== undefined) {
    const el = btn.querySelector('.ui-btn__label');
    if (el) el.textContent = label;
    if (btn.dataset.variant === 'icon') btn.setAttribute('aria-label', label);
  }
  if (loading !== undefined) {
    btn.classList.toggle('ui-btn--loading', loading);
    btn.disabled = loading || disabled === true;
  }
  if (disabled !== undefined && loading === undefined) {
    btn.disabled = disabled || btn.classList.contains('ui-btn--loading');
    btn.setAttribute('aria-disabled', String(btn.disabled));
  }
}

// ── Автозагрузка стилей ──────────────────────────────────────
function _loadStyles() {
  if (_stylesLoaded || typeof document === 'undefined') return;
  _stylesLoaded = true;
  if (document.querySelector('[data-ui-styles="button"]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.dataset.uiStyles = 'button';
  link.href = new URL('./Button.css', import.meta.url).href;
  document.head.appendChild(link);
}
