/**
 * Toggle — переключатель on/off @abeestudio/ui
 * src/components/Toggle.js
 *
 * Использование:
 *   import { Toggle } from '../ui/src/components/Toggle.js';
 *
 *   const tog = Toggle({
 *     label:    L10n.t('ui.sound'),
 *     checked:  true,
 *     onChange: (on) => Audio.setVolume('master', on ? 1 : 0),
 *   });
 *   container.appendChild(tog);
 *
 * Событие на document: 'ui:toggle:change'  { detail: { id, checked } }
 */

let _stylesLoaded = false;
let _uid = 0;

/**
 * @param {object}   opts
 * @param {boolean}  [opts.checked=false]
 * @param {boolean}  [opts.disabled=false]
 * @param {string}   [opts.label='']       — текст рядом с переключателем
 * @param {'left'|'right'} [opts.labelPos='right'] — позиция текста
 * @param {string}   [opts.id=null]
 * @param {function} [opts.onChange=null]  — (checked: boolean) => void
 * @returns {HTMLLabelElement}
 */
export function Toggle({
  checked   = false,
  disabled  = false,
  label     = '',
  labelPos  = 'right',
  id        = null,
  onChange  = null,
} = {}) {
  _loadStyles();

  const inputId = `ui-toggle-${++_uid}`;

  // Корневой элемент — label (весь кликабельный)
  const root = document.createElement('label');
  root.className = `ui-toggle${labelPos === 'left' ? ' ui-toggle--label-left' : ''}`;
  root.htmlFor = inputId;
  if (id) root.dataset.id = id;

  // Настоящий чекбокс (спрятан визуально, виден для AT и клавиатуры)
  const input = document.createElement('input');
  input.type       = 'checkbox';
  input.id         = inputId;
  input.className  = 'ui-toggle__input';
  input.checked    = checked;
  input.disabled   = disabled;
  input.setAttribute('role', 'switch');
  input.setAttribute('aria-checked', String(checked));
  if (id) input.setAttribute('aria-label', label || id);

  // Трек + ползунок
  const track = document.createElement('span');
  track.className = 'ui-toggle__track';
  track.setAttribute('aria-hidden', 'true');

  const thumb = document.createElement('span');
  thumb.className = 'ui-toggle__thumb';
  track.appendChild(thumb);

  // Текстовая метка
  let labelEl = null;
  if (label) {
    labelEl = document.createElement('span');
    labelEl.className = 'ui-toggle__label';
    labelEl.textContent = label;
  }

  // Сборка
  if (labelPos === 'left' && labelEl) root.appendChild(labelEl);
  root.appendChild(input);
  root.appendChild(track);
  if (labelPos !== 'left' && labelEl) root.appendChild(labelEl);

  // Обработчик изменения
  input.addEventListener('change', () => {
    const on = input.checked;
    input.setAttribute('aria-checked', String(on));
    onChange?.(on);
    document.dispatchEvent(new CustomEvent('ui:toggle:change', {
      detail: { id, checked: on },
      bubbles: false,
    }));
  });

  return root;
}

/**
 * Обновляет переключатель без перерендеринга.
 * @param {HTMLLabelElement} toggle
 * @param {{ checked?, disabled?, label? }} changes
 */
export function updateToggle(toggle, { checked, disabled, label } = {}) {
  const input = toggle.querySelector('.ui-toggle__input');
  if (!input) return;
  if (checked !== undefined) {
    input.checked = checked;
    input.setAttribute('aria-checked', String(checked));
  }
  if (disabled !== undefined) {
    input.disabled = disabled;
    toggle.classList.toggle('ui-toggle--disabled', disabled);
  }
  if (label !== undefined) {
    const labelEl = toggle.querySelector('.ui-toggle__label');
    if (labelEl) labelEl.textContent = label;
  }
}

// ── Автозагрузка стилей ──────────────────────────────────────
function _loadStyles() {
  if (_stylesLoaded || typeof document === 'undefined') return;
  _stylesLoaded = true;
  if (document.querySelector('[data-ui-styles="toggle"]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.dataset.uiStyles = 'toggle';
  link.href = new URL('./Toggle.css', import.meta.url).href;
  document.head.appendChild(link);
}
