/**
 * Автотесты AudioSystem — Node.js, без браузера, без Web Audio API.
 * Все тесты работают с audioContext: null (null-backend).
 */
import { AudioSystem } from '../src/audio.js';
import { EventBus } from '../src/events.js';

let passed = 0, failed = 0;
function assert(c, m)   { if (c) { console.log(`  ✓ ${m}`); passed++; } else { console.error(`  ✗ FAIL: ${m}`); failed++; } }
function assertEqual(a, b, m) { assert(a === b, `${m} (exp ${JSON.stringify(b)}, got ${JSON.stringify(a)})`); }
function assertNear(a, b, eps, m) { assert(Math.abs(a-b)<=eps, `${m} (exp ~${b}, got ${a})`); }

function make(opts = {}) {
  const bus = new EventBus();
  const sys = new AudioSystem({ audioContext: null, events: bus, ...opts });
  return { sys, bus };
}

// ─── init без AudioContext ─────────────────────────────────────────────────
console.log('\n[init null-backend]');
{
  const { sys } = make();
  await sys.init();
  assert(!sys.isUnlocked, 'isUnlocked=false до жеста');
}

// ─── setVolume / getVolume ─────────────────────────────────────────────────
console.log('\n[setVolume / getVolume]');
{
  const { sys } = make();
  await sys.init();
  sys.setVolume('music', 0.5);
  assertNear(sys.getVolume('music'), 0.5, 0.001, 'setVolume music=0.5');
  sys.setVolume('sfx', 0.8);
  assertNear(sys.getVolume('sfx'), 0.8, 0.001, 'setVolume sfx=0.8');
  sys.setVolume('ui', 0);
  assertNear(sys.getVolume('ui'), 0, 0.001, 'setVolume ui=0');
}

// ─── setVolume: клампинг 0..1 ─────────────────────────────────────────────
console.log('\n[setVolume: клампинг]');
{
  const { sys } = make();
  await sys.init();
  sys.setVolume('music', -0.5);
  assertNear(sys.getVolume('music'), 0, 0.001, 'отрицательное клампится к 0');
  sys.setVolume('music', 1.5);
  assertNear(sys.getVolume('music'), 1, 0.001, 'больше 1 клампится к 1');
}

// ─── setMute ───────────────────────────────────────────────────────────────
console.log('\n[setMute]');
{
  const { sys } = make();
  await sys.init();
  assert(!sys.isMuted('music'), 'по умолчанию не замьючено');
  sys.setMute('music', true);
  assert(sys.isMuted('music'), 'isMuted после setMute(true)');
  sys.setMute('music', false);
  assert(!sys.isMuted('music'), '!isMuted после setMute(false)');
}

// ─── duckForAd / unduck ───────────────────────────────────────────────────
console.log('\n[duckForAd / unduck]');
{
  const { sys } = make();
  await sys.init();
  sys.setVolume('music', 0.8);
  assert(!sys.isDucked, 'isDucked=false до duck');
  sys.duckForAd();
  assert(sys.isDucked, 'isDucked=true после duckForAd');
  // Громкость шины не меняется — duck применяется на GainNode (null в тестах)
  assertNear(sys.getVolume('music'), 0.8, 0.001, 'bus.volume не изменился при duck');
  sys.unduck();
  assert(!sys.isDucked, 'isDucked=false после unduck');
}

// ─── duckForAd идемпотентен ───────────────────────────────────────────────
console.log('\n[duck идемпотентен]');
{
  const { sys } = make();
  await sys.init();
  sys.setVolume('music', 0.6);
  sys.duckForAd();
  sys.duckForAd(); // второй вызов — должен игнорироваться
  sys.unduck();
  assertNear(sys.getVolume('music'), 0.6, 0.001, 'громкость восстановлена корректно');
}

// ─── duckForAd: события EventBus ─────────────────────────────────────────
console.log('\n[duck: события]');
{
  const { sys, bus } = make();
  await sys.init();
  const evts = [];
  bus.on('audio:ducked',   () => evts.push('ducked'));
  bus.on('audio:unducked', () => evts.push('unducked'));
  sys.duckForAd();
  sys.unduck();
  assert(evts.includes('ducked'),   'audio:ducked эмитится');
  assert(evts.includes('unducked'), 'audio:unducked эмитится');
}

