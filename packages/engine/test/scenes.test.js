/**
 * Автотесты SceneManager — Node.js, без браузера.
 * fadeDuration: 0 → мгновенные переходы, тесты синхронны (await сразу резолвится).
 */
import { SceneManager } from '../src/scenes.js';
import { EventBus } from '../src/events.js';

let passed = 0, failed = 0;
function assert(cond, msg) {
  if (cond) { console.log(`  ✓ ${msg}`); passed++; }
  else       { console.error(`  ✗ FAIL: ${msg}`); failed++; }
}
function assertEqual(a, b, msg) {
  assert(a === b, `${msg} (expected ${JSON.stringify(b)}, got ${JSON.stringify(a)})`);
}

// Фабрика: логирующая тестовая сцена
function makeSceneClass(name, hooks = {}) {
  class TestScene {
    constructor() { this.log = []; }
    preload()        { this.log.push('preload'); return hooks.preload?.() ?? Promise.resolve(); }
    enter(p)         { this.log.push(`enter:${JSON.stringify(p ?? null)}`); hooks.enter?.(p); }
    exit()           { this.log.push('exit'); hooks.exit?.(); }
    pause()          { this.log.push('pause'); }
    resume()         { this.log.push('resume'); }
    update(dt)       { this.log.push(`update:${dt}`); }
    render(a)        { this.log.push(`render:${a}`); }
  }
  TestScene.sceneName = name;
  return TestScene;
}

function makeManager() {
  return new SceneManager(new EventBus(), { fadeDuration: 0 });
}

// --- register + go ---
console.log('\n[register + go]');
{
  const sm = makeManager();
  sm.register('menu', makeSceneClass('menu'));
  await sm.go('menu', { test: 1 });
  const scene = sm.current;
  assert(scene !== null, 'current не null после go');
  assert(scene.log.includes('preload'), 'preload вызван');
  assert(scene.log.some(l => l.startsWith('enter:')), 'enter вызван');
  assert(!scene.log.includes('exit'), 'exit НЕ вызван при входе');
}

// --- go передаёт payload ---
console.log('\n[go payload]');
{
  const sm = makeManager();
  let received;
  class PayloadScene {
    enter(p) { received = p; }
  }
  sm.register('p', PayloadScene);
  await sm.go('p', { coins: 42 });
  assertEqual(received?.coins, 42, 'payload доходит до enter()');
}

// --- go: exit вызывается на предыдущей сцене ---
console.log('\n[go: exit старой сцены]');
{
  const sm = makeManager();
  sm.register('a', makeSceneClass('a'));
  sm.register('b', makeSceneClass('b'));
  await sm.go('a');
  const sceneA = sm.current;
  await sm.go('b');
  assert(sceneA.log.includes('exit'), 'exit вызван на сцене A при go("b")');
  assert(sm.current !== sceneA, 'current теперь сцена B');
}

// --- go незарегистрированной сцены не кидает ---
console.log('\n[go: неизвестная сцена]');
{
  const sm = makeManager();
  let ok = true;
  try { await sm.go('nonexistent'); } catch { ok = false; }
  assert(ok, 'go несуществующей сцены не кидает исключение');
}

// --- push / pop стек ---
console.log('\n[push / pop]');
{
  const sm = makeManager();
  sm.register('game', makeSceneClass('game'));
  sm.register('pause', makeSceneClass('pause'));
  await sm.go('game');
  const game = sm.current;

  await sm.push('pause');
  assert(game.log.includes('pause'), 'game получает pause() при push');
  assert(sm.current !== game, 'current после push — сцена паузы');
  assertEqual(sm.stackNames.length, 2, 'стек = 2 после push');

  const pauseScene = sm.current;
  await sm.pop();
  assert(pauseScene.log.includes('exit'), 'сцена паузы получает exit() при pop');
  assert(game.log.includes('resume'), 'game получает resume() после pop');
  assert(sm.current === game, 'current после pop — снова game');
  assertEqual(sm.stackNames.length, 1, 'стек = 1 после pop');
}

