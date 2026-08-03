/**
 * GameLoop — игровой цикл abeeStudio.
 *
 * Модель: фиксированный шаг симуляции + свободный рендер.
 *   - update(dt) вызывается N раз за кадр с шагом UPDATE_STEP_MS
 *   - render(alpha) вызывается один раз с alpha = остаток / UPDATE_STEP_MS
 *     (alpha ∈ [0,1] — для интерполяции позиций)
 *
 * Защита от «прыжка» (spiral of death): не более MAX_STEPS шагов за один кадр.
 * Если вкладка была свёрнута — накопитель сбрасывается, симуляция продолжается плавно.
 *
 * Использование:
 *   const loop = new GameLoop(engine.events);
 *   loop.start(
 *     (dt) => world.update(dt),      // dt в секундах (0.016)
 *     (alpha) => world.render(alpha)  // alpha 0..1
 *   );
 *   loop.pause();
 *   loop.resume();
 */

/** Шаг симуляции в миллисекундах (~60 Гц) */
export const UPDATE_STEP_MS = 16;

/** Шаг симуляции в секундах — удобно для физики */
export const UPDATE_STEP_S = UPDATE_STEP_MS / 1000;

/** Максимальное количество шагов за один кадр (защита от спирали смерти) */
const MAX_STEPS = 5;

export class GameLoop {
  /**
   * @param {import('./events.js').EventBus} events - шина событий
   */
  constructor(events) {
    this._events = events;

    this._running  = false;
    this._paused   = false;
    this._rafId    = null;

    /** Время предыдущего кадра (ms performance.now / Date.now) */
    this._lastTime = 0;
    /** Накопленный остаток времени между кадрами */
    this._accumulator = 0;

    /** @type {((dt: number) => void)|null} */
    this._updateFn = null;
    /** @type {((alpha: number) => void)|null} */
    this._renderFn = null;

    // Статистика для отладки
    this._frameCount  = 0;
    this._totalTime   = 0;

    this._onVisibilityChange = this._handleVisibility.bind(this);
    this._boundTick = this._tick.bind(this);

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this._onVisibilityChange);
    }
  }

  /**
   * Запустить цикл.
   * @param {(dt: number) => void} updateFn  - обновление логики (dt в секундах)
   * @param {(alpha: number) => void} renderFn - рендер (alpha 0..1)
   */
  start(updateFn, renderFn) {
    if (this._running) return;

    this._updateFn = updateFn;
    this._renderFn = renderFn;
    this._running  = true;
    this._paused   = false;
    this._lastTime = this._now();
    this._accumulator = 0;

    this._scheduleFrame();
    this._events?.emit('loop:started');
  }

  /** Поставить на паузу (цикл продолжает работать, но update/render не вызываются) */
  pause() {
    if (!this._running || this._paused) return;
    this._paused = true;
    this._events?.emit('loop:paused');
  }

  /** Снять с паузы */
  resume() {
    if (!this._running || !this._paused) return;
    // Сбрасываем lastTime — иначе после паузы накопитель получит огромный delta
    this._lastTime = this._now();
    this._accumulator = 0;
    this._paused = false;
    this._events?.emit('loop:resumed');
  }

  /** Полная остановка цикла */
  stop() {
    if (!this._running) return;
    this._running = false;
    this._paused  = false;
    if (this._rafId !== null) {
      if (typeof cancelAnimationFrame !== 'undefined') {
        cancelAnimationFrame(this._rafId);
      } else {
        clearTimeout(this._rafId);
      }
      this._rafId = null;
    }
    this._events?.emit('loop:stopped');
  }

  /** @returns {boolean} */
  get isRunning() { return this._running; }

  /** @returns {boolean} */
  get isPaused() { return this._paused; }

  // ─── внутренние ───────────────────────────────────────────────────────────

  _scheduleFrame() {
    if (!this._running) return;

    if (typeof requestAnimationFrame !== 'undefined') {
      this._rafId = requestAnimationFrame(this._boundTick);
    } else {
      // Node.js / тесты: имитируем rAF через setTimeout
      this._rafId = setTimeout(() => this._boundTick(this._now()), UPDATE_STEP_MS);
    }
  }

  _tick(timestamp) {
    if (!this._running) return;

    this._rafId = null;
    this._scheduleFrame(); // запланировать следующий кадр сразу

    if (this._paused) return; // кадр пропускаем, но цикл жив

    const now   = typeof timestamp === 'number' ? timestamp : this._now();
    let   delta = now - this._lastTime;
    this._lastTime = now;

    // Защита от прыжка: ограничиваем delta максимально возможным временем
    const maxDelta = UPDATE_STEP_MS * MAX_STEPS;
    if (delta > maxDelta) {
      delta = maxDelta;
    }

    this._accumulator += delta;
    this._totalTime   += delta;
    this._frameCount++;

    // Шаги симуляции
    let steps = 0;
    while (this._accumulator >= UPDATE_STEP_MS && steps < MAX_STEPS) {
      this._updateFn?.(UPDATE_STEP_S);
      this._accumulator -= UPDATE_STEP_MS;
      steps++;
    }

    // Рендер с альфой интерполяции
    const alpha = this._accumulator / UPDATE_STEP_MS;
    this._renderFn?.(alpha);
  }

  _handleVisibility() {
    if (typeof document === 'undefined') return;

    if (document.visibilityState === 'hidden') {
      // Требование площадки п. 1.3: звук глушится при сворачивании
      this._events?.emit('app:hidden');
      this.pause();
    } else {
      this._events?.emit('app:visible');
      this.resume();
    }
  }

  _now() {
    if (typeof performance !== 'undefined') return performance.now();
    return Date.now();
  }

  /**
   * Сброс — для тестов, очищает состояние без остановки цикла.
   * @internal
   */
  _reset() {
    this._lastTime    = this._now();
    this._accumulator = 0;
    this._frameCount  = 0;
    this._totalTime   = 0;
  }

  destroy() {
    this.stop();
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this._onVisibilityChange);
    }
  }
}
