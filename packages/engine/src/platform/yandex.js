/**
 * YandexPlatform — боевой адаптер Яндекс SDK для abeeStudio.
 *
 * Тонкая обёртка над window.ysdk (результат YaGames.init()).
 * Предоставляет тот же публичный интерфейс, что и MockPlatform, —
 * игровой код не знает, под каким адаптером работает.
 *
 * Обрабатывает обязательные требования площадки:
 *   п. 4.7: game_api_pause → пауза симуляции и звука
 *   п. 1.3: visibilitychange:hidden → звук выключается
 *   п. 1.19.2: loadingAPI.ready() вызывается в нужный момент
 *
 * Использование:
 *   const ysdk = await YaGames.init();
 *   const platform = new YandexPlatform(ysdk, events);
 *   // platform теперь имеет те же поля, что и MockPlatform после init()
 */

export class YandexPlatform {
  /**
   * @param {object} ysdk - результат YaGames.init()
   * @param {import('../events.js').EventBus} [events] - шина событий движка
   */
  constructor(ysdk, events) {
    if (!ysdk) throw new Error('[YandexPlatform] ysdk не передан');

    this._sdk    = ysdk;
    this._events = events ?? null;
    this.isYandex = true;

    // Прямые ссылки на подсистемы ysdk — движок обращается через них
    this.environment = ysdk.environment;
    this.loadingAPI  = ysdk.loadingAPI;
    this.shortcut    = ysdk.shortcut;
    this.feedback    = ysdk.feedback;
    this.features    = ysdk.features;

    // Адаптированные подсистемы
    this.adv         = this._buildAdv();
    this.player      = null;  // заполняется после getPlayer()
    this.leaderboard = this._buildLeaderboard();
    this.payments    = null;  // заполняется после getPayments()

    this._playerPromise   = null;
    this._paymentsPromise = null;

    // Подписаться на события площадки
    this._bindPlatformEvents();
  }

  // ─── инициализация подсистем ──────────────────────────────────────────────

  /**
   * Загрузить объект игрока (async, кешируется).
   * После вызова this.player доступен синхронно.
   * @returns {Promise<object>}
   */
  async initPlayer() {
    if (this.player) return this.player;
    if (!this._playerPromise) {
      this._playerPromise = this._sdk.getPlayer({ scopes: false }).then(p => {
        this.player = p;
        return p;
      });
    }
    return this._playerPromise;
  }

  /**
   * Загрузить объект платежей (async, кешируется).
   * @returns {Promise<object>}
   */
  async initPayments() {
    if (this.payments) return this.payments;
    if (!this._paymentsPromise) {
      this._paymentsPromise = this._sdk.getPayments({ signed: true }).then(p => {
        this.payments = p;
        return p;
      });
    }
    return this._paymentsPromise;
  }

  // ─── on / off (проксируем в ysdk) ────────────────────────────────────────

  on(event, handler)  { this._sdk.on?.(event, handler);  }
  off(event, handler) { this._sdk.off?.(event, handler); }

  // ─── внутренние ──────────────────────────────────────────────────────────

  /**
   * Строим adv-обёртку, которая выглядит идентично MockPlatform.adv,
   * но делегирует в реальный this._sdk.adv.
   */
  _buildAdv() {
    const sdk    = this._sdk;
    const events = this._events;

    return {
      showRewardedVideo({ callbacks = {} } = {}) {
        sdk.adv.showRewardedVideo({ callbacks });
      },

      showFullscreenAdv({ callbacks = {} } = {}) {
        sdk.adv.showFullscreenAdv({ callbacks });
      },
    };
  }

  /**
   * Строим leaderboard-обёртку с единым интерфейсом.
   * Реальный ysdk требует сначала getLeaderboards(), затем методы на полученном объекте.
   */
  _buildLeaderboard() {
    const sdk = this._sdk;
    let _lb = null;

    async function getLb() {
      if (!_lb) _lb = await sdk.getLeaderboards();
      return _lb;
    }

    return {
      async setLeaderboardScore(name, score) {
        const lb = await getLb();
        return lb.setLeaderboardScore(name, score);
      },
      async getLeaderboardEntries(name, opts) {
        const lb = await getLb();
        return lb.getLeaderboardEntries(name, opts);
      },
      async getLeaderboardPlayerEntry(name) {
        const lb = await getLb();
        return lb.getLeaderboardPlayerEntry(name);
      },
    };
  }

  /**
   * Подписываемся на обязательные события площадки и транслируем их
   * в шину событий движка, чтобы Engine мог автоматически ставить игру
   * на паузу и глушить звук.
   *
   * п. 4.7: игра обязана быть на паузе и без звука во время рекламы.
   * п. 1.3: звук должен быть выключен при сворачивании вкладки.
   */
  _bindPlatformEvents() {
    const events = this._events;
    if (!events) return;

    // Площадка эмитит эти события при показе fullscreen/rewarded рекламы
    this._sdk.on?.('game_api_pause', () => {
      events.emit('platform:pause');   // Engine слушает и вызывает loop.pause() + audio.duck()
    });

    this._sdk.on?.('game_api_resume', () => {
      events.emit('platform:resume');  // Engine слушает и вызывает loop.resume() + audio.unduck()
    });

    // Сворачивание вкладки (п. 1.3)
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
          events.emit('platform:hidden');   // Audio глушится
        } else {
          events.emit('platform:visible');  // Audio возвращается
        }
      });
    }
  }
}

/**
 * Вспомогательная функция: проверить, доступен ли Яндекс SDK.
 * Используется в initPlatform() из mock.js для автоопределения среды.
 * @returns {boolean}
 */
export function isYandexEnvironment() {
  return (
    typeof window !== 'undefined' &&
    typeof window.YaGames !== 'undefined'
  );
}
