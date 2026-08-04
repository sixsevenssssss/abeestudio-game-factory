/**
 * Тесты для src/checks/brand.js — проверка «от противного».
 * Запуск: node --test test/brand.test.js
 */

import { test, describe, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, rmSync, writeFileSync, readFileSync, mkdtempSync, unlinkSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

import brandChecks from '../src/checks/brand.js';
import { runChecks, STATUS } from '../src/checks/runner.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE   = join(__dirname, 'fixtures/i18n-game');

const [B1, B2, B3] = brandChecks;

const tmpDirs = [];

function brokenCopy(mutate = () => {}) {
  const dir = mkdtempSync(join(tmpdir(), 'abee-brand-'));
  tmpDirs.push(dir);
  cpSync(FIXTURE, dir, { recursive: true });
  mutate({
    dir,
    write:  (p, text) => writeFileSync(join(dir, p), text),
    read:   (p) => readFileSync(join(dir, p), 'utf-8'),
    patch:  (p, from, to) => {
      const full = join(dir, p);
      writeFileSync(full, readFileSync(full, 'utf-8').replace(from, to));
    },
    writeJson: (p, obj) => writeFileSync(join(dir, p), JSON.stringify(obj, null, 2)),
    readJson:  (p) => JSON.parse(readFileSync(join(dir, p), 'utf-8')),
    remove: (p) => unlinkSync(join(dir, p)),
    removeDir: (p) => rmSync(join(dir, p), { recursive: true, force: true }),
  });
  return dir;
}

afterEach(() => {
  while (tmpDirs.length) rmSync(tmpDirs.pop(), { recursive: true, force: true });
});

async function run(check, gameDir) {
  const [result] = await runChecks(gameDir, [check]);
  return result;
}

// ─── Здоровая фикстура ────────────────────────────────────────────────────────

describe('здоровая фикстура', () => {
  test('все три проверки — ok', async () => {
    const results = await runChecks(FIXTURE, brandChecks);
    const notOk = results.filter(r => r.status !== STATUS.OK);
    assert.deepEqual(notOk, [],
      'исправный проект не должен ругаться: ' +
      notOk.map(r => `${r.id}: ${r.message}`).join(' | '));
  });

  test('отсутствие явного showSplash() в коде игры не считается поломкой', async () => {
    // По контракту ядра Brand.showSplash() зовётся автоматически в Engine.start().
    // Фикстура его не вызывает — и это правильно.
    const code = readFileSync(join(FIXTURE, 'src/game/main.js'), 'utf-8');
    assert.ok(!code.includes('showSplash'),
      'фикстура намеренно не вызывает showSplash вручную');
    const r = await run(B1, FIXTURE);
    assert.equal(r.status, STATUS.OK,
      'ядро зовёт заставку само — требовать вызов в игре значит ругать корректный код');
  });
});

// ─── B1: конфиг бренда ────────────────────────────────────────────────────────

describe('B1 — конфиг бренда', () => {
  test('нет game.config.js → fail', async () => {
    const dir = brokenCopy(({ remove }) => remove('game.config.js'));
    const r = await run(B1, dir);
    assert.equal(r.status, STATUS.FAIL);
    assert.ok(/game\.config\.js/.test(r.message), r.message);
  });

  test('нет секции brand → fail', async () => {
    const dir = brokenCopy(({ write }) => {
      write('game.config.js', 'export default { id: "x", firstScene: "gameplay" };\n');
    });
    const r = await run(B1, dir);
    assert.equal(r.status, STATUS.FAIL);
    assert.ok(/brand|studioName/.test(r.message), r.message);
  });

  test('brand есть, studioName нет → fail', async () => {
    const dir = brokenCopy(({ write }) => {
      write('game.config.js', 'export default { brand: { games: [] } };\n');
    });
    const r = await run(B1, dir);
    assert.equal(r.status, STATUS.FAIL);
    assert.ok(/studioName/.test(r.message), r.message);
  });

  test('пустой studioName → fail', async () => {
    const dir = brokenCopy(({ patch }) => {
      patch('game.config.js', "studioName: 'abeeStudio'", "studioName: ''");
    });
    const r = await run(B1, dir);
    assert.equal(r.status, STATUS.FAIL);
    assert.ok(/пуст/i.test(r.message), r.message);
  });

  test('заставка отключена → fail', async () => {
    const dir = brokenCopy(({ patch }) => {
      patch('game.config.js', 'splashDuration: 1200', 'splash: false');
    });
    const r = await run(B1, dir);
    assert.equal(r.status, STATUS.FAIL);
    assert.ok(/заставка/i.test(r.message), r.message);
  });

  test('заставка дольше 1,5 с → fail с названным числом', async () => {
    const dir = brokenCopy(({ patch }) => {
      patch('game.config.js', 'splashDuration: 1200', 'splashDuration: 4000');
    });
    const r = await run(B1, dir);
    assert.equal(r.status, STATUS.FAIL);
    assert.ok(r.message.includes('4000'), `должно показать измеренное значение: ${r.message}`);
  });

  test('заставка 1500 мс ровно → ok (граница включительно)', async () => {
    const dir = brokenCopy(({ patch }) => {
      patch('game.config.js', 'splashDuration: 1200', 'splashDuration: 1500');
    });
    assert.equal((await run(B1, dir)).status, STATUS.OK);
  });

  test('studioName в комментарии не считается заданным', async () => {
    const dir = brokenCopy(({ write }) => {
      write('game.config.js',
        '// TODO: добавить studioName: "abeeStudio"\nexport default { id: "x" };\n');
    });
    const r = await run(B1, dir);
    assert.equal(r.status, STATUS.FAIL,
      'закомментированный конфиг ядро не прочитает');
  });
});

// ─── B2: окно «Об игре» ───────────────────────────────────────────────────────

describe('B2 — окно «Об игре»', () => {
  test('удалён about-screen.js → fail', async () => {
    const dir = brokenCopy(({ remove, patch }) => {
      remove('src/screens/about-screen.js');
      // Убираем и упоминание, чтобы поиск по содержимому не нашёл
      patch('src/i18n/ru.json', '"about"', '"info_ru"');
      patch('src/i18n/en.json', '"about"', '"info_en"');
    });

    const r = await run(B2, dir);
    assert.equal(r.status, STATUS.FAIL);
    assert.ok(/Об игре/i.test(r.message), r.message);
    assert.ok(r.fix, 'должна быть подсказка, где создать');
  });

  test('найден по классу AboutScreen в файле с другим именем', async () => {
    const dir = brokenCopy(({ remove, write }) => {
      remove('src/screens/about-screen.js');
      write('src/screens/info.js', 'export class AboutScreen {}\n');
    });
    assert.equal((await run(B2, dir)).status, STATUS.OK);
  });

  test('нет папки src → skip, НЕ ok', async () => {
    const dir = brokenCopy(({ removeDir }) => removeDir('src'));
    const r = await run(B2, dir);
    assert.equal(r.status, STATUS.SKIP);
  });
});

// ─── B3: подпись в интерфейсе ─────────────────────────────────────────────────

describe('B3 — подпись студии в интерфейсе', () => {
  test('конфиг заполнен, но интерфейс его не читает → fail', async () => {
    const dir = brokenCopy(({ write, readJson, writeJson }) => {
      // Экран есть, но подпись не берётся ни из Brand.config, ни из словаря
      write('src/screens/about-screen.js',
        "import { L10n } from '../engine/index.js';\n"
        + 'export class AboutScreen { enter() { this.t = L10n.t("about.title"); } }\n');
      for (const lang of ['ru', 'en']) {
        const d = readJson(`src/i18n/${lang}.json`);
        d.about = { title: lang === 'ru' ? 'Об игре' : 'About' };
        writeJson(`src/i18n/${lang}.json`, d);
      }
    });

    const r = await run(B3, dir);
    assert.equal(r.status, STATUS.FAIL,
      'название в конфиге, которое игрок не видит, — это не подпись студии');
    assert.ok(/abeeStudio/.test(r.message), r.message);
  });

  test('подпись через Brand.config → ok', async () => {
    const r = await run(B3, FIXTURE);
    assert.equal(r.status, STATUS.OK);
    assert.ok(/конфиг/i.test(r.message), r.message);
  });

  test('подпись только в словаре тоже принимается', async () => {
    const dir = brokenCopy(({ write }) => {
      write('src/screens/about-screen.js',
        "import { L10n } from '../engine/index.js';\n"
        + 'export class AboutScreen { enter() { this.t = L10n.t("about.studio"); } }\n');
    });
    const r = await run(B3, dir);
    assert.equal(r.status, STATUS.OK,
      'локализуемая подпись в словаре — законный способ');
    assert.ok(/словар/i.test(r.message), r.message);
  });

  test('упоминание Brand.config в комментарии не считается', async () => {
    const dir = brokenCopy(({ write, readJson, writeJson }) => {
      write('src/screens/about-screen.js',
        '// раньше тут был Brand.config.studioName\nexport class AboutScreen {}\n');
      for (const lang of ['ru', 'en']) {
        const d = readJson(`src/i18n/${lang}.json`);
        d.about = { title: 'x' };
        writeJson(`src/i18n/${lang}.json`, d);
      }
    });
    assert.equal((await run(B3, dir)).status, STATUS.FAIL);
  });

  test('нет кода игры → skip, НЕ ok', async () => {
    const dir = brokenCopy(({ removeDir }) => {
      removeDir('src/game'); removeDir('src/screens');
    });
    const r = await run(B3, dir);
    assert.equal(r.status, STATUS.SKIP);
  });
});

// ─── Сводный прогон ───────────────────────────────────────────────────────────

describe('несколько поломок разом', () => {
  test('нет конфига + нет окна «Об игре» → два fail', async () => {
    const dir = brokenCopy(({ remove, patch }) => {
      remove('game.config.js');
      remove('src/screens/about-screen.js');
      patch('src/i18n/ru.json', '"about"', '"info_ru"');
      patch('src/i18n/en.json', '"about"', '"info_en"');
    });

    const results = await runChecks(dir, brandChecks);
    const fails = results.filter(r => r.status === STATUS.FAIL).map(r => r.id).sort();
    assert.ok(fails.includes('B1') && fails.includes('B2'), `получено: ${fails}`);
  });
});
