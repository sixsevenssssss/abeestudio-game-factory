/**
 * Тесты для src/checks/platform.js — проверка «от противного».
 * Запуск: node --test test/platform.test.js
 */

import { test, describe, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, rmSync, writeFileSync, readFileSync, mkdtempSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

import platformChecks from '../src/checks/platform.js';
import { runChecks, STATUS } from '../src/checks/runner.js';
import { maskSource, findMatches } from '../src/checks/util.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE   = join(__dirname, 'fixtures/i18n-game');

const [P1, P2, P3, P4] = platformChecks;

const tmpDirs = [];

function brokenCopy(mutate = () => {}) {
  const dir = mkdtempSync(join(tmpdir(), 'abee-platform-'));
  tmpDirs.push(dir);
  cpSync(FIXTURE, dir, { recursive: true });
  mutate({
    dir,
    appendJs: (p, text) => writeFileSync(join(dir, p), readFileSync(join(dir, p), 'utf-8') + text),
    writeRaw: (p, text) => writeFileSync(join(dir, p), text),
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

// ─── Утилита маскировки ───────────────────────────────────────────────────────

describe('maskSource', () => {
  test('заглушает однострочный комментарий', () => {
    const masked = maskSource('const a = 1; // ysdk.adv.show()');
    assert.ok(!masked.includes('ysdk'), 'ysdk в комментарии должен исчезнуть');
    assert.ok(masked.includes('const a = 1;'), 'код должен остаться');
  });

  test('заглушает блочный комментарий, сохраняя переводы строк', () => {
    const src = 'a\n/* ysdk\n   localStorage */\nb';
    const masked = maskSource(src);
    assert.ok(!masked.includes('ysdk'));
    assert.ok(!masked.includes('localStorage'));
    assert.equal(masked.split('\n').length, src.split('\n').length,
      'число строк обязано совпадать — иначе номера строк в отчёте соврут');
  });

  test('заглушает содержимое строк, оставляя кавычки', () => {
    const masked = maskSource(`const s = "ysdk";`);
    assert.ok(!masked.includes('ysdk'), 'строковый литерал не является обращением к API');
    assert.ok(masked.includes('"'), 'кавычки остаются');
  });

  test('не ломается на слэше внутри строки', () => {
    const masked = maskSource(`const url = "a//b"; const x = ysdk;`);
    assert.ok(masked.includes('ysdk'), 'настоящий ysdk после строки со слэшами должен сохраниться');
  });

  test('не ломается на апострофе внутри комментария', () => {
    const masked = maskSource(`// don't touch\nconst x = localStorage;`);
    assert.ok(masked.includes('localStorage'),
      'апостроф в комментарии не должен съедать следующую строку кода');
  });

  test('сохраняет длину исходника', () => {
    const src = `// abc\nconst s = "xyz";`;
    assert.equal(maskSource(src).length, src.length);
  });
});

describe('findMatches', () => {
  test('возвращает верные номера строк', () => {
    const hits = findMatches('a\nb\nysdk\n', /ysdk/);
    assert.equal(hits.length, 1);
    assert.equal(hits[0].line, 3);
  });

  test('находит несколько совпадений в одной строке', () => {
    const hits = findMatches('ysdk ysdk', /ysdk/);
    assert.equal(hits.length, 2);
  });
});

// ─── Здоровая фикстура ────────────────────────────────────────────────────────

describe('здоровая фикстура', () => {
  test('все четыре проверки — ok', async () => {
    const results = await runChecks(FIXTURE, platformChecks);
    const notOk = results.filter(r => r.status !== STATUS.OK);
    assert.deepEqual(notOk, [],
      'исправный проект не должен ругаться: ' +
      notOk.map(r => `${r.id}: ${r.message}`).join(' | '));
  });

  test('ysdk внутри src/platform/ разрешён', async () => {
    // Адаптер фикстуры реально использует YaGames.init() и ysdk.environment
    const r = await run(P1, FIXTURE);
    assert.equal(r.status, STATUS.OK,
      'platform/ — единственное легальное место для ysdk, ругаться на него нельзя');
  });

  test('SDK-тег в index.html не считается внешней ссылкой', async () => {
    const r = await run(P3, FIXTURE);
    assert.equal(r.status, STATUS.OK,
      'подключение SDK площадки обязательно (п. 1.1) и не может быть поломкой');
  });
});

// ─── P1: ysdk в коде игры ─────────────────────────────────────────────────────

describe('P1 — ysdk вне адаптера', () => {
  test('ysdk в коде игры → fail, место названо', async () => {
    const dir = brokenCopy(({ appendJs }) => {
      appendJs('src/game/scenes/gameplay-scene.js',
        '\nexport function showAd() { ysdk.adv.showFullscreenAdv(); }\n');
    });

    const r = await run(P1, dir);
    assert.equal(r.status, STATUS.FAIL, 'прямой вызов ysdk обязан ловиться');
    assert.ok(/gameplay-scene\.js:\d+/.test(r.message), r.message);
    assert.ok(/адаптер|Platform/i.test(r.message),
      `должно объяснять, чем заменить: ${r.message}`);
  });

  test('YaGames.init в коде игры → fail', async () => {
    const dir = brokenCopy(({ appendJs }) => {
      appendJs('src/game/main.js', '\nconst sdk = await YaGames.init();\n');
    });
    assert.equal((await run(P1, dir)).status, STATUS.FAIL);
  });

  test('ysdk в комментарии → ok (наружу не ведёт)', async () => {
    const dir = brokenCopy(({ appendJs }) => {
      appendJs('src/game/main.js', '\n// раньше здесь был ysdk.adv, вынесено в адаптер\n');
    });
    assert.equal((await run(P1, dir)).status, STATUS.OK);
  });

  test('слово ysdk внутри строки → ok', async () => {
    const dir = brokenCopy(({ appendJs }) => {
      appendJs('src/game/main.js', '\nAnalytics.event("ysdk_ready");\n');
    });
    assert.equal((await run(P1, dir)).status, STATUS.OK,
      'имя события — не обращение к SDK');
  });

  test('нет кода игры → skip, НЕ ok', async () => {
    const dir = brokenCopy(({ removeDir }) => {
      removeDir('src/game'); removeDir('src/screens');
    });
    const r = await run(P1, dir);
    assert.equal(r.status, STATUS.SKIP);
    assert.ok(/не проверено/i.test(r.message), r.message);
  });
});

// ─── P2: localStorage мимо Save ───────────────────────────────────────────────

describe('P2 — localStorage мимо Save', () => {
  test('localStorage.setItem в коде игры → fail', async () => {
    const dir = brokenCopy(({ appendJs }) => {
      appendJs('src/game/scenes/gameplay-scene.js',
        '\nlocalStorage.setItem("score", String(42));\n');
    });

    const r = await run(P2, dir);
    assert.equal(r.status, STATUS.FAIL, 'запись мимо Save обязана ловиться');
    assert.ok(/Save/.test(r.message), `должно указывать на Save: ${r.message}`);
    assert.ok(/gameplay-scene\.js:\d+/.test(r.message), r.message);
  });

  test('sessionStorage тоже ловится', async () => {
    const dir = brokenCopy(({ appendJs }) => {
      appendJs('src/game/main.js', '\nsessionStorage.setItem("tmp", "1");\n');
    });
    assert.equal((await run(P2, dir)).status, STATUS.FAIL);
  });

  test('Save.set не считается поломкой', async () => {
    const dir = brokenCopy(({ appendJs }) => {
      appendJs('src/game/main.js', '\nSave.set("progress.level", 3);\n');
    });
    assert.equal((await run(P2, dir)).status, STATUS.OK);
  });
});

// ─── P3: внешние адреса ───────────────────────────────────────────────────────

describe('P3 — внешние адреса', () => {
  test('внешний запрос в коде → fail', async () => {
    const dir = brokenCopy(({ appendJs }) => {
      appendJs('src/game/main.js',
        '\nfetch("https://api.example.com/scores").then(r => r.json());\n');
    });

    const r = await run(P3, dir);
    assert.equal(r.status, STATUS.FAIL, 'внешний сетевой запрос обязан ловиться');
    assert.ok(r.message.includes('api.example.com'), r.message);
    assert.ok(/8\.4|наружу|запрещен/i.test(r.message),
      `должно ссылаться на правило площадки: ${r.message}`);
  });

  test('внешняя ссылка в index.html → fail', async () => {
    const dir = brokenCopy(({ writeRaw }) => {
      writeRaw('index.html',
        '<!DOCTYPE html><html><body>'
        + '<a href="https://vk.com/mygame">Наша группа</a>'
        + '</body></html>');
    });

    const r = await run(P3, dir);
    assert.equal(r.status, STATUS.FAIL);
    assert.ok(r.message.includes('vk.com'), r.message);
  });

  test('внешний шрифт в разметке → fail', async () => {
    const dir = brokenCopy(({ writeRaw }) => {
      writeRaw('index.html',
        '<!DOCTYPE html><html><head>'
        + '<link href="https://fonts.googleapis.com/css2?family=Inter" rel="stylesheet">'
        + '</head><body></body></html>');
    });

    const r = await run(P3, dir);
    assert.equal(r.status, STATUS.FAIL,
      'внешний шрифт ломает требование «ноль запросов во время игры»');
    assert.ok(r.message.includes('fonts.googleapis.com'), r.message);
  });

  test('xmlns SVG не считается внешней ссылкой', async () => {
    const dir = brokenCopy(({ appendJs }) => {
      appendJs('src/game/main.js',
        '\nconst svg = `<svg xmlns="http://www.w3.org/2000/svg"></svg>`;\n');
    });
    assert.equal((await run(P3, dir)).status, STATUS.OK,
      'пространство имён XML браузер не загружает — это не запрос');
  });

  test('ссылка в комментарии не считается поломкой', async () => {
    const dir = brokenCopy(({ appendJs }) => {
      appendJs('src/game/main.js',
        '\n// документация: https://yandex.ru/dev/games/doc/ru/\n');
    });
    assert.equal((await run(P3, dir)).status, STATUS.OK,
      'ссылка в комментарии наружу не ведёт');
  });

  test('localhost не считается внешним', async () => {
    const dir = brokenCopy(({ appendJs }) => {
      appendJs('src/game/main.js', '\nconst dev = "http://localhost:3000/assets";\n');
    });
    assert.equal((await run(P3, dir)).status, STATUS.OK);
  });
});

// ─── P4: постоянные соединения ────────────────────────────────────────────────

describe('P4 — постоянные соединения', () => {
  test('WebSocket → fail', async () => {
    const dir = brokenCopy(({ appendJs }) => {
      appendJs('src/game/main.js', '\nconst ws = new WebSocket("wss://example.com");\n');
    });

    const r = await run(P4, dir);
    assert.equal(r.status, STATUS.FAIL);
    assert.ok(/WebSocket/.test(r.message), r.message);
  });

  test('sendBeacon → fail', async () => {
    const dir = brokenCopy(({ appendJs }) => {
      appendJs('src/game/main.js', '\nnavigator.sendBeacon("/log", data);\n');
    });

    const r = await run(P4, dir);
    assert.equal(r.status, STATUS.FAIL);
    assert.ok(/Analytics/.test(r.message), `должно предлагать Analytics: ${r.message}`);
  });

  test('XMLHttpRequest → fail', async () => {
    const dir = brokenCopy(({ appendJs }) => {
      appendJs('src/game/main.js', '\nconst xhr = new XMLHttpRequest();\n');
    });
    assert.equal((await run(P4, dir)).status, STATUS.FAIL);
  });

  test('локальный fetch ассета не считается поломкой', async () => {
    const dir = brokenCopy(({ appendJs }) => {
      appendJs('src/game/main.js', '\nconst data = await fetch("assets/levels.json");\n');
    });
    assert.equal((await run(P4, dir)).status, STATUS.OK,
      'ассеты лежат в архиве, читать их локально — норма');
  });
});

// ─── Сводный прогон ───────────────────────────────────────────────────────────

describe('несколько поломок разом', () => {
  test('четыре поломки → ровно четыре fail, каждая своя', async () => {
    const dir = brokenCopy(({ appendJs, writeRaw }) => {
      appendJs('src/game/main.js', '\nysdk.adv.showFullscreenAdv();\n');          // P1
      appendJs('src/game/main.js', '\nlocalStorage.setItem("x", "1");\n');        // P2
      writeRaw('index.html',
        '<html><body><a href="https://t.me/studio">Канал</a></body></html>');     // P3
      appendJs('src/game/main.js', '\nconst ws = new WebSocket("wss://a.b");\n'); // P4
    });

    const results = await runChecks(dir, platformChecks);
    const fails = results.filter(r => r.status === STATUS.FAIL).map(r => r.id).sort();
    assert.deepEqual(fails, ['P1', 'P2', 'P3', 'P4'],
      'каждая проверка обязана поймать свою поломку');
  });
});
