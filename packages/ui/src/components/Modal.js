/**
 * Modal — модальное окно @abeestudio/ui
 * src/components/Modal.js
 *
 * Использование:
 *   import { Modal } from '../ui/src/components/Modal.js';
 *
 *   const modal = Modal({
 *     title:   L10n.t('ui.confirm'),
 *     content: myContent,    // HTMLElement | строка
 *     buttons: [cancelBtn, confirmBtn],
 *     onClose: () => {},
 *   });
 *   modal.open();
 *   // ...
 *   modal.close();
 *
 * Событие на document: 'ui:modal:close'  { detail: { id } }
 */

let _stylesLoaded = false;
let _uid = 0;
let _openCount = 0;  // сколько модальных окон сейчас открыто

/**
 * @param {object}   opts
 * @param {string}   [opts.title='']
 * @param {HTMLElement|string} [opts.content=null] — содержимое тела
 * @param {HTMLElement[]} [opts.buttons=[]]        — кнопки в подвале
 * @param {'soft'|'spring'|'snap'} [opts.animation='soft'] — характер появления
 * @param {boolean}  [opts.closable=true]          — можно ли закрыть кликом на фон/Escape
 * @param {string}   [opts.id=null]
 * @param {function} [opts.onClose=null]           — вызывается при закрытии
 * @returns {{ open(): void, close(): void, el: HTMLDivElement }}
 */
export function Modal({
  title     = '',
  content   = null,
  buttons   = [],
  animation = 'soft',
  closable  = true,
  id        = null,
  onClose   = null,
} = {}) {
  _loadStyles();

  const modalId = `ui-modal-${++_uid}`;
  let _isOpen   = false;

  // ── Оверлей (затемнение фона) ─────────────────────────────
  const overlay = document.createElement('div');
  overlay.className = `ui-modal-overlay ui-modal-overlay--${animation}`;
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-labelledby', `${modalId}-title`);
  if (id) overlay.dataset.id = id;

  // ── Само окно ─────────────────────────────────────────────
  const modal = document.createElement('div');
  modal.className = 'ui-modal';
  modal.setAttribute('tabindex', '-1');  // для первоначального фокуса

  // Заголовок
  if (title || closable) {
    const header = document.createElement('div');
    header.className = 'ui-modal__header';

    if (title) {
      const titleEl = document.createElement('h2');
      titleEl.id          = `${modalId}-title`;
      titleEl.className   = 'ui-modal__title';
      titleEl.textContent = title;
      header.appendChild(titleEl);
    }

    if (closable) {
      const closeBtn = document.createElement('button');
      closeBtn.type      = 'button';
      closeBtn.className = 'ui-modal__close';
      closeBtn.setAttribute('aria-label', 'Закрыть');
      closeBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
      closeBtn.addEventListener('click', close);
      header.appendChild(closeBtn);
    }

    modal.appendChild(header);
  }

  // Тело
  if (content) {
    const body = document.createElement('div');
    body.className = 'ui-modal__body';
    if (typeof content === 'string') {
      body.innerHTML = content;
    } else {
      body.appendChild(content);
    }
    modal.appendChild(body);
  }

  // Подвал с кнопками
  if (buttons.length) {
    const footer = document.createElement('div');
    footer.className = 'ui-modal__footer';
    buttons.forEach(btn => footer.appendChild(btn));
    modal.appendChild(footer);
  }

  overlay.appendChild(modal);

  // ── Закрытие по клику на фон ─────────────────────────────
  if (closable) {
    overlay.addEventListener('click', e => {
      if (e.target === overlay) close();
    });
  }

  // ── Ловушка фокуса ────────────────────────────────────────
  overlay.addEventListener('keydown', e => {
    if (e.key === 'Escape' && closable) { close(); return; }
    if (e.key !== 'Tab') return;

    const focusable = Array.from(
      modal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')
    ).filter(el => !el.disabled && el.offsetParent !== null);

    if (!focusable.length) { e.preventDefault(); return; }

    const first = focusable[0], last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault(); last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault(); first.focus();
    }
  });

  // ── Открыть ───────────────────────────────────────────────
  function open() {
    if (_isOpen) return;
    _isOpen = true;
    _openCount++;

    document.body.appendChild(overlay);

    // Небольшая задержка чтобы CSS-transition сработал
    requestAnimationFrame(() => {
      overlay.classList.add('ui-modal-overlay--visible');
      // Фокус на модальное окно
      setTimeout(() => modal.focus(), 50);
    });
  }

  // ── Закрыть ───────────────────────────────────────────────
  function close() {
    if (!_isOpen) return;
    _isOpen = false;
    _openCount = Math.max(0, _openCount - 1);

    overlay.classList.add('ui-modal-overlay--closing');
    overlay.classList.remove('ui-modal-overlay--visible');

    // Ждём окончания анимации
    const onEnd = () => {
      overlay.removeEventListener('transitionend', onEnd);
      overlay.removeEventListener('animationend',  onEnd);
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
      onClose?.();
      document.dispatchEvent(new CustomEvent('ui:modal:close', {
        detail: { id },
        bubbles: false,
      }));
    };
    overlay.addEventListener('transitionend', onEnd, { once: true });
    // Fallback если transition не сработал
    setTimeout(onEnd, 420);
  }

  return { open, close, el: overlay };
}

// ── Автозагрузка стилей ──────────────────────────────────────
function _loadStyles() {
  if (_stylesLoaded || typeof document === 'undefined') return;
  _stylesLoaded = true;
  if (document.querySelector('[data-ui-styles="modal"]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.dataset.uiStyles = 'modal';
  link.href = new URL('./Modal.css', import.meta.url).href;
  document.head.appendChild(link);
}
