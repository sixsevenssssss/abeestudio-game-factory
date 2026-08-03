/**
 * BrandModule — бренд abeeStudio.
 *
 * Отвечает за:
 *   - Заставку студии (SVG-логотип, ≤1.5с, пропуск по тапу)
 *   - Конфиг студии (название, ссылки на другие игры через Platform.features.GamesAPI)
 *   - Никаких юридических текстов и несуществующих ссылок — только плейсхолдеры
 *
 * SVG-логотип: шестиугольник + пчела (hex + bee) + надпись «abeeStudio»
 * Всё кодом, без внешних картинок.
 *
 * Использование:
 *   const brand = new BrandModule({ config: gameConfig.brand, container: document.body });
 *   await brand.showSplash(); // показывает заставку ≤1.5с, пропускается по тапу
 */

/** Максимальная длительность заставки в мс */
const SPLASH_MAX_MS = 1500;

/** SVG-логотип abeeStudio (шестиугольник + пчела + текст) */
const LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="160" height="160" aria-label="abeeStudio">
  <!-- Шестиугольник -->
  <polygon points="100,8 174,50 174,150 100,192 26,150 26,50"
    fill="#1a1a2e" stroke="#f5c518" stroke-width="4"/>

  <!-- Соты (фоновый паттерн) -->
  <polygon points="100,30 126,45 126,75 100,90 74,75 74,45"
    fill="none" stroke="#f5c518" stroke-width="1.5" opacity="0.35"/>

  <!-- Тело пчелы (овал) -->
  <ellipse cx="100" cy="108" rx="18" ry="26" fill="#f5c518"/>
  <!-- Полоски -->
  <rect x="82" y="101" width="36" height="5" rx="2" fill="#1a1a2e"/>
  <rect x="82" y="112" width="36" height="5" rx="2" fill="#1a1a2e"/>
  <rect x="82" y="123" width="36" height="5" rx="2" fill="#1a1a2e"/>
  <!-- Голова -->
  <circle cx="100" cy="85" r="10" fill="#f5c518"/>
  <!-- Усики -->
  <line x1="96" y1="76" x2="88" y2="66" stroke="#f5c518" stroke-width="1.5" stroke-linecap="round"/>
  <circle cx="87" cy="65" r="2" fill="#f5c518"/>
  <line x1="104" y1="76" x2="112" y2="66" stroke="#f5c518" stroke-width="1.5" stroke-linecap="round"/>
  <circle cx="113" cy="65" r="2" fill="#f5c518"/>
  <!-- Крылья -->
  <ellipse cx="83" cy="97" rx="14" ry="8" fill="rgba(255,255,255,0.6)" transform="rotate(-25,83,97)"/>
  <ellipse cx="117" cy="97" rx="14" ry="8" fill="rgba(255,255,255,0.6)" transform="rotate(25,117,97)"/>

  <!-- Надпись abeeStudio -->
  <text x="100" y="181" text-anchor="middle" font-family="Arial,sans-serif"
    font-size="15" font-weight="700" letter-spacing="1" fill="#f5c518">abeeStudio</text>
</svg>`;

export class BrandModule {
  /**
   * @param {{
   *   config?: BrandConfig,
   *   container?: HTMLElement|null,  // элемент для монтирования заставки (null = тесты)
   *   splashMaxMs?: number,
   *   events?: import('./events.js').EventBus,
   * }} [opts]
   *
   * @typedef {{
   *   studioName?: string,
   *   games?: Array<{id: string, title: string}>,
   * }} BrandConfig
   */
  constructor(opts = {}) {
    this._config     = opts.config      ?? { studioName: 'abeeStudio', games: [] };
    this._container  = opts.container   ?? null;
    this._maxMs      = opts.splashMaxMs ?? SPLASH_MAX_MS;
    this._events     = opts.events      ?? null;
  }

  // ─── заставка ─────────────────────────────────────────────────────────────

  /**
   * Показать заставку abeeStudio.
   * Resolves через splashMaxMs или по тапу/клику — что раньше.
   * В null-режиме (container=null) resolves мгновенно.
   * @returns {Promise<void>}
   */
  showSplash() {
    if (!this._container) {
      // Node.js / тест-режим — мгновенно
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      const overlay = this._buildOverlay();
      this._container.appendChild(overlay);

      const done = () => {
        if (!overlay.parentNode) return; // уже убрали
        overlay.style.opacity = '0';
        setTimeout(() => {
          overlay.parentNode?.removeChild(overlay);
          this._events?.emit('brand:splash:done');
          resolve();
        }, 200); // fade-out 200мс
      };

      // Таймер — максимум SPLASH_MAX_MS
      const timer = setTimeout(done, this._maxMs);

      // Пропуск по тапу / клику / касанию
      const skipHandler = () => {
        clearTimeout(timer);
        done();
      };
      overlay.addEventListener('click',      skipHandler, { once: true });
      overlay.addEventListener('touchstart', skipHandler, { once: true, passive: true });
    });
  }

  // ─── геттеры ──────────────────────────────────────────────────────────────

  /** Конфиг студии */
  get config() { return this._config; }

  /** Название студии */
  get studioName() { return this._config.studioName ?? 'abeeStudio'; }

  /** Список других игр студии (для GamesAPI) */
  get games() { return this._config.games ?? []; }

  /** SVG-строка логотипа */
  get logoSvg() { return LOGO_SVG; }

  // ─── внутренние ──────────────────────────────────────────────────────────

  _buildOverlay() {
    const div = document.createElement('div');
    div.setAttribute('role', 'img');
    div.setAttribute('aria-label', 'abeeStudio');

    Object.assign(div.style, {
      position:        'fixed',
      inset:           '0',
      zIndex:          '99999',
      display:         'flex',
      flexDirection:   'column',
      alignItems:      'center',
      justifyContent:  'center',
      background:      '#0d0d1a',
      opacity:         '0',
      transition:      'opacity 0.3s ease',
      cursor:          'pointer',
      userSelect:      'none',
      WebkitUserSelect:'none',
      touchAction:     'none',
    });

    div.innerHTML = `
      <div style="animation:abee-pulse 1.5s ease-in-out infinite alternate">
        ${LOGO_SVG}
      </div>
      <style>
        @keyframes abee-pulse {
          from { transform: scale(1); }
          to   { transform: scale(1.06); }
        }
      </style>
    `;

    // Fade-in в следующем кадре
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        div.style.opacity = '1';
      });
    });

    return div;
  }
}
