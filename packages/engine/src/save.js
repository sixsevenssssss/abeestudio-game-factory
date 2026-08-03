/**
 * SaveSystem — система сохранений abeeStudio.
 *
 * Гарантии:
 *   - Версионирование: { _version: N, ...данные } — всегда знаем, от какой версии схема.
 *   - Цепочка миграций: при загрузке старого сохранения автоматически прогоняет все
 *     недостающие шаги версий.
 *   - Защита от порчи: если localStorage битый — откат к резервной копии.
 *     Если и резервная испорчена — начинаем с нуля (не кидаем исключение).
 *   - Аварийный сейв: flush() при beforeunload и visibilitychange:hidden.
 *   - Батчинг: set() откладывает запись на 300мс; flush() пишет немедленно.
 *   - Лимит: данные > 200КБ (ограничение Яндекс SDK) — предупреждение в консоли.
 *
 * Использование:
 *   const save = new SaveSystem({ version: 3, storage: localStorage });
 *   save.migrate(1, data => ({ ...data, coins: data.gold ?? 0 }));  // gold → coins
 *   save.migrate(2, data => ({ ...data, level: 1 }));              // добавить level
 *   await save.load();
 *
 *   Save.get('coins', 0)         // → 42
 *   Save.set('settings.sound', false)
 *   Save.flush()                 // → Promise<void>
 */

const STORAGE_KEY        = 'abeestudio_save';
const STORAGE_BACKUP_KEY = 'abeestudio_save_backup';
const DEBOUNCE_MS        = 300;
const MAX_SIZE_BYTES     = 200 * 1024; // 200 КБ — лимит Яндекс SDK

export class SaveSystem {
  /**
   * @param {{
   *   version?: number,           // текущая версия схемы (default 1)
   *   storage?: Storage|MockStorage, // localStorage или мок (default: авто)
   *   events?: import('./events.js').EventBus,
   *   storageKey?: string,        // override ключа (для тестов)
   * }} [opts]
   */
  constructor(opts = {}) {
    this._version      = opts.version    ?? 1;
    this._storage      = opts.storage    ?? this._detectStorage();
    this._events       = opts.events     ?? null;
    this._key          = opts.storageKey ?? STORAGE_KEY;
    this._backupKey    = (opts.storageKey ?? STORAGE_KEY) + '_backup';

    /** @type {Record<number, (data: object) => object>} version → migration fn */
    this._migrations = {};

    /** Текущие данные (живое состояние) */
    this._data = {};

    /** Последний успешно загруженный снимок — для отката */
    this._lastGoodJson = null;

    /** Флаг: данные изменились и нужно записать */
    this._dirty = false;

    /** Timer id для debounce */
    this._flushTimer = null;

    /** Защита от конкурентного flush */
    this._flushing = false;

    this._boundEmergencySave = () => this.flush();
    this._bindEmergencyHandlers();
  }

  // ─── регистрация миграций ─────────────────────────────────────────────────

  /**
   * Зарегистрировать функцию миграции.
   * Вызывается когда сохранение имеет версию fromVersion и нужно поднять до fromVersion+1.
   * @param {number} fromVersion
   * @param {(data: object) => object} fn
   */
  migrate(fromVersion, fn) {
    if (this._migrations[fromVersion]) {
      console.warn(`[Save] Миграция с версии ${fromVersion} уже зарегистрирована — перезапись.`);
    }
    this._migrations[fromVersion] = fn;
  }

  // ─── загрузка ─────────────────────────────────────────────────────────────

  /**
   * Загрузить сохранение из хранилища.
   * Вызывается один раз при старте игры (через Engine.start).
   */
  async load() {
    const raw = this._readRaw(this._key);
    let parsed = this._tryParse(raw);

    if (parsed === null) {
      // Основной слот битый — пробуем резервный
      const backup = this._readRaw(this._backupKey);
      parsed = this._tryParse(backup);
      if (parsed !== null) {
        console.warn('[Save] Основное сохранение повреждено — восстановлено из резервной копии.');
      }
    }

    if (parsed === null) {
      // Оба слота битые — начинаем с нуля
      console.warn('[Save] Оба сохранения повреждены — начинаем с нуля.');
      parsed = { _version: 0 };
    }

    // Прогоняем цепочку миграций
    parsed = this._runMigrations(parsed);

    this._data = parsed;
    this._lastGoodJson = JSON.stringify(parsed);
    return this._data;
  }

  // ─── публичный API ────────────────────────────────────────────────────────

  /**
   * Получить значение по точечному пути.
   * @param {string} path  — например 'coins' или 'settings.sound'
   * @param {*} [fallback] — значение по умолчанию если пути нет
   */
  get(path, fallback) {
    const value = this._getByPath(this._data, path);
    return value === undefined ? fallback : value;
  }

  /**
   * Установить значение по точечному пути.
   * Создаёт промежуточные объекты если нужно.
   * @param {string} path
   * @param {*} value
   */
  set(path, value) {
    this._setByPath(this._data, path, value);
    this._dirty = true;
    this._scheduleFlushe();
  }

