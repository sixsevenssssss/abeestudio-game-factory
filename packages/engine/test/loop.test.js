/**
 * Автотесты GameLoop — Node.js, без браузера, без rAF.
 * Тестируем логику накопителя, защиту от прыжка, паузу.
 * rAF недоступен → GameLoop автоматически использует setTimeout (не тестируем асинхронно).
 * Основной тест — прямой вызов _tick() с произвольными timestamp.
 */
import { GameLoop, UPDATE_STEP_MS, UPDATE_STEP_S } from '../src/loop.js';
import { EventBus } from '../src/events.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) { console.log(`  ✓ ${message}`); passed++; }
  else           { console.error(`  ✗ FAIL: ${message}`); failed++; }
}
function assertEqual(a, b, msg) {
  assert(a === b, `${msg} (expected ${JSON.stringify(b)}, got ${JSON.stringify(a)})`);
}
function assertNear(a, b, eps, msg) {
  assert(Math.abs(a - b) <= eps, `${msg} (expected ~${b}, got ${a})`);
}

// helper: создать loop без rAF, с заблокированным _scheduleFrame
function makeLoop(bus) {
  const loop = new GameLoop(bus ?? new EventBus());
  loop._scheduleFrame = () => {}; // отключаем реальное планирование
  return loop;
}

// --- константы ---
console.log('\n[константы]');
{
  assertEqual(UPDATE_STEP_MS, 16, 'UPDATE_STEP_MS = 16');
  assertNear(UPDATE_STEP_S, 0.016, 0.0001, 'UPDATE_STEP_S ≈ 0.016');
}

// --- start устанавливает флаги ---
console.log('\n[start]');
{
  const loop = makeLoop();
  let updates = 0, renders = 0;
  loop.start(() => updates++, () => renders++);
  assert(loop.isRunning, 'isRunning после start');
  assert(!loop.isPaused,  '!isPaused после start');
  loop.stop();
}

// --- ровно N шагов симуляции ---
console.log('\n[шаги симуляции]');
{
  const loop = makeLoop();
  let updates = 0;
  loop.start(() => updates++, () => {});

  // Подаём точно 3 шага
  loop._lastTime = 0;
  loop._accumulator = 0;
  loop._tick(UPDATE_STEP_MS * 3);
  assertEqual(updates, 3, '3 шага за кадр delta=3*16мс');

  loop.stop();
}

// --- остаток накапливается ---
console.log('\n[накопитель остатка]');
{
  const loop = makeLoop();
  let updates = 0;
  loop.start(() => updates++, () => {});

  loop._lastTime = 0;
  loop._accumulator = 0;
  loop._tick(20); // delta=20мс → 1 шаг (16мс), остаток 4мс
  assertEqual(updates, 1, '1 шаг при delta=20мс');
  assertNear(loop._accumulator, 4, 0.5, 'остаток ≈ 4мс');

  loop._tick(40); // ещё 20мс (timestamp 20→40), уже 24мс накоплено → 1 шаг, остаток 8мс
  assertEqual(updates, 2, '2й шаг на следующем кадре');

  loop.stop();
}

// --- alpha передаётся в render ---
console.log('\n[alpha для рендера]');
{
  const loop = makeLoop();
  let lastAlpha = -1;
  loop.start(() => {}, (alpha) => { lastAlpha = alpha; });

  loop._lastTime = 0;
  loop._accumulator = 0;
  loop._tick(20); // 1 шаг (16мс), остаток 4мс → alpha = 4/16 = 0.25
  assertNear(lastAlpha, 0.25, 0.05, 'alpha ≈ 0.25 при остатке 4мс');

  loop.stop();
}

// --- защита от прыжка (cap=5 шагов) ---
console.log('\n[защита от прыжка]');
{
  const loop = makeLoop();
  let updates = 0;
  loop.start(() => updates++, () => {});

  loop._lastTime = 0;
  loop._accumulator = 0;
  // delta = 10 секунд — должно быть cap = 5 шагов, не 625
  loop._tick(10000);
  assertEqual(updates, 5, 'максимум 5 шагов за кадр при огромной delta');

  loop.stop();
}

// --- пауза: tick не вызывает update/render ---
console.log('\n[пауза]');
{
  const loop = makeLoop();
  let updates = 0, renders = 0;
  loop.start(() => updates++, () => renders++);
  loop.pause();
  assert(loop.isPaused, 'isPaused после pause()');

  loop._lastTime = 0;
  loop._accumulator = 0;
  loop._tick(100); // большая дельта, но пауза
  assertEqual(updates, 0, 'update не вызывается на паузе');
  assertEqual(renders, 0, 'render не вызывается на паузе');

  loop.stop();
}

// --- resume сбрасывает lastTime (нет прыжка после паузы) ---
console.log('\n[resume: нет прыжка]');
{
  const loop = makeLoop();
  let updates = 0;
  loop.start(() => updates++, () => {});
  loop.pause();
  loop.resume();

  // После resume _lastTime = now → первый tick даст нулевую или маленькую delta
  loop._tick(loop._lastTime + 20); // +20мс от resume
  assertEqual(updates, 1, 'после resume не более 1 шага');

  loop.stop();
}

// --- события шины ---
console.log('\n[события EventBus]');
{
  const bus = new EventBus();
  const events = [];
  bus.on('loop:started',  () => events.push('started'));
  bus.on('loop:paused',   () => events.push('paused'));
  bus.on('loop:resumed',  () => events.push('resumed'));
  bus.on('loop:stopped',  () => events.push('stopped'));

  const loop = makeLoop(bus);
  loop.start(() => {}, () => {});
  loop.pause();
  loop.resume();
  loop.stop();

  assert(events.includes('started'),  'эмит loop:started');
  assert(events.includes('paused'),   'эмит loop:paused');
  assert(events.includes('resumed'),  'эмит loop:resumed');
  assert(events.includes('stopped'),  'эмит loop:stopped');
}

// --- повторный start — игнорируется ---
console.log('\n[повторный start]');
{
  const loop = makeLoop();
  let count = 0;
  loop.start(() => {}, () => {});
  loop.start(() => { count++; }, () => {}); // второй start должен игнорироваться
  loop._lastTime = 0;
  loop._tick(UPDATE_STEP_MS);
  assertEqual(count, 0, 'повторный start не заменяет update-функцию');
  loop.stop();
}

// --- stop после stop — не падает ---
console.log('\n[stop идемпотентен]');
{
  const loop = makeLoop();
  loop.start(() => {}, () => {});
  loop.stop();
  let ok = true;
  try { loop.stop(); } catch { ok = false; }
  assert(ok, 'двойной stop не кидает исключение');
}

// Итог
console.log(`\n${'='.repeat(40)}`);
if (failed === 0) {
  console.log(`✅ Все ${passed} тестов прошли`);
} else {
  console.log(`❌ Провалено: ${failed} / ${passed + failed}`);
  process.exit(1);
}
