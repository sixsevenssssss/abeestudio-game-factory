/**
 * Автотесты AnalyticsSystem — Node.js.
 */
import { AnalyticsSystem, MockJournal } from '../src/analytics.js';
import { EventBus } from '../src/events.js';

let passed = 0, failed = 0;
function assert(c, m)   { if (c) { console.log(`  ✓ ${m}`); passed++; } else { console.error(`  ✗ FAIL: ${m}`); failed++; } }
function assertEqual(a, b, m) { assert(a === b, `${m} (exp ${JSON.stringify(b)}, got ${JSON.stringify(a)})`); }

function make(opts = {}) {
  const bus     = new EventBus();
  const journal = new MockJournal();
  const sys = new AnalyticsSystem({
    storage: journal,
    events:  bus,
    flushIntervalMs: 0, // без таймера в тестах
    now: () => 12345,
    ...opts,
    events: bus,
  });
  sys.init();
  return { sys, bus, journal };
}

// ─── event() добавляет в буфер и журнал ──────────────────────────────────
console.log('\n[event: буфер и журнал]');
{
  const { sys, journal } = make();
  sys.event('test', { value: 1 });
  assertEqual(sys.bufferSize, 1, 'буфер = 1 после event');
  const log = JSON.parse(journal.getItem('abeestudio_analytics_log') ?? '[]');
  assertEqual(log.length, 1, 'журнал содержит 1 запись');
  assertEqual(log[0].name, 'test', 'имя события корректно');
  assertEqual(log[0].params.value, 1, 'параметры сохранены');
}

// ─── flush очищает буфер ──────────────────────────────────────────────────
console.log('\n[flush]');
{
  const { sys } = make();
  sys.event('a');
  sys.event('b');
  assertEqual(sys.bufferSize, 2, 'буфер = 2');
  sys.flush();
  assertEqual(sys.bufferSize, 0, 'буфер пуст после flush');
}

// ─── flush отправляет в Platform ──────────────────────────────────────────
console.log('\n[flush → Platform]');
{
  const sent = [];
  const mockPlatform = {
    analytics: { track: (name, params) => sent.push({ name, params }) },
  };
  const { sys } = make({ platform: mockPlatform });
  sys.event('level_up', { level: 5 });
  sys.flush();
  assertEqual(sent.length, 1, 'событие отправлено в Platform');
  assertEqual(sent[0].name, 'level_up', 'имя события дошло до Platform');
  assertEqual(sent[0].params.level, 5, 'параметры дошли до Platform');
}

// ─── без platform — не кидает ─────────────────────────────────────────────
console.log('\n[flush без platform]');
{
  const { sys } = make({ platform: null });
  sys.event('test');
  let ok = true;
  try { sys.flush(); } catch { ok = false; }
  assert(ok, 'flush без platform не кидает');
}

// ─── getJournal() ─────────────────────────────────────────────────────────
console.log('\n[getJournal]');
{
  const { sys } = make();
  sys.event('x', { a: 1 });
  sys.event('y', { b: 2 });
  const log = sys.getJournal();
  assertEqual(log.length, 2, 'getJournal содержит 2 записи');
  assertEqual(log[1].name, 'y', 'последняя запись = y');
}

// ─── журнал ограничен 100 записями ────────────────────────────────────────
console.log('\n[журнал: лимит 100]');
{
  const { sys } = make();
  for (let i = 0; i < 120; i++) sys.event('e', { i });
  const log = sys.getJournal();
  assertEqual(log.length, 100, 'журнал обрезан до 100');
  assertEqual(log[0].params.i, 20, 'сохранены последние 100 (начинаются с i=20)');
}

// ─── событие EventBus analytics:event ────────────────────────────────────
console.log('\n[EventBus: analytics:event]');
{
  const { sys, bus } = make();
  let evt;
  bus.on('analytics:event', e => evt = e);
  sys.event('my_event', { val: 42 });
  assertEqual(evt?.name, 'my_event', 'analytics:event.name');
  assertEqual(evt?.params.val, 42, 'analytics:event.params.val');
}

