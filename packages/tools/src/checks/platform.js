/**
 * @abeestudio/tools — проверки платформенной чистоты (P1–P4)
 *
 * Игра общается с площадкой ТОЛЬКО через адаптер src/platform/ — это условие
 * выпуска на несколько площадок: один и тот же код уезжает на Яндекс, VK,
 * CrazyGames, а меняется только адаптер.
 *
 * P1  Нет прямых обращений к ysdk вне src/platform/
 * P2  Нет записи в localStorage мимо Save
 * P3  Нет внешних адресов в коде и разметке (Яндекс Игры, п. 8.4)
 * P4  Нет постоянных сетевых соединений
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { STATUS } from './runner.js';
import {
  walkFiles, rel, findGameCodeDirs, maskSource, findMatches, truncate, listSome,
} from './util.js';

/** Файлы игры, по которым идут P1/P2/P4: только код самой игры. */
function gameJsFiles(gameDir) {
  return findGameCodeDirs(gameDir).flatMap(dir => walkFiles(dir, ['.js']));
}

/** Разметка игры: index.html и прочие .html в корне и src/. */
function gameHtmlFiles(gameDir) {
  const out = [];
  const index = join(gameDir, 'index.html');
  if (existsSync(index)) out.push(index);
  for (const dir of ['src']) {
    const full = join(gameDir, dir);
    if (existsSync(full)) out.push(...walkFiles(full, ['.html']));
  }
  return out;
}

// ─── P1: ysdk вне адаптера ────────────────────────────────────────────────────

const checkNoDirectSdk = {
  id: 'P1',
  title: 'Нет прямых обращений к ysdk вне platform/',
  fn: async (gameDir) => {
    const files = gameJsFiles(gameDir);
    if (files.length === 0) {
      return { status: STATUS.SKIP, message: 'Не проверено: не найдено кода игры (src/game/, src/screens/)' };
    }

    const pattern = /\b(?:ysdk|YaGames|window\.ysdk)\b/;
    const hits = [];

    for (const file of files) {
      let source;
      try { source = readFileSync(file, 'utf-8'); } catch { continue; }
      for (const m of findMatches(maskSource(source), pattern)) {
        hits.push(`${rel(gameDir, file)}:${m.line} — ${m.match}`);
      }
    }

    if (hits.length === 0) {
      return {
        status: STATUS.OK,
        message: `Обращений нет, проверено ${files.length} ${files.length === 1 ? 'файл' : 'файлов'}`,
      };
    }

    return {
      status: STATUS.FAIL,
      message: `Прямое обращение к SDK площадки (${hits.length}): ${listSome(hits, 4)}. `
             + `Такой код нельзя выпустить на VK или CrazyGames — там другой SDK. `
             + `Вызывай через адаптер: Platform, Ads, Save из engine.`,
      fix: hits[0].split(' — ')[0],
    };
  },
};

// ─── P2: localStorage мимо Save ───────────────────────────────────────────────

const checkNoDirectStorage = {
  id: 'P2',
  title: 'Нет записи в localStorage мимо Save',
  fn: async (gameDir) => {
    const files = gameJsFiles(gameDir);
    if (files.length === 0) {
      return { status: STATUS.SKIP, message: 'Не проверено: не найдено кода игры (src/game/, src/screens/)' };
    }

    const pattern = /\b(?:localStorage|sessionStorage)\b/;
    const hits = [];

    for (const file of files) {
      let source;
      try { source = readFileSync(file, 'utf-8'); } catch { continue; }
      for (const m of findMatches(maskSource(source), pattern)) {
        hits.push(`${rel(gameDir, file)}:${m.line} — ${m.match}`);
      }
    }

    if (hits.length === 0) {
      return { status: STATUS.OK, message: 'Прогресс идёт только через Save' };
    }

    return {
      status: STATUS.FAIL,
      message: `Обращение к хранилищу напрямую (${hits.length}): ${listSome(hits, 4)}. `
             + `Мимо Save не работают миграции, облачные сохранения и лимит 200 КБ — `
             + `игрок потеряет прогресс при обновлении игры. Используй Save.get / Save.set.`,
      fix: hits[0].split(' — ')[0],
    };
  },
};

// ─── P3: внешние адреса ───────────────────────────────────────────────────────

/**
 * Адреса, которым внешний вид разрешён:
 *  - пространства имён XML/SVG — не сетевые запросы, браузер их не загружает;
 *  - SDK площадки в index.html — подключать обязательно (п. 1.1);
 *  - локальная разработка.
 */
