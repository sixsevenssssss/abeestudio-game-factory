/**
 * EventBus — шина событий abeeStudio.
 * Единственный способ связи между слоями ядра.
 * Не имеет зависимостей; работает в любом окружении (браузер / Node.js / тесты).
 *
 * Использование:
 *   const bus = new EventBus();
 *   const unsub = bus.on('coins:changed', ({ value }) => console.log(value));
 *   bus.emit('coins:changed', { value: 42 });
 *   unsub(); // отписаться
 */
export class EventBus {
  constructor() {
    /** @type {Map<string, Set<Function>>} */
    this._listeners = new Map();
  }

  /**
   * Подписаться на событие.
   * @param {string} type
   * @param {Function} fn
   * @returns {() => void} функция отписки
   */
  on(type, fn) {
    if (!this._listeners.has(type)) {
      this._listeners.set(type, new Set());
    }
    this._listeners.get(type).add(fn);
    return () => this.off(type, fn);
  }

  /**
   * Подписаться ровно на одно событие — автоматически отписывается после первого вызова.
   * @param {string} type
   * @param {Function} fn
   * @returns {() => void} функция принудительной отписки
   */
  once(type, fn) {
    const wrapper = (payload) => {
      fn(payload);
      this.off(type, wrapper);
    };
    // Сохраняем ссылку на wrapper в fn, чтобы off(type, originalFn) тоже работал
    wrapper._originalFn = fn;
    return this.on(type, wrapper);
  }

  /**
   * Отписаться от события.
   * Принимает как оригинальную функцию, так и wrapper от once().
   * @param {string} type
   * @param {Function} fn
   */
  off(type, fn) {
    const set = this._listeners.get(type);
    if (!set) return;

    // Прямое совпадение
    if (set.has(fn)) {
      set.delete(fn);
    } else {
      // Поиск wrapper от once() по _originalFn
      for (const listener of set) {
        if (listener._originalFn === fn) {
          set.delete(listener);
          break;
        }
      }
    }

    if (set.size === 0) {
      this._listeners.delete(type);
    }
  }

  /**
   * Отправить событие всем подписчикам.
   * Ошибки в обработчиках изолированы — один упавший не блокирует остальных.
   * @param {string} type
   * @param {*} [payload]
   */
  emit(type, payload) {
    const set = this._listeners.get(type);
    if (!set || set.size === 0) return;

    // Снимок Set: безопасен при изменении подписок во время итерации
    for (const fn of [...set]) {
      try {
        fn(payload);
      } catch (err) {
        // Ошибка в одном обработчике не убивает остальные
        console.error(`[EventBus] Ошибка в обработчике "${type}":`, err);
      }
    }
  }

  /**
   * Снять все подписки на указанный тип (или все сразу, если type не передан).
   * @param {string} [type]
   */
  clear(type) {
    if (type) {
      this._listeners.delete(type);
    } else {
      this._listeners.clear();
    }
  }

  /**
   * Количество подписчиков (для отладки и тестов).
   * @param {string} type
   * @returns {number}
   */
  listenerCount(type) {
    return this._listeners.get(type)?.size ?? 0;
  }
}

/**
 * Глобальная шина — используется Engine и всеми системами через Engine.events.
 * Не экспортируется напрямую; доступна через Engine.events после Engine.start().
 */
export const globalBus = new EventBus();
