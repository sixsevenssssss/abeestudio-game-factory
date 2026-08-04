/**
 * @abeestudio/tools — магические числа в логике игры (M1)
 *
 * Правило студии: все настраиваемые числа живут в конфигах, а не в логике.
 * Баланс, тайминги и экономику должно быть можно править в одном месте —
 * иначе симулятор экономики (`npm run sim`) не видит настоящих значений,
 * а правка баланса превращается в поиск числа по всему коду.
 *
 * M1  Нет «магических чисел» в коде игры
 */

import { readFileSync } from 'node:fs';
import { join, sep } from 'node:path';
import { STATUS } from './runner.js';
import { walkFiles, rel, findGameCodeDirs, maskSource, listSome } from './util.js';

/**
 * Числа, которые магическими не считаются:
 *   0, 1, -1  — ноль, единица, признак «не найдено»
 *   2, -2, 0.5 — деление и умножение вдвое, идиоматично
 *   100       — проценты
 *   1000      — миллисекунды в секунде
 * Всё остальное в логике — настройка, которой место в конфиге.
 */
const ALLOWED_NUMBERS = new Set([0, 1, -1, 2, -2, 0.5, 100, 1000]);

/** Начиная со скольких разных чисел это уже проблема, а не единичный случай. */
const FAIL_THRESHOLD = 5;

/** Папка, где числам жить положено. */
const DATA_DIR_MARKER = `${sep}data${sep}`;

/**
 * Ищет числовые литералы в коде (комментарии и строки уже заглушены).
 * @returns {Array<{value: number, line: number}>}
 */
export function findNumericLiterals(maskedSource) {
  const out = [];
  const lines = maskedSource.split('\n');
  // Число с необязательной дробной частью и экспонентой
  const re = /\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g;

  for (let idx = 0; idx < lines.length; idx++) {
    const line = lines[idx];
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(line)) !== null) {
      const start = m.index;
      const end   = start + m[0].length;
      const before = line.slice(0, start);
      const prevChar = start > 0 ? line[start - 1] : '';
      const nextChar = line[end] ?? '';

      // Часть идентификатора: player2, sha256, v1_2
      if (/[A-Za-z_$\d.]/.test(prevChar) && prevChar !== '.') continue;
      if (/[A-Za-z_$]/.test(nextChar)) continue;

      // Дробная часть уже съедена регуляркой; точка слева — это obj.5 (невалидно)
      // либо .5 — учитываем как 0.5
      if (prevChar === '.') {
        if (/[A-Za-z_$\]]/.test(before.slice(0, -1).at(-1) ?? '')) continue;  // obj.5 / arr[0].5
      }

      // Шестнадцатеричное или двоичное: 0xFF, 0b1010
      if (/0$/.test(before) && /^[xXbBoO]/.test(nextChar)) continue;
      if (/0[xXbBoO][0-9a-fA-F]*$/.test(before + m[0])) continue;

      // Индекс массива: arr[3], matrix[0][1]
      if (/\[\s*$/.test(before) && /^\s*\]/.test(line.slice(end))) continue;

      const isNegative = /[-]\s*$/.test(before) && !/[\w)\]]\s*-\s*$/.test(before);
      const raw = (prevChar === '.' ? '0.' + m[0] : m[0]);
      const value = (isNegative ? -1 : 1) * Number(raw);
      if (!Number.isFinite(value)) continue;

      out.push({ value, line: idx + 1 });
    }
  }

  return out;
}

const checkMagicNumbers = {
  id: 'M1',
  title: 'Нет магических чисел в логике игры',
  fn: async (gameDir) => {
    const codeDirs = findGameCodeDirs(gameDir);
    if (codeDirs.length === 0) {
      return { status: STATUS.SKIP, message: 'Не проверено: не найдено кода игры (src/game/, src/screens/)' };
    }

    // data/ — это и есть место для чисел, её не проверяем
    const files = codeDirs
      .flatMap(dir => walkFiles(dir, ['.js']))
      .filter(f => !f.includes(DATA_DIR_MARKER));

    if (files.length === 0) {
      return {
        status: STATUS.SKIP,
        message: 'Не проверено: в коде игры нет .js файлов вне data/',
      };
    }

    const hits = [];
    for (const file of files) {
      let source;
      try { source = readFileSync(file, 'utf-8'); } catch { continue; }
      for (const lit of findNumericLiterals(maskSource(source))) {
        if (ALLOWED_NUMBERS.has(lit.value)) continue;
        hits.push({ place: `${rel(gameDir, file)}:${lit.line}`, value: lit.value });
      }
    }

    const distinct = new Set(hits.map(h => h.value));
    const places = hits.map(h => `${h.place} → ${h.value}`);
    const scanned = `проверено ${files.length} ${files.length === 1 ? 'файл' : 'файлов'}`;

    if (hits.length === 0) {
      return { status: STATUS.OK, message: `Числа живут в конфигах, ${scanned}` };
    }

    if (distinct.size < FAIL_THRESHOLD) {
      // Не блокируем, но показываем: пусть человек решит сам
      return {
        status: STATUS.OK,
        show: true,
        message: `Найдено чисел в логике: ${hits.length} (${distinct.size} ${distinct.size === 1 ? 'разное' : 'разных'}) — `
               + `порог ${FAIL_THRESHOLD} не превышен, вердикт не блокирую. `
               + `${listSome(places, 4)}. Если это баланс или тайминги — вынеси в src/game/data/.`,
      };
    }

    return {
      status: STATUS.FAIL,
      message: `Магические числа в логике: ${hits.length} ${hits.length === 1 ? 'штука' : 'штук'}, `
             + `${distinct.size} разных. ${listSome(places, 5)}. `
             + `Такой баланс нельзя ни настроить в одном месте, ни прогнать через `
             + `симулятор экономики — вынеси числа в src/game/data/.`,
      fix: hits[0].place,
    };
  },
};

export default [checkMagicNumbers];
