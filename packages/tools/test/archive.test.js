/**
 * Тесты для src/checks/archive.js — проверка «от противного».
 * Запуск: node --test test/archive.test.js
 */

import { test, describe, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, rmSync, writeFileSync, mkdtempSync, unlinkSync, mkdirSync, renameSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

import archiveChecks, { formatBytes } from '../src/checks/archive.js';
import { runChecks, formatReport, STATUS } from '../src/checks/runner.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE   = join(__dirname, 'fixtures/i18n-game');

const [A1, A2, A3, A4] = archiveChecks;

const tmpDirs = [];

function brokenCopy(mutate = () => {}) {
  const dir = mkdtempSync(join(tmpdir(), 'abee-archive-'));
  tmpDirs.push(dir);
  cpSync(FIXTURE, dir, { recursive: true });
  mutate({
    dir,
    write:  (p, text) => writeFileSync(join(dir, p), text),
    remove: (p) => unlinkSync(join(dir, p)),
    mkdir:  (p) => mkdirSync(join(dir, p), { recursive: true }),
    move:   (from, to) => renameSync(join(dir, from), join(dir, to)),
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

// ─── formatBytes ──────────────────────────────────────────────────────────────

describe('formatBytes', () => {
  test('байты', () => assert.equal(formatBytes(512), '512 Б'));
  test('килобайты', () => assert.equal(formatBytes(2048), '2.0 КБ'));
  test('мегабайты', () => assert.equal(formatBytes(5 * 1024 * 1024), '5.00 МБ'));
  test('ноль', () => assert.equal(formatBytes(0), '0 Б'));
});

// ─── Здоровая фикстура ────────────────────────────────────────────────────────

describe('здоровая фикстура', () => {
  test('A1–A3 ok, A4 честный skip', async () => {
    const results = await runChecks(FIXTURE, archiveChecks);
    const byId = Object.fromEntries(results.map(r => [r.id, r]));
    assert.equal(byId.A1.status, STATUS.OK);
    assert.equal(byId.A2.status, STATUS.OK);
    assert.equal(byId.A3.status, STATUS.OK);
    assert.equal(byId.A4.status, STATUS.SKIP,
      'время до первого кадра без браузера измерить нельзя — обязан быть skip');
  });

  test('A4 никогда не зелёный и объясняет причину', async () => {
    const r = await run(A4, FIXTURE);
    assert.notEqual(r.status, STATUS.OK,
      'неизмеренный пункт чек-листа не имеет права быть зелёным');
    assert.ok(/не проверено/i.test(r.message), r.message);
    assert.ok(/браузер/i.test(r.message), `должна быть названа причина: ${r.message}`);
  });

  test('A3 показывает измеренный вес в отчёте, а не скрывает за галочкой', async () => {
    const results = await runChecks(FIXTURE, [A3]);
    const report = formatReport(results);
    assert.ok(/\d/.test(report.split('\n').slice(2).join('\n')),
      `измеренное число обязано быть видно в отчёте: ${report}`);
    assert.ok(/Б|КБ|МБ/.test(report), 'должна быть единица измерения');
  });

  test('A3 предупреждает, что это распакованный вес', async () => {
    const r = await run(A3, FIXTURE);
    assert.ok(/распакованный/i.test(r.message),
      `нельзя дать спутать вес папки с весом архива: ${r.message}`);
    assert.ok(/pack/i.test(r.message), 'должно указывать, чем меряется архив');
  });
});

// ─── A1: index.html ───────────────────────────────────────────────────────────

describe('A1 — index.html в корне', () => {
  test('удалён index.html → fail', async () => {
    const dir = brokenCopy(({ remove }) => remove('index.html'));
    const r = await run(A1, dir);
    assert.equal(r.status, STATUS.FAIL);
    assert.ok(/index\.html/.test(r.message), r.message);
  });

  test('index.html лежит не в корне → fail с подсказкой где нашли', async () => {
    const dir = brokenCopy(({ mkdir, move }) => {
      mkdir('public');
      move('index.html', 'public/index.html');
    });

    const r = await run(A1, dir);
    assert.equal(r.status, STATUS.FAIL);
    assert.ok(/public\/index\.html/.test(r.message),
      `должно подсказать, где файл нашёлся: ${r.message}`);
  });

  test('несуществующая папка → skip, НЕ fail', async () => {
    const r = await run(A1, join(tmpdir(), 'abee-no-such-dir-' + Date.now()));
    assert.equal(r.status, STATUS.SKIP,
      'нет папки — проверка не выполнялась, обвинять игру нельзя');
  });
});

// ─── A2: имена файлов ─────────────────────────────────────────────────────────

describe('A2 — имена файлов', () => {
  test('кириллица в имени → fail, файл и причина названы', async () => {
    const dir = brokenCopy(({ write }) => write('assets-спрайт.png', 'x'));
    const r = await run(A2, dir);
    assert.equal(r.status, STATUS.FAIL);
    assert.ok(r.message.includes('спрайт'), r.message);
    assert.ok(/кириллица/i.test(r.message), `должна быть названа причина: ${r.message}`);
  });

  test('пробел в имени → fail', async () => {
    const dir = brokenCopy(({ write }) => write('my sprite.png', 'x'));
    const r = await run(A2, dir);
    assert.equal(r.status, STATUS.FAIL);
    assert.ok(/пробел/i.test(r.message), r.message);
  });

  test('пробел и кириллица разом → обе причины в сообщении', async () => {
    const dir = brokenCopy(({ write }) => write('мой файл.png', 'x'));
    const r = await run(A2, dir);
    assert.equal(r.status, STATUS.FAIL);
    assert.ok(/пробел/i.test(r.message) && /кириллица/i.test(r.message), r.message);
  });

  test('ru.json и en.json именами не нарушают правило', async () => {
    const r = await run(A2, FIXTURE);
    assert.equal(r.status, STATUS.OK,
      'кириллица внутри словаря — норма, правило про ИМЕНА файлов');
  });

  test('файл в tools/ с плохим именем не считается — не уедет в архив', async () => {
    const dir = brokenCopy(({ mkdir, write }) => {
      mkdir('tools');
      write('tools/мой скрипт.js', 'x');
    });
    assert.equal((await run(A2, dir)).status, STATUS.OK,
      'tools/ в архив не попадает, ругаться на него нельзя');
  });
});

// ─── A3: вес ──────────────────────────────────────────────────────────────────

describe('A3 — вес', () => {
  test('измеряет реальные байты, а не выдумывает', async () => {
    const dir = brokenCopy(({ write }) => write('big.bin', 'A'.repeat(50 * 1024)));
    const r = await run(A3, dir);
    assert.equal(r.status, STATUS.OK);
    assert.ok(/КБ/.test(r.message), r.message);
    assert.ok(r.message.includes('big.bin'),
      `самый тяжёлый файл обязан быть в списке: ${r.message}`);
  });

  test('топ тяжёлых отсортирован по убыванию', async () => {
    const dir = brokenCopy(({ write }) => {
      write('small.bin', 'A'.repeat(1024));
      write('huge.bin',  'A'.repeat(90 * 1024));
      write('mid.bin',   'A'.repeat(40 * 1024));
    });
    const r = await run(A3, dir);
    const posHuge = r.message.indexOf('huge.bin');
    const posMid  = r.message.indexOf('mid.bin');
    assert.ok(posHuge !== -1 && posMid !== -1, r.message);
    assert.ok(posHuge < posMid, `huge должен идти раньше mid: ${r.message}`);
  });

  test('ориентир студии 150 КБ отражён для маленького проекта', async () => {
    const r = await run(A3, FIXTURE);
    assert.ok(/150 КБ/.test(r.message), r.message);
  });

  test('пустая папка → skip, НЕ ok с нулём', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'abee-empty-'));
    tmpDirs.push(dir);
    const r = await run(A3, dir);
    assert.equal(r.status, STATUS.SKIP,
      'нечего измерять — это «не проверено», а не «вес 0, всё отлично»');
  });
});

// ─── Сводный прогон ───────────────────────────────────────────────────────────

describe('несколько поломок разом', () => {
  test('удалён index.html + плохое имя → ровно два fail', async () => {
    const dir = brokenCopy(({ remove, write }) => {
      remove('index.html');
      write('плохое имя.png', 'x');
    });

    const results = await runChecks(dir, archiveChecks);
    const fails = results.filter(r => r.status === STATUS.FAIL).map(r => r.id).sort();
    assert.deepEqual(fails, ['A1', 'A2']);
    // A4 остаётся skip и не превращается в fail из-за соседей
    const a4 = results.find(r => r.id === 'A4');
    assert.equal(a4.status, STATUS.SKIP);
  });
});