// ─── стандартные события ──────────────────────────────────────────────────
console.log('\n[стандартные события]');
{
  const { sys } = make();
  sys.sessionStart({ lang: 'ru' });
  sys.firstSession({ lang: 'ru' });
  sys.adWatched({ ad_id: 'rewarded_1' });
  sys.adSkipped({ ad_id: 'rewarded_2' });
  sys.achievementUnlocked({ achievement_id: 'first_game' });
  sys.purchase({ product_id: 'coins_100' });
  const log = sys.getJournal();
  const names = log.map(e => e.name);
  assert(names.includes('session_start'),       'session_start');
  assert(names.includes('first_session'),       'first_session');
  assert(names.includes('ad_watched'),          'ad_watched');
  assert(names.includes('ad_skipped'),          'ad_skipped');
  assert(names.includes('achievement_unlocked'),'achievement_unlocked');
  assert(names.includes('purchase'),            'purchase');
}

// ─── sessionEnd вызывает flush ────────────────────────────────────────────
console.log('\n[sessionEnd: auto-flush]');
{
  const sent = [];
  const mockPlatform = {
    analytics: { track: (name) => sent.push(name) },
  };
  const { sys } = make({ platform: mockPlatform });
  sys.event('x');
  sys.sessionEnd({ duration_s: 120 });
  assert(sent.includes('x'),           'предыдущее событие отправлено при sessionEnd');
  assert(sent.includes('session_end'), 'session_end отправлен');
  assertEqual(sys.bufferSize, 0, 'буфер пуст после sessionEnd');
}

// ─── auto-event: achievements:unlocked → achievement_unlocked ─────────────
console.log('\n[auto: achievements:unlocked]');
{
  const { sys, bus } = make();
  bus.emit('achievements:unlocked', { id: 'hero' });
  const log = sys.getJournal();
  assert(log.some(e => e.name === 'achievement_unlocked' && e.params.achievement_id === 'hero'),
    'achievements:unlocked → achievement_unlocked auto-event');
}

// ─── auto-event: ads:rewarded:granted → ad_watched ────────────────────────
console.log('\n[auto: ad_watched]');
{
  const { sys, bus } = make();
  bus.emit('ads:rewarded:granted', { rewardId: 'double_coins' });
  const log = sys.getJournal();
  assert(log.some(e => e.name === 'ad_watched' && e.params.ad_id === 'double_coins'),
    'ads:rewarded:granted → ad_watched auto-event');
}

// ─── auto-event: ads:rewarded:end(granted=false) → ad_skipped ─────────────
console.log('\n[auto: ad_skipped]');
{
  const { sys, bus } = make();
  bus.emit('ads:rewarded:end', { granted: false, rewardId: 'gems' });
  const log = sys.getJournal();
  assert(log.some(e => e.name === 'ad_skipped'), 'ads:rewarded:end(false) → ad_skipped');
}

// ─── ts записывается из now() ─────────────────────────────────────────────
console.log('\n[timestamp]');
{
  const { sys } = make({ now: () => 99999 });
  sys.event('ts_test');
  const log = sys.getJournal();
  assertEqual(log[0].ts, 99999, 'ts из инжектированного now()');
}

// ─── destroy очищает буфер и таймер ──────────────────────────────────────
console.log('\n[destroy]');
{
  const { sys } = make();
  sys.event('e');
  sys.destroy();
  assertEqual(sys.bufferSize, 0, 'destroy вызывает flush (буфер пуст)');
  let ok = true;
  try { sys.event('after_destroy'); } catch { ok = false; }
  assert(ok, 'event после destroy не кидает');
}

console.log(`\n${'='.repeat(40)}`);
if (failed === 0) {
  console.log(`✅ Все ${passed} тестов прошли`);
} else {
  console.log(`❌ Провалено: ${failed} / ${passed + failed}`);
  process.exit(1);
}
