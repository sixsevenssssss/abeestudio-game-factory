/**
 * @abeestudio/tools — проверки локализации (L1–L4)
 *
 * Двуязычность — обязательное требование студии: русский и английский
 * равноправны, оба словаря обязательны, ни одной строки текста в коде.
 *
 * L1  Ключи ru.json и en.json совпадают один в один
 * L2  Нет пустых значений в словарях
 * L3  Нет строк текста, зашитых в код игры
 * L4  Экран выбора языка присутствует
 */

import { existsSync, statSync, readFileSync } from 'node:fs';
import { join, basename } from 'node:path';
import { STATUS } from './runner.js';
import {
  walkFiles, rel, findI18nDir, findGameCodeDirs,
  flatten, readJson, extractStringLiterals, truncate, listSome,
} from './util.js';

const REQUIRED_LANGS = ['ru', 'en'];

// ─── L1: паритет ключей ───────────────────────────────────────────────────────

const checkKeyParity = {
  id: 'L1',
  title: 'Ключи ru.json и en.json совпадают',
  fn: async (gameDir) => {
    const i18nDir = findI18nDir(gameDir);
    if (!i18nDir) {
      return {
        status: STATUS.FAIL,
        message: 'Папка словарей не найдена. Двуязычность обязательна: нужны оба словаря.',
        fix: 'Создай src/i18n/ru.json и src/i18n/en.json',
      };
    }

    const dicts = {};
    for (const lang of REQUIRED_LANGS) {
      const file = join(i18nDir, `${lang}.json`);
      if (!existsSync(file)) {
        return {
          status: STATUS.FAIL,
          message: `Нет словаря ${lang}.json. Русский и английский равноправны — обязательны оба.`,
          fix: `${rel(gameDir, i18nDir)}/${lang}.json`,
        };
      }
      try {
        dicts[lang] = flatten(readJson(file));
      } catch (err) {
        return {
          status: STATUS.FAIL,
          message: `Словарь ${lang}.json не читается — ${err.message}`,
          fix: rel(gameDir, file),
        };
      }
    }

    const ruKeys = new Set(Object.keys(dicts.ru));
    const enKeys = new Set(Object.keys(dicts.en));
    const missingInEn = [...ruKeys].filter(k => !enKeys.has(k)).sort();
    const missingInRu = [...enKeys].filter(k => !ruKeys.has(k)).sort();

    if (missingInEn.length === 0 && missingInRu.length === 0) {
      return {
        status: STATUS.OK,
        message: `Совпадают, ${ruKeys.size} ${ruKeys.size === 1 ? 'ключ' : 'ключей'} в каждом`,
      };
    }

    const parts = [];
    if (missingInEn.length) {
      parts.push(`в en.json не хватает ${missingInEn.length}: ${listSome(missingInEn)}`);
    }
    if (missingInRu.length) {
      parts.push(`в ru.json не хватает ${missingInRu.length}: ${listSome(missingInRu)}`);
    }

    return {
      status: STATUS.FAIL,
      message: `Словари разошлись — ${parts.join('; ')}. `
             + `На языке с пропущенным ключом игрок увидит пустое место или сам ключ.`,
      fix: `${rel(gameDir, i18nDir)}/ru.json и en.json`,
    };
  },
};

// ─── L2: пустые значения ──────────────────────────────────────────────────────

const checkNoEmpty = {
  id: 'L2',
  title: 'Нет пустых значений в словарях',
  fn: async (gameDir) => {
    const i18nDir = findI18nDir(gameDir);
    if (!i18nDir) {
      return {
        status: STATUS.SKIP,
        message: 'Не проверено: папка словарей не найдена (см. L1)',
      };
    }

    const empty = [];
    let checkedFiles = 0;

    for (const lang of REQUIRED_LANGS) {
      const file = join(i18nDir, `${lang}.json`);
      if (!existsSync(file)) continue;
      let dict;
      try { dict = flatten(readJson(file)); }
      catch { continue; }  // битый JSON — это забота L1
      checkedFiles++;

      for (const [key, value] of Object.entries(dict)) {
        if (value === null || value === undefined
            || (typeof value === 'string' && value.trim() === '')) {
          empty.push(`${lang}.json → ${key}`);
        }
      }
    }

    if (checkedFiles === 0) {
      return {
        status: STATUS.SKIP,
        message: 'Не проверено: ни один словарь не удалось прочитать (см. L1)',
      };
    }

    if (empty.length === 0) {
      return { status: STATUS.OK, message: 'Пустых значений нет' };
    }

    return {
      status: STATUS.FAIL,
      message: `Пустые значения (${empty.length}): ${listSome(empty)}. `
             + `Игрок увидит пустую кнопку или подпись.`,
      fix: `${rel(gameDir, i18nDir)}/`,
    };
  },
};

// ─── L3: строки текста в коде ─────────────────────────────────────────────────

/**
 * Явно не текст для игрока: идентификаторы, пути, селекторы, значения стилей.
 *
 * Кириллица никогда не считается технической: это почти всегда подпись для
 * игрока, и лучше разобрать один спорный случай руками, чем пропустить
 * нелокализованную строку в релиз.
 */
