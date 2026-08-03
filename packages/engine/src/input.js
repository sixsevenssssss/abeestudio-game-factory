/**
 * InputManager — единый ввод мыши и тача для abeeStudio.
 *
 * Использует Pointer Events API (объединяет mouse + touch).
 * Требование площадки п. 1.6: без контекстного меню, без выделения текста, без скролла.
 *
 * Распознаваемые жесты:
 *   tap          — короткое нажатие (<500мс, смещение <TAP_MAX_MOVE)
 *   longpress    — удержание ≥500мс без движения (>MOVE_THRESHOLD)
 *   swipe        — быстрое движение (>SWIPE_THRESHOLD за <SWIPE_MAX_MS) → 4 направления
 *   drag         — медленное/длинное перемещение → непрерывные события drag:move
 *   pinch        — 2 пальца: scale относительно начального расстояния
 *
 * Генерируемые события (Engine.events):
 *   input:tap         { x, y, pointerId }
 *   input:longpress   { x, y, pointerId }
 *   input:swipe       { direction, dx, dy, x, y, pointerId }
 *   input:drag:start  { x, y, pointerId }
 *   input:drag:move   { x, y, dx, dy, pointerId }
 *   input:drag:end    { x, y, totalDx, totalDy, pointerId }
 *   input:pinch       { scale, centerX, centerY, distance }
 *   input:pinch:end   {}
 */

const LONG_PRESS_MS    = 500;  // мс до срабатывания long-press
const MOVE_THRESHOLD   = 10;   // px — мин. движение для отмены tap/longpress
const SWIPE_THRESHOLD  = 30;   // px — мин. смещение для свайпа
const SWIPE_MAX_MS     = 500;  // мс — макс. время жеста для свайпа
const TAP_MAX_MOVE     = 10;   // px — макс. движение для тапа

export class InputManager {
  /**
   * @param {import('./events.js').EventBus} events
   * @param {EventTarget|null} [target] - DOM-элемент или null (для тестов)
   */
  constructor(events, target = null) {
    this._events = events;
    this._target = target;

    /** @type {Map<number, PointerState>} pointerId → состояние */
    this._pointers = new Map();

    /** Для пинча: начальное расстояние между двумя пальцами */
    this._pinchStartDist = 0;
    this._pinching = false;

    this._onPointerDown   = this._handlePointerDown.bind(this);
    this._onPointerMove   = this._handlePointerMove.bind(this);
    this._onPointerUp     = this._handlePointerUp.bind(this);
    this._onPointerCancel = this._handlePointerCancel.bind(this);
    this._onContextMenu   = (e) => e.preventDefault();

    if (target) this._attach(target);
  }

  /** Подключиться к DOM-элементу (если не передан в конструкторе) */
  attach(target) {
    if (this._target) this.detach();
    this._target = target;
    this._attach(target);
  }

  detach() {
    if (!this._target) return;
    this._detach(this._target);
    this._target = null;
    this._pointers.clear();
  }

  // ─── публичный API для тестов: прямая симуляция ───────────────────────────

  /** @internal — используется в тестах вместо DOM-событий */
  _simulateDown(x, y, pointerId = 0) {
    this._handlePointerDown({ pointerId, clientX: x, clientY: y, preventDefault: () => {} });
  }
  _simulateMove(x, y, pointerId = 0) {
    this._handlePointerMove({ pointerId, clientX: x, clientY: y, preventDefault: () => {} });
  }
  _simulateUp(x, y, pointerId = 0) {
    this._handlePointerUp({ pointerId, clientX: x, clientY: y, preventDefault: () => {} });
  }
  _simulateCancel(pointerId = 0) {
    this._handlePointerCancel({ pointerId, preventDefault: () => {} });
  }

  // ─── DOM attachment ───────────────────────────────────────────────────────

  _attach(target) {
    target.addEventListener('pointerdown',   this._onPointerDown,   { passive: false });
    target.addEventListener('pointermove',   this._onPointerMove,   { passive: false });
    target.addEventListener('pointerup',     this._onPointerUp,     { passive: false });
    target.addEventListener('pointercancel', this._onPointerCancel, { passive: false });
    target.addEventListener('contextmenu',   this._onContextMenu);

    // Запрет выделения текста и скролла (требование площадки)
    if (target.style) {
      target.style.userSelect        = 'none';
      target.style.webkitUserSelect  = 'none';
      target.style.touchAction       = 'none';
    }
  }

  _detach(target) {
    target.removeEventListener('pointerdown',   this._onPointerDown);
    target.removeEventListener('pointermove',   this._onPointerMove);
    target.removeEventListener('pointerup',     this._onPointerUp);
    target.removeEventListener('pointercancel', this._onPointerCancel);
    target.removeEventListener('contextmenu',   this._onContextMenu);
  }

  // ─── обработчики ──────────────────────────────────────────────────────────

  _handlePointerDown(e) {
    e.preventDefault?.();

    const id = e.pointerId ?? 0;
    const x  = e.clientX ?? 0;
    const y  = e.clientY ?? 0;
    const now = this._now();

    const state = {
      id,
      startX: x, startY: y,
      lastX: x,  lastY: y,
      currentX: x, currentY: y,
      startTime: now,
      dragging: false,
      moved: false,
      longPressTimer: null,
    };

    // Таймер long-press
    state.longPressTimer = setTimeout(() => {
      if (!state.moved && this._pointers.has(id)) {
        this._events?.emit('input:longpress', { x: state.currentX, y: state.currentY, pointerId: id });
        state.longPressed = true;
      }
    }, LONG_PRESS_MS);

    this._pointers.set(id, state);

    // Начало пинча при втором пальце
    if (this._pointers.size === 2) {
      this._startPinch();
    }
  }

