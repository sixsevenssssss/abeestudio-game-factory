/**
 * Автотесты InputManager — Node.js без браузера.
 * Используем _simulate* методы для прямого вызова логики без DOM.
 */
import { InputManager } from '../src/input.js';
import { EventBus } from '../src/events.js';

let passed = 0, failed = 0;
function assert(c, m)   { if (c) { console.log(`  ✓ ${m}`); passed++; } else { console.error(`  ✗ FAIL: ${m}`); failed++; } }
function assertEqual(a, b, m) { assert(a === b, `${m} (exp ${JSON.stringify(b)}, got ${JSON.stringify(a)})`); }
function assertNear(a, b, eps, m) { assert(Math.abs(a-b)<=eps, `${m} (exp ~${b}, got ${a})`); }

function make() {
  const bus = new EventBus();
  const inp = new InputManager(bus);
  return { bus, inp };
}

// ─── tap ───────────────────────────────────────────────────────────────────
console.log('\n[tap]');
{
  const { bus, inp } = make();
  let taps = [];
  bus.on('input:tap', e => taps.push(e));

  inp._simulateDown(10, 20);
  inp._simulateUp(10, 20);
  assertEqual(taps.length, 1, 'tap при нулевом смещении');
  assertEqual(taps[0].x, 10, 'tap.x');
  assertEqual(taps[0].y, 20, 'tap.y');
}

// ─── tap не срабатывает при большом смещении ─────────────────────────────
console.log('\n[tap отменяется при движении]');
{
  const { bus, inp } = make();
  let taps = [];
  bus.on('input:tap', e => taps.push(e));
  inp._simulateDown(0, 0);
  inp._simulateMove(50, 0); // большое смещение
  inp._simulateUp(50, 0);
  assertEqual(taps.length, 0, 'нет тапа при смещении > TAP_MAX_MOVE');
}

// ─── swipe right ──────────────────────────────────────────────────────────
console.log('\n[swipe]');
{
  const { bus, inp } = make();
  let swipes = [];
  bus.on('input:swipe', e => swipes.push(e));

  inp._simulateDown(0, 0);
  inp._simulateMove(40, 0);
  inp._simulateUp(40, 0);
  assertEqual(swipes.length, 1, 'swipe при смещении > 30px');
  assertEqual(swipes[0].direction, 'right', 'направление right');
}

// ─── swipe left ───────────────────────────────────────────────────────────
{
  const { bus, inp } = make();
  let swipes = [];
  bus.on('input:swipe', e => swipes.push(e));
  inp._simulateDown(100, 0);
  inp._simulateMove(60, 0);
  inp._simulateUp(60, 0);
  assertEqual(swipes[0]?.direction, 'left', 'свайп влево');
}

// ─── swipe up / down ──────────────────────────────────────────────────────
{
  const { bus, inp } = make();
  let swipes = [];
  bus.on('input:swipe', e => swipes.push(e));
  inp._simulateDown(0, 100);
  inp._simulateMove(0, 60);
  inp._simulateUp(0, 60);
  assertEqual(swipes[0]?.direction, 'up', 'свайп вверх');
}
{
  const { bus, inp } = make();
  let swipes = [];
  bus.on('input:swipe', e => swipes.push(e));
  inp._simulateDown(0, 0);
  inp._simulateMove(0, 40);
  inp._simulateUp(0, 40);
  assertEqual(swipes[0]?.direction, 'down', 'свайп вниз');
}

// ─── drag ─────────────────────────────────────────────────────────────────
console.log('\n[drag]');
{
  const { bus, inp } = make();
  const events = [];
  bus.on('input:drag:start', e => events.push({ type: 'start', ...e }));
  bus.on('input:drag:move',  e => events.push({ type: 'move',  ...e }));
  bus.on('input:drag:end',   e => events.push({ type: 'end',   ...e }));

  inp._simulateDown(0, 0);
  inp._simulateMove(15, 0);
  inp._simulateMove(25, 0);
  inp._simulateUp(25, 0);

  assert(events.some(e => e.type === 'start'), 'drag:start эмитится');
  assert(events.some(e => e.type === 'move'),  'drag:move эмитится');
  assert(events.some(e => e.type === 'end'),   'drag:end эмитится');

  const end = events.find(e => e.type === 'end');
  assertEqual(end?.totalDx, 25, 'drag:end.totalDx корректен');
}

