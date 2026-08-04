/**
 * @abeestudio/engine — главный модуль ядра.
 *
 * Экспортирует все системы и класс Engine с методом Engine.start().
 *
 * Использование в игре:
 *   import { Engine, Save, Ads, L10n, Audio, Achievements, Daily, Analytics, Platform, Brand }
 *     from '../engine/index.js';
 *
 *   await Engine.start({ scenes, config });
 */

// ─── реэкспорты всех систем ──────────────────────────────────────────────

export { EventBus }                           from './src/events.js';
export { GameLoop, UPDATE_STEP_MS, UPDATE_STEP_S } from './src/loop.js';
export { SceneManager }                       from './src/scenes.js';
export { InputManager }                       from './src/input.js';
export { MockPlatform, initPlatform }         from './src/platform/mock.js';
export { YandexPlatform, isYandexEnvironment } from './src/platform/yandex.js';
export { SaveSystem, MockStorage }            from './src/save.js';
export { AdsSystem }                          from './src/ads.js';
export { AudioSystem, NullAudioHandle }       from './src/audio.js';
export { L10nSystem }                         from './src/l10n.js';
export { AchievementsSystem }                 from './src/achievements.js';
export { DailySystem }                        from './src/daily.js';
export { AnalyticsSystem, MockJournal }       from './src/analytics.js';
export { BrandModule }                        from './src/brand.js';

// ─── импорты для Engine ──────────────────────────────────────────────────

import { EventBus }        from './src/events.js';
import { GameLoop }        from './src/loop.js';
import { SceneManager }    from './src/scenes.js';
import { InputManager }    from './src/input.js';
import { initPlatform }    from './src/platform/mock.js';
import { SaveSystem }      from './src/save.js';
import { AdsSystem }       from './src/ads.js';
import { AudioSystem }     from './src/audio.js';
import { L10nSystem }      from './src/l10n.js';
import { AchievementsSystem } from './src/achievements.js';
import { DailySystem }     from './src/daily.js';
import { AnalyticsSystem } from './src/analytics.js';
import { BrandModule }     from './src/brand.js';

// ─── Engine ──────────────────────────────────────────────────────────────

/**
 * Engine — оркестратор всех систем.
 *
 * Синглтон-паттерн: Engine.start() инициализирует все системы в порядке,
 * зафиксированном в контракте студии:
 *   Platform → L10n → Save → Audio → Achievements → Daily → Analytics
 *   → Ads → Scenes → Loop → (Input) → Brand.showSplash → LoadingAPI.ready
 *   → Scenes.go(firstScene)
 *
 * После start() все системы доступны через статические свойства.
 */
export class Engine {
  /** @type {EngineInstance|null} */
  static _instance = null;

  // ─── статические делегаты ────────────────────────────────────────────

  static get events()   { return Engine._instance?._events  ?? _fallbackBus; }
  static get scenes()   { return Engine._instance?._scenes; }
  static get loop()     { return Engine._instance?._loop; }
  static get input()    { return Engine._instance?._input; }
  static get platform() { return Engine._instance?._platform; }
  static get save()     { return Engine._instance?._save; }
  static get ads()      { return Engine._instance?._ads; }
  static get audio()    { return Engine._instance?._audio; }
  static get l10n()     { return Engine._instance?._l10n; }
  static get achievements() { return Engine._instance?._achievements; }
  static get daily()    { return Engine._instance?._daily; }
  static get analytics(){ return Engine._instance?._analytics; }
  static get brand()    { return Engine._instance?._brand; }

  // ─── инициализация ───────────────────────────────────────────────────

  /**
   * Инициализировать все системы и запустить первую сцену.
   *
   * @param {{
   *   scenes: Map<string, Function> | Record<string, Function>,
   *   config: GameConfig,
   *   container?: HTMLElement|null,
   *   canvas?: HTMLCanvasElement|null,
   * }} opts
   *
   * @typedef {{
   *   firstScene?: string,
   *   firstScenePayload?: any,
   *   brand?: { studioName?: string, games?: any[] },
   *   i18n?: { defaultLang?: string, dictionaries?: Record<string,any> },
   *   audio?: { music?: {volume?: number}, sfx?: {volume?: number}, ui?: {volume?: number} },
   *   achievements?: any[],
   *   daily?: { rewards?: any[] },
   *   ads?: { interstitialIntervalMs?: number },
   *   save?: { version?: number, migrations?: Array<{from: number, fn: Function}> },
   * }} GameConfig
   */
  static async start({ scenes, config = {}, container = null, canvas = null } = {}) {
    const instance = new EngineInstance();
    Engine._instance = instance;
    await instance._init({ scenes, config, container, canvas });
    return instance;
  }

  /**
   * Остановить движок и очистить ресурсы.
   */
  static stop() {
    Engine._instance?._destroy();
    Engine._instance = null;
  }
}

/** Fallback EventBus до вызова Engine.start() */
const _fallbackBus = new EventBus();

