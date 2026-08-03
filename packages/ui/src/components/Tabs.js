/**
 * Tabs — горизонтальные вкладки @abeestudio/ui
 * src/components/Tabs.js
 *
 * Использование:
 *   import { Tabs } from '../ui/src/components/Tabs.js';
 *
 *   const tabs = Tabs({
 *     tabs: [
 *       { id: 'game',     label: L10n.t('ui.tab.game') },
 *       { id: 'settings', label: L10n.t('ui.tab.settings') },
 *       { id: 'shop',     label: L10n.t('ui.tab.shop') },
 *     ],
 *     active:   'game',
 *     onChange: (id) => showPanel(id),
 *   });
 *   container.appendChild(tabs);
 *
 * Событие на document: 'ui:tabs:change'  { detail: { id, tabId } }
 */

let _stylesLoaded = false;
let _uid = 0;

/**
 * @param {object}   opts
 * @param {Array<{id:string, label:string, disabled?:boolean}>} opts.tabs
 * @param {string}   [opts.active]     — id активной вкладки (по умолчанию первая)
 * @param {boolean}  [opts.disabled=false] — заблокировать все вкладки
 * @param {string}   [opts.id=null]
 * @param {function} [opts.onChange=null] — (tabId: string) => void
 * @returns {HTMLDivElement}
 */
export function Tabs({
  tabs     = [],
  active   = null,
  disabled = false,
  id       = null,
  onChange = null,
} = {}) {
  _loadStyles();

  if (!tabs.length) return document.createElement('div');

  const rootId = `ui-tabs-${++_uid}`;
  const currentActive = { id: active ?? tabs[0].id };

  // ── Корневой контейнер ──────────────────────────────────────
  const root = document.createElement('div');
  root.className = 'ui-tabs';
  root.id        = rootId;
  root.setAttribute('role', 'tablist');
  if (id) root.dataset.id = id;
  if (disabled) root.classList.add('ui-tabs--disabled');

  // ── Скользящий индикатор ────────────────────────────────────
  const indicator = document.createElement('span');
  indicator.className = 'ui-tabs__indicator';
  indicator.setAttribute('aria-hidden', 'true');

  // ── Кнопки вкладок ──────────────────────────────────────────
  const buttons = tabs.map(tab => {
    const btn = document.createElement('button');
    btn.type      = 'button';
    btn.className = 'ui-tabs__tab';
    btn.dataset.tabId = tab.id;
    btn.setAttribute('role', 'tab');
    btn.setAttribute('id', `${rootId}-tab-${tab.id}`);
    btn.setAttribute('aria-controls', `${rootId}-panel-${tab.id}`);

    const labelEl = document.createElement('span');
    labelEl.className   = 'ui-tabs__label';
    labelEl.textContent = tab.label;
    btn.appendChild(labelEl);

    if (tab.disabled || disabled) btn.disabled = true;

    // Активная вкладка
    if (tab.id === currentActive.id) {
      btn.classList.add('ui-tabs__tab--active');
      btn.setAttribute('aria-selected', 'true');
      btn.setAttribute('tabindex', '0');
    } else {
      btn.setAttribute('aria-selected', 'false');
      btn.setAttribute('tabindex', '-1');
    }

    return btn;
  });

  buttons.forEach(btn => root.appendChild(btn));
  root.appendChild(indicator);

  // ── Позиционирование индикатора ──────────────────────────────
  const _updateIndicator = () => {
    const activeBtn = root.querySelector('.ui-tabs__tab--active');
    if (!activeBtn) return;
    indicator.style.width     = `${activeBtn.offsetWidth}px`;
    indicator.style.transform = `translateX(${activeBtn.offsetLeft}px)`;
  };

  // Первичная установка после вставки в DOM
  requestAnimationFrame(_updateIndicator);

  // ── Переключение вкладки ─────────────────────────────────────
  const _activate = (tabId) => {
    if (tabId === currentActive.id) return;
    currentActive.id = tabId;

    buttons.forEach(btn => {
      const isActive = btn.dataset.tabId === tabId;
      btn.classList.toggle('ui-tabs__tab--active', isActive);
      btn.setAttribute('aria-selected', String(isActive));
      btn.setAttribute('tabindex', isActive ? '0' : '-1');
    });

    _updateIndicator();
    onChange?.(tabId);
    document.dispatchEvent(new CustomEvent('ui:tabs:change', {
      detail: { id, tabId },
      bubbles: false,
    }));
  };

  // ── Клики ────────────────────────────────────────────────────
  root.addEventListener('click', e => {
    const btn = e.target.closest('.ui-tabs__tab');
    if (!btn || btn.disabled) return;
    _activate(btn.dataset.tabId);
  });

  // ── Клавиатура (стрелки) ─────────────────────────────────────
  root.addEventListener('keydown', e => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    const enabledBtns = buttons.filter(b => !b.disabled);
    const idx = enabledBtns.findIndex(b => b.dataset.tabId === currentActive.id);
    const next = e.key === 'ArrowRight'
      ? enabledBtns[(idx + 1) % enabledBtns.length]
      : enabledBtns[(idx - 1 + enabledBtns.length) % enabledBtns.length];
    if (next) { next.focus(); _activate(next.dataset.tabId); }
  });

  // ── Обновление индикатора при изменении размеров ─────────────
  if (typeof ResizeObserver !== 'undefined') {
    const ro = new ResizeObserver(_updateIndicator);
    ro.observe(root);
  }

  return root;
}

/**
 * Обновляет вкладки без перерендеринга.
 * @param {HTMLDivElement} tabs
 * @param {{ active?, labels? }} changes
 * @param {Object} [changes.labels]  — { [tabId]: newLabel }
 */
export function updateTabs(tabs, { active, labels } = {}) {
  if (active !== undefined) {
    const btn = tabs.querySelector(`[data-tab-id="${active}"]`);
    if (btn && !btn.disabled) btn.click();
  }
  if (labels) {
    Object.entries(labels).forEach(([tabId, label]) => {
      const btn = tabs.querySelector(`[data-tab-id="${tabId}"] .ui-tabs__label`);
      if (btn) btn.textContent = label;
    });
  }
}

// ── Автозагрузка стилей ──────────────────────────────────────
function _loadStyles() {
  if (_stylesLoaded || typeof document === 'undefined') return;
  _stylesLoaded = true;
  if (document.querySelector('[data-ui-styles="tabs"]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.dataset.uiStyles = 'tabs';
  link.href = new URL('./Tabs.css', import.meta.url).href;
  document.head.appendChild(link);
}
