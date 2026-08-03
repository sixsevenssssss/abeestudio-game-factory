/**
 * Тесты для src/checks/i18n.js — проверка «от противного».
 *
 * Каждая поломка подкладывается в копию здоровой фикстуры, после чего
 * проверяется: ловит ли ЕЁ ОБНАРУЖИЛА своя проверка, объясняет ли причину
 * человеческим языком, и не задевает ли соседние проверки.
 *
 * Запуск: node --test test/i18n.test.js
 */

import { test, describe, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, rmSync, writeFileSync, readFileSync, mkdtempSync, unlinkSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

import i18nChecks from '../src/checks/i18n.js';
import { runChecks, STATUS } from '../src/checks/runner.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE   = join(__dirname, 'fixtures/i18n-game');

const [L1, L2, L3, L4] = i18nChecks;

// ─── Инфраструктура: копия фикстуры, которую можно ломать ─────────────────────

const tmpDirs = [];

/** Копирует здоровую фикстуру в tmp и применяет мутацию. */
function brokenCopy(mutate = () => {}) {
  const dir = mkdtempSync(join(tmpdir(), 'abee-i18n-'));
  tmpDirs.push(dir);
  cpSync(FIXTURE, dir, { recursive: true });
  mutate({
    dir,
    i18n:  (lang) => join(dir, 'src/i18n', `${lang}.json`),
    read:  (p) => JSON.parse(readFileSync(join(dir, p), 'utf-8')),
    write: (p, obj) => writeFileSync(join(dir, p), JSON.stringify(obj, null, 2)),
    writeRaw: (p, text) => writeFileSync(join(dir, p), text),
    appendJs: (p, text) => writeFileSync(join(dir, p), readFileSync(join(dir, p), 'utf-8') + text),
    remove: (p) => unlinkSync(join(dir, p)),
    removeDir: (p) => rmSync(join(dir, p), { recursive: true, force: true }),
  });
  return dir;
}

afterEach(() => {
  while (tmpDirs.length) rmSync(tmpDirs.pop(), { recursive: true, force: true });
});

/** Запускает одну проверку и возвращает результат. */
async function run(check, gameDir) {
  const [result] = await runChecks(gameDir, [check]);
  return result;
}

// ─── Здоровая фикстура: всё зелёное ───────────────────────────────────────────

describe('здоровая фикстура', () => {
  test('все четыре проверки — ok', async () => {
    const results = await runChecks(FIXTURE, i18nChecks);
    const notOk = results.filter(r => r.status !== STATUS.OK);
    assert.deepEqual(notOk, [],
      'на исправном проекте ни одна проверка не должна ругаться: ' +
      notOk.map(r => `${r.id}: ${r.message}`).join(' | '));
  });
});

// ─── L1: пропавший ключ в en.json ─────────────────────────────────────────────

describe('L1 — паритет ключей', () => {
  test('убран ключ из en.json → fail, ключ назван', async () => {
    const dir = brokenCopy(({ read, write }) => {
      const en = read('src/i18n/en.json');
      delete en.menu.settings;          // ломаем ровно один ключ
      write('src/i18n/en.json', en);
    });

    const r = await run(L1, dir);
    assert.equal(r.status, STATUS.FAIL, 'пропавший ключ обязан ловиться');
    assert.ok(r.message.includes('menu.settings'),
      `в сообщении должен быть назван пропавший ключ, получено: ${r.message}`);
    assert.ok(r.message.includes('en.json'),
      `должно быть указано, в каком файле не хватает: ${r.message}`);
    assert.ok(r.fix, 'должна быть ссылка, где чинить');
  });

  test('убран ключ из ru.json → fail, направление верное', async () => {
    const dir = brokenCopy(({ read, write }) => {
      const ru = read('src/i18n/ru.json');
      delete ru.gameplay.paused;
      write('src/i18n/ru.json', ru);
    });

    const r = await run(L1, dir);
    assert.equal(r.status, STATUS.FAIL);
    assert.ok(r.message.includes('gameplay.paused'), r.message);
    assert.ok(r.message.includes('ru.json'),
      `должно указывать что не хватает именно в ru.json: ${r.message}`);
  });

  test('лишний ключ в en.json → тоже fail (расхождение в обе стороны)', async () => {
    const dir = brokenCopy(({ read, write }) => {
      const en = read('src/i18n/en.json');
      en.menu.exit = 'Exit';           // ключа нет в ru.json
      write('src/i18n/en.json', en);
    });

    const r = await run(L1, dir);
    assert.equal(r.status, STATUS.FAIL);
    assert.ok(r.message.includes('menu.exit'), r.message);
  });

  test('нет en.json → fail с требованием двуязычности', async () => {
    const dir = brokenCopy(({ remove }) => remove('src/i18n/en.json'));
    const r = await run(L1, dir);
    assert.equal(r.status, STATUS.FAIL);
    assert.ok(/en\.json/.test(r.message), r.message);
  });

  test('нет папки словарей → fail, а не skip', async () => {
    const dir = brokenCopy(({ removeDir }) => removeDir('src/i18n'));
    const r = await run(L1, dir);
    assert.equal(r.status, STATUS.FAIL,
      'отсутствие словарей — это поломка требования студии, а не «не проверено»');
  });

  test('битый JSON в ru.json → fail, а не падение', async () => {
    const dir = brokenCopy(({ writeRaw }) => writeRaw('src/i18n/ru.json', '{ "menu": '));
    const r = await run(L1, dir);
    assert.equal(r.status, STATUS.FAIL);
    assert.ok(/JSON|читается/i.test(r.message), r.message);
  });

  test('поломка L1 не задевает L3 и L4', async () => {
    const dir = brokenCopy(({ read, write }) => {
      const en = read('src/i18n/en.json');
      delete en.menu.play;
      write('src/i18n/en.json', en);
    });

    assert.equal((await run(L3, dir)).status, STATUS.OK, 'L3 не должна реагировать на словари');
    assert.equal((await run(L4, dir)).status, STATUS.OK, 'L4 не должна реагировать на словари');
  });
});

// ─── L2: пустые значения ──────────────────────────────────────────────────────

describe('L2 — пустые значения', () => {
  test('пустая строка → fail, ключ назван', async () => {
    const dir = brokenCopy(({ read, write }) => {
      const ru = read('src/i18n/ru.json');
      ru.menu.play = '';
      write('src/i18n/ru.json', ru);
    });

    const r = await run(L2, dir);
    assert.equal(r.status, STATUS.FAIL);
    assert.ok(r.message.includes('menu.play'), r.message);
    assert.ok(r.message.includes('ru.json'), r.message);
  });

  test('строка из пробелов → fail (визуально тоже пусто)', async () => {
    const dir = brokenCopy(({ read, write }) => {
      const en = read('src/i18n/en.json');
      en.gameplay.paused = '   ';
      write('src/i18n/en.json', en);
    });

    const r = await run(L2, dir);
    assert.equal(r.status, STATUS.FAIL);
    assert.ok(r.message.includes('gameplay.paused'), r.message);
  });

  test('null → fail', async () => {
    const dir = brokenCopy(({ read, write }) => {
      const ru = read('src/i18n/ru.json');
      ru.lang.choose = null;
      write('src/i18n/ru.json', ru);
    });

    assert.equal((await run(L2, dir)).status, STATUS.FAIL);
  });

  test('нет словарей → skip с причиной, НЕ ok', async () => {
    const dir = brokenCopy(({ removeDir }) => removeDir('src/i18n'));
    const r = await run(L2, dir);
    assert.equal(r.status, STATUS.SKIP,
      'проверка фактически не выполнилась — обязана быть skip, а не зелёной');
    assert.ok(/не проверено/i.test(r.message), r.message);
  });
});

// ─── L3: текст, зашитый в код ─────────────────────────────────────────────────

describe('L3 — текст в коде', () => {
  test('русская строка в коде → fail, файл и строка названы', async () => {
    const dir = brokenCopy(({ appendJs }) => {
      appendJs('src/game/scenes/gameplay-scene.js',
        '\nexport const HUD_LABEL = "Осталось попыток";\n');
    });

    const r = await run(L3, dir);
    assert.equal(r.status, STATUS.FAIL, 'зашитый русский текст обязан ловиться');
    assert.ok(r.message.includes('Осталось попыток'),
      `сообщение должно показывать саму строку: ${r.message}`);
    assert.ok(/gameplay-scene\.js:\d+/.test(r.message),
      `должно быть указано файл:строка, получено: ${r.message}`);
    assert.ok(/L10n\.t/.test(r.message),
      `должно объяснять, что делать: ${r.message}`);
  });

  test('английская фраза из нескольких слов → fail', async () => {
    const dir = brokenCopy(({ appendJs }) => {
      appendJs('src/game/main.js', '\nconst hint = "Tap to continue playing";\n');
    });

    const r = await run(L3, dir);
    assert.equal(r.status, STATUS.FAIL);
    assert.ok(r.message.includes('Tap to continue'), r.message);
  });

  test('строка внутри L10n.t не считается поломкой', async () => {
    const dir = brokenCopy(({ appendJs }) => {
      appendJs('src/game/main.js', '\nconst ok = L10n.t("menu.play");\n');
    });

    assert.equal((await run(L3, dir)).status, STATUS.OK);
  });

  test('строка в комментарии не считается поломкой', async () => {
    const dir = brokenCopy(({ appendJs }) => {
      appendJs('src/game/main.js',
        '\n// Здесь была подпись "Начать игру", вынесена в словарь\n');
    });

    assert.equal((await run(L3, dir)).status, STATUS.OK,
      'текст в комментарии игрок не увидит');
  });

  test('console.log с текстом не считается поломкой', async () => {
    const dir = brokenCopy(({ appendJs }) => {
      appendJs('src/game/main.js', '\nconsole.warn("Сцена не найдена, откат в меню");\n');
    });

    assert.equal((await run(L3, dir)).status, STATUS.OK,
      'отладочный вывод — не интерфейс игрока');
  });

  test('технические строки не дают ложных срабатываний', async () => {
    // Регрессия: "16px sans-serif" ловилось как текст для игрока
    const dir = brokenCopy(({ appendJs }) => {
      appendJs('src/game/scenes/gameplay-scene.js', `
const STYLE = {
  font: 'bold 24px Arial, sans-serif',
  shadow: '0 2px 8px rgba(0, 0, 0, 0.4)',
  transform: 'translate(-50%, -50%)',
  blend: 'source-over',
  cursor: 'pointer',
  type: 'application/json',
  event: 'pointerdown',
  sprite: 'assets/hero-idle.png',
  selector: '.hud-score',
  ctx: '2d',
};
document.querySelector('#game canvas');
element.addEventListener('visibilitychange', onHide);
`);
    });

    const r = await run(L3, dir);
    assert.equal(r.status, STATUS.OK,
      `CSS, селекторы и имена событий не текст для игрока, получено: ${r.message}`);
  });

  test('нет кода игры → skip, НЕ ok', async () => {
    const dir = brokenCopy(({ removeDir }) => {
      removeDir('src/game');
      removeDir('src/screens');
    });

    const r = await run(L3, dir);
    assert.equal(r.status, STATUS.SKIP,
      'нечего проверять — значит не проверено, а не «в порядке»');
    assert.ok(/не проверено/i.test(r.message), r.message);
  });

  test('текст в src/engine не проверяется (чужая зона)', async () => {
    const dir = brokenCopy(({ appendJs }) => {
      appendJs('src/engine/index.js', '\nconst t = "Загрузка ядра завершена";\n');
    });

    assert.equal((await run(L3, dir)).status, STATUS.OK,
      'engine/ приходит из пакета и не является зоной ответственности игры');
  });
});

// ─── L4: экран выбора языка ───────────────────────────────────────────────────

describe('L4 — экран выбора языка', () => {
  test('удалён language-screen.js → fail', async () => {
    const dir = brokenCopy(({ remove }) => remove('src/screens/language-screen.js'));

    const r = await run(L4, dir);
    assert.equal(r.status, STATUS.FAIL, 'отсутствие экрана выбора языка обязано ловиться');
    assert.ok(/язык/i.test(r.message), r.message);
    assert.ok(r.fix, 'должна быть подсказка, где создать');
  });

  test('найден по классу LanguageScreen в другом файле', async () => {
    const dir = brokenCopy(({ remove, writeRaw }) => {
      remove('src/screens/language-screen.js');
      writeRaw('src/screens/first-run.js',
        'export class LanguageSelectScreen {}\n');
    });

    // Файл называется иначе, но класс распознаётся по содержимому
    const r = await run(L4, dir);
    assert.equal(r.status, STATUS.OK,
      `экран должен находиться и по содержимому, получено: ${r.message}`);
  });

  test('нет папки src → skip, НЕ ok', async () => {
    const dir = brokenCopy(({ removeDir }) => removeDir('src'));
    const r = await run(L4, dir);
    assert.equal(r.status, STATUS.SKIP);
  });
});

// ─── Сводный прогон: несколько поломок одновременно ───────────────────────────

describe('несколько поломок разом', () => {
  test('четыре поломки → ровно четыре fail, каждая своя', async () => {
    const dir = brokenCopy(({ read, write, appendJs, remove }) => {
      const en = read('src/i18n/en.json');
      delete en.menu.about;                            // L1
      write('src/i18n/en.json', en);
      const ru = read('src/i18n/ru.json');
      ru.menu.play = '';                               // L2
      write('src/i18n/ru.json', ru);
      appendJs('src/game/main.js',
        '\nconst label = "Нажми чтобы начать";\n');     // L3
      remove('src/screens/language-screen.js');        // L4
    });

    const results = await runChecks(dir, i18nChecks);
    const fails = results.filter(r => r.status === STATUS.FAIL).map(r => r.id).sort();
    assert.deepEqual(fails, ['L1', 'L2', 'L3', 'L4'],
      'каждая проверка обязана поймать свою поломку');
  });
});
