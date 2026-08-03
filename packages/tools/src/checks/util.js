/**
 * @abeestudio/tools — общие утилиты для статических проверок
 */

import { readdirSync, statSync, existsSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

/** Папки, которые не принадлежат игре и никогда не проверяются. */
export const IGNORED_DIRS = new Set([
  'node_modules', '.git', 'build', 'dist', 'tools', 'store', '.github',
]);

/**
 * Рекурсивно собирает файлы с заданными расширениями.
 * @param {string} dir       корень обхода
 * @param {string[]} exts    ['.js'] — с точкой; пустой массив = все файлы
 * @returns {string[]} абсолютные пути
 */
export function walkFiles(dir, exts = []) {
  const out = [];
  if (!existsSync(dir)) return out;

  const stack = [dir];
  while (stack.length) {
    const current = stack.pop();
    let entries;
    try { entries = readdirSync(current, { withFileTypes: true }); }
    catch { continue; }

    for (const entry of entries) {
      const full = join(current, entry.name);
      if (entry.isDirectory()) {
        if (!IGNORED_DIRS.has(entry.name)) stack.push(full);
      } else if (entry.isFile()) {
        if (exts.length === 0 || exts.some(e => entry.name.endsWith(e))) {
          out.push(full);
        }
      }
    }
  }
  return out.sort();
}

/** Путь относительно корня игры, всегда со слэшами — для сообщений. */
export function rel(gameDir, filePath) {
  return relative(gameDir, filePath).split(sep).join('/');
}

/**
 * Ищет папку словарей: сначала src/i18n, потом i18n.
 * @returns {string|null} абсолютный путь или null
 */
export function findI18nDir(gameDir) {
  for (const candidate of ['src/i18n', 'i18n', 'src/l10n']) {
    const full = join(gameDir, ...candidate.split('/'));
    if (existsSync(full) && statSync(full).isDirectory()) return full;
  }
  return null;
}

/**
 * Папки с кодом самой игры. engine/, ui/, platform/ приходят из пакетов
 * и не являются зоной ответственности игры — их не проверяем.
 */
export function findGameCodeDirs(gameDir) {
  const out = [];
  for (const candidate of ['src/game', 'src/screens', 'src/scenes']) {
    const full = join(gameDir, ...candidate.split('/'));
    if (existsSync(full)) out.push(full);
  }
  return out;
}

/**
 * Разворачивает вложенный JSON в плоские точечные пути.
 * { a: { b: 1 } } → { 'a.b': 1 }
 */
export function flatten(obj, prefix = '', out = {}) {
  for (const [key, value] of Object.entries(obj ?? {})) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      flatten(value, path, out);
    } else {
      out[path] = value;
    }
  }
  return out;
}

/** Читает и парсит JSON. Бросает с человекочитаемым сообщением. */
export function readJson(filePath) {
  const raw = readFileSync(filePath, 'utf-8');
  try {
    return JSON.parse(raw);
  } catch (err) {
    throw new Error(`битый JSON: ${err.message}`);
  }
}

/**
 * Токенизирует JS-исходник: вырезает комментарии и возвращает
 * строковые литералы с номерами строк и контекстом слева.
 *
 * Полноценный парсер здесь не нужен, но наивный regex ломается на
 * апострофах внутри комментариев и слэшах внутри строк — поэтому
 * маленький конечный автомат.
 *
 * @returns {Array<{value: string, line: number, before: string, quote: string}>}
 */
export function extractStringLiterals(source) {
  const literals = [];
  let i = 0, line = 1;
  const n = source.length;

  while (i < n) {
    const ch = source[i];

    // Перевод строки
    if (ch === '\n') { line++; i++; continue; }

    // Однострочный комментарий
    if (ch === '/' && source[i + 1] === '/') {
      while (i < n && source[i] !== '\n') i++;
      continue;
    }

    // Блочный комментарий
    if (ch === '/' && source[i + 1] === '*') {
      i += 2;
      while (i < n && !(source[i] === '*' && source[i + 1] === '/')) {
        if (source[i] === '\n') line++;
        i++;
      }
      i += 2;
      continue;
    }

    // Строковый литерал
    if (ch === '"' || ch === "'" || ch === '`') {
      const quote = ch;
      const startLine = line;
      const before = source.slice(Math.max(0, i - 60), i);
      i++;
      let value = '';
      while (i < n) {
        if (source[i] === '\\') { value += source[i + 1] ?? ''; i += 2; continue; }
        if (source[i] === quote) { i++; break; }
        if (source[i] === '\n') line++;
        value += source[i];
        i++;
      }
      literals.push({ value, line: startLine, before, quote });
      continue;
    }

    i++;
  }

  return literals;
}

/** Обрезает строку для вывода в отчёте. */
export function truncate(str, max = 50) {
  const oneLine = str.replace(/\s+/g, ' ').trim();
  return oneLine.length > max ? oneLine.slice(0, max) + '…' : oneLine;
}

/**
 * Собирает список в человекочитаемую строку, показывая не более `max` элементов.
 * Остальные сворачивает в «и ещё N».
 */
export function listSome(items, max = 5) {
  if (items.length <= max) return items.join(', ');
  return items.slice(0, max).join(', ') + `, и ещё ${items.length - max}`;
}
