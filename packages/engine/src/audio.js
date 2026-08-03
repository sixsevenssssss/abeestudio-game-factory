/**
 * AudioSystem — система звука abeeStudio.
 *
 * Три шины: music (фоновая), sfx (эффекты), ui (интерфейс).
 * Backend: Web Audio API (при наличии), иначе HTMLAudioElement, иначе null (тесты).
 *
 * Требования площадки:
 *   п. 1.3:  звук глушится при сворачивании вкладки.
 *   п. 4.7:  звук глушится во время полноэкранной рекламы.
 *   Браузер: AudioContext требует жест пользователя для разблокировки.
 *
 * Использование:
 *   const audio = new AudioSystem({ events });
 *   audio.register('click', '/assets/audio/click.mp3');
 *   audio.register('bgm',   '/assets/audio/bgm.ogg');
 *   await audio.init();
 *
 *   audio.play('click', { bus: 'ui' });
 *   audio.music('bgm');
 *   audio.setVolume('music', 0.5);
 *   audio.duckForAd();
 *   audio.unduck();
 */

const MAX_SFX_POOL    = 8;    // максимум одновременных экземпляров одного sfx
const CROSSFADE_MS    = 1000; // длительность crossfade музыки
const DUCK_RATIO      = 0.2;  // 20% громкости при duck (-80%)

export class AudioSystem {
  /**
   * @param {{
   *   events?: import('./events.js').EventBus,
   *   audioContext?: AudioContext|null,  // null для тестов без браузера
   *   maxSfxPool?: number,
   *   crossfadeMs?: number,
   * }} [opts]
   */
  constructor(opts = {}) {
    this._events      = opts.events       ?? null;
    this._ctx         = opts.audioContext ?? null; // null = мок/тест режим
    this._maxPool     = opts.maxSfxPool   ?? MAX_SFX_POOL;
    this._crossfadeMs = opts.crossfadeMs  ?? CROSSFADE_MS;

    /** Шины: { volume, muted, _gain } */
    this._buses = {
      music: { volume: 1, muted: false, _gain: null },
      sfx:   { volume: 1, muted: false, _gain: null },
      ui:    { volume: 1, muted: false, _gain: null },
    };

    /** Состояние duck */
    this._ducked              = false;
    this._preDuckMusicVolume  = 1;

    /** Зарегистрированные ассеты: id → url */
    this._assets = new Map();

    /** Загруженные буферы: id → AudioBuffer */
    this._buffers = new Map();

    /** Пул активных экземпляров: id → AudioHandle[] */
    this._pool = new Map();

    /** Текущая музыка */
    this._currentMusicId     = null;
    this._currentMusicSource = null; // AudioBufferSourceNode или HTMLAudioElement
    this._currentMusicGain   = null; // дополнительный GainNode для fade

    /** Разблокирован ли AudioContext */
    this._unlocked = false;

    this._boundUnlock = this._unlock.bind(this);
  }

  // ─── инициализация ────────────────────────────────────────────────────────

  /**
   * Инициализировать Web Audio API.
   * Вызывается в Engine.start(). Безопасно вызывать до жеста пользователя.
   */
  async init() {
    if (this._ctx === null && this._detectWebAudio()) {
      try {
        this._ctx = new AudioContext();
        this._buildBusGraph();
      } catch {
        this._ctx = null;
      }
    } else if (this._ctx && this._ctx.destination) {
      // Инжектированный реальный контекст
      this._buildBusGraph();
    }

    // Слушаем первый жест для разблокировки
    if (typeof document !== 'undefined') {
      document.addEventListener('pointerdown', this._boundUnlock, { once: true });
      document.addEventListener('keydown',     this._boundUnlock, { once: true });
    }

    // Слушаем EventBus для duck/unduck и паузы
    this._events?.on('app:hidden',       () => this._suspend());
    this._events?.on('app:visible',      () => this._resumeCtx());
    this._events?.on('platform:hidden',  () => this._suspend());
    this._events?.on('platform:visible', () => this._resumeCtx());
  }

  /**
   * Зарегистрировать звуковой ассет.
   * @param {string} id
   * @param {string} url
   */
  register(id, url) {
    this._assets.set(id, url);
  }

  // ─── воспроизведение ──────────────────────────────────────────────────────

