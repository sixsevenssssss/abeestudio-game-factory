/**
 * SceneManager — менеджер сцен abeeStudio.
 *
 * Модель стека:
 *   _stack[0..n-2] — фоновые сцены (на паузе)
 *   _stack[n-1]    — активная сцена (update + render)
 *
 * Интерфейс сцены (все методы опциональны):
 *   preload()          → Promise<void>  — вызывается до enter()
 *   enter(payload)     → void           — сцена становится активной
 *   exit()             → void           — сцена деактивируется
 *   pause()            → void           — другая сцена пушится поверх
 *   resume()           → void           — верхняя сцена удалена со стека
 *   update(dt)         → void           — вызывается каждый шаг (dt в секундах)
 *   render(alpha)      → void           — вызывается каждый кадр (alpha 0..1)
 *
 * Переходы (go):  fade-out → exit old → preload new → enter new → fade-in
 * Стек (push):    pause current → preload new → enter new
 * Стек (pop):     exit top → resume previous
 */

export class SceneManager {
  /**
   * @param {import('./events.js').EventBus} events
   * @param {{
   *   fadeDuration?: number,   // мс затемнения (0 = мгновенно, удобно для тестов)
   *   fadeColor?: string,      // цвет оверлея (default '#000')
   *   getCanvas?: () => HTMLCanvasElement|null
   * }} [opts]
   */
  constructor(events, opts = {}) {
    this._events       = events;
    this._fadeDuration = opts.fadeDuration ?? 150;
    this._fadeColor    = opts.fadeColor ?? '#000';
    this._getCanvas    = opts.getCanvas ?? (() => null);

    /** @type {Map<string, Function>} name → SceneClass */
    this._registry = new Map();

    /** @type {object[]} стек инстанцированных сцен */
    this._stack = [];

    /** Предотвращает конкурентные переходы */
    this._transitioning = false;

    /** Текущий уровень непрозрачности оверлея (0 = прозрачный, 1 = чёрный) */
    this._fadeAlpha = 0;
  }

  // ─── регистрация ──────────────────────────────────────────────────────────

  /**
   * Зарегистрировать класс сцены.
   * @param {string} name
   * @param {Function} SceneClass
   */
  register(name, SceneClass) {
    if (this._registry.has(name)) {
      console.warn(`[SceneManager] Сцена "${name}" уже зарегистрирована — перезапись.`);
    }
    this._registry.set(name, SceneClass);
  }

  // ─── переходы ─────────────────────────────────────────────────────────────

  /**
   * Перейти к новой сцене с затемнением. Заменяет весь стек.
   * @param {string} name
   * @param {*} [payload]
   */
  async go(name, payload) {
    if (this._transitioning) {
      console.warn(`[SceneManager] Переход уже идёт, go("${name}") проигнорирован.`);
      return;
    }
    const SceneClass = this._getClass(name);
    if (!SceneClass) return;

    this._transitioning = true;
    this._events?.emit('scenes:transition:start', { name });

    try {
      // 1. Затемнение (fade-out)
      await this._fade(0, 1);

      // 2. Выход из всех текущих сцен
      for (let i = this._stack.length - 1; i >= 0; i--) {
        this._callHook(this._stack[i], 'exit');
      }
      this._stack = [];

      // 3. Предзагрузка следующей сцены
      const scene = new SceneClass();
      await this._preload(scene);

      // 4. Вход
      this._stack.push(scene);
      this._callHook(scene, 'enter', payload);
      this._events?.emit('scenes:changed', { name, stack: this._stackNames() });

      // 5. Проявление (fade-in)
      await this._fade(1, 0);
    } finally {
      this._transitioning = false;
      this._events?.emit('scenes:transition:end', { name });
    }
  }

