/**
 * AchievementsSystem — достижения abeeStudio.
 *
 * Каталог достижений задаётся в game.config.js и передаётся при инициализации.
 * Состояние персистится через SaveSystem.
 * При разблокировке — событие на EventBus + уведомление в очереди.
 *
 * Пример конфига:
 *   achievements: [
 *     { id: 'first_game',  type: 'one-shot',  reward: { coins: 50 } },
 *     { id: 'score_1000', type: 'progress', target: 1000, reward: { coins: 100 } },
 *   ]
 *
 * Использование:
 *   const ach = new AchievementsSystem({ catalog, save, events });
 *   ach.init();
 *
 *   ach.unlock('first_game');
 *   ach.progress('score_1000', 350);  // прогресс без разблокировки
 *   ach.progress('score_1000', 1000); // разблокировка
 */

const SAVE_KEY     = 'achievements';
const TOAST_MS     = 3000; // длительность уведомления в мс

export class AchievementsSystem {
  /**
   * @param {{
   *   catalog: AchievementDef[],
   *   save?: import('./save.js').SaveSystem,
   *   events?: import('./events.js').EventBus,
   *   showToast?: (achievement: AchievementDef & AchievementState) => void,
   * }} opts
   *
   * @typedef {{ id: string, type: 'one-shot'|'progress', target?: number, reward?: any }} AchievementDef
   * @typedef {{ unlocked: boolean, progress: number, unlockedAt: number|null }} AchievementState
   */
  constructor({ catalog = [], save, events, showToast } = {}) {
    this._catalog   = catalog;
    this._save      = save   ?? null;
    this._events    = events ?? null;
    this._showToast = showToast ?? null;

    /** @type {Map<string, AchievementDef>} id → определение */
    this._defs = new Map(catalog.map(a => [a.id, a]));

    /** @type {Map<string, AchievementState>} id → живое состояние */
    this._state = new Map();

    /** Очередь уведомлений: id достижений в порядке разблокировки */
    this._toastQueue = [];
    this._toastShowing = false;
  }

  // ─── инициализация ────────────────────────────────────────────────────────

  /**
   * Загрузить состояние из Save.
   * Вызывается в Engine.start() после Save.load().
   */
  init() {
    // Инициализируем все достижения начальным состоянием
    for (const def of this._catalog) {
      const saved = this._save?.get(`${SAVE_KEY}.${def.id}`) ?? null;
      this._state.set(def.id, saved ?? {
        unlocked:   false,
        progress:   0,
        unlockedAt: null,
      });
    }
  }

  // ─── основной API ─────────────────────────────────────────────────────────

  /**
   * Разблокировать достижение (one-shot или завершение прогресса).
   * Повторный вызов игнорируется.
   * @param {string} id
   */
  unlock(id) {
    const state = this._state.get(id);
    if (!state) {
      console.warn(`[Achievements] Достижение "${id}" не найдено в каталоге.`);
      return;
    }
    if (state.unlocked) return; // уже открыто

    state.unlocked   = true;
    state.unlockedAt = Date.now();

    const def = this._defs.get(id);
    if (def?.type === 'progress') {
      state.progress = def.target ?? state.progress;
    }

    this._persist(id, state);
    this._notify(id, def, state);
  }

  /**
   * Обновить прогресс достижения.
   * Автоматически разблокирует при достижении target.
   * @param {string} id
   * @param {number} value — абсолютное значение (не дельта)
   */
  progress(id, value) {
    const def   = this._defs.get(id);
    const state = this._state.get(id);

    if (!def || !state) {
      console.warn(`[Achievements] Достижение "${id}" не найдено.`);
      return;
    }
    if (state.unlocked) return;
    if (def.type !== 'progress') {
      console.warn(`[Achievements] Достижение "${id}" не является прогрессивным.`);
      return;
    }

    state.progress = Math.max(state.progress, value); // прогресс только растёт
    this._persist(id, state);

    if (def.target !== undefined && state.progress >= def.target) {
      this.unlock(id);
    }
  }

  /**
   * Прибавить дельту к прогрессу (удобная обёртка над progress).
   * @param {string} id
   * @param {number} delta
   */
  addProgress(id, delta) {
    const state = this._state.get(id);
    if (!state) return;
    this.progress(id, (state.progress ?? 0) + delta);
  }

  // ─── геттеры ──────────────────────────────────────────────────────────────

  /** @returns {boolean} */
  isUnlocked(id) { return this._state.get(id)?.unlocked ?? false; }

  /** @returns {number} */
  getProgress(id) { return this._state.get(id)?.progress ?? 0; }

  /**
   * Полный список состояний достижений.
   * @returns {Array<AchievementDef & AchievementState>}
   */
  getAll() {
    return this._catalog.map(def => ({
      ...def,
      ...(this._state.get(def.id) ?? { unlocked: false, progress: 0, unlockedAt: null }),
    }));
  }

  /** Количество разблокированных достижений */
  get unlockedCount() {
    let count = 0;
    for (const s of this._state.values()) if (s.unlocked) count++;
    return count;
  }

  // ─── уведомление ─────────────────────────────────────────────────────────

  /**
   * Текущая очередь уведомлений (для тестов / отображения).
   * @returns {string[]}
   */
  get toastQueue() { return [...this._toastQueue]; }

  // ─── внутренние ──────────────────────────────────────────────────────────

  _persist(id, state) {
    try {
      this._save?.set(`${SAVE_KEY}.${id}`, { ...state });
    } catch {}
  }

  _notify(id, def, state) {
    // Событие на шину
    this._events?.emit('achievements:unlocked', {
      id,
      def,
      state,
      reward: def?.reward ?? null,
    });

    // Очередь уведомлений
    this._toastQueue.push(id);
    this._drainToastQueue();
  }

  _drainToastQueue() {
    if (this._toastShowing || this._toastQueue.length === 0) return;

    const id  = this._toastQueue.shift();
    const def = this._defs.get(id);
    const st  = this._state.get(id);

    this._toastShowing = true;

    if (this._showToast) {
      try {
        this._showToast({ ...def, ...st });
      } catch (err) {
        console.error('[Achievements] Ошибка в showToast:', err);
      }
    }

    // Следующий слот через TOAST_MS
    setTimeout(() => {
      this._toastShowing = false;
      this._drainToastQueue();
    }, TOAST_MS);
  }
}
