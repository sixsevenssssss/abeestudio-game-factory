/**
 * Автотесты Engine — Node.js (без DOM, без браузера).
 * Проверяем: barrel exports, Engine.start() без сцен, wire-ап систем.
 */
import { Engine, SaveSystem as Save, EventBus, L10nSystem, SaveSystem, AdsSystem,
         AudioSystem, AchievementsSystem, DailySystem, AnalyticsSystem,
         BrandModule, GameLoop, SceneManager, InputManager,
         MockPlatform, initPlatform } from '../index.js';

let passed = 0, failed = 0;
function assert(c, m)   { if (c) { console.log(`  ✓ ${m}`); passed++; } else { console.error(`  ✗ FAIL: ${m}`); failed++; } }
function assertEqual(a, b, m) { assert(a === b, `${m} (exp ${JSON.stringify(b)}, got ${JSON.stringify(a)})`); }

// ─── barrel exports доступны ──────────────────────────────────────────────
console.log('\n[barrel exports]');
{
  assert(typeof Engine            === 'function', 'Engine');
  assert(typeof EventBus          === 'function', 'EventBus');
  assert(typeof SaveSystem        === 'function', 'SaveSystem');
  assert(typeof AdsSystem         === 'function', 'AdsSystem');
  assert(typeof AudioSystem       === 'function', 'AudioSystem');
  assert(typeof L10nSystem        === 'function', 'L10nSystem');
  assert(typeof AchievementsSystem=== 'function', 'AchievementsSystem');
  assert(typeof DailySystem       === 'function', 'DailySystem');
  assert(typeof AnalyticsSystem   === 'function', 'AnalyticsSystem');
  assert(typeof BrandModule       === 'function', 'BrandModule');
  assert(typeof GameLoop          === 'function', 'GameLoop');
  assert(typeof SceneManager      === 'function', 'SceneManager');
  assert(typeof InputManager      === 'function', 'InputManager');
  assert(typeof MockPlatform      === 'function', 'MockPlatform');
  assert(typeof initPlatform      === 'function', 'initPlatform');
}

// ─── Engine.start() без сцен — не кидает ─────────────────────────────────
console.log('\n[Engine.start: минимальный конфиг]');
{
  let ok = true;
  try {
    await Engine.start({ scenes: {}, config: {} });
  } catch (e) {
    ok = false;
    console.error('  Исключение:', e.message);
  }
  assert(ok, 'Engine.start() без сцен и конфига не кидает');
}

// ─── после start() системы доступны ──────────────────────────────────────
console.log('\n[Engine: системы доступны]');
{
  await Engine.start({ scenes: {}, config: {} });
  assert(Engine.events    !== null, 'Engine.events');
  assert(Engine.scenes    !== null, 'Engine.scenes');
  assert(Engine.loop      !== null, 'Engine.loop');
  assert(Engine.save      !== null, 'Engine.save');
  assert(Engine.audio     !== null, 'Engine.audio');
  assert(Engine.l10n      !== null, 'Engine.l10n');
  assert(Engine.analytics !== null, 'Engine.analytics');
  assert(Engine.brand     !== null, 'Engine.brand');
}

// ─── Engine.events — рабочая шина ────────────────────────────────────────
console.log('\n[Engine.events работает]');
{
  await Engine.start({ scenes: {}, config: {} });
  let received = false;
  Engine.events.on('test:ping', () => { received = true; });
  Engine.events.emit('test:ping');
  assert(received, 'Engine.events.on/emit работают');
}

// ─── Engine.loop запущен ──────────────────────────────────────────────────
console.log('\n[Engine.loop]');
{
  await Engine.start({ scenes: {}, config: {} });
  assert(Engine.loop.isRunning, 'loop.isRunning после start');
}

// ─── config.i18n применяется ──────────────────────────────────────────────
console.log('\n[config.i18n]');
{
  await Engine.start({
    scenes: {},
    config: {
      i18n: {
        defaultLang: 'en',
        dictionaries: {
          ru: { 'test.key': 'Привет' },
          en: { 'test.key': 'Hello'  },
        },
      },
    },
  });
  assertEqual(Engine.l10n.lang, 'en', 'lang = en из конфига');
  assertEqual(Engine.l10n.t('test.key'), 'Hello', 'перевод применён');
}

// ─── Engine.stop() останавливает loop ────────────────────────────────────
console.log('\n[Engine.stop]');
{
  await Engine.start({ scenes: {}, config: {} });
  assert(Engine.loop.isRunning, 'loop работает до stop');
  Engine.stop();
  assert(Engine._instance === null, 'instance = null после stop');
}

// ─── Engine.events до start() — не кидает ────────────────────────────────
console.log('\n[Engine.events до start]');
{
  Engine.stop(); // убедиться что нет instance
  let ok = true;
  try {
    Engine.events.emit('before:start');
  } catch { ok = false; }
  assert(ok, 'Engine.events.emit до start не кидает (fallback bus)');
}

// ─── повторный Engine.start() заменяет instance ──────────────────────────
console.log('\n[повторный start]');
{
  await Engine.start({ scenes: {}, config: { i18n: { defaultLang: 'ru', dictionaries: {} } } });
  const inst1 = Engine._instance;
  await Engine.start({ scenes: {}, config: { i18n: { defaultLang: 'en', dictionaries: {} } } });
  const inst2 = Engine._instance;
  assert(inst1 !== inst2, 'повторный start создаёт новый instance');
}

// ─── config.audio применяется ─────────────────────────────────────────────
console.log('\n[config.audio]');
{
  await Engine.start({
    scenes: {},
    config: { audio: { music: { volume: 0.5 }, sfx: { volume: 0.7 } } },
  });
  const near = (a, b) => Math.abs(a - b) < 0.001;
  assert(near(Engine.audio.getVolume('music'), 0.5), 'audio.music.volume = 0.5');
  assert(near(Engine.audio.getVolume('sfx'),   0.7), 'audio.sfx.volume = 0.7');
}

// ─── firstSession записывается один раз ──────────────────────────────────
console.log('\n[firstSession]');
{
  await Engine.start({ scenes: {}, config: {} });
  const firstSeen = Engine.save.get('_firstSessionSeen');
  assert(firstSeen === true, '_firstSessionSeen = true после первого start');
}

console.log(`\n${'='.repeat(40)}`);
if (failed === 0) {
  console.log(`✅ Все ${passed} тестов прошли`);
} else {
  console.log(`❌ Провалено: ${failed} / ${passed + failed}`);
  process.exit(1);
}
