/**
 * Тесты для src/checks/magic-numbers.js — проверка «от противного».
 * Запуск: node --test test/magic-numbers.test.js
 */

import { test, describe, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, rmSync, writeFileSync, readFileSync, mkdtempSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

import magicChecks, { findNumericLiterals } from '../src/checks/magic-numbers.js';
import { runChecks, STATUS } from '../src/checks/runner.js';
import { maskSource } from '../src/checks/util.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE   = join(__dirname, 'fixtures/i18n-game');

const [M1] = magicChecks;

const tmpDirs = [];

function brokenCopy(mutate = () => {}) {
  const dir = mkdtempSync(join(tmpdir(), 'abee-magic-'));
  tmpDirs.push(dir);
  cpSync(FIXTURE, dir, { recursive: true });
  mutate({
    dir,
    appendJs: (p, text) => writeFileSync(join(dir, p), readFileSync(join(dir, p), 'utf-8') + text),
    write: (p, text) => writeFileSync(join(dir, p), text),
    mkdir: (p) => mkdirSync(join(dir, p), { recursive: true }),
    removeDir: (p) => rmSync(join(dir, p), { recursive: true, force: true }),
  });
  return dir;
}

afterEach(() => {
  while (tmpDirs.length) rmSync(tmpDirs.pop(), { recursive: true, force: true });
});

async function run(gameDir) {
  const [result] = await runChecks(gameDir, [M1]);
  return result;
}

/** Хелпер: какие числа детектор видит в куске кода. */
function numbersIn(code) {
  return findNumericLiterals(maskSource(code)).map(x => x.value);
}

// ─── Детектор литералов ───────────────────────────────────────────────────────

describe('findNumericLiterals', () => {
  test('находит целое и дробное', () => {
    assert.deepEqual(numbersIn('const a = 1500; const b = 3.7;'), [1500, 3.7]);
  });

  test('не считает число частью идентификатора', () => {
    assert.deepEqual(numbersIn('const player2 = init(); const v1 = 0;'), [0]);
  });

  test('не считает шестнадцатеричный цвет', () => {
    assert.deepEqual(numbersIn('const MASK = 0xFF00FF;'), []);
  });

  test('не считает индекс массива', () => {
    assert.deepEqual(numbersIn('const x = arr[3];'), []);
  });

  test('не видит числа в комментариях', () => {
    assert.deepEqual(numbersIn('// порог был 9999\nconst a = 0;'), [0]);
  });

  test('не видит числа в строках', () => {
    assert.deepEqual(numbersIn(`const s = "bold 24px Arial";`), []);
  });

  test('распознаёт отрицательное число', () => {
    assert.ok(numbersIn('const t = -42;').includes(-42));
  });

  test('экспонента разбирается', () => {
    assert.ok(numbersIn('const ms = 1e3;').includes(1000));
  });

  test('номера строк верные', () => {
    const hits = findNumericLiterals(maskSource('a\nb\nconst x = 777;'));
    assert.equal(hits[0].line, 3);
  });
});

// ─── Здоровая фикстура и чистый код ───────────────────────────────────────────

describe('чистый код не ругается', () => {
  test('здоровая фикстура — ok', async () => {
    const r = await run(FIXTURE);
    assert.equal(r.status, STATUS.OK, r.message);
  });

  test('идиоматичные числа не считаются магическими', async () => {
    const dir = brokenCopy(({ appendJs }) => {
      appendJs('src/game/scenes/gameplay-scene.js', `
export function helpers(ctx, dt, items, ratio) {
  const half = ctx.canvas.width / 2;
  const seconds = dt / 1000;
  const percent = ratio * 100;
  const notFound = items.indexOf(null) === -1;
  const first = items[0];
  const third = items[2];
  const angle = Math.PI * 2;
  const shown = ratio.toFixed(2);
  const damped = ratio * 0.5;
  for (let i = 0; i < items.length; i += 1) { void i; }
  return { half, seconds, percent, notFound, first, third, angle, shown, damped };
}
`);
    });

    const r = await run(dir);
    assert.equal(r.status, STATUS.OK,
      `деление вдвое, проценты, миллисекунды и индексы — не баланс: ${r.message}`);
  });

  test('числа в src/game/data/ не проверяются — им там место', async () => {
    const dir = brokenCopy(({ write }) => {
      write('src/game/data/balance.js',
        'export const BALANCE = { speed: 3.7, coins: 25, delay: 2500, cap: 1500, tier: 7, hud: { x: 24, y: 48 }, scorePerTick: 0.5 };\n');
    });

    const r = await run(dir);
    assert.equal(r.status, STATUS.OK,
      `data/ — это и есть конфиг, ругаться на него нельзя: ${r.message}`);
  });

  test('код в src/engine не проверяется (чужая зона)', async () => {
    const dir = brokenCopy(({ appendJs }) => {
      appendJs('src/engine/index.js',
        '\nconst STEP = 16; const CAP = 5; const FADE = 300; const DEBOUNCE = 350; const LIMIT = 4096;\n');
    });
    assert.equal((await run(dir)).status, STATUS.OK);
  });
});

// ─── Поломка: баланс в логике ─────────────────────────────────────────────────

describe('M1 — магические числа', () => {
  test('пять балансных чисел в логике → fail, места и значения названы', async () => {
    const dir = brokenCopy(({ appendJs }) => {
      appendJs('src/game/scenes/gameplay-scene.js', `
export function progress(state) {
  if (state.score > 1500) state.level += 1;
  state.speed = 3.7;
  state.coins += 25;
  state.delay = 2500;
  if (state.level >= 7) state.bonus = true;
}
`);
    });

    const r = await run(dir);
    assert.equal(r.status, STATUS.FAIL, 'баланс в логике обязан ловиться');
    assert.ok(/gameplay-scene\.js:\d+/.test(r.message),
      `должно быть указано файл:строка — ${r.message}`);
    assert.ok(r.message.includes('1500'), `должно показывать само число: ${r.message}`);
    assert.ok(/data\//.test(r.message), `должно объяснять куда вынести: ${r.message}`);
    assert.ok(r.fix, 'должна быть ссылка, где чинить');
  });

  test('меньше порога → ok, но числа показаны человеку', async () => {
    const dir = brokenCopy(({ appendJs }) => {
      appendJs('src/game/main.js', '\nconst threshold = 1500;\nconst speed = 3.7;\n');
    });

    const r = await run(dir);
    assert.equal(r.status, STATUS.OK, 'два числа не должны блокировать отправку');
    assert.equal(r.show, true, 'но человек обязан их увидеть в отчёте');
    assert.ok(r.message.includes('1500'), r.message);
    assert.ok(/порог/i.test(r.message), `должно объяснять, почему не fail: ${r.message}`);
  });

  test('одно и то же число много раз — считается как одно разное', async () => {
    const dir = brokenCopy(({ appendJs }) => {
      appendJs('src/game/main.js',
        '\nconst a = 777;\nconst b = 777;\nconst c = 777;\nconst d = 777;\nconst e = 777;\nconst f = 777;\n');
    });

    const r = await run(dir);
    assert.equal(r.status, STATUS.OK,
      'шесть повторов одной константы — это одна настройка, а не пять разных');
    assert.equal(r.show, true);
  });

  test('нет кода игры → skip, НЕ ok', async () => {
    const dir = brokenCopy(({ removeDir }) => {
      removeDir('src/game'); removeDir('src/screens');
    });

    const r = await run(dir);
    assert.equal(r.status, STATUS.SKIP);
    assert.ok(/не проверено/i.test(r.message), r.message);
  });

  test('только data/ и ничего больше → skip', async () => {
    const dir = brokenCopy(({ removeDir, mkdir, write }) => {
      removeDir('src/game'); removeDir('src/screens');
      mkdir('src/game/data');
      write('src/game/data/balance.js', 'export const B = { x: 5 };\n');
    });

    const r = await run(dir);
    assert.equal(r.status, STATUS.SKIP,
      'вне data/ проверять нечего — это «не проверено», а не «чисто»');
  });
});
