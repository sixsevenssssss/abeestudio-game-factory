/**
 * Platform Mock — полный мок Яндекс SDK для локальной разработки и тестов.
 *
 * Имитирует полный интерфейс window.ysdk без внешних зависимостей.
 * Поведение предсказуемо и настраиваемо через конструктор MockPlatform.
 *
 * Использование в engine:
 *   import { MockPlatform } from './platform/mock.js';
 *   const platform = new MockPlatform({ lang: 'ru' });
 *   await platform.init();   // → platform готов к использованию
 *
 * Использование в тестах:
 *   const platform = new MockPlatform({ rewardedResult: false }); // всегда отказ
 *   platform.overridePlayer({ name: 'Тестовый игрок' });
 */

/** @typedef {{ onOpen?: ()=>void, onRewarded?: ()=>void, onClose?: (wasShown: boolean)=>void, onError?: (err: Error)=>void }} RewardedCallbacks */
/** @typedef {{ onOpen?: ()=>void, onClose?: (wasShown: boolean)=>void, onError?: (err: Error)=>void }} InterstitialCallbacks */

export class MockPlatform {
  /**
   * @param {{
   *   lang?: string,                  // 'ru' | 'en' | ... (default 'ru')
   *   rewardedResult?: boolean,       // true = реклама досмотрена (default true)
   *   interstitialDelay?: number,     // мс задержки interstitial (default 300)
   *   rewardedDelay?: number,         // мс задержки rewarded (default 500)
   *   isAuthorized?: boolean,         // игрок авторизован (default false)
   *   playerName?: string,
   *   playerId?: string,
   *   cloudData?: Record<string,any>, // начальные облачные данные
   * }} [opts]
   */
  constructor(opts = {}) {
    this._lang             = opts.lang             ?? 'ru';
    this._rewardedResult   = opts.rewardedResult   ?? true;
    this._interstitialDelay = opts.interstitialDelay ?? 300;
    this._rewardedDelay    = opts.rewardedDelay    ?? 500;
    this._isAuthorized     = opts.isAuthorized     ?? false;
    this._playerName       = opts.playerName       ?? 'Гость';
    this._playerId         = opts.playerId         ?? 'mock-player-001';
    this._cloudData        = { ...(opts.cloudData  ?? {}) };
    this._cloudStats       = {};

    this._eventHandlers    = {};
    this._leaderboardData  = {}; // name → entries[]
    this._purchases        = [];
    this._loadingReady     = false;

    this.isYandex = false; // мок — не площадка

    // Публичные подсистемы — доступны после init()
    this.environment = null;
    this.adv         = null;
    this.player      = null;
    this.leaderboard = null;
    this.payments    = null;
    this.loadingAPI  = null;
    this.shortcut    = null;
    this.feedback    = null;
    this.features    = null;
  }

  // ─── инициализация ────────────────────────────────────────────────────────

  /**
   * Имитирует YaGames.init(). Возвращает себя (как ysdk).
   * @returns {Promise<MockPlatform>}
   */
  async init() {
    // Небольшая задержка как у настоящего SDK
    await this._delay(10);
    this._buildSubsystems();
    return this;
  }

  // ─── события площадки ─────────────────────────────────────────────────────

  /**
   * Подписка на события площадки (game_api_pause / game_api_resume и др.)
   * @param {string} event
   * @param {Function} handler
   */
  on(event, handler) {
    if (!this._eventHandlers[event]) this._eventHandlers[event] = [];
    this._eventHandlers[event].push(handler);
  }

  off(event, handler) {
    if (!this._eventHandlers[event]) return;
    this._eventHandlers[event] = this._eventHandlers[event].filter(h => h !== handler);
  }

  /** Симулировать событие площадки (для тестов и демонстрации) */
  _emit(event, data) {
    for (const h of (this._eventHandlers[event] ?? [])) {
      try { h(data); } catch {}
    }
  }

  // ─── переопределения для тестов ──────────────────────────────────────────

  overridePlayer(opts) {
    if (opts.name       !== undefined) this._playerName   = opts.name;
    if (opts.id         !== undefined) this._playerId     = opts.id;
    if (opts.authorized !== undefined) this._isAuthorized = opts.authorized;
  }

  overrideRewardedResult(result) { this._rewardedResult = result; }

  /** Загрузить начальные данные облачного сохранения */
  seedCloudData(data) { this._cloudData = { ...data }; }

  // ─── сборка подсистем ─────────────────────────────────────────────────────

