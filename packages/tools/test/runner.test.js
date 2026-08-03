/**
 * Тесты для src/checks/runner.js
 * Запуск: node --test test/runner.test.js
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { runChecks, formatReport, exitCode, STATUS } from '../src/checks/runner.js';

// ─── Тестовые проверки ────────────────────────────────────────────────────────

const checkOk = {
  id: 'T1',
  title: 'Тестовая проверка ok',
  fn: async () => ({ status: STATUS.OK, message: 'Всё хорошо' }),
};

const checkFail = {
  id: 'T2',
  title: 'Тестовая проверка fail',
  fn: async () => ({
    status: STATUS.FAIL,
    message: 'Найдена проблема в файле foo.js:12',
    fix: 'src/game/foo.js, строка 12',
  }),
};

const checkSkip = {
  id: 'T3',
  title: 'Тестовая проверка skip',
  fn: async () => ({ status: STATUS.SKIP, message: 'Не проверено: нет браузера' }),
};

const checkThrows = {
  id: 'T4',
  title: 'Проверка с исключением',
  fn: async () => { throw new Error('внутренняя ошибка'); },
};

const checkBadStatus = {
  id: 'T5',
  title: 'Проверка с неверным статусом',
  fn: async () => ({ status: 'invalid', message: 'что-то' }),
};

// ─── runChecks ────────────────────────────────────────────────────────────────

describe('runChecks', () => {
  test('ok проверка возвращает status ok', async () => {
    const results = await runChecks('/tmp', [checkOk]);
    assert.equal(results.length, 1);
    assert.equal(results[0].status, STATUS.OK);
    assert.equal(results[0].id, 'T1');
    assert.equal(results[0].title, 'Тестовая проверка ok');
  });

  test('fail проверка возвращает status fail с сообщением', async () => {
    const results = await runChecks('/tmp', [checkFail]);
    assert.equal(results[0].status, STATUS.FAIL);
    assert.ok(results[0].message.includes('foo.js:12'));
    assert.equal(results[0].fix, 'src/game/foo.js, строка 12');
  });

  test('skip проверка возвращает status skip', async () => {
    const results = await runChecks('/tmp', [checkSkip]);
    assert.equal(results[0].status, STATUS.SKIP);
  });

  test('исключение в fn → status skip, не fail', async () => {
    const results = await runChecks('/tmp', [checkThrows]);
    assert.equal(results[0].status, STATUS.SKIP,
      'ошибка в проверке должна давать skip, не fail — ложное зелёное хуже красного');
    assert.ok(results[0].message.includes('внутренняя ошибка'));
  });

  test('неверный статус из fn → status skip', async () => {
    const results = await runChecks('/tmp', [checkBadStatus]);
    assert.equal(results[0].status, STATUS.SKIP);
  });

  test('запускает все проверки из массива', async () => {
    const results = await runChecks('/tmp', [checkOk, checkFail, checkSkip]);
    assert.equal(results.length, 3);
  });

  test('пустой массив → пустые результаты', async () => {
    const results = await runChecks('/tmp', []);
    assert.deepEqual(results, []);
  });

  test('opts.only фильтрует по id', async () => {
    const results = await runChecks('/tmp', [checkOk, checkFail, checkSkip], { only: 'T2' });
    assert.equal(results.length, 1);
    assert.equal(results[0].id, 'T2');
  });

  test('opts.only с несуществующим id → пустой массив', async () => {
    const results = await runChecks('/tmp', [checkOk, checkFail], { only: 'Z999' });
    assert.deepEqual(results, []);
  });

  test('gameDir передаётся в fn', async () => {
    let received;
    const spy = { id: 'SPY', title: 'spy', fn: async (dir) => { received = dir; return { status: STATUS.OK, message: '' }; } };
    await runChecks('/test/dir', [spy]);
    assert.equal(received, '/test/dir');
  });
});

// ─── formatReport ─────────────────────────────────────────────────────────────

describe('formatReport', () => {
  test('все ok → заголовок ГОТОВО К ОТПРАВКЕ', async () => {
    const results = await runChecks('/tmp', [checkOk]);
    const report = formatReport(results);
    assert.ok(report.includes('ГОТОВО К ОТПРАВКЕ'), `Отчёт: ${report}`);
    assert.ok(!report.includes('НЕ ГОТОВО'));
  });

  test('есть fail → заголовок НЕ ГОТОВО', async () => {
    const results = await runChecks('/tmp', [checkOk, checkFail]);
    const report = formatReport(results);
    assert.ok(report.includes('НЕ ГОТОВО'), `Отчёт: ${report}`);
  });

  test('склонение: 1 проблема', async () => {
    const results = await runChecks('/tmp', [checkFail]);
    assert.ok(formatReport(results).includes('1 проблема'));
  });

  test('склонение: 2 проблемы', async () => {
    const c = (n) => ({ id: `F${n}`, title: `f${n}`, fn: async () => ({ status: STATUS.FAIL, message: 'm' }) });
    const results = await runChecks('/tmp', [c(1), c(2)]);
    assert.ok(formatReport(results).includes('2 проблемы'));
  });

  test('склонение: 5 проблем', async () => {
    const c = (n) => ({ id: `F${n}`, title: `f${n}`, fn: async () => ({ status: STATUS.FAIL, message: 'm' }) });
    const results = await runChecks('/tmp', [c(1), c(2), c(3), c(4), c(5)]);
    assert.ok(formatReport(results).includes('5 проблем'));
  });

  test('✅ для ok, ❌ для fail, ⬜ для skip', async () => {
    const results = await runChecks('/tmp', [checkOk, checkFail, checkSkip]);
    const report = formatReport(results);
    assert.ok(report.includes('✅'), 'нет ✅');
    assert.ok(report.includes('❌'), 'нет ❌');
    assert.ok(report.includes('⬜'), 'нет ⬜');
  });

  test('fail — сообщение и fix присутствуют в отчёте', async () => {
    const results = await runChecks('/tmp', [checkFail]);
    const report = formatReport(results);
    assert.ok(report.includes('foo.js:12'), 'нет сообщения об ошибке');
    assert.ok(report.includes('src/game/foo.js'), 'нет ссылки на файл для исправления');
  });

  test('skip — сообщение присутствует', async () => {
    const results = await runChecks('/tmp', [checkSkip]);
    const report = formatReport(results);
    assert.ok(report.includes('нет браузера'), 'нет причины skip');
  });

  test('пустой реестр → ВЕРДИКТ НЕ ВЫДАН, не зелёное', () => {
    const report = formatReport([]);
    assert.ok(report.includes('ВЕРДИКТ НЕ ВЫДАН'), `Отчёт: ${report}`);
    assert.ok(!report.includes('✅'),
      'пустой чек-лист не имеет права печатать зелёную галочку');
    assert.ok(!report.includes('ГОТОВО К ОТПРАВКЕ'),
      'ничего не проверено — это не «готово к отправке»');
  });

  test('все проверки skip → ВЕРДИКТ НЕ ВЫДАН, не зелёное', async () => {
    const results = await runChecks('/tmp', [checkSkip]);
    const report = formatReport(results);
    assert.ok(report.includes('ВЕРДИКТ НЕ ВЫДАН'), `Отчёт: ${report}`);
    assert.ok(!report.includes('ГОТОВО К ОТПРАВКЕ'),
      'если не выполнилась ни одна проверка — вердикта нет');
  });

  test('ok + skip → ГОТОВО К ОТПРАВКЕ (есть подтверждённая проверка)', async () => {
    const results = await runChecks('/tmp', [checkOk, checkSkip]);
    const report = formatReport(results);
    assert.ok(report.includes('ГОТОВО К ОТПРАВКЕ'), `Отчёт: ${report}`);
    assert.ok(report.includes('1 пропущено'), 'счётчик пропущенных должен быть виден');
  });
});

// ─── exitCode ─────────────────────────────────────────────────────────────────

describe('exitCode', () => {
  test('все ok → 0', async () => {
    const results = await runChecks('/tmp', [checkOk]);
    assert.equal(exitCode(results), 0);
  });

  test('есть fail → 1', async () => {
    const results = await runChecks('/tmp', [checkOk, checkFail]);
    assert.equal(exitCode(results), 1);
  });

  test('только skip → 2 (вердикт не выдан, а не «всё хорошо»)', async () => {
    const results = await runChecks('/tmp', [checkSkip]);
    assert.equal(exitCode(results), 2,
      'ни одна проверка не выполнилась — возвращать 0 значит соврать вызывающему');
  });

  test('skip + ok → 0 (есть подтверждённая проверка)', async () => {
    const results = await runChecks('/tmp', [checkOk, checkSkip]);
    assert.equal(exitCode(results), 0);
  });

  test('пустой реестр → 2', () => {
    assert.equal(exitCode([]), 2,
      'пустой чек-лист не имеет права возвращать успех');
  });

  test('исключение в fn (→ skip) → 2, не 0', async () => {
    const results = await runChecks('/tmp', [checkThrows]);
    assert.equal(exitCode(results), 2,
      'единственная проверка упала — вердикта нет, ноль вернуть нельзя');
  });

  test('fail важнее пустоты: fail + skip → 1', async () => {
    const results = await runChecks('/tmp', [checkFail, checkSkip]);
    assert.equal(exitCode(results), 1);
  });
});