  /**
   * Воспроизвести звуковой эффект.
   * @param {string} id
   * @param {{ bus?: 'sfx'|'ui', loop?: boolean, volume?: number }} [opts]
   * @returns {AudioHandle|null}
   */
  play(id, { bus = 'sfx', loop = false, volume = 1 } = {}) {
    if (!this._assets.has(id)) {
      console.warn(`[Audio] Ассет "${id}" не зарегистрирован.`);
      return null;
    }

    // Управление пулом
    this._trimPool(id);

    const handle = this._createHandle(id, bus, loop, volume);
    if (handle) {
      if (!this._pool.has(id)) this._pool.set(id, []);
      this._pool.get(id).push(handle);
      handle._onEnd = () => this._removeFromPool(id, handle);
    }
    return handle;
  }

  /**
   * Сменить фоновую музыку с crossfade.
   * @param {string|null} id — null для остановки музыки
   * @param {{ crossfadeMs?: number }} [opts]
   */
  music(id, { crossfadeMs } = {}) {
    if (id === this._currentMusicId) return; // уже играет

    const fadeDuration = crossfadeMs ?? this._crossfadeMs;
    const prevSource = this._currentMusicSource;
    const prevGain   = this._currentMusicGain;

    this._currentMusicId = id;
    this._currentMusicSource = null;
    this._currentMusicGain   = null;

    // Fade out предыдущей музыки
    if (prevSource) {
      this._fadeOut(prevGain, fadeDuration, () => {
        this._stopSource(prevSource);
      });
    }

    // Fade in новой музыки
    if (id) {
      const handle = this._createMusicHandle(id, fadeDuration);
      if (handle) {
        this._currentMusicSource = handle.source;
        this._currentMusicGain   = handle.gainNode;
      }
    }
  }

  /**
   * Остановить конкретный звук по id.
   * @param {string} id
   */
  stop(id) {
    const handles = this._pool.get(id) ?? [];
    for (const h of [...handles]) {
      h.stop();
    }
  }

  /**
   * Остановить всю музыку без fade.
   */
  stopMusic() {
    if (this._currentMusicSource) {
      this._stopSource(this._currentMusicSource);
      this._currentMusicSource = null;
      this._currentMusicGain   = null;
    }
    this._currentMusicId = null;
  }

  // ─── управление громкостью ────────────────────────────────────────────────

  /**
   * Установить громкость шины.
   * @param {'music'|'sfx'|'ui'} bus
   * @param {number} volume — 0..1
   */
  setVolume(bus, volume) {
    const b = this._buses[bus];
    if (!b) { console.warn(`[Audio] Шина "${bus}" не найдена.`); return; }
    b.volume = Math.max(0, Math.min(1, volume));
    this._applyBusVolume(bus);
  }

  /**
   * Включить/выключить шину.
   * @param {'music'|'sfx'|'ui'} bus
   * @param {boolean} muted
   */
  setMute(bus, muted) {
    const b = this._buses[bus];
    if (!b) return;
    b.muted = muted;
    this._applyBusVolume(bus);
  }

  /**
   * Приглушить звук для рекламы: music → 20% (−80%). Требование п. 4.7.
   */
  duckForAd() {
    if (this._ducked) return;
    this._ducked = true;
    this._preDuckMusicVolume = this._buses.music.volume;
    this._setGainValue(this._buses.music._gain, this._preDuckMusicVolume * DUCK_RATIO);
    this._events?.emit('audio:ducked');
  }

  /**
   * Восстановить громкость после рекламы.
   */
  unduck() {
    if (!this._ducked) return;
    this._ducked = false;
    this._setGainValue(this._buses.music._gain, this._preDuckMusicVolume);
    this._events?.emit('audio:unducked');
  }

  // ─── геттеры для тестов ───────────────────────────────────────────────────

  /** @returns {number} */
  getVolume(bus) { return this._buses[bus]?.volume ?? 0; }

  /** @returns {boolean} */
  isMuted(bus) { return this._buses[bus]?.muted ?? false; }

  /** @returns {boolean} */
  get isDucked() { return this._ducked; }

  /** @returns {string|null} */
  get currentMusicId() { return this._currentMusicId; }

  /** @returns {boolean} */
  get isUnlocked() { return this._unlocked; }