function looksTechnical(value) {
  const v = value.trim();
  if (v === '') return true;
  if (/[а-яА-ЯёЁ]/.test(v)) return false;                   // кириллица → разбирает looksHuman
  if (!/[a-zA-Z]/.test(v)) return true;                     // нет букв вовсе
  if (/^[a-z0-9_.\-/]+$/i.test(v)) return true;             // ключ / путь / css-класс / событие
  if (/^#[0-9a-f]{3,8}$/i.test(v)) return true;             // цвет
  if (/\b\d+(px|em|rem|%|vh|vw|pt|deg|ms)\b/i.test(v)) return true;  // содержит css-размер
  if (/\b(serif|sans-serif|monospace|cursive|fantasy|system-ui)\b/i.test(v)) return true;
  if (/^(rgba?|hsla?|url|calc|linear-gradient|radial-gradient|translate|scale|rotate)\(/i.test(v)) return true;
  if (/^(2d|webgl2?|module|utf-8|application\/|text\/|image\/|audio\/)/i.test(v)) return true;
  if (/\.(js|mjs|json|css|html|png|jpe?g|webp|svg|mp3|ogg|wav|woff2?)$/i.test(v)) return true;
  return false;
}

/** Похоже на фразу для игрока: кириллица или несколько слов латиницей. */
function looksHuman(value) {
  const v = value.trim();
  if (/[а-яА-ЯёЁ]/.test(v)) return true;                    // кириллица — почти всегда UI-текст
  if (/\s/.test(v) && (v.match(/[a-zA-Z]{2,}/g) ?? []).length >= 2) return true;
  return false;
}

/** Литерал стоит внутри вызова, который текстом для игрока не является. */
function inAllowedCall(before) {
  const tail = before.replace(/\s+$/, '');
  return /(?:L10n\.t|\bt|L10n\.plural|__)\($/.test(tail)          // локализация
      || /console\.(log|warn|error|info|debug)\(\s*$/.test(tail)  // отладка
      || /\b(?:import|from|require)\s*\(?\s*$/.test(tail)         // модули
      || /\b(?:querySelector(?:All)?|getElementById|addEventListener|removeEventListener|createElement|setAttribute|getAttribute|classList\.\w+|matchMedia|Audio\.play|Audio\.music|emit|on)\(\s*$/.test(tail)
      || /new Error\(\s*$/.test(tail)                             // текст исключения
      || /throw new \w*Error\(\s*$/.test(tail);
}

const checkNoHardcodedText = {
  id: 'L3',
  title: 'Нет строк текста, зашитых в код',
  fn: async (gameDir) => {
    const codeDirs = findGameCodeDirs(gameDir);
    if (codeDirs.length === 0) {
      return {
        status: STATUS.SKIP,
        message: 'Не проверено: не найдено кода игры (src/game/, src/screens/)',
      };
    }

    const files = codeDirs.flatMap(dir => walkFiles(dir, ['.js']));
    if (files.length === 0) {
      return { status: STATUS.SKIP, message: 'Не проверено: в коде игры нет .js файлов' };
    }

    const hits = [];
    for (const file of files) {
      // data/ — это конфиги баланса, там строк для игрока быть не должно,
      // но и текста не бывает; всё равно проверяем: ключи там технические.
      let source;
      try { source = readFileSync(file, 'utf-8'); } catch { continue; }

      for (const lit of extractStringLiterals(source)) {
        if (looksTechnical(lit.value)) continue;
        if (!looksHuman(lit.value)) continue;
        if (inAllowedCall(lit.before)) continue;
        hits.push(`${rel(gameDir, file)}:${lit.line} — "${truncate(lit.value)}"`);
      }
    }

    if (hits.length === 0) {
      return {
        status: STATUS.OK,
        message: `Текста в коде нет, проверено ${files.length} ${files.length === 1 ? 'файл' : 'файлов'}`,
      };
    }

    return {
      status: STATUS.FAIL,
      message: `Текст зашит в код (${hits.length}): ${listSome(hits, 4)}. `
             + `Такая строка не переведётся и останется русской в английской версии — `
             + `выноси её в словарь и вызывай через L10n.t.`,
      fix: hits[0].split(' — ')[0],
    };
  },
};

// ─── L4: экран выбора языка ───────────────────────────────────────────────────

const checkLanguageScreen = {
  id: 'L4',
  title: 'Экран выбора языка присутствует',
  fn: async (gameDir) => {
    const srcDir = join(gameDir, 'src');
    if (!existsSync(srcDir)) {
      return { status: STATUS.SKIP, message: 'Не проверено: папки src/ нет' };
    }

    const files = walkFiles(srcDir, ['.js']);
    if (files.length === 0) {
      return { status: STATUS.SKIP, message: 'Не проверено: в src/ нет .js файлов' };
    }

    // По имени файла
    const byName = files.filter(f => /lang(uage)?[-_.]?screen/i.test(basename(f)));
    if (byName.length > 0) {
      return {
        status: STATUS.OK,
        message: `Найден ${rel(gameDir, byName[0])}`,
      };
    }

    // По содержимому — класс или регистрация сцены
    for (const file of files) {
      let source;
      try { source = readFileSync(file, 'utf-8'); } catch { continue; }
      if (/class\s+Language\w*Screen|['"`]language['"`]\s*[,:)]|LanguageScreen/.test(source)) {
        return {
          status: STATUS.OK,
          message: `Найден в ${rel(gameDir, file)}`,
        };
      }
    }

    return {
      status: STATUS.FAIL,
      message: 'Экран выбора языка не найден. При первом запуске игрок должен '
             + 'увидеть выбор языка (два крупных флага-кнопки, предвыбран язык площадки).',
      fix: 'src/screens/language-screen.js',
    };
  },
};

export default [checkKeyParity, checkNoEmpty, checkNoHardcodedText, checkLanguageScreen];
