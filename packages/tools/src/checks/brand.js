/**
 * @abeestudio/tools — проверки бренда abeeStudio (B1–B3)
 *
 * Все игры студии выходят под единым брендом: заставка при загрузке, подпись
 * студии в меню и в окне «Об игре», название студии и перекрёстные ссылки —
 * в одном месте, в `game.config.js`.
 *
 * B1  Конфиг бренда со названием студии присутствует и заставка не отключена
 * B2  Окно «Об игре» присутствует
 * B3  Подпись студии доходит до интерфейса
 *
 * ВАЖНО про заставку. По контракту ядра (packages/engine/API.md) `Brand.showSplash()`
 * вызывается АВТОМАТИЧЕСКИ внутри `Engine.start()`. Поэтому явного вызова в коде
 * игры искать нельзя: у корректной игры его не будет, и проверка дала бы ложное
 * красное. Проверяем то, что действительно принадлежит игре — конфиг бренда.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join, basename } from 'node:path';
import { STATUS } from './runner.js';
import {
  walkFiles, rel, findGameCodeDirs, findI18nDir, maskSource, flatten, readJson,
} from './util.js';

/** Имя студии, под которым выходят все игры. Живёт в конфиге бренда игры. */
const STUDIO_NAME = 'abeeStudio';

function readGameConfig(gameDir) {
  const file = join(gameDir, 'game.config.js');
  if (!existsSync(file)) return null;
  try { return { file, source: readFileSync(file, 'utf-8') }; }
  catch { return null; }
}

// ─── B1: конфиг бренда ────────────────────────────────────────────────────────