// ─── EngineInstance ──────────────────────────────────────────────────────

class EngineInstance {
  constructor() {
    this._events      = new EventBus();
    this._platform    = null;
    this._save        = null;
    this._l10n        = null;
    this._audio       = null;
    this._achievements = null;
    this._daily       = null;
    this._analytics   = null;
    this._ads         = null;
    this._scenes      = null;
    this._loop        = null;
    this._input       = null;
    this._brand       = null;
  }

  async _init({ scenes, config, container, canvas }) {
    const cfg = config ?? {};

    // 1. Platform — определить среду и язык
    const { sdk, isYandex } = await initPlatform({
      lang: cfg.i18n?.defaultLang ?? 'ru',
    });
    this._platform = sdk;
    const platformLang = sdk.environment?.i18n?.lang ?? cfg.i18n?.defaultLang ?? 'ru';

    // 2. L10n — словари
    this._l10n = new L10nSystem({ events: this._events });
    if (cfg.i18n?.dictionaries) {
      this._l10n.init(platformLang, cfg.i18n.dictionaries);
    } else {
      this._l10n.init(platformLang, {});
    }

    // 3. Save — загрузка прогресса
    this._save = new SaveSystem({
      version: cfg.save?.version ?? 1,
      events:  this._events,
    });
    for (const m of (cfg.save?.migrations ?? [])) {
      this._save.migrate(m.from, m.fn);
    }
    await this._save.load();

    // 4. Audio — три шины
    this._audio = new AudioSystem({
      events:      this._events,
      audioContext: null, // браузер создаст после жеста пользователя
    });
    await this._audio.init();
    if (cfg.audio?.music?.volume  !== undefined) this._audio.setVolume('music', cfg.audio.music.volume);
    if (cfg.audio?.sfx?.volume    !== undefined) this._audio.setVolume('sfx',   cfg.audio.sfx.volume);
    if (cfg.audio?.ui?.volume     !== undefined) this._audio.setVolume('ui',    cfg.audio.ui.volume);

    // 5. Achievements
    this._achievements = new AchievementsSystem({
      catalog: cfg.achievements ?? [],
      save:    this._save,
      events:  this._events,
    });
    this._achievements.init();

    // 6. Daily
    this._daily = new DailySystem({
      rewards: cfg.daily?.rewards ?? [],
      save:    this._save,
      events:  this._events,
    });
    this._daily.init();

    // 7. Analytics
    this._analytics = new AnalyticsSystem({
      platform: this._platform,
      events:   this._events,
    });
    this._analytics.init();

    // 8. Ads
    this._ads = new AdsSystem({
      platform:              this._platform,
      events:                this._events,
      loop:                  null, // wire после создания loop
      audio:                 this._audio,
      interstitialIntervalMs: cfg.ads?.interstitialIntervalMs,
    });

    // 9. Scenes + Loop (взаимозависимы)
    this._scenes = new SceneManager(this._events, {
      fadeDuration: typeof document !== 'undefined' ? 150 : 0,
      getCanvas:    canvas ? () => canvas : () => null,
    });

    this._loop = new GameLoop(this._events);

    // wire Ads → Loop
    this._ads._loop = this._loop;

    // wire Loop update/render → Scenes
    this._loop.start(
      (dt)    => this._scenes.update(dt),
      (alpha) => this._scenes.render(alpha)
    );

    // 10. Input
    if (container) {
      this._input = new InputManager(this._events, container);
    }

    // 11. Brand
    this._brand = new BrandModule({
      config:    cfg.brand ?? {},
      container: typeof document !== 'undefined' ? (container ?? document.body) : null,
      events:    this._events,
    });

    // Регистрируем сцены
    const sceneMap = scenes instanceof Map ? scenes : new Map(Object.entries(scenes ?? {}));
    for (const [name, cls] of sceneMap) {
      this._scenes.register(name, cls);
    }

    // 12. Brand splash
    await this._brand.showSplash();

    // 13. LoadingAPI.ready() — игрок видит игру (требование п. 1.19.2)
    try { this._platform?.loadingAPI?.ready(); } catch {}

    // 14. Первая сцена
    const firstScene = cfg.firstScene;
    if (firstScene && sceneMap.has(firstScene)) {
      await this._scenes.go(firstScene, cfg.firstScenePayload);
    }

    // Отправить session_start
    this._analytics.sessionStart({
      lang:     this._l10n.lang,
      platform: isYandex ? 'yandex' : 'local',
    });

    // Проверить first_session
    const isFirst = !this._save.get('_firstSessionSeen', false);
    if (isFirst) {
      this._save.set('_firstSessionSeen', true);
      this._analytics.firstSession({ lang: this._l10n.lang });
    }
  }

  _destroy() {
    this._loop?.stop();
    this._input?.detach();
    this._analytics?.sessionEnd({ duration_s: 0 });
    this._audio?.destroy();
    this._save?.destroy();
  }
}