  /**
   * Принудительно записать данные в хранилище немедленно.
   * @returns {Promise<void>}
   */
  flush() {
    if (this._flushTimer !== null) {
      clearTimeout(this._flushTimer);
      this._flushTimer = null;
    }
    return this._doFlush();
  }

  /**
   * Полный снимок данных (только для чтения).
   * @returns {Readonly<object>}
   */
  snapshot() {
    return Object.freeze(JSON.parse(JSON.stringify(this._data)));
  }

  /**
   * Размер сохранения в байтах.
   * @returns {number}
   */
  size() {
    return new TextEncoder().encode(JSON.stringify(this._data)).length;
  }

  /**
   * Полностью сбросить сохранение (для тестов и функции «сброс прогресса»).
   */
  async reset() {
    this._data = { _version: this._version };
    this._dirty = true;
    await this.flush();
  }

  // ─── внутренние ──────────────────────────────────────────────────────────

  _scheduleFlushe() {
    if (this._flushTimer !== null) clearTimeout(this._flushTimer);
    this._flushTimer = setTimeout(() => {
      this._flushTimer = null;
      this._doFlush();
    }, DEBOUNCE_MS);
  }

  async _doFlush() {
    if (!this._dirty) return;
    this._dirty = false;

    // Обновить версию
    this._data._version = this._version;

    const json = JSON.stringify(this._data);

    // Проверка лимита размера
    const byteSize = new TextEncoder().encode(json).length;
    if (byteSize > MAX_SIZE_BYTES) {
      console.warn(`[Save] Размер сохранения ${byteSize} байт превышает лимит ${MAX_SIZE_BYTES}. Часть данных может не сохраниться на площадке.`);
    }

    // Записываем в оба слота (резервный = предыдущее хорошее состояние)
    if (this._lastGoodJson !== null) {
      this._writeRaw(this._backupKey, this._lastGoodJson);
    }
    this._writeRaw(this._key, json);
    this._lastGoodJson = json;

    this._events?.emit('save:flushed', { size: byteSize });
  }

  _tryParse(raw) {
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      if (typeof parsed !== 'object' || parsed === null) return null;
      return parsed;
    } catch {
      return null;
    }
  }

  _runMigrations(data) {
    let version = data._version ?? 0;
    while (version < this._version) {
      const fn = this._migrations[version];
      if (fn) {
        try {
          data = fn({ ...data });
          data._version = version + 1;
        } catch (err) {
          console.error(`[Save] Ошибка в миграции v${version}→v${version+1}:`, err);
          // Пропускаем неудачную миграцию — не блокируем запуск
          data._version = version + 1;
        }
      } else {
        // Нет миграции для этой версии — просто bump
        data._version = version + 1;
      }
      version++;
    }
    return data;
  }

  // ─── точечный доступ к объекту ───────────────────────────────────────────

  _getByPath(obj, path) {
    if (!path) return obj;
    const parts = path.split('.');
    let cur = obj;
    for (const part of parts) {
      if (cur === null || cur === undefined || typeof cur !== 'object') return undefined;
      cur = cur[part];
    }
    return cur;
  }

  _setByPath(obj, path, value) {
    const parts = path.split('.');
    let cur = obj;
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (typeof cur[part] !== 'object' || cur[part] === null) {
        cur[part] = {};
      }
      cur = cur[part];
    }
    cur[parts[parts.length - 1]] = value;
  }

  // ─── хранилище ───────────────────────────────────────────────────────────

  _readRaw(key) {
    try {
      return this._storage?.getItem(key) ?? null;
    } catch {
      return null;
    }
  }

  _writeRaw(key, value) {
    try {
      this._storage?.setItem(key, value);
    } catch (err) {
      console.error('[Save] Ошибка записи в хранилище:', err);
    }
  }

  _detectStorage() {
    if (typeof localStorage !== 'undefined') return localStorage;
    return null; // Node.js — будет работать только с инжектированным хранилищем
  }

  // ─── аварийный сейв ──────────────────────────────────────────────────────

  _bindEmergencyHandlers() {
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', this._boundEmergencySave);
    }
    // Также слушаем событие шины (от GameLoop и Platform)
    this._events?.on('app:hidden',      this._boundEmergencySave);
    this._events?.on('platform:hidden', this._boundEmergencySave);
  }

  destroy() {
    if (typeof window !== 'undefined') {
      window.removeEventListener('beforeunload', this._boundEmergencySave);
    }
    if (this._flushTimer !== null) {
      clearTimeout(this._flushTimer);
      this._flushTimer = null;
    }
  }
}

/**
 * MockStorage — простое хранилище для тестов (без localStorage).
 */
export class MockStorage {
  constructor(initial = {}) {
    this._data = { ...initial };
  }
  getItem(key)        { return this._data[key] ?? null; }
  setItem(key, value) { this._data[key] = value; }
  removeItem(key)     { delete this._data[key]; }
  clear()             { this._data = {}; }
  get length()        { return Object.keys(this._data).length; }
}
