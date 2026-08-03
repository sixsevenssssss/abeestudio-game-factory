/**
 * Автотесты SaveSystem — Node.js, без браузера.
 */
import { SaveSystem, MockStorage } from '../src/save.js';

let passed = 0, failed = 0;
function assert(c, m)   { if (c) { console.log(`  ✓ ${m}`); passed++; } else { console.error(`  ✗ FAIL: ${m}`); failed++; } }
function assertEqual(a, b, m) { assert(a === b, `${m} (exp ${JSON.stringify(b)}, got ${JSON.stringify(a)})`); }
function assertDeepEqual(a, b, m) { assert(JSON.stringify(a)===JSON.stringify(b), `${m}`); }

function make(opts = {}) {
  return new SaveSystem({ storage: new MockStorage(), version: 1, ...opts });
}

// ─── базовый get / set ────────────────────────────────────────────────────
console.log('\n[get / set]');
{
  const s = make();
  await s.load();
  s.set('coins', 100);
  assertEqual(s.get('coins'), 100, 'set / get корневое поле');
  assertEqual(s.get('missing', 42), 42, 'fallback при отсутствии ключа');
  assertEqual(s.get('also.missing', 'x'), 'x', 'fallback при отсутствии вложенного ключа');
}

// ─── вложенные пути ───────────────────────────────────────────────────────
console.log('\n[вложенные пути]');
{
  const s = make();
  await s.load();
  s.set('settings.sound', false);
  s.set('settings.music', true);
  assertEqual(s.get('settings.sound'), false, 'get вложенного false');
  assertEqual(s.get('settings.music'), true,  'get вложенного true');
  assertEqual(s.get('settings.vibration', true), true, 'fallback для несуществующего вложенного');

  s.set('a.b.c.d', 99);
  assertEqual(s.get('a.b.c.d'), 99, 'глубокая вложенность работает');
}

// ─── flush записывает в хранилище ─────────────────────────────────────────
console.log('\n[flush]');
{
  const storage = new MockStorage();
  const s = new SaveSystem({ storage, version: 1, storageKey: 'test_flush' });
  await s.load();
  s.set('score', 500);
  await s.flush();
  const stored = JSON.parse(storage.getItem('test_flush'));
  assertEqual(stored.score, 500, 'flush записывает в хранилище');
  assertEqual(stored._version, 1, 'flush записывает _version');
}

// ─── данные загружаются после перезагрузки ────────────────────────────────
console.log('\n[persist / reload]');
{
  const storage = new MockStorage();
  const s1 = new SaveSystem({ storage, version: 1, storageKey: 'persist_test' });
  await s1.load();
  s1.set('level', 7);
  await s1.flush();

  const s2 = new SaveSystem({ storage, version: 1, storageKey: 'persist_test' });
  await s2.load();
  assertEqual(s2.get('level'), 7, 'данные восстановлены после reload');
}

// ─── миграция v0 → v1 ─────────────────────────────────────────────────────
console.log('\n[миграция v0→v1]');
{
  const storage = new MockStorage({
    mig_test: JSON.stringify({ _version: 0, gold: 300 }),
  });
  const s = new SaveSystem({ storage, version: 1, storageKey: 'mig_test' });
  s.migrate(0, data => ({ ...data, coins: data.gold ?? 0 }));
  await s.load();
  assertEqual(s.get('coins'), 300, 'поле gold → coins мигрировало');
  assertEqual(s.get('_version'), 1, 'версия поднята до 1');
}

// ─── цепочка миграций v0→v1→v2 ───────────────────────────────────────────
console.log('\n[цепочка v0→v2]');
{
  const storage = new MockStorage({
    chain_test: JSON.stringify({ _version: 0, gold: 50 }),
  });
  const s = new SaveSystem({ storage, version: 2, storageKey: 'chain_test' });
  s.migrate(0, d => ({ ...d, coins: d.gold ?? 0 }));
  s.migrate(1, d => ({ ...d, gems: 5 }));
  await s.load();
  assertEqual(s.get('coins'), 50, 'цепочка: gold→coins');
  assertEqual(s.get('gems'),   5, 'цепочка: gems добавлены на v1→v2');
  assertEqual(s.get('_version'), 2, 'версия = 2');
}