// --- pop на стеке из 1 не кидает ---
console.log('\n[pop: стек ≤ 1]');
{
  const sm = makeManager();
  sm.register('a', makeSceneClass('a'));
  await sm.go('a');
  let ok = true;
  try { await sm.pop(); } catch { ok = false; }
  assert(ok, 'pop на одиночной сцене не кидает');
}

// --- update / render делегируются в активную сцену ---
console.log('\n[update / render]');
{
  const sm = makeManager();
  sm.register('g', makeSceneClass('g'));
  await sm.go('g');
  sm.update(0.016);
  sm.render(0.5);
  assert(sm.current.log.includes('update:0.016'), 'update делегируется');
  assert(sm.current.log.includes('render:0.5'), 'render делегируется');
}

// --- события EventBus ---
console.log('\n[события]');
{
  const bus = new EventBus();
  const sm  = new SceneManager(bus, { fadeDuration: 0 });
  const evts = [];
  bus.on('scenes:transition:start', () => evts.push('start'));
  bus.on('scenes:transition:end',   () => evts.push('end'));
  bus.on('scenes:changed',          () => evts.push('changed'));
  bus.on('scenes:pushed',           () => evts.push('pushed'));
  bus.on('scenes:popped',           () => evts.push('popped'));

  class S { enter(){} exit(){} pause(){} resume(){} }
  sm.register('a', S);
  sm.register('b', S);
  await sm.go('a');
  await sm.push('b');
  await sm.pop();

  assert(evts.includes('start'),   'эмит transition:start');
  assert(evts.includes('end'),     'эмит transition:end');
  assert(evts.includes('changed'), 'эмит scenes:changed');
  assert(evts.includes('pushed'),  'эмит scenes:pushed');
  assert(evts.includes('popped'),  'эмит scenes:popped');
}

// --- ошибка в enter не ломает переход ---
console.log('\n[изоляция ошибок в хуках]');
{
  const sm = makeManager();
  class BadScene { enter() { throw new Error('намеренная ошибка в enter'); } }
  sm.register('bad', BadScene);
  let ok = true;
  try { await sm.go('bad'); } catch { ok = false; }
  assert(ok, 'ошибка в enter() не кидает наружу');
}

// --- preload ожидается до enter ---
console.log('\n[порядок: preload → enter]');
{
  const sm = makeManager();
  const order = [];
  class OrderScene {
    async preload() { order.push('preload'); }
    enter()         { order.push('enter'); }
  }
  sm.register('o', OrderScene);
  await sm.go('o');
  assertEqual(order[0], 'preload', 'preload вызывается перед enter');
  assertEqual(order[1], 'enter',   'enter вызывается после preload');
}

// --- конкурентный go игнорируется ---
console.log('\n[конкурентный go]');
{
  const sm = makeManager();
  class SlowScene {
    async preload() { await new Promise(r => setTimeout(r, 10)); }
    enter() {}
  }
  class FastScene { enter() {} }
  sm.register('slow', SlowScene);
  sm.register('fast', FastScene);
  const p1 = sm.go('slow');
  const p2 = sm.go('fast'); // должен быть проигнорирован
  await Promise.all([p1, p2]);
  SlowScene.sceneName = 'slow';
  assertEqual(sm.stackNames[0], 'slow', 'конкурентный go("fast") проигнорирован');
}

// --- stackNames ---
console.log('\n[stackNames]');
{
  const sm = makeManager();
  class A {} A.sceneName = 'Alpha';
  class B {} B.sceneName = 'Beta';
  sm.register('a', A);
  sm.register('b', B);
  await sm.go('a');
  await sm.push('b');
  assertEqual(sm.stackNames.join(','), 'Alpha,Beta', 'stackNames корректны');
}

console.log(`\n${'='.repeat(40)}`);
if (failed === 0) {
  console.log(`✅ Все ${passed} тестов прошли`);
} else {
  console.log(`❌ Провалено: ${failed} / ${passed + failed}`);
  process.exit(1);
}
