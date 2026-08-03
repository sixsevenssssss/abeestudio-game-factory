/**
 * @abeestudio/tools — проверки архива (A1–A4)
 *
 * Требования площадки к архиву: один index.html в корне, имена файлов без
 * пробелов и кириллицы, до 100 МБ распакованными.
 *
 * A1  index.html лежит в корне
 * A2  Имена файлов без пробелов и не-ASCII
 * A3  Распакованный вес и самые тяжёлые файлы (только измерение)
 * A4  Время до первого кадра — требует браузера, пока не измеряется
 */

import { existsSync, statSync } from 'node:fs';
import { join, basename } from 'node:path';
import { STATUS } from './runner.js';
import { walkFiles, rel, listSome } from './util.js';

/** Порог площадки: распакованный архив до 100 МБ. */
const HARD_LIMIT_BYTES = 100 * 1024 * 1024;

/** Ориентиры студии, показываются в отчёте как справка, вердикта не меняют. */
const REFERENCE_POINTS = [
  { bytes: 150 * 1024,             label: 'цель студии для пустого шаблона — 150 КБ' },
  { bytes: 8  * 1024 * 1024,       label: 'порог Poki — 8 МБ' },
  { bytes: 20 * 1024 * 1024,       label: 'порог мобильной главной CrazyGames — 20 МБ' },
];

/** Человекочитаемый размер. Без выдумывания: печатаем то, что измерили. */
export function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} МБ`;
}

/** Файлы, которые реально уедут на площадку (без tools/, .git/, node_modules/ и т.п.). */
function shippingFiles(gameDir) {
  return walkFiles(gameDir, []);
}

// ─── A1: index.html в корне ───────────────────────────────────────────────────

const checkIndexInRoot = {
  id: 'A1',
  title: 'index.html лежит в корне',
  fn: async (gameDir) => {
    if (!existsSync(gameDir)) {
      return { status: STATUS.SKIP, message: `Не проверено: папка не найдена — ${gameDir}` };
    }

    const index = join(gameDir, 'index.html');
    if (existsSync(index) && statSync(index).isFile()) {
      return { status: STATUS.OK, message: 'На месте' };
    }

    // Может лежать не там — подскажем, где нашли
    const found = shippingFiles(gameDir).filter(f => basename(f) === 'index.html');
    const hint = found.length
      ? ` Найден не в корне: ${listSome(found.map(f => rel(gameDir, f)), 3)}.`
      : '';

    return {
      status: STATUS.FAIL,
      message: `В корне нет index.html.${hint} Площадка требует ровно один index.html `
             + `в корне архива — иначе игра просто не запустится.`,
      fix: 'index.html',
    };
  },
};

// ─── A2: имена файлов ─────────────────────────────────────────────────────────

const checkFileNames = {
  id: 'A2',
  title: 'Имена файлов без пробелов и не-ASCII',
  fn: async (gameDir) => {
    const files = shippingFiles(gameDir);
    if (files.length === 0) {
      return { status: STATUS.SKIP, message: 'Не проверено: файлов не найдено' };
    }

    const bad = [];
    for (const file of files) {
      const name = basename(file);
      const reasons = [];
      if (/\s/.test(name))                    reasons.push('пробел');
      if (/[а-яА-ЯёЁ]/.test(name))            reasons.push('кириллица');
      // eslint-disable-next-line no-control-regex
      else if (/[^\x20-\x7E]/.test(name))     reasons.push('не-ASCII символ');
      if (reasons.length) {
        bad.push(`${rel(gameDir, file)} (${reasons.join(', ')})`);
      }
    }

    if (bad.length === 0) {
      return {
        status: STATUS.OK,
        message: `Все имена корректны, проверено ${files.length} ${files.length === 1 ? 'файл' : 'файлов'}`,
      };
    }

    return {
      status: STATUS.FAIL,
      message: `Недопустимые имена (${bad.length}): ${listSome(bad, 4)}. `
             + `Площадка требует имена без пробелов и кириллицы: такие файлы `
             + `не отдаются с сервера и игра ломается уже после загрузки архива.`,
      fix: bad[0].split(' (')[0],
    };
  },
};

// ─── A3: вес ──────────────────────────────────────────────────────────────────

const checkWeight = {
  id: 'A3',
  title: 'Распакованный вес игры',
  fn: async (gameDir) => {
    const files = shippingFiles(gameDir);
    if (files.length === 0) {
      return { status: STATUS.SKIP, message: 'Не проверено: файлов не найдено' };
    }

    const sized = [];
    let total = 0;
    let unreadable = 0;

    for (const file of files) {
      try {
        const size = statSync(file).size;
        total += size;
        sized.push({ file, size });
      } catch {
        unreadable++;  // не угадываем размер — считаем непрочитанным
      }
    }

    if (sized.length === 0) {
      return { status: STATUS.SKIP, message: 'Не проверено: ни один файл не удалось измерить' };
    }

    sized.sort((a, b) => b.size - a.size);
    const top = sized.slice(0, 5)
      .map(x => `${rel(gameDir, x.file)} ${formatBytes(x.size)}`)
      .join(', ');

    // Ближайший ориентир сверху — чтобы человек видел, куда он попадает
    const nextRef = REFERENCE_POINTS.find(r => total <= r.bytes);
    const refNote = nextRef
      ? ` Укладывается в ${nextRef.label}.`
      : ` Превышены все ориентиры студии (CrazyGames — 20 МБ).`;

    const base = `${formatBytes(total)} в ${sized.length} ${sized.length === 1 ? 'файле' : 'файлах'}`;
    const unreadNote = unreadable > 0
      ? ` Не удалось измерить файлов: ${unreadable} — вес занижен.`
      : '';
    const zipNote = ' Это распакованный вес; вес zip меньше и меряется командой pack.';

    if (total > HARD_LIMIT_BYTES) {
      return {
        status: STATUS.FAIL,
        message: `${base} — больше лимита площадки 100 МБ распакованными. `
               + `Самые тяжёлые: ${top}.${unreadNote}`,
        fix: rel(gameDir, sized[0].file),
      };
    }

    return {
      status: STATUS.OK,
      show: true,   // измеренный вес виден в отчёте даже при зелёном
      message: `${base}.${refNote}${unreadNote} Самые тяжёлые: ${top}.${zipNote}`,
    };
  },
};

// ─── A4: время до первого кадра ───────────────────────────────────────────────

/**
 * Пункт чек-листа студии, который без браузера измерить нельзя.
 * Живёт в реестре намеренно: если его вообще не показывать, зелёный отчёт
 * будет выглядеть так, будто время загрузки проверили. Пока браузера нет —
 * честное «не проверено» вместо тишины и вместо правдоподобной цифры.
 */
const checkFirstFrame = {
  id: 'A4',
  title: 'Время до первого кадра',
  fn: async () => ({
    status: STATUS.SKIP,
    message: 'Не проверено: нужен браузер. Цель студии — меньше 2 секунд; '
           + 'измерение появится вместе с браузерным слоем проверок.',
  }),
};

export default [checkIndexInRoot, checkFileNames, checkWeight, checkFirstFrame];
