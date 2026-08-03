/**
 * DailySystem — ежедневная награда со стриком abeeStudio.
 *
 * «Новый день» считается по UTC-полуночи: нам важно, что прошла полночь UTC
 * между предыдущим получением и текущим моментом. Клиентским часам доверяем
 * только для этого сравнения — мы не синхронизируем с сервером (нет сервера),
 * но и не создаём условий для злоупотреблений переводом часов: strik ломается
 * если пропущен хотя бы один UTC-день.
 *
 * Использование (конфиг из game.config.js):
 *   const daily = new DailySystem({
 *     rewards: [          // награды по дням (1-й, 2-й, ... день стрика)
 *       { coins: 50 },
 *       { coins: 100 },
 *       { coins: 150 },
 *       { coins: 200, gems: 5 },
 *       { coins: 300, gems: 10 },
 *       { coins: 400, gems: 15 },
 *       { coins: 500, gems: 20 },   // 7-й день — максимальная награда
 *     ],
 *     save, events,
 *   });
 *   daily.init();
 *
 *   const { canClaim, streak, nextClaimAt, weekAheadRewards } = daily.state();
 *   if (canClaim) {
 *     const reward = daily.claim();
 *     applyReward(reward);
 *   }
 */

const SAVE_PREFIX    = 'daily';
const MS_PER_DAY     = 86_400_000; // 24 часа в мс
const WEEK_PREVIEW   = 7;          // дней предпросмотра

export class DailySystem {
  /**
   * @param {{
   *   rewards: object[],                 // массив наград по позиции стрика (cycling)
   *   save?: import('./save.js').SaveSystem,
   *   events?: import('./events.js').EventBus,
   *   now?: () => number,               // инжектируемые часы для тестов
   * }} opts
   */
  constructor({ rewards = [], save, events, now } = {}) {
    this._rewards = rewards;
    this._save    = save   ?? null;
    this._events  = events ?? null;
    this._now     = now    ?? (() => Date.now());

    /** Текущее состояние */
    this._lastClaimTs  = 0;
    this._streak       = 0;
    this._totalClaims  = 0;

    this._initialized  = false;
  }

  // ─── инициализация ────────────────────────────────────────────────────────

  init() {
    if (!this._save) { this._initialized = true; return; }

    this._lastClaimTs = this._save.get(`${SAVE_PREFIX}.lastClaimTs`, 0);
    this._streak      = this._save.get(`${SAVE_PREFIX}.streak`, 0);
    this._totalClaims = this._save.get(`${SAVE_PREFIX}.totalClaims`, 0);

    // Проверяем стрик: если пропущен день — сбрасываем
    if (this._streak > 0 && !this._isStreakAlive()) {
      this._streak = 0;
    }

    this._initialized = true;
  }

  // ─── публичный API ────────────────────────────────────────────────────────

  /**
   * Текущее состояние ежедневной награды.
   * @returns {{
   *   canClaim: boolean,
   *   streak: number,
   *   totalClaims: number,
   *   nextClaimAt: number,      // timestamp UTC следующей доступной полуночи
   *   weekAheadRewards: object[], // следующие WEEK_PREVIEW наград
   * }}
   */
  state() {
    const now          = this._now();
    const todayMidnight = this._utcMidnight(now);
    const canClaim     = this._lastClaimTs < todayMidnight;

    // Когда можно забрать следующую: если ещё не брали сегодня → сегодняшняя полночь
    // (т.е. уже можно); если брали → следующая полночь
    const nextClaimAt  = canClaim ? todayMidnight : todayMidnight + MS_PER_DAY;

    // Предпросмотр: streak + 0, +1, ..., +6 (циклически по _rewards)
    const weekAheadRewards = [];
    for (let i = 0; i < WEEK_PREVIEW; i++) {
      weekAheadRewards.push(this._rewardForStreak(this._streak + i));
    }

    return {
      canClaim,
      streak:            this._streak,
      totalClaims:       this._totalClaims,
      nextClaimAt,
      weekAheadRewards,
    };
  }

  /**
   * Забрать ежедневную награду.
   * @returns {object|null} награда или null если нельзя забрать
   */
  claim() {
    const now           = this._now();
    const todayMidnight = this._utcMidnight(now);

    if (this._lastClaimTs >= todayMidnight) {
      // Уже получена сегодня
      return null;
    }

    // Стрик: жив ли предыдущий или начинаем заново
    if (this._streak > 0 && !this._isStreakAlive()) {
      this._streak = 0; // пропустили день — сброс
    }

    this._streak++;
    this._totalClaims++;
    this._lastClaimTs = now;

    const reward = this._rewardForStreak(this._streak);

    // Сохранить
    this._persist();

    // Событие
    this._events?.emit('daily:claimed', {
      streak:      this._streak,
      totalClaims: this._totalClaims,
      reward,
    });

    return reward;
  }

  // ─── геттеры ──────────────────────────────────────────────────────────────

  get streak()       { return this._streak; }
  get totalClaims()  { return this._totalClaims; }
  get lastClaimTs()  { return this._lastClaimTs; }
  get isInitialized(){ return this._initialized; }

  // ─── внутренние ──────────────────────────────────────────────────────────

  /**
   * Начало UTC-дня для заданного timestamp (полночь UTC 00:00:00.000).
   * @param {number} ts
   * @returns {number}
   */
  _utcMidnight(ts) {
    return Math.floor(ts / MS_PER_DAY) * MS_PER_DAY;
  }

  /**
   * Стрик жив если last_claim был «вчера» (в UTC-сутки, предшествующие сегодня).
   * Стрик сохраняется: last_claim ∈ [yesterday_midnight, today_midnight)
   * @returns {boolean}
   */
  _isStreakAlive() {
    if (this._lastClaimTs === 0) return false;
    const now             = this._now();
    const todayMidnight   = this._utcMidnight(now);
    const yesterdayMidnight = todayMidnight - MS_PER_DAY;
    return this._lastClaimTs >= yesterdayMidnight;
  }

  /**
   * Награда для позиции стрика (циклически).
   * @param {number} streak — 1-based
   * @returns {object}
   */
  _rewardForStreak(streak) {
    if (this._rewards.length === 0) return {};
    const index = (Math.max(0, streak - 1)) % this._rewards.length;
    return this._rewards[index] ?? {};
  }

  _persist() {
    if (!this._save) return;
    this._save.set(`${SAVE_PREFIX}.lastClaimTs`,  this._lastClaimTs);
    this._save.set(`${SAVE_PREFIX}.streak`,       this._streak);
    this._save.set(`${SAVE_PREFIX}.totalClaims`,  this._totalClaims);
  }
}
