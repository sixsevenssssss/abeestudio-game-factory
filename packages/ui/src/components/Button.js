/**
 * Button — кнопка @abeestudio/ui
 * src/components/Button.js
 *
 * Варианты: 'primary' | 'secondary' | 'danger' | 'icon' | 'price' | 'ad'
 *
 * Пример — кнопка с ценой:
 *   Button({ label: L10n.t('ui.buy'), variant: 'price', price: '100 🪙', icon: COIN_SVG })
 *
 * Пример — кнопка рекламы:
 *   Button({ label: L10n.t('ui.watch_ad'), variant: 'ad' })
 *   // icon по умолчанию — треугольник воспроизведения
 *
 * Событие на document: 'ui:button:click'  { detail: { id, variant } }
 */

let _stylesLoaded = false;

// SVG-иконка воспроизведения по умолчанию для варианта 'ad'
const _AD_ICON_DEFAULT = `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M8 5v14l11-7z"/></svg>`;

/**
 * @param {object}   opts
 * @param {string}   opts.label
 * @param {'primary'|'secondary'|'danger'|'icon'|'price'|'ad'} [opts.variant='primary']
 * @param {boolean}  [opts.disabled=false]
 * @param {boolean}  [opts.loading=false]
 * @param {string}   [opts.icon=null]   — SVG-строка иконки (для ad: используется _AD_ICON_DEFAULT если не задана)
 * @param {string}   [opts.price=null]  — строка цены только для variant='price' (напр. '100 🪙')
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
  price    = null,
  id       = null,
  onClick  = null,
} = {}) {
  _loadStyles();

  const btn = document.createElement('button');
  btn.type      = 'button';
  btn.className = `ui-btn ui-btn--${variant}`;
  if (id) btn.dataset.id = id;

  // Для 'ad' — использовать иконку по умолчанию если не передана
  const effectiveIcon = variant === 'ad' ? (icon ?? _AD_ICON_DEFAULT) : icon;

  // Иконка
  if (effectiveIcon) {
    const iconEl = document.createElement('span');
    iconEl.className = 'ui-btn__icon';
    iconEl.setAttribute('aria-hidden', 'true');
    iconEl.innerHTML = effectiveIcon;
    btn.appendChild(iconEl);
  }

  // Текст (не показываем для 'icon')
  if (variant !== 'icon' && label) {
    const labelEl = document.createElement('span');
    labelEl.className = 'ui-btn__label';
    labelEl.textContent = label;
    btn.appendChild(labelEl);
  } else if (variant === 'icon') {
    if (label) btn.setAttribute('aria-label', label);
  }

  // Бейдж цены (только для 'price')
  if (variant === 'price' && price != null) {
    const priceEl = document.createElement('span');
    priceEl.className = 'ui-btn__price';
    priceEl.textContent = price;
    priceEl.setAttribute('aria-label', price);
    btn.appendChild(priceEl);
  }

  // Спиннер — скрыт в обычном состоянии
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

  // Клик
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
 * @param {{ label?, price?, disabled?, loading? }} changes
 */
export function updateButton(btn, { label, price, disabled, loading } = {}) {
  if (label !== undefined) {
    const el = btn.querySelector('.ui-btn__label');
    if (el) el.textContent = label;
    if (btn.classList.contains('ui-btn--icon')) btn.setAttribute('aria-label', label);
  }
  if (price !== undefined) {
    const el = btn.querySelector('.ui-btn__price');
    if (el) el.textContent = price;
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