// ─── drag не включает tap; drag и swipe могут сосуществовать (быстрое движение) ─
console.log('\n[drag не включает tap]');
{
  const { bus, inp } = make();
  let taps = 0;
  bus.on('input:tap', () => taps++);

  // Перемещение > MOVE_THRESHOLD → drag. Tap не должен срабатывать.
  inp._simulateDown(0, 0);
  inp._simulateMove(15, 0);  // вызывает drag:start
  inp._simulateMove(50, 0);
  inp._simulateUp(50, 0);

  assertEqual(taps, 0, 'нет тапа при drag');
  // swipe может сосуществовать с drag:end при быстром движении — это корректно
}

// ─── long-press (асинхронный таймер) ─────────────────────────────────────
console.log('\n[long-press]');
{
  await new Promise(resolve => {
    const { bus, inp } = make();
    let longpresses = [];
    bus.on('input:longpress', e => { longpresses.push(e); resolve(); });

    inp._simulateDown(50, 50);
    // Не двигаем, ждём 550мс
    setTimeout(() => {
      if (longpresses.length === 0) { resolve(); } // timeout fallback
    }, 600);
  });
  // Проверяем отдельным экземпляром с реальным ожиданием
  const result = await new Promise(resolve => {
    const { bus, inp } = make();
    bus.on('input:longpress', e => resolve(e));
    inp._simulateDown(50, 50);
    setTimeout(() => resolve(null), 600);
  });
  assert(result !== null, 'long-press срабатывает через 500мс');
  assertEqual(result?.x, 50, 'long-press.x');
}

// ─── long-press отменяется при движении ──────────────────────────────────
console.log('\n[long-press отменяется при движении]');
{
  const result = await new Promise(resolve => {
    const { bus, inp } = make();
    bus.on('input:longpress', e => resolve('fired'));
    inp._simulateDown(0, 0);
    inp._simulateMove(20, 0); // смещение > MOVE_THRESHOLD
    setTimeout(() => resolve('not-fired'), 600);
  });
  assertEqual(result, 'not-fired', 'long-press не срабатывает если переместились');
}

// ─── pinch ────────────────────────────────────────────────────────────────
console.log('\n[pinch]');
{
  const { bus, inp } = make();
  let pinches = [], pinchEnd = 0;
  bus.on('input:pinch',     e => pinches.push(e));
  bus.on('input:pinch:end', () => pinchEnd++);

  // Два пальца: начало
  inp._simulateDown(0, 0, 0);
  inp._simulateDown(100, 0, 1); // расстояние = 100px

  // Движение: второй палец → расстояние стало 200px
  inp._simulateMove(200, 0, 1);

  assert(pinches.length > 0, 'input:pinch эмитится');
  assertNear(pinches[pinches.length-1].scale, 2, 0.05, 'scale ≈ 2 при удвоении расстояния');

  // Отпускаем
  inp._simulateUp(200, 0, 1);
  assertEqual(pinchEnd, 1, 'input:pinch:end эмитится');
}

// ─── pointercancel завершает drag ─────────────────────────────────────────
console.log('\n[pointercancel]');
{
  const { bus, inp } = make();
  let ended = 0;
  bus.on('input:drag:end', () => ended++);
  inp._simulateDown(0, 0);
  inp._simulateMove(20, 0);
  inp._simulateCancel(0);
  assertEqual(ended, 1, 'drag:end эмитится при pointercancel');
}

// ─── несколько тапов независимы ───────────────────────────────────────────
console.log('\n[несколько тапов]');
{
  const { bus, inp } = make();
  let taps = [];
  bus.on('input:tap', e => taps.push(e));
  inp._simulateDown(1, 1); inp._simulateUp(1, 1);
  inp._simulateDown(2, 2); inp._simulateUp(2, 2);
  inp._simulateDown(3, 3); inp._simulateUp(3, 3);
  assertEqual(taps.length, 3, 'три последовательных тапа');
}

console.log(`\n${'='.repeat(40)}`);
if (failed === 0) {
  console.log(`✅ Все ${passed} тестов прошли`);
} else {
  console.log(`❌ Провалено: ${failed} / ${passed + failed}`);
  process.exit(1);
}