  _buildSubsystems() {
    const self = this;

    // environment
    this.environment = {
      i18n: { lang: self._lang, tld: 'ru' },
      app:  { id: 'mock-game', version: '0.0.1' },
      browser: { lang: self._lang },
      payload: null,
    };

    // loadingAPI
    this.loadingAPI = {
      ready() {
        self._loadingReady = true;
        // В реальном SDK это сигнал площадке, что игра загружена
      },
    };

    // adv
    this.adv = {
      showRewardedVideo({ callbacks = {} } = {}) {
        callbacks.onOpen?.();
        setTimeout(() => {
          // Симулируем просмотр ролика
          if (self._rewardedResult) {
            callbacks.onRewarded?.();
          }
          callbacks.onClose?.(self._rewardedResult);
          // Имитируем события паузы/возобновления как реальный SDK
          self._emit('game_api_resume');
        }, self._rewardedDelay);
        // Сначала пауза
        self._emit('game_api_pause');
      },

      showFullscreenAdv({ callbacks = {} } = {}) {
        callbacks.onOpen?.();
        self._emit('game_api_pause');
        setTimeout(() => {
          callbacks.onClose?.(true);
          self._emit('game_api_resume');
        }, self._interstitialDelay);
      },
    };

    // player
    this.player = {
      getMode()       { return self._isAuthorized ? 'full' : 'lite'; },
      isAuthorized()  { return self._isAuthorized; },
      getUniqueID()   { return self._playerId; },
      getName()       { return self._playerName; },
      getPhoto(_size) { return ''; }, // мок без фото

      getData(_keys)  { return Promise.resolve({ ...self._cloudData }); },
      setData(data, _flush) {
        Object.assign(self._cloudData, data);
        return Promise.resolve();
      },
      getStats(_keys) { return Promise.resolve({ ...self._cloudStats }); },
      setStats(stats) {
        Object.assign(self._cloudStats, stats);
        return Promise.resolve();
      },
    };

    // leaderboard
    this.leaderboard = {
      setLeaderboardScore(name, score) {
        if (!self._leaderboardData[name]) self._leaderboardData[name] = [];
        // Заменяем или добавляем запись для мок-игрока
        const idx = self._leaderboardData[name].findIndex(e => e.player.uniqueID === self._playerId);
        const entry = {
          score,
          rank: 1,
          player: { uniqueID: self._playerId, name: self._playerName, lang: self._lang },
        };
        if (idx >= 0) self._leaderboardData[name][idx] = entry;
        else          self._leaderboardData[name].unshift(entry);
        return Promise.resolve();
      },

      getLeaderboardEntries(name, _opts) {
        const entries = self._leaderboardData[name] ?? [];
        return Promise.resolve({
          leaderboard: { name, title: { ru: name, en: name } },
          ranges:  [{ start: 0, size: entries.length }],
          userRank: 0,
          entries: entries.map((e, i) => ({ ...e, rank: i + 1 })),
        });
      },

      getLeaderboardPlayerEntry(name) {
        const entries = self._leaderboardData[name] ?? [];
        const entry = entries.find(e => e.player.uniqueID === self._playerId);
        if (!entry) return Promise.reject(new Error('LEADERBOARD_PLAYER_NOT_PRESENT'));
        return Promise.resolve(entry);
      },
    };

    // payments
    this.payments = {
      purchase({ id } = {}) {
        const purchase = { productID: id, purchaseToken: `mock-token-${Date.now()}` };
        self._purchases.push(purchase);
        return Promise.resolve(purchase);
      },
      getPurchases() {
        return Promise.resolve([...self._purchases]);
      },
      getCatalog() {
        return Promise.resolve([]); // мок-каталог пуст
      },
      consumePurchase(purchaseToken) {
        self._purchases = self._purchases.filter(p => p.purchaseToken !== purchaseToken);
        return Promise.resolve();
      },
    };

    // shortcut
    this.shortcut = {
      canShowPrompt() { return Promise.resolve({ canShow: false }); },
      showPrompt()    { return Promise.resolve({ outcome: 'dismissed' }); },
    };

    // feedback (оценка игры)
    this.feedback = {
      canReview()      { return Promise.resolve({ value: false, reason: 'UNKNOWN' }); },
      requestReview()  { return Promise.resolve({ feedbackSent: false }); },
    };

    // features
    this.features = {
      GamesAPI: {
        getAllGames() { return Promise.resolve([]); },
        // Перекрёстные ссылки на другие игры студии — пустой мок
      },
    };
  }

  _delay(ms) {
    return new Promise(r => setTimeout(r, ms));
  }
}

/**
 * Определить платформу и вернуть готовый адаптер.
 * Если window.YaGames доступен — инициализирует настоящий SDK.
 * Иначе — возвращает MockPlatform.
 *
 * @param {object} [mockOpts] — опции мока (только если не Яндекс)
 * @returns {Promise<{ sdk: MockPlatform|object, isYandex: boolean }>}
 */
export async function initPlatform(mockOpts = {}) {
  const isYandex =
    typeof window !== 'undefined' &&
    typeof window.YaGames !== 'undefined';

  if (isYandex) {
    const sdk = await window.YaGames.init();
    sdk.isYandex = true;
    return { sdk, isYandex: true };
  }

  const mock = new MockPlatform(mockOpts);
  const sdk  = await mock.init();
  return { sdk, isYandex: false };
}