  /** Количество активных экземпляров звука в пуле */
  poolSize(id) { return this._pool.get(id)?.length ?? 0; }

  // ─── внутренние: Web Audio ───────────────────────────────────────────────

  _detectWebAudio() {
    return typeof AudioContext !== 'undefined' || typeof webkitAudioContext !== 'undefined';
  }

  _buildBusGraph() {
    if (!this._ctx?.destination) return;
    for (const [name, bus] of Object.entries(this._buses)) {
      const gain = this._ctx.createGain();
      gain.gain.value = bus.muted ? 0 : bus.volume;
      gain.connect(this._ctx.destination);
      bus._gain = gain;
    }
  }

  _createHandle(id, busName, loop, volume) {
    // Нет AudioContext → null-handle (тест режим)
    if (!this._ctx?.destination) {
      return new NullAudioHandle(id, busName, loop, volume);
    }
    // TODO: буферизованное воспроизведение (для реального браузера)
    // Сейчас возвращаем NullHandle — реальный браузер получит реализацию позже
    return new NullAudioHandle(id, busName, loop, volume);
  }

  _createMusicHandle(id, _fadeDuration) {
    if (!this._ctx?.destination) {
      return new NullMusicHandle(id);
    }
    return new NullMusicHandle(id);
  }

  _trimPool(id) {
    const handles = this._pool.get(id);
    if (!handles || handles.length < this._maxPool) return;
    // Останавливаем самый старый экземпляр
    const oldest = handles[0];
    oldest.stop();
  }

  _removeFromPool(id, handle) {
    const handles = this._pool.get(id);
    if (!handles) return;
    const idx = handles.indexOf(handle);
    if (idx >= 0) handles.splice(idx, 1);
  }

  _applyBusVolume(bus) {
    const b = this._buses[bus];
    if (!b) return;
    const effective = b.muted ? 0 : b.volume;
    // Не перезаписываем duck, если музыка ducked
    if (bus === 'music' && this._ducked) {
      this._setGainValue(b._gain, effective * DUCK_RATIO);
    } else {
      this._setGainValue(b._gain, effective);
    }
  }

  _setGainValue(gainNode, value) {
    if (gainNode?.gain) {
      gainNode.gain.value = value;
    }
  }

  _fadeOut(gainNode, durationMs, onDone) {
    if (!gainNode?.gain || durationMs === 0) { onDone?.(); return; }
    const start = gainNode.gain.value;
    const elapsed = { t: 0 };
    const step = () => {
      elapsed.t += 16;
      const progress = Math.min(elapsed.t / durationMs, 1);
      gainNode.gain.value = start * (1 - progress);
      if (progress < 1) {
        setTimeout(step, 16);
      } else {
        onDone?.();
      }
    };
    setTimeout(step, 16);
  }

  _stopSource(source) {
    try {
      if (typeof source?.stop === 'function') source.stop();
      if (typeof source?.pause === 'function') source.pause();
    } catch {}
  }

  async _unlock() {
    if (this._unlocked) return;
    this._unlocked = true;
    try {
      if (this._ctx?.state === 'suspended') {
        await this._ctx.resume();
      }
    } catch {}
    this._events?.emit('audio:unlocked');
  }

  _suspend() {
    try { this._ctx?.suspend?.(); } catch {}
  }

  _resumeCtx() {
    if (this._unlocked) {
      try { this._ctx?.resume?.(); } catch {}
    }
  }

  destroy() {
    if (typeof document !== 'undefined') {
      document.removeEventListener('pointerdown', this._boundUnlock);
      document.removeEventListener('keydown',     this._boundUnlock);
    }
    try { this._ctx?.close?.(); } catch {}
  }
}

// ─── Null-handles (работают без Web Audio для тестов и fallback) ──────────

export class NullAudioHandle {
  constructor(id, bus, loop, volume) {
    this.id     = id;
    this.bus    = bus;
    this.loop   = loop;
    this.volume = volume;
    this._stopped = false;
    this._onEnd = null;
  }
  stop() {
    if (this._stopped) return;
    this._stopped = true;
    this._onEnd?.();
  }
  get isStopped() { return this._stopped; }
}

export class NullMusicHandle {
  constructor(id) {
    this.id = id;
    this.source   = { stop: () => {} };
    this.gainNode = { gain: { value: 1 } };
  }
}