  /**
   * Положить сцену на стек (пауза поверх геймплея). Без затемнения.
   * @param {string} name
   * @param {*} [payload]
   */
  async push(name, payload) {
    if (this._transitioning) {
      console.warn(`[SceneManager] Переход уже идёт, push("${name}") проигнорирован.`);
      return;
    }
    const SceneClass = this._getClass(name);
    if (!SceneClass) return;

    this._transitioning = true;
    try {
      // Пауза текущей сцены
      const current = this._current;
      if (current) this._callHook(current, 'pause');

      // Предзагрузка и вход
      const scene = new SceneClass();
      await this._preload(scene);
      this._stack.push(scene);
      this._callHook(scene, 'enter', payload);
      this._events?.emit('scenes:pushed', { name, stack: this._stackNames() });
    } finally {
      this._transitioning = false;
    }
  }

  /**
   * Снять верхнюю сцену со стека. Предыдущая получает resume().
   */
  async pop() {
    if (this._stack.length <= 1) {
      console.warn('[SceneManager] pop() — нечего снимать (стек ≤1).');
      return;
    }
    if (this._transitioning) {
      console.warn('[SceneManager] Переход уже идёт, pop() проигнорирован.');
      return;
    }

    this._transitioning = true;
    try {
      const top = this._stack.pop();
      this._callHook(top, 'exit');

      const prev = this._current;
      if (prev) this._callHook(prev, 'resume');
      this._events?.emit('scenes:popped', { stack: this._stackNames() });
    } finally {
      this._transitioning = false;
    }
  }

  // ─── игровой цикл ─────────────────────────────────────────────────────────

  /**
   * Вызывается из GameLoop.update().
   * @param {number} dt
   */
  update(dt) {
    const scene = this._current;
    if (scene && !this._transitioning) {
      this._callHook(scene, 'update', dt);
    }
  }

  /**
   * Вызывается из GameLoop.render().
   * Рендерит активную сцену, затем поверх — оверлей перехода.
   * @param {number} alpha
   */
  render(alpha) {
    const scene = this._current;
    if (scene) {
      this._callHook(scene, 'render', alpha);
    }
    // Оверлей затемнения
    if (this._fadeAlpha > 0) {
      this._renderFadeOverlay(this._fadeAlpha);
    }
  }

  // ─── геттеры ──────────────────────────────────────────────────────────────

  /** Текущая (верхняя) сцена или null */
  get current() { return this._current; }

  /** Имена сцен в стеке снизу вверх */
  get stackNames() { return this._stackNames(); }

  get isTransitioning() { return this._transitioning; }

  // ─── внутренние ───────────────────────────────────────────────────────────

  get _current() {
    return this._stack.length > 0 ? this._stack[this._stack.length - 1] : null;
  }

  _getClass(name) {
    const cls = this._registry.get(name);
    if (!cls) {
      console.error(`[SceneManager] Сцена "${name}" не зарегистрирована.`);
    }
    return cls ?? null;
  }

  _callHook(scene, hook, arg) {
    if (typeof scene[hook] === 'function') {
      try {
        scene[hook](arg);
      } catch (err) {
        console.error(`[SceneManager] Ошибка в ${scene.constructor?.name}.${hook}():`, err);
      }
    }
  }

  async _preload(scene) {
    if (typeof scene.preload === 'function') {
      try {
        await scene.preload();
      } catch (err) {
        console.error('[SceneManager] Ошибка в preload():', err);
      }
    }
  }

  /** Анимация оверлея: from → to за this._fadeDuration мс */
  _fade(from, to) {
    this._fadeAlpha = from;
    if (this._fadeDuration === 0) {
      this._fadeAlpha = to;
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      const start = this._now();
      const tick  = () => {
        const elapsed = this._now() - start;
        const t = Math.min(elapsed / this._fadeDuration, 1);
        this._fadeAlpha = from + (to - from) * t;
        if (t < 1) {
          if (typeof requestAnimationFrame !== 'undefined') {
            requestAnimationFrame(tick);
          } else {
            setTimeout(tick, 16);
          }
        } else {
          this._fadeAlpha = to;
          resolve();
        }
      };
      tick();
    });
  }

  _renderFadeOverlay(alpha) {
    const canvas = this._getCanvas();
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle   = this._fadeColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
  }

  _stackNames() {
    return this._stack.map((s) => s.constructor?.sceneName ?? s.constructor?.name ?? '?');
  }

  _now() {
    if (typeof performance !== 'undefined') return performance.now();
    return Date.now();
  }
}
