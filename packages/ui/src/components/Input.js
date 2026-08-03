/**
 * Input — текстовое поле ввода @abeestudio/ui
 * src/components/Input.js
 *
 * Использование:
 *   import { Input } from '../ui/src/components/Input.js';
 *
 *   const inp = Input({
 *     label:       L10n.t('ui.name'),
 *     placeholder: L10n.t('ui.name.placeholder'),
 *     type:        'text',
 *     onChange:    (v) => setName(v),
 *   });
 *   container.appendChild(inp);
 *
 * Событие на document: 'ui:input:change'  { detail: { id, value } }
 */

let _stylesLoaded = false;
let _uid = 0;

/**
 * @param {object}   opts
 * @param {string}   [opts.label='']       — метка над полем
 * @param {string}   [opts.placeholder=''] — подсказка внутри поля
 * @param {'text'|'number'|'password'|'email'} [opts.type='text']
 * @param {string}   [opts.value='']       — начальное значение
 * @param {string}   [opts.icon=null]      — SVG-строка иконки (слева)
 * @param {string}   [opts.error=null]     — текст ошибки (null = нет ошибки)
 * @param {boolean}  [opts.disabled=false]
 * @param {string}   [opts.id=null]
 * @param {function} [opts.onChange=null]  — (value: string) => void
 * @param {function} [opts.onBlur=null]    — (value: string) => void
 * @returns {HTMLDivElement}
 */
export function Input({
  label       = '',
  placeholder = '',
  type        = 'text',
  value       = '',
  icon        = null,
  error       = null,
  disabled    = false,
  id          = null,
  onChange    = null,
  onBlur      = null,
} = {}) {
  _loadStyles();

  const inputId = `ui-input-${++_uid}`;

  // ── Корневой контейнер ──────────────────────────────────────
  const root = document.createElement('div');
  root.className = 'ui-input';
  if (id) root.dataset.id = id;
  if (disabled) root.classList.add('ui-input--disabled');
  if (error)    root.classList.add('ui-input--error');

  // ── Метка ────────────────────────────────────────────────────
  if (label) {
    const labelEl = document.createElement('label');
    labelEl.className   = 'ui-input__label';
    labelEl.htmlFor     = inputId;
    labelEl.textContent = label;
    root.appendChild(labelEl);
  }

  // ── Обёртка (иконка + поле) ──────────────────────────────────
  const wrap = document.createElement('div');
  wrap.className = 'ui-input__wrap';

  if (icon) {
    const iconEl = document.createElement('span');
    iconEl.className = 'ui-input__icon';
    iconEl.setAttribute('aria-hidden', 'true');
    iconEl.innerHTML = icon;
    wrap.appendChild(iconEl);
    wrap.classList.add('ui-input__wrap--has-icon');
  }

  const field = document.createElement('input');
  field.type        = type;
  field.id          = inputId;
  field.className   = 'ui-input__field';
  field.placeholder = placeholder;
  field.value       = value;
  field.disabled    = disabled;
  // Важно: font-size 16px предотвращает авто-зум на iOS при фокусе
  // (задаётся через CSS, но дублируем атрибут как напоминание)
  wrap.appendChild(field);
  root.appendChild(wrap);

  // ── Текст ошибки ─────────────────────────────────────────────
  let errorEl = null;
  if (error) {
    errorEl = document.createElement('span');
    errorEl.className   = 'ui-input__error-text';
    errorEl.textContent = error;
    root.appendChild(errorEl);
  }

  // ── События ──────────────────────────────────────────────────
  field.addEventListener('input', () => {
    onChange?.(field.value);
    document.dispatchEvent(new CustomEvent('ui:input:change', {
      detail: { id, value: field.value },
      bubbles: false,
    }));
  });

  field.addEventListener('blur', () => {
    onBlur?.(field.value);
  });

  return root;
}

/**
 * Обновляет поле без перерендеринга.
 * @param {HTMLDivElement} input
 * @param {{ value?, error?, disabled?, label? }} changes
 */
export function updateInput(input, { value, error, disabled, label } = {}) {
  const field   = input.querySelector('.ui-input__field');
  const labelEl = input.querySelector('.ui-input__label');
  let   errorEl = input.querySelector('.ui-input__error-text');

  if (field) {
    if (value    !== undefined) field.value    = value;
    if (disabled !== undefined) {
      field.disabled = disabled;
      input.classList.toggle('ui-input--disabled', disabled);
    }
  }

  if (label !== undefined && labelEl) {
    labelEl.textContent = label;
  }

  if (error !== undefined) {
    input.classList.toggle('ui-input--error', !!error);
    if (error) {
      if (!errorEl) {
        errorEl = document.createElement('span');
        errorEl.className = 'ui-input__error-text';
        input.appendChild(errorEl);
      }
      errorEl.textContent = error;
    } else if (errorEl) {
      errorEl.remove();
    }
  }
}

// ── Автозагрузка стилей ──────────────────────────────────────
function _loadStyles() {
  if (_stylesLoaded || typeof document === 'undefined') return;
  _stylesLoaded = true;
  if (document.querySelector('[data-ui-styles="input"]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.dataset.uiStyles = 'input';
  link.href = new URL('./Input.css', import.meta.url).href;
  document.head.appendChild(link);
}
