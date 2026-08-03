/**
 * src/themes/index.js — управление темами @abeestudio/ui
 *
 * Каждая тема — отдельный CSS-файл с CSS custom properties.
 * Игра подключает нужные темы тегами <link> в index.html:
 *
 *   <link rel="stylesheet" href="ui/src/themes/abee-default.css">
 *
 * switchTheme() только меняет классы на <html> — без рантаймовых запросов.
 *
 * Пример:
 *   import { switchTheme, getCurrentTheme } from '../ui/src/themes/index.js';
 *   switchTheme('cosmic-dark');
 *   switchTheme('abee-default', true); // true = светлый вариант
 *   getCurrentTheme(); // → { name: 'cosmic-dark', light: false }
 */

const THEMES = [
  'abee-default',   // фирменная тёмная (умолчание)
  'crystal-light',  // светлая чистая
  'cosmic-dark',    // тёмная космическая
  'meadow-warm',    // тёплая природная
  'steel-sharp',    // холодная технологичная
];
const PREFIX = 'theme-';

let _name  = 'abee-default';
let _light = false;

/**
 * Переключает тему.
 *
 * @param {string}  name  — имя темы (одно из AVAILABLE_THEMES)
 * @param {boolean} light — true = светлый вариант (по умолчанию false = тёмный)
 *
 * Эмитит CustomEvent 'ui:theme:change' на document:
 *   { detail: { name: string, light: boolean } }
 */
export function switchTheme(name, light = false) {
  if (!THEMES.includes(name)) {
    console.warn(`[ui/themes] Неизвестная тема: "${name}". Доступно: ${THEMES.join(', ')}`);
    return;
  }
  const html = document.documentElement;
  // Снимаем все классы тем и варианты
  THEMES.forEach(t => html.classList.remove(PREFIX + t));
  html.classList.remove('light', 'dark');
  // Применяем новую тему
  html.classList.add(PREFIX + name);
  html.classList.add(light ? 'light' : 'dark');
  _name  = name;
  _light = light;
  // Событие для игры
  document.dispatchEvent(new CustomEvent('ui:theme:change', {
    detail: { name, light },
    bubbles: false,
  }));
}

/**
 * Возвращает текущую тему.
 * @returns {{ name: string, light: boolean }}
 */
export function getCurrentTheme() {
  return { name: _name, light: _light };
}

/**
 * Все доступные имена тем.
 * @type {readonly string[]}
 */
export const AVAILABLE_THEMES = Object.freeze([...THEMES]);