const ALLOWED_URL = [
  /^https?:\/\/(?:www\.)?w3\.org\//i,
  /^https?:\/\/(?:www\.)?w3\.org$/i,
  /^https?:\/\/schemas?\./i,
  /^https?:\/\/yandex\.ru\/games\/sdk\//i,
  /^https?:\/\/sdk\.games\.s3\.yandex\.net\//i,
  /^https?:\/\/localhost(?::\d+)?/i,
  /^https?:\/\/127\.0\.0\.1(?::\d+)?/i,
];

function isAllowedUrl(url) {
  return ALLOWED_URL.some(re => re.test(url));
}

const checkNoExternalUrls = {
  id: 'P3',
  title: 'Нет внешних адресов в коде и разметке',
  fn: async (gameDir) => {
    const jsFiles   = gameJsFiles(gameDir);
    const htmlFiles = gameHtmlFiles(gameDir);
    if (jsFiles.length === 0 && htmlFiles.length === 0) {
      return { status: STATUS.SKIP, message: 'Не проверено: не найдено ни кода игры, ни index.html' };
    }

    const urlPattern = /https?:\/\/[^\s"'`<>)\\]+/;
    const hits = [];

    // Адреса живут внутри строковых литералов, поэтому ищем по исходнику.
    // Маска нужна только чтобы отбросить строки, которые целиком комментарий:
    // ссылка в комментарии наружу не ведёт.
    for (const file of jsFiles) {
      let source;
      try { source = readFileSync(file, 'utf-8'); } catch { continue; }
      const lines       = source.split('\n');
      const maskedLines = maskSource(source).split('\n');

      for (let idx = 0; idx < lines.length; idx++) {
        const isWholeLineComment = (maskedLines[idx] ?? '').trim() === ''
                                 && lines[idx].trim() !== '';
        if (isWholeLineComment) continue;

        for (const m of findMatches(lines[idx], urlPattern)) {
          if (isAllowedUrl(m.match)) continue;
          hits.push(`${rel(gameDir, file)}:${idx + 1} — ${truncate(m.match, 40)}`);
        }
      }
    }

    for (const file of htmlFiles) {
      let source;
      try { source = readFileSync(file, 'utf-8'); } catch { continue; }
      for (const m of findMatches(source, urlPattern)) {
        if (isAllowedUrl(m.match)) continue;
        hits.push(`${rel(gameDir, file)}:${m.line} — ${truncate(m.match, 40)}`);
      }
    }

    if (hits.length === 0) {
      return { status: STATUS.OK, message: 'Внешних адресов нет' };
    }

    return {
      status: STATUS.FAIL,
      message: `Внешние адреса (${hits.length}): ${listSome(hits, 4)}. `
             + `Ссылки наружу запрещены правилами Яндекс Игр (п. 8.4), а внешние `
             + `шрифты и скрипты ещё и ломают требование «ноль запросов во время игры». `
             + `На другие игры студии ссылайся через Platform (ysdk.features.GamesAPI).`,
      fix: hits[0].split(' — ')[0],
    };
  },
};

// ─── P4: постоянные сетевые соединения ────────────────────────────────────────

const checkNoLiveConnections = {
  id: 'P4',
  title: 'Нет постоянных сетевых соединений',
  fn: async (gameDir) => {
    const files = gameJsFiles(gameDir);
    if (files.length === 0) {
      return { status: STATUS.SKIP, message: 'Не проверено: не найдено кода игры (src/game/, src/screens/)' };
    }

    const pattern = /\b(?:new\s+WebSocket|new\s+EventSource|navigator\s*\.\s*sendBeacon|new\s+XMLHttpRequest|importScripts)\b/;
    const hits = [];

    for (const file of files) {
      let source;
      try { source = readFileSync(file, 'utf-8'); } catch { continue; }
      for (const m of findMatches(maskSource(source), pattern)) {
        hits.push(`${rel(gameDir, file)}:${m.line} — ${m.match.replace(/\s+/g, ' ')}`);
      }
    }

    if (hits.length === 0) {
      return { status: STATUS.OK, message: 'Постоянных соединений нет' };
    }

    return {
      status: STATUS.FAIL,
      message: `Сетевые соединения в коде игры (${hits.length}): ${listSome(hits, 4)}. `
             + `Всё, что нужно игре, лежит в архиве: во время игры не должно быть `
             + `ни одного внешнего запроса. Аналитику отправляй через Analytics.`,
      fix: hits[0].split(' — ')[0],
    };
  },
};

export default [checkNoDirectSdk, checkNoDirectStorage, checkNoExternalUrls, checkNoLiveConnections];
