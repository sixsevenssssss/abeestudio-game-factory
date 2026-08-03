/**
 * AnalyticsSystem — аналитика abeeStudio.
 *
 * Единственная точка входа для всей аналитики: Analytics.event(name, params).
 * Накапливает события в буфере, flush каждые 30с и при уходе со страницы.
 * Сохраняет последние 100 событий в sessionStorage для отладки.
 *
 * Отправка в площадку: вызывает platform.analytics?.track(name, params).
 * Если Platform не поддерживает аналитику — только локальный журнал.
 *
 * Стандартные события студии (удобные обёртки над event()):
 *   session_start, first_session, session_end,
 *   ad_watched, ad_skipped, achievement_unlocked, purchase
 *
 * Использование:
 *   const analytics = new AnalyticsSystem({ platform, events, storage });
 *   analytics.init();
 *
 *   analytics.event('session_start', { lang: 'ru', platform: 'yandex' });
 *   analytics.sessionStart({ lang: 'ru' });  // удобная обёртка
 */

const JOURNAL_KEY   = 'abeestudio_analytics_log';
const JOURNAL_LIMIT = 100;   // последних событий
const FLUSH_INTERVAL_MS = 30_000; // 30 секунд

export class AnalyticsSystem {
  /**
   * @param {{
   *   platform?: object,              // MockPlatform или YandexPlatform
   *   events?: import('./events.js').EventBus,
   *   storage?: Storage|MockJournal,  // sessionStorage или мок
   *   flushIntervalMs?: number,
   *   now?: () => number,
   * }} [opts]
   */
  constructor(opts = {}) {
    this._platform   = opts.platform   ?? null;
    this._events     = opts.events     ?? null;
    this._storage    = opts.storage    ?? this._detectSessionStorage();
    this._intervalMs = opts.flushIntervalMs ?? FLUSH_INTERVAL_MS;
    this._now        = opts.now        ?? (() => Date.now());

    /** @type {Array<{name: string, params: object, ts: number}>} */
    this._buffer = [];

    this._flushTimer = null;
    this._initialized = false;

    this._boundFlush = () => this.flush();
  }

  // ─── инициализация ────────────────────────────────────────────────────────

  init() {
    if (this._initialized) return;
    this._initialized = true;

    // Запустить таймер flush
    if (this._intervalMs > 0) {
      this._flushTimer = setInterval(this._boundFlush, this._intervalMs);
    }

    // Аварийный flush при уходе
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', this._boundFlush);
    }

    // Слушаем события движка для автоматической отправки
    this._events?.on('achievements:unlocked', e =>
      this.achievementUnlocked({ achievement_id: e.id })
    );
    this._events?.on('ads:rewarded:granted', e =>
      this.adWatched({ ad_id: e.rewardId ?? 'reward' })
    );
    this._events?.on('ads:rewarded:end', e => {
      if (!e.granted) this.adSkipped({ ad_id: e.rewardId ?? 'reward' });
    });
  }

  // ─── основной API ─────────────────────────────────────────────────────────

  /**
   * Зафиксировать событие.
   * @param {string} name
   * @param {Record<string, any>} [params]
   */
  event(name, params = {}) {
    const entry = {
      name,
      params: { ...params },
      ts: this._now(),
    };

    this._buffer.push(entry);
    this._writeJournal(entry);

    this._events?.emit('analytics:event', { name, params });
  }

  /**
   * Принудительно отправить все накопленные события.
   */
  flush() {
    if (this._buffer.length === 0) return;

    const toSend = this._buffer.splice(0);
    for (const entry of toSend) {
      this._sendToPlatform(entry.name, entry.params);
    }
  }

  /**
   * Журнал последних событий (для отладки).
   * @returns {Array<{name: string, params: object, ts: number}>}
   */
  getJournal() {
    try {
      const raw = this._storage?.getItem(JOURNAL_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  /**
   * Размер буфера (не отправленных событий).
   * @returns {number}
   */
  get bufferSize() { return this._buffer.length; }

  destroy() {
    this.flush();
    if (this._flushTimer !== null) {
      clearInterval(this._flushTimer);
      this._flushTimer = null;
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('beforeunload', this._boundFlush);
    }
  }

  // ─── стандартные события студии ──────────────────────────────────────────

  /** Начало игровой сессии */
  sessionStart(params = {}) {
    this.event('session_start', params);
  }

  /** Первая сессия игрока (новый игрок) */
  firstSession(params = {}) {
    this.event('first_session', params);
  }

  /** Завершение сессии */
  sessionEnd(params = {}) {
    this.event('session_end', params);
    this.flush(); // сразу отправляем
  }

  /** Реклама досмотрена до конца */
  adWatched(params = {}) {
    this.event('ad_watched', params);
  }

  /** Реклама пропущена или закрыта */
  adSkipped(params = {}) {
    this.event('ad_skipped', params);
  }

  /** Достижение разблокировано */
  achievementUnlocked(params = {}) {
    this.event('achievement_unlocked', params);
  }

  /** Покупка совершена */
  purchase(params = {}) {
    this.event('purchase', params);
    this.flush();
  }

  // ─── внутренние ──────────────────────────────────────────────────────────

  _sendToPlatform(name, params) {
    // Пробуем отправить через Platform (если есть analytics API)
    if (this._platform?.analytics?.track) {
      try {
        this._platform.analytics.track(name, params);
      } catch {}
    }
    // Яндекс SDK использует Metrica через window.ym — не встраиваем напрямую
    // Это делает конкретная игра через конфиг Metrica
  }

  _writeJournal(entry) {
    if (!this._storage) return;
    try {
      const journal = this.getJournal();
      journal.push(entry);
      // Ограничение: последние JOURNAL_LIMIT событий
      if (journal.length > JOURNAL_LIMIT) {
        journal.splice(0, journal.length - JOURNAL_LIMIT);
      }
      this._storage.setItem(JOURNAL_KEY, JSON.stringify(journal));
    } catch {}
  }

  _detectSessionStorage() {
    try {
      if (typeof sessionStorage !== 'undefined') return sessionStorage;
    } catch {}
    return null;
  }
}

/**
 * MockJournal — замена sessionStorage для тестов.
 */
export class MockJournal {
  constructor() { this._data = {}; }
  getItem(key)        { return this._data[key] ?? null; }
  setItem(key, value) { this._data[key] = value; }
  removeItem(key)     { delete this._data[key]; }
}
