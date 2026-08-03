/**
 * Автотесты EventBus — Node.js, без браузера.
 * Запуск: node test/events.test.js
 */
import { EventBus } from '../src/events.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ ${message}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failed++;
  }
}

function assertEqual(a, b, message) {
  assert(a === b, `${message} (expected ${JSON.stringify(b)}, got ${JSON.stringify(a)})`);
}

// --- on / emit ---
console.log('\n[on / emit]');
{
  const bus = new EventBus();
  let calls = 0;
  bus.on('test', () => calls++);
  bus.emit('test');
  bus.emit('test');
  assertEqual(calls, 2, 'on вызывается на каждый emit');
}

// --- payload передаётся ---
console.log('\n[payload]');
{
  const bus = new EventBus();
  let received;
  bus.on('data', (p) => received = p);
  bus.emit('data', { x: 42 });
  assertEqual(received?.x, 42, 'payload доходит до обработчика');
}

// --- off ---
console.log('\n[off]');
{
  const bus = new EventBus();
  let calls = 0;
  const fn = () => calls++;
  bus.on('ev', fn);
  bus.emit('ev');
  bus.off('ev', fn);
  bus.emit('ev');
  assertEqual(calls, 1, 'off снимает подписку');
  assertEqual(bus.listenerCount('ev'), 0, 'тип удаляется когда подписчиков нет');
}

// --- unsubscribe через возвращённую функцию ---
console.log('\n[unsubscribe()]');
{
  const bus = new EventBus();
  let calls = 0;
  const unsub = bus.on('ev', () => calls++);
  bus.emit('ev');
  unsub();
  bus.emit('ev');
  assertEqual(calls, 1, 'unsub() снимает подписку');
}

// --- once ---
console.log('\n[once]');
{
  const bus = new EventBus();
  let calls = 0;
  bus.once('ev', () => calls++);
  bus.emit('ev');
  bus.emit('ev');
  bus.emit('ev');
  assertEqual(calls, 1, 'once срабатывает ровно один раз');
}

// --- once + off по оригинальной функции ---
console.log('\n[once + off по originalFn]');
{
  const bus = new EventBus();
  let calls = 0;
  const fn = () => calls++;
  bus.once('ev', fn);
  bus.off('ev', fn); // снимаем до emit
  bus.emit('ev');
  assertEqual(calls, 0, 'off по оригинальной fn снимает wrapper от once');
}

// --- несколько подписчиков ---
console.log('\n[несколько подписчиков]');
{
  const bus = new EventBus();
  let a = 0, b = 0;
  bus.on('ev', () => a++);
  bus.on('ev', () => b++);
  bus.emit('ev');
  assertEqual(a, 1, 'первый подписчик получает событие');
  assertEqual(b, 1, 'второй подписчик получает событие');
}

// --- ошибка в обработчике не ломает остальные ---
console.log('\n[изоляция ошибок]');
{
  const bus = new EventBus();
  let called = false;
  bus.on('ev', () => { throw new Error('намеренная ошибка'); });
  bus.on('ev', () => { called = true; });
  bus.emit('ev');
  assert(called, 'второй обработчик вызывается даже если первый упал');
}

// --- clear(type) ---
console.log('\n[clear(type)]');
{
  const bus = new EventBus();
  let calls = 0;
  bus.on('ev', () => calls++);
  bus.on('ev', () => calls++);
  bus.clear('ev');
  bus.emit('ev');
  assertEqual(calls, 0, 'clear(type) снимает все подписки на тип');
}

// --- clear() всё ---
console.log('\n[clear() все]');
{
  const bus = new EventBus();
  let a = 0, b = 0;
  bus.on('x', () => a++);
  bus.on('y', () => b++);
  bus.clear();
  bus.emit('x');
  bus.emit('y');
  assertEqual(a + b, 0, 'clear() без аргумента снимает всё');
}

// --- emit без подписчиков — не падает ---
console.log('\n[emit без подписчиков]');
{
  const bus = new EventBus();
  let ok = true;
  try { bus.emit('nonexistent'); } catch { ok = false; }
  assert(ok, 'emit без подписчиков не кидает исключение');
}

// --- подписка изменяется внутри emit (безопасность снимка) ---
console.log('\n[snapshot-безопасность emit]');
{
  const bus = new EventBus();
  let calls = 0;
  const unsub = bus.on('ev', () => {
    calls++;
    unsub(); // отписываемся прямо во время emit
  });
  bus.emit('ev');
  bus.emit('ev');
  assertEqual(calls, 1, 'отписка внутри emit работает безопасно');
}

// --- listenerCount ---
console.log('\n[listenerCount]');
{
  const bus = new EventBus();
  assertEqual(bus.listenerCount('ev'), 0, 'count=0 без подписчиков');
  const u1 = bus.on('ev', () => {});
  const u2 = bus.on('ev', () => {});
  assertEqual(bus.listenerCount('ev'), 2, 'count=2 после двух подписок');
  u1();
  assertEqual(bus.listenerCount('ev'), 1, 'count=1 после одной отписки');
}

// Итог
console.log(`\n${'='.repeat(40)}`);
if (failed === 0) {
  console.log(`✅ Все ${passed} тестов прошли`);
} else {
  console.log(`❌ Провалено: ${failed} / ${passed + failed}`);
  process.exit(1);
}