  _handlePointerMove(e) {
    e.preventDefault?.();

    const id = e.pointerId ?? 0;
    const state = this._pointers.get(id);
    if (!state) return;

    const x  = e.clientX ?? 0;
    const y  = e.clientY ?? 0;
    const dx = x - state.lastX;
    const dy = y - state.lastY;
    const totalDx = x - state.startX;
    const totalDy = y - state.startY;
    const totalDist = Math.hypot(totalDx, totalDy);

    state.currentX = x;
    state.currentY = y;

    // Пинч (2 пальца)
    if (this._pointers.size === 2 && this._pinching) {
      this._updatePinch();
      state.lastX = x;
      state.lastY = y;
      return;
    }

    // Отмена long-press при движении
    if (totalDist > MOVE_THRESHOLD && !state.moved) {
      state.moved = true;
      if (state.longPressTimer) {
        clearTimeout(state.longPressTimer);
        state.longPressTimer = null;
      }
    }

    // Начало drag
    if (totalDist > MOVE_THRESHOLD && !state.dragging && !state.longPressed) {
      state.dragging = true;
      this._events?.emit('input:drag:start', { x: state.startX, y: state.startY, pointerId: id });
    }

    // Drag:move
    if (state.dragging && (dx !== 0 || dy !== 0)) {
      this._events?.emit('input:drag:move', { x, y, dx, dy, pointerId: id });
    }

    state.lastX = x;
    state.lastY = y;
  }

  _handlePointerUp(e) {
    e.preventDefault?.();

    const id = e.pointerId ?? 0;
    const state = this._pointers.get(id);
    if (!state) return;

    const x   = e.clientX ?? state.currentX;
    const y   = e.clientY ?? state.currentY;
    const now = this._now();
    const duration = now - state.startTime;
    const totalDx = x - state.startX;
    const totalDy = y - state.startY;
    const totalDist = Math.hypot(totalDx, totalDy);

    this._clearPointer(id);

    // Завершить пинч
    if (this._pinching && this._pointers.size < 2) {
      this._endPinch();
    }

    // Завершение drag (независимо от того, будет ли swipe)
    if (state.dragging) {
      this._events?.emit('input:drag:end', {
        x, y, totalDx, totalDy, pointerId: id,
      });
    }

    if (!state.longPressed) {
      if (totalDist >= SWIPE_THRESHOLD && duration < SWIPE_MAX_MS) {
        // Свайп — быстрое направленное движение (может совпадать с drag)
        const dir = this._swipeDirection(totalDx, totalDy);
        this._events?.emit('input:swipe', {
          direction: dir, dx: totalDx, dy: totalDy, x, y, pointerId: id,
        });
      } else if (!state.dragging && totalDist < TAP_MAX_MOVE && duration < LONG_PRESS_MS) {
        // Тап — только если не было drag и не long-press
        this._events?.emit('input:tap', { x, y, pointerId: id });
      }
    }
  }

  _handlePointerCancel(e) {
    const id = e.pointerId ?? 0;
    const state = this._pointers.get(id);
    if (state?.dragging) {
      this._events?.emit('input:drag:end', {
        x: state.currentX, y: state.currentY,
        totalDx: state.currentX - state.startX,
        totalDy: state.currentY - state.startY,
        pointerId: id, cancelled: true,
      });
    }
    this._clearPointer(id);
    if (this._pinching && this._pointers.size < 2) {
      this._endPinch();
    }
  }

  // ─── pinch ────────────────────────────────────────────────────────────────

  _startPinch() {
    const [a, b] = [...this._pointers.values()];
    this._pinchStartDist = Math.hypot(b.startX - a.startX, b.startY - a.startY) || 1;
    this._pinching = true;
  }

  _updatePinch() {
    const pts = [...this._pointers.values()];
    if (pts.length < 2) return;
    const [a, b] = pts;
    const dist    = Math.hypot(b.currentX - a.currentX, b.currentY - a.currentY);
    const scale   = dist / this._pinchStartDist;
    const centerX = (a.currentX + b.currentX) / 2;
    const centerY = (a.currentY + b.currentY) / 2;
    this._events?.emit('input:pinch', { scale, centerX, centerY, distance: dist });
  }

  _endPinch() {
    this._pinching = false;
    this._pinchStartDist = 0;
    this._events?.emit('input:pinch:end', {});
  }

  // ─── утилиты ──────────────────────────────────────────────────────────────

  _swipeDirection(dx, dy) {
    return Math.abs(dx) >= Math.abs(dy)
      ? (dx > 0 ? 'right' : 'left')
      : (dy > 0 ? 'down'  : 'up');
  }

  _clearPointer(id) {
    const state = this._pointers.get(id);
    if (state?.longPressTimer) clearTimeout(state.longPressTimer);
    this._pointers.delete(id);
  }

  _now() {
    if (typeof performance !== 'undefined') return performance.now();
    return Date.now();
  }
}
