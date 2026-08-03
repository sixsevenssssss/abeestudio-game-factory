/**
 * L10nSystem — локализация abeeStudio.
 *
 * Обязательные требования студии:
 *   - Русский и английский равноправны.
 *   - Ни одной строки текста в коде — только ключи.
 *   - Горячая смена языка: весь интерфейс меняется без перезагрузки.
 *   - Предупреждение если ключ есть в одном словаре и нет в другом.
 *
 * Использование:
 *   const l10n = new L10nSystem({ events });
 *   l10n.init('ru', {
 *     ru: { 'menu.play': 'Играть', 'score': 'Очки: {{value}}' },
 *     en: { 'menu.play': 'Play',   'score': 'Score: {{value}}' },
 *   });
 *
 *   l10n.t('menu.play')                   // → 'Играть'
 *   l10n.t('score', { value: 42 })        // → 'Очки: 42'
 *   l10n.plural(5, ['день', 'дня', 'дней']) // → 'дней'
 *
 *   l10n.setLang('en');  // → события 'l10n:changed' на шине
 */

export class L10nSystem {
  /**
   * @param {{
   *   events?: import('./events.js').EventBus,
   *   warnMissingKeys?: boolean,  // default true
   * }} [opts]
   */
  constructor(opts = {}) {
    this._events         = opts.events          ?? null;
    this._warnMissing    = opts.warnMissingKeys  ?? true;

    /** @type {string} текущий язык */
    this._lang = 'ru';

    /** @type {Record<string, Record<string, string>>} lang → key → value */
    this._dicts = {};

    this._initialized = false;
  }

  // ─── инициализация ────────────────────────────────────────────────────────

  /**
   * Инициализировать систему локализации.
   * @param {string} lang          — начальный язык ('ru' | 'en' | ...)
   * @param {Record<string, Record<string, string>>} dictionaries — { ru: {...}, en: {...} }
   */
  init(lang, dictionaries) {
    this._dicts = dictionaries ?? {};
    this._lang  = this._normalizeLang(lang);
    this._initialized = true;

    // Проверить паритет ключей
    if (this._warnMissing) {
      this._checkParity();
    }
  }

  // ─── основной API ─────────────────────────────────────────────────────────

  /**
   * Перевести ключ с подстановкой переменных.
   * Переменные: {{varName}} в строке словаря.
   *
   * @param {string} key
   * @param {Record<string, string|number>} [vars]
   * @returns {string}
   */
  t(key, vars) {
    const dict = this._dicts[this._lang];
    let value;

    if (dict && key in dict) {
      value = dict[key];
    } else {
      // Фоллбэк: пробуем другой язык
      for (const [l, d] of Object.entries(this._dicts)) {
        if (l !== this._lang && key in d) {
          if (this._warnMissing) {
            console.warn(`[L10n] Ключ "${key}" отсутствует в словаре "${this._lang}", используется фоллбэк из "${l}".`);
          }
          value = d[key];
          break;
        }
      }
    }

    if (value === undefined) {
      if (this._warnMissing) {
        console.warn(`[L10n] Ключ "${key}" не найден ни в одном словаре.`);
      }
      return key; // возвращаем сам ключ — не ломаем интерфейс
    }

    // Подстановка переменных {{name}}
    if (vars && Object.keys(vars).length > 0) {
      value = value.replace(/\{\{(\w+)\}\}/g, (_, name) => {
        return name in vars ? String(vars[name]) : `{{${name}}}`;
      });
    }

    return value;
  }

  /**
   * Склонение числительного.
   * Для русского: forms = [одна форма, две формы, пять форм].
   * Для английского: forms = [singular, plural] (forms[2] игнорируется).
   *
   * @param {number} n
   * @param {[string, string, string]} forms
   * @returns {string}
   */
  plural(n, forms) {
    if (this._lang === 'ru' || this._lang === 'uk' || this._lang === 'be') {
      return forms[this._ruPluralIndex(n)] ?? forms[2] ?? forms[0];
    }
    // EN и остальные: singular / plural
    return n === 1 ? (forms[0] ?? '') : (forms[1] ?? forms[0] ?? '');
  }

  /**
   * Горячая смена языка без перезагрузки страницы.
   * Генерирует событие 'l10n:changed' — все экраны обновляют тексты.
   * @param {string} lang
   */
  setLang(lang) {
    const normalized = this._normalizeLang(lang);
    if (normalized === this._lang) return;

    const prev = this._lang;
    this._lang = normalized;

    this._events?.emit('l10n:changed', { lang: normalized, prev });
  }

  /**
   * Текущий язык.
   * @returns {string}
   */
  get lang() { return this._lang; }

  /**
   * Все доступные языки (ключи словарей).
   * @returns {string[]}
   */
  get availableLangs() { return Object.keys(this._dicts); }

  /**
   * Проверить, инициализирована ли система.
   * @returns {boolean}
   */
  get isInitialized() { return this._initialized; }

  // ─── вспомогательные утилиты ──────────────────────────────────────────────

  /**
   * Нормализовать код языка: взять только первую часть ('ru-RU' → 'ru').
   * @param {string} lang
   * @returns {string}
   */
  _normalizeLang(lang) {
    if (!lang) return 'ru';
    return lang.split('-')[0].split('_')[0].toLowerCase();
  }

  /**
   * Индекс формы для русского склонения:
   *   0 — одна (1, 21, 31…)
   *   1 — две (2-4, 22-24…)
   *   2 — пять (5-20, 25-30…)
   * @param {number} n
   * @returns {0|1|2}
   */
  _ruPluralIndex(n) {
    const abs = Math.abs(Math.floor(n));
    const mod10  = abs % 10;
    const mod100 = abs % 100;

    if (mod10 === 1 && mod100 !== 11) return 0;
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 1;
    return 2;
  }

  /**
   * Проверить паритет ключей между словарями.
   * Выводит Warning для каждого ключа, отсутствующего хотя бы в одном словаре.
   */
  _checkParity() {
    const langs = Object.keys(this._dicts);
    if (langs.length < 2) return;

    // Собираем все ключи
    const allKeys = new Set();
    for (const dict of Object.values(this._dicts)) {
      for (const key of Object.keys(dict)) allKeys.add(key);
    }

    // Ищем расхождения
    for (const key of allKeys) {
      const missing = langs.filter(l => !(key in this._dicts[l]));
      if (missing.length > 0) {
        console.warn(`[L10n] Ключ "${key}" отсутствует в словарях: ${missing.join(', ')}.`);
      }
    }
  }
}