const checkBrandConfig = {
  id: 'B1',
  title: 'Конфиг бренда: название студии и заставка',
  fn: async (gameDir) => {
    const config = readGameConfig(gameDir);
    if (!config) {
      return {
        status: STATUS.FAIL,
        message: 'Нет game.config.js. Это единственное место, откуда берутся название '
               + 'студии, заставка и перекрёстные ссылки на другие игры — без него '
               + 'бренд студии в игре не появится.',
        fix: 'game.config.js',
      };
    }

    const code = maskSource(config.source);
    const hasBrandSection = /\bbrand\s*:/.test(code);
    const hasStudioName   = /\bstudioName\s*:/.test(code);

    if (!hasBrandSection && !hasStudioName) {
      return {
        status: STATUS.FAIL,
        message: 'В game.config.js нет секции brand со studioName. Ядро читает '
               + 'название студии из Brand.config — без него заставка и подпись пустые.',
        fix: 'game.config.js → brand.studioName',
      };
    }

    if (!hasStudioName) {
      return {
        status: STATUS.FAIL,
        message: 'Секция brand есть, но поля studioName в ней нет. Ядро берёт название '
               + 'студии именно оттуда (Brand.config.studioName).',
        fix: 'game.config.js → brand.studioName',
      };
    }

    // Пустое значение — это как будто поля нет
    if (/\bstudioName\s*:\s*(['"`])\s*\1/.test(config.source)) {
      return {
        status: STATUS.FAIL,
        message: 'studioName пустой. Игрок увидит заставку и подпись без названия студии.',
        fix: 'game.config.js → brand.studioName',
      };
    }

    // Заставка обязательна: проверяем, что её не выключили явно
    const splashDisabled = /\bsplash\s*:\s*false\b/.test(code)
                        || /\bshowSplash\s*:\s*false\b/.test(code)
                        || /\bsplashEnabled\s*:\s*false\b/.test(code);
    if (splashDisabled) {
      return {
        status: STATUS.FAIL,
        message: 'Заставка отключена в конфиге. Все игры студии выходят с заставкой '
               + 'abeeStudio при загрузке — она короткая (до 1,5 с) и пропускается по тапу.',
        fix: 'game.config.js → brand',
      };
    }

    // Слишком долгая заставка — это про удержание: игрок ждёт вместо игры
    const durationMatch = /\bsplash(?:Duration|Ms)?\s*:\s*(\d+)/.exec(code);
    if (durationMatch) {
      const ms = Number(durationMatch[1]);
      if (ms > 1500) {
        return {
          status: STATUS.FAIL,
          message: `Заставка длится ${ms} мс — дольше полутора секунд. `
                 + `Первые секунды решают, останется ли игрок: держи заставку короткой.`,
          fix: 'game.config.js → brand',
        };
      }
    }

    return {
      status: STATUS.OK,
      message: 'Название студии задано, заставка включена',
    };
  },
};

// ─── B2: окно «Об игре» ───────────────────────────────────────────────────────

const checkAboutScreen = {
  id: 'B2',
  title: 'Окно «Об игре» присутствует',
  fn: async (gameDir) => {
    const srcDir = join(gameDir, 'src');
    if (!existsSync(srcDir)) {
      return { status: STATUS.SKIP, message: 'Не проверено: папки src/ нет' };
    }

    const files = walkFiles(srcDir, ['.js']);
    if (files.length === 0) {
      return { status: STATUS.SKIP, message: 'Не проверено: в src/ нет .js файлов' };
    }

    const byName = files.filter(f => /about[-_.]?screen/i.test(basename(f)));
    if (byName.length > 0) {
      return { status: STATUS.OK, message: `Найден ${rel(gameDir, byName[0])}` };
    }

    for (const file of files) {
      let source;
      try { source = readFileSync(file, 'utf-8'); } catch { continue; }
      if (/class\s+About\w*Screen|AboutScreen|['"`]about['"`]\s*[,:)]/.test(source)) {
        return { status: STATUS.OK, message: `Найден в ${rel(gameDir, file)}` };
      }
    }

    return {
      status: STATUS.FAIL,
      message: 'Окна «Об игре» нет. В нём живёт подпись студии и перекрёстные ссылки '
             + 'на другие игры abeeStudio (только через Platform.features.GamesAPI).',
      fix: 'src/screens/about-screen.js',
    };
  },
};

// ─── B3: подпись доходит до интерфейса ────────────────────────────────────────

const checkStudioSignature = {
  id: 'B3',
  title: 'Подпись студии доходит до интерфейса',
  fn: async (gameDir) => {
    const codeDirs = findGameCodeDirs(gameDir);
    if (codeDirs.length === 0) {
      return { status: STATUS.SKIP, message: 'Не проверено: не найдено кода игры (src/game/, src/screens/)' };
    }

    const files = codeDirs.flatMap(dir => walkFiles(dir, ['.js']));
    if (files.length === 0) {
      return { status: STATUS.SKIP, message: 'Не проверено: в коде игры нет .js файлов' };
    }

    // Путь первый: код обращается к Brand.config / studioName
    for (const file of files) {
      let source;
      try { source = readFileSync(file, 'utf-8'); } catch { continue; }
      const code = maskSource(source);
      if (/\bBrand\s*\.\s*config\b/.test(code) || /\bstudioName\b/.test(code)) {
        return {
          status: STATUS.OK,
          message: `Берётся из конфига бренда в ${rel(gameDir, file)}`,
        };
      }
    }

    // Путь второй: подпись лежит в словарях как ключ (и тогда она локализуема)
    const i18nDir = findI18nDir(gameDir);
    if (i18nDir) {
      for (const lang of ['ru', 'en']) {
        const dict = join(i18nDir, `${lang}.json`);
        if (!existsSync(dict)) continue;
        let flat;
        try { flat = flatten(readJson(dict)); } catch { continue; }
        const hit = Object.entries(flat).find(([key, value]) =>
          /studio|about/i.test(key) && typeof value === 'string' && value.includes(STUDIO_NAME));
        if (hit) {
          return {
            status: STATUS.OK,
            message: `Найдена в словаре ${lang}.json → ${hit[0]}`,
          };
        }
      }
    }

    return {
      status: STATUS.FAIL,
      message: `Подписи студии в интерфейсе нет. Название задано в конфиге, но игрок его `
             + `не увидит: экраны не обращаются к Brand.config, и в словарях нет ключа `
             + `с «${STUDIO_NAME}». Подпись должна быть в главном меню и в окне «Об игре».`,
      fix: 'src/screens/about-screen.js или src/i18n/ru.json',
    };
  },
};

export default [checkBrandConfig, checkAboutScreen, checkStudioSignature];
