/**
 * Checkbox — чекбокс @abeestudio/ui
 * src/components/Checkbox.js
 *
 * Использование:
 *   import { Checkbox } from '../ui/src/components/Checkbox.js';
 *
 *   const cb = Checkbox({
 *     label:    L10n.t('ui.remember'),
 *     checked:  false,
 *     onChange: (on) => save('remember', on),
 *   });
 *   container.appendChild(cb);
 *
 * Событие на document: 'ui:checkbox:change'  { detail: { id, checked } }
 */

let _stylesLoaded = false;
let _uid = 0;

// SVG галочки
const _ICON_CHECK = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
// SVG тире (indeterminate)
const _ICON_DASH  = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>`;

/**
 * @param {object}   opts
 * @param {string}   [opts.label='']
 * @param {boolean}  [opts.checked=false]
 * @param {boolean}  [opts.indeterminate=false]
 * @param {boolean}  [opts.disabled=false]
 * @param {string}   [opts.id=null]
 * @param {function} [opts.onChange=null]   — (checked: boolean) => void
 * @returns {HTMLLabelElement}
 */
export function Checkbox({
  label         = '',
  checked       = false,
  indeterminate = false,
  disabled      = false,
  id            = null,
  onChange      = null,
} = {}) {
  _loadStyles();

  const inputId = `ui-cb-${++_uid}`;

  // ── Корневой label (весь кликабельный) ────────────────────────
  const root = document.createElement('label');
  root.className = 'ui-checkbox';
  root.htmlFor   = inputId;
  if (id) root.dataset.id = id;

  // ── Настоящий input (скрытый) ─────────────────────────────────
  const input = document.createElement('input');
  input.type          = 'checkbox';
  input.id            = inputId;
  input.className     = 'ui-checkbox__input';
  input.checked       = checked;
  input.indeterminate = indeterminate;
  input.disabled      = disabled;
  if (label) input.setAttribute('aria-label', label);

  // ── Визуальный квадрат ────────────────────────────────────────
  const box = document.createElement('span');
  box.className = 'ui-checkbox__box';
  box.setAttribute('aria-hidden', 'true');

  const check = document.createElement('span');
  check.className = 'ui-checkbox__check';
  check.innerHTML = indeterminate ? _ICON_DASH : _ICON_CHECK;
  box.appendChild(check);

  // ── Текстовая метка ───────────────────────────────────────────
  let labelEl = null;
  if (label) {
    labelEl = document.createElement('span');
    labelEl.className   = 'ui-checkbox__label';
    labelEl.textContent = label;
  }

  // ── Сборка ────────────────────────────────────────────────────
  root.appendChild(input);
  root.appendChild(box);
  if (labelEl) root.appendChild(labelEl);

  // Начальный визуальный класс
  if (checked || indeterminate) box.classList.add('ui-checkbox__box--on');

  // ── Обработчик ────────────────────────────────────────────────
  input.addEventListener('change', () => {
    const on = input.checked;
    box.classList.toggle('ui-checkbox__box--on', on || input.indeterminate);
    // Сбрасываем indeterminate при ручном клике
    if (input.indeterminate) {
      input.indeterminate = false;
      check.innerHTML = _ICON_CHECK;
    }
    onChange?.(on);
    document.dispatchEvent(new CustomEvent('ui:checkbox:change', {
      detail: { id, checked: on },
      bubbles: false,
    }));
  });

  return root;
}

/**
 * Обновляет чекбокс без перерендеринга.
 * @param {HTMLLabelElement} cb
 * @param {{ checked?, indeterminate?, disabled?, label? }} changes
 */
export function updateCheckbox(cb, { checked, indeterminate, disabled, label } = {}) {
  const input = cb.querySelector('.ui-checkbox__input');
  const box   = cb.querySelector('.ui-checkbox__box');
  const check = cb.querySelector('.ui-checkbox__check');
  const lbl   = cb.querySelector('.ui-checkbox__label');
  if (!input || !box) return;

  if (indeterminate !== undefined) {
    input.indeterminate = indeterminate;
    if (check) check.innerHTML = indeterminate ? _ICON_DASH : _ICON_CHECK;
  }
  if (checked !== undefined) {
    input.checked = checked;
    box.classList.toggle('ui-checkbox__box--on', checked || input.indeterminate);
  }
  if (disabled !== undefined) {
    input.disabled = disabled;
    cb.classList.toggle('ui-checkbox--disabled', disabled);
  }
  if (label !== undefined) {
    if (lbl) lbl.textContent = label;
    input.setAttribute('aria-label', label);
  }
}

// ── Автозагрузка стилей ──────────────────────────────────────
function _loadStyles() {
  if (_stylesLoaded || typeof document === 'undefined') return;
  _stylesLoaded = true;
  if (document.querySelector('[data-ui-styles="checkbox"]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.dataset.uiStyles = 'checkbox';
  link.href = new URL('./Checkbox.css', import.meta.url).href;
  document.head.appendChild(link);
}