// ─── register + play ──────────────────────────────────────────────────────
console.log('\n[register + play]');
{
  const { sys } = make();
  await sys.init();
  sys.register('click', '/assets/click.mp3');
  const handle = sys.play('click', { bus: 'ui' });
  assert(handle !== null, 'play возвращает handle');
  assertEqual(handle.bus, 'ui', 'handle.bus корректен');
  assert(!handle.isStopped, 'handle не остановлен');
}

// ─── play без регистрации ─────────────────────────────────────────────────
console.log('\n[play без регистрации]');
{
  const { sys } = make();
  await sys.init();
  const handle = sys.play('nonexistent');
  assert(handle === null, 'play возвращает null для незарегистрированного ассета');
}

// ─── stop ─────────────────────────────────────────────────────────────────
console.log('\n[stop]');
{
  const { sys } = make();
  await sys.init();
  sys.register('shot', '/shot.mp3');
  const h = sys.play('shot');
  assert(!h.isStopped, 'звук играет');
  sys.stop('shot');
  assert(h.isStopped, 'звук остановлен после stop()');
}

// ─── пул: остановка старейшего при превышении ─────────────────────────────
console.log('\n[пул: max 8]');
{
  const { sys } = make({ maxSfxPool: 3 });
  await sys.init();
  sys.register('boom', '/boom.mp3');
  const h1 = sys.play('boom');
  const h2 = sys.play('boom');
  const h3 = sys.play('boom');
  // Пул заполнен (3/3)
  assert(!h1.isStopped, 'h1 играет при 3/3');
  const h4 = sys.play('boom'); // превышение → h1 должен быть остановлен
  assert(h1.isStopped, 'h1 (старейший) остановлен при превышении пула');
  assert(!h4.isStopped, 'h4 играет');
}

// ─── poolSize ─────────────────────────────────────────────────────────────
console.log('\n[poolSize]');
{
  const { sys } = make();
  await sys.init();
  sys.register('ping', '/ping.mp3');
  assertEqual(sys.poolSize('ping'), 0, 'пул пуст до play');
  sys.play('ping');
  sys.play('ping');
  assertEqual(sys.poolSize('ping'), 2, 'пул = 2 после двух play');
  sys.stop('ping');
  assertEqual(sys.poolSize('ping'), 0, 'пул пуст после stop');
}

// ─── music: смена трека ───────────────────────────────────────────────────
console.log('\n[music: смена трека]');
{
  const { sys } = make();
  await sys.init();
  sys.register('theme', '/theme.ogg');
  sys.register('battle', '/battle.ogg');
  assert(sys.currentMusicId === null, 'нет музыки при старте');
  sys.music('theme');
  assertEqual(sys.currentMusicId, 'theme', 'currentMusicId = theme');
  sys.music('battle');
  assertEqual(sys.currentMusicId, 'battle', 'currentMusicId = battle после смены');
}

// ─── music: повторный вызов того же id — игнорируется ─────────────────────
console.log('\n[music: повтор игнорируется]');
{
  const { sys } = make();
  await sys.init();
  sys.register('bgm', '/bgm.ogg');
  sys.music('bgm');
  sys.music('bgm'); // должен игнорироваться (уже играет)
  assertEqual(sys.currentMusicId, 'bgm', 'currentMusicId остался bgm');
}

// ─── stopMusic ────────────────────────────────────────────────────────────
console.log('\n[stopMusic]');
{
  const { sys } = make();
  await sys.init();
  sys.register('theme', '/theme.ogg');
  sys.music('theme');
  sys.stopMusic();
  assert(sys.currentMusicId === null, 'currentMusicId = null после stopMusic');
}

// ─── EventBus: app:hidden → suspend ──────────────────────────────────────
console.log('\n[EventBus: app:hidden]');
{
  // Просто убеждаемся что подписка не кидает исключений
  const { sys, bus } = make();
  await sys.init();
  let ok = true;
  try { bus.emit('app:hidden'); } catch { ok = false; }
  assert(ok, 'app:hidden не кидает исключение');
}

console.log(`\n${'='.repeat(40)}`);
if (failed === 0) {
  console.log(`✅ Все ${passed} тестов прошли`);
} else {
  console.log(`❌ Провалено: ${failed} / ${passed + failed}`);
  process.exit(1);
}