// ─── защита от битого JSON ────────────────────────────────────────────────
console.log('\n[защита от битого JSON]');
{
  const storage = new MockStorage({
    corrupt_test: 'НЕВАЛИДНЫЙ JSON!!!',
  });
  const s = new SaveSystem({ storage, version: 1, storageKey: 'corrupt_test' });
  let ok = true;
  try { await s.load(); } catch { ok = false; }
  assert(ok, 'битый JSON не кидает исключение');
  assertEqual(s.get('_version'), 1, 'после битого JSON версия = текущая');
}

// ─── откат к резервной копии ──────────────────────────────────────────────
console.log('\n[откат к резервной копии]');
{
  const storage = new MockStorage({
    bak_test:         'CORRUPT',
    bak_test_backup:  JSON.stringify({ _version: 1, coins: 999 }),
  });
  const s = new SaveSystem({ storage, version: 1, storageKey: 'bak_test' });
  await s.load();
  assertEqual(s.get('coins'), 999, 'данные восстановлены из резервной копии');
}

// ─── оба слота битые → начинаем с нуля ───────────────────────────────────
console.log('\n[оба слота битые → ноль]');
{
  const storage = new MockStorage({
    zero_test:        'BAD',
    zero_test_backup: 'ALSO BAD',
  });
  const s = new SaveSystem({ storage, version: 1, storageKey: 'zero_test' });
  await s.load();
  assertEqual(s.get('coins', 0), 0, 'нет данных когда оба слота битые');
}

// ─── flush записывает резервную копию ─────────────────────────────────────
console.log('\n[резервная копия при flush]');
{
  const storage = new MockStorage();
  const s = new SaveSystem({ storage, version: 1, storageKey: 'bk_flush' });
  await s.load();
  s.set('x', 1); await s.flush();
  s.set('x', 2); await s.flush();
  // Резервная = предыдущий flush = { x: 1 }
  const bk = JSON.parse(storage.getItem('bk_flush_backup'));
  assertEqual(bk.x, 1, 'резервная копия = предыдущий flush');
}

// ─── reset ────────────────────────────────────────────────────────────────
console.log('\n[reset]');
{
  const s = make();
  await s.load();
  s.set('coins', 9999);
  await s.reset();
  assertEqual(s.get('coins', 0), 0, 'reset обнуляет данные');
}

// ─── size() ──────────────────────────────────────────────────────────────
console.log('\n[size]');
{
  const s = make();
  await s.load();
  const sz = s.size();
  assert(sz > 0, `size() > 0 (got ${sz})`);
}

// ─── snapshot() immutable ────────────────────────────────────────────────
console.log('\n[snapshot immutable]');
{
  const s = make();
  await s.load();
  s.set('val', 1);
  const snap = s.snapshot();
  assertEqual(snap.val, 1, 'snapshot содержит данные');
  // Изменить snapshot нельзя (frozen)
  let threw = false;
  try { snap.val = 999; } catch { threw = true; }
  // В strict mode кидает, в non-strict нет — проверяем что значение не изменилось
  assertEqual(snap.val, 1, 'frozen snapshot не изменяется');
}

// ─── debounce: set не пишет немедленно ───────────────────────────────────
console.log('\n[debounce]');
{
  const storage = new MockStorage();
  const s = new SaveSystem({ storage, version: 1, storageKey: 'db_test' });
  await s.load();
  s.set('x', 42);
  // Сразу после set — хранилище ещё пустое (flush ещё не произошёл)
  const immediate = storage.getItem('db_test');
  assert(immediate === null, 'debounce: flush не происходит сразу после set');
  // После flush — записано
  await s.flush();
  const after = JSON.parse(storage.getItem('db_test'));
  assertEqual(after.x, 42, 'flush пишет накопленные изменения');
}

// ─── ошибка в миграции не ломает загрузку ────────────────────────────────
console.log('\n[ошибка в миграции]');
{
  const storage = new MockStorage({ err_test: JSON.stringify({ _version: 0 }) });
  const s = new SaveSystem({ storage, version: 1, storageKey: 'err_test' });
  s.migrate(0, () => { throw new Error('намеренная ошибка'); });
  let ok = true;
  try { await s.load(); } catch { ok = false; }
  assert(ok, 'ошибка в миграции не кидает наружу');
  assertEqual(s.get('_version'), 1, 'версия поднята несмотря на ошибку');
}

console.log(`\n${'='.repeat(40)}`);
if (failed === 0) {
  console.log(`✅ Все ${passed} тестов прошли`);
} else {
  console.log(`❌ Провалено: ${failed} / ${passed + failed}`);
  process.exit(1);
}
