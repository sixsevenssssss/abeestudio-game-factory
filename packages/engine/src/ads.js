/**
 * AdsSystem — система рекламы abeeStudio.
 *
 * Требования площадки (нарушение → отказ модерации):
 *   п. 4.7: игра ДОЛЖНА быть на паузе и без звука во время любой рекламы.
 *   п. 4.5: rewarded — только добровольное нажатие, честная подпись награды.
 *           Задержка от вызова до показа ≤ 0.33с.
 *   п. 1.16: реклама только через SDK, имитировать нельзя.
 *
 * Использование:
 *   const ads = new AdsSystem({ platform, events, loop, audio });
 *   const rewarded = await ads.rewarded('double_coins');
 *   if (rewarded) giveDoubleCoins();
 *
 *   await ads.interstitial('level_complete');
 *
 * AdsSystem не знает об Audio / GameLoop напрямую — получает их через инжекцию.
 * Это позволяет тестировать систему без браузера.
 */

/** Минимальный интервал между межстраничными показами по умолчанию (мс) */
const DEFAULT_INTERSTITIAL_INTERVAL_MS = 60_000; // 60 секунд

export class AdsSystem {
  /**
   * @param {{
   *   platform: object,           // MockPlatform или YandexPlatform после init()
   *   events?: import('./events.js').EventBus,
   *   loop?: { pause: ()=>void, resume: ()=>void },        // GameLoop
   *   audio?: { duckForAd: ()=>void, unduck: ()=>void },   // AudioSystem
   *   interstitialIntervalMs?: number,
   * }} opts
   */
  constructor({ platform, events, loop, audio, interstitialIntervalMs } = {}) {
    if (!platform) throw new Error('[Ads] platform обязателен');

    this._platform   = platform;
    this._events     = events  ?? null;
    this._loop       = loop    ?? null;
    this._audio      = audio   ?? null;
    this._intervalMs = interstitialIntervalMs ?? DEFAULT_INTERSTITIAL_INTERVAL_MS;

    /** Timestamp последнего показа interstitial (performance.now / Date.now) */
    this._lastInterstitialAt = -Infinity;

    /** Флаг: в данный момент идёт показ рекламы */
    this._showing = false;
  }

  // ─── Rewarded Video ───────────────────────────────────────────────────────

  /**
   * Показать rewarded-видео.
   * @param {string} [rewardId] — идентификатор награды (для аналитики)
   * @returns {Promise<boolean>} true только если ролик досмотрен и onRewarded вызван
   */
  rewarded(rewardId = 'reward') {
    return new Promise((resolve) => {
      if (this._showing) {
        // Уже идёт показ — не можем показать ещё одну рекламу
        resolve(false);
        return;
      }

      this._beforeShow();
      this._events?.emit('ads:rewarded:start', { rewardId });

      let rewardGranted = false;
      let settled = false;

      const done = (result) => {
        if (settled) return;
        settled = true;
        this._afterShow();
        this._events?.emit('ads:rewarded:end', { rewardId, granted: result });
        resolve(result);
      };

      try {
        this._platform.adv.showRewardedVideo({
          callbacks: {
            onOpen: () => {
              this._events?.emit('ads:rewarded:opened', { rewardId });
            },
            onRewarded: () => {
              rewardGranted = true;
              this._events?.emit('ads:rewarded:granted', { rewardId });
            },
            onClose: (_wasShown) => {
              done(rewardGranted);
            },
            onError: (err) => {
              console.warn('[Ads] Ошибка rewarded:', err?.message ?? err);
              done(false);
            },
          },
        });
      } catch (err) {
        console.error('[Ads] Исключение при вызове rewarded:', err);
        done(false);
      }
    });
  }

  // ─── Interstitial (fullscreen) ────────────────────────────────────────────

  /**
   * Показать межстраничную рекламу.
   * Если интервал с прошлого показа не истёк — возвращает resolved Promise без показа.
   * @param {string} [reason] — причина показа ('level_complete', 'menu', ...)
   * @returns {Promise<void>}
   */
  interstitial(reason = '') {
    const now = this._now();
    const elapsed = now - this._lastInterstitialAt;

    if (elapsed < this._intervalMs) {
      // Интервал не истёк — тихо пропускаем
      this._events?.emit('ads:interstitial:skipped', {
        reason,
        remainingMs: Math.ceil(this._intervalMs - elapsed),
      });
      return Promise.resolve();
    }

    if (this._showing) {
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      this._beforeShow();
      this._events?.emit('ads:interstitial:start', { reason });

      let settled = false;
      const done = () => {
        if (settled) return;
        settled = true;
        this._lastInterstitialAt = this._now();
        this._afterShow();
        this._events?.emit('ads:interstitial:end', { reason });
        resolve();
      };

      try {
        this._platform.adv.showFullscreenAdv({
          callbacks: {
            onOpen: () => {
              this._events?.emit('ads:interstitial:opened', { reason });
            },
            onClose: (_wasShown) => {
              done();
            },
            onError: (err) => {
              console.warn('[Ads] Ошибка interstitial:', err?.message ?? err);
              done();
            },
          },
        });
      } catch (err) {
        console.error('[Ads] Исключение при вызове interstitial:', err);
        done();
      }
    });
  }

  // ─── утилиты ─────────────────────────────────────────────────────────────

  /**
   * Сбросить таймер интервала (для тестов).
   */
  resetInterstitialTimer() {
    this._lastInterstitialAt = -Infinity;
  }

  /**
   * Переопределить интервал (для тестов и конфига игры).
   * @param {number} ms
   */
  setInterstitialInterval(ms) {
    this._intervalMs = ms;
  }

  /** @returns {boolean} идёт ли сейчас показ рекламы */
  get isShowing() { return this._showing; }

  // ─── внутренние ──────────────────────────────────────────────────────────

  _beforeShow() {
    this._showing = true;
    // Пауза симуляции (требование п. 4.7)
    try { this._loop?.pause(); } catch {}
    // Приглушить звук (требование п. 4.7)
    try { this._audio?.duckForAd(); } catch {}
  }

  _afterShow() {
    this._showing = false;
    // Возобновить симуляцию
    try { this._loop?.resume(); } catch {}
    // Восстановить звук
    try { this._audio?.unduck(); } catch {}
  }

  _now() {
    if (typeof performance !== 'undefined') return performance.now();
    return Date.now();
  }
}
