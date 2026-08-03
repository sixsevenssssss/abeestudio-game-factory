/**
 * Slider — горизонтальный ползунок @abeestudio/ui
 * src/components/Slider.js
 *
 * Использование:
 *   import { Slider } from '../ui/src/components/Slider.js';
 *
 *   const sl = Slider({
 *     value:     70,
 *     min:       0,
 *     max:       100,
 *     label:     L10n.t('ui.volume'),
 *     showValue: true,
 *     onChange:  (v) => Audio.setVolume('master', v / 100),
 *   });
 *   container.appendChild(sl);
 *
 * Событие на document: 'ui:slider:change'  { detail: { id, value } }
 */

let _stylesLoaded = false;
let _uid = 0;

/**
 * @param {object}   opts
 * @param {number}   [opts.value=50]
 * @param {number}   [opts.min=0]
 * @param {number}   [opts.max=100]
 * @param {number}   [opts.step=1]
 * @param {string}   [opts.label='']       — текст над ползунком
 * @param {boolean}  [opts.showValue=true] — показывать текущее значение
 * @param {boolean}  [opts.disabled=false]
 * @param {string}   [opts.id=null]
 * @param {function} [opts.onChange=null]  — (value: number) => void
 * @returns {HTMLDivElement}
 */
export function Slider({
  value     = 50,
  min       = 0,
  max       = 100,
  step      = 1,
  label     = '',
  showValue = true,
  disabled  = false,
  id        = null,
  onChange  = null,
} = {}) {
  _loadStyles();

  const inputId = `ui-slider-${++_uid}`;
  const clamp   = (v) => Math.min(max, Math.max(min, v));
  let   current = clamp(value);

  // ── Корневой контейнер ──────────────────────────────────────
  const root = document.createElement('div');
  root.className = 'ui-slider';
  if (id) root.dataset.id = id;

  // ── Заголовок (метка + текущее значение) ────────────────────
  let valueEl = null;
  if (label || showValue) {
    const header = document.createElement('div');
    header.className = 'ui-slider__header';

    if (label) {
      const labelEl = document.createElement('label');
      labelEl.className = 'ui-slider__label';
      labelEl.htmlFor   = inputId;
      labelEl.textContent = label;
      header.appendChild(labelEl);
    }

    if (showValue) {
      valueEl = document.createElement('span');
      valueEl.className   = 'ui-slider__value';
      valueEl.textContent = String(current);
      header.appendChild(valueEl);
    }

    root.appendChild(header);
  }

  // ── Трек + заливка + нативный input ─────────────────────────
  const wrap = document.createElement('div');
  wrap.className = 'ui-slider__wrap';

  const track = document.createElement('div');
  track.className = 'ui-slider__track';

  const fill = document.createElement('div');
  fill.className = 'ui-slider__fill';
  track.appendChild(fill);

  const input = document.createElement('input');
  input.type     = 'range';
  input.id       = inputId;
  input.className = 'ui-slider__input';
  input.min      = String(min);
  input.max      = String(max);
  input.step     = String(step);
  input.value    = String(current);
  input.disabled = disabled;
  if (id) input.setAttribute('aria-label', label || id);

  // Начальное положение заливки
  _setFill(fill, current, min, max);

  wrap.appendChild(track);
  wrap.appendChild(input);
  root.appendChild(wrap);

  // Отключённое состояние
  if (disabled) root.classList.add('ui-slider--disabled');

  // ── Обработчик ────────────────────────────────────────────────
  const onInputChange = () => {
    current = Number(input.value);
    _setFill(fill, current, min, max);
    if (valueEl) valueEl.textContent = String(current);
    onChange?.(current);
    document.dispatchEvent(new CustomEvent('ui:slider:change', {
      detail: { id, value: current },
      bubbles: false,
    }));
  };

  input.addEventListener('input',  onInputChange);
  input.addEventListener('change', onInputChange); // mobile: fires on release

  return root;
}

/**
 * Обновляет ползунок без перерендеринга.
 * @param {HTMLDivElement} slider
 * @param {{ value?, disabled?, label? }} changes
 */
export function updateSlider(slider, { value, disabled, label } = {}) {
  const input   = slider.querySelector('.ui-slider__input');
  const fill    = slider.querySelector('.ui-slider__fill');
  const valueEl = slider.querySelector('.ui-slider__value');
  const labelEl = slider.querySelector('.ui-slider__label');
  if (!input || !fill) return;

  if (value !== undefined) {
    const v = Math.min(Number(input.max), Math.max(Number(input.min), value));
    input.value = String(v);
    _setFill(fill, v, Number(input.min), Number(input.max));
    if (valueEl) valueEl.textContent = String(v);
  }
  if (disabled !== undefined) {
    input.disabled = disabled;
    slider.classList.toggle('ui-slider--disabled', disabled);
  }
  if (label !== undefined && labelEl) {
    labelEl.textContent = label;
  }
}

// ── Утилита: установить ширину заливки ──────────────────────────
function _setFill(fillEl, value, min, max) {
  const pct = max === min ? 0 : ((value - min) / (max - min)) * 100;
  fillEl.style.width = `${pct.toFixed(2)}%`;
}

// ── Автозагрузка стилей ──────────────────────────────────────────
function _loadStyles() {
  if (_stylesLoaded || typeof document === 'undefined') return;
  _stylesLoaded = true;
  if (document.querySelector('[data-ui-styles="slider"]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.dataset.uiStyles = 'slider';
  link.href = new URL('./Slider.css', import.meta.url).href;
  document.head.appendChild(link);
}
