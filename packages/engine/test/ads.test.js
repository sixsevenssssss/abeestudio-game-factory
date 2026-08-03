/**
 * Автотесты AdsSystem — Node.js, без браузера.
 * Используем MockPlatform с мгновенным delay.
 */
import { AdsSystem } from '../src/ads.js';
import { MockPlatform } from '../src/platform/mock.js';
import { EventBus } from '../src/events.js';

let passed = 0, failed = 0;
function assert(c, m)   { if (c) { console.log(`  ✓ ${m}`); passed++; } else { console.error(`  ✗ FAIL: ${m}`); failed++; } }
function assertEqual(a, b, m) { assert(a === b, `${m} (exp ${JSON.stringify(b)}, got ${JSON.stringify(a)})`); }

async function makePlatform(opts = {}) {
  const p = new MockPlatform({ rewardedDelay: 5, interstitialDelay: 5, ...opts });
  await p.init();
  return p;
}

function makeLoop() {
  const log = [];
  return { pause: () => log.push('pause'), resume: () => log.push('resume'), log };
}
function makeAudio() {
  const log = [];
  return { duckForAd: () => log.push('duck'), unduck: () => log.push('unduck'), log };
}

// ─── rewarded: успех ──────────────────────────────────────────────────────
console.log('\n[rewarded: успех]');
{
  const platform = await makePlatform({ rewardedResult: true });
  const ads = new AdsSystem({ platform });
  const result = await ads.rewarded('coins');
  assert(result === true, 'rewarded возвращает true при успехе');
}

// ─── rewarded: отказ ──────────────────────────────────────────────────────
console.log('\n[rewarded: отказ]');
{
  const platform = await makePlatform({ rewardedResult: false });
  const ads = new AdsSystem({ platform });
  const result = await ads.rewarded('coins');
  assert(result === false, 'rewarded возвращает false при отказе');
}

// ─── rewarded: ошибка → false (не исключение) ────────────────────────────
console.log('\n[rewarded: ошибка → false]');
{
  const platform = await makePlatform();
  // Заменяем adv на бросающий ошибку
  platform.adv.showRewardedVideo = ({ callbacks }) => {
    callbacks.onError?.(new Error('нет интернета'));
  };
  const ads = new AdsSystem({ platform });
  let result;
  let threw = false;
  try { result = await ads.rewarded('x'); } catch { threw = true; }
  assert(!threw,           'ошибка не кидается наружу');
  assert(result === false, 'rewarded возвращает false при ошибке');
}

// ─── rewarded: пауза + duck перед показом ────────────────────────────────
console.log('\n[rewarded: пауза + duck]');
{
  const platform = await makePlatform({ rewardedResult: true });
  const loop  = makeLoop();
  const audio = makeAudio();
  const ads   = new AdsSystem({ platform, loop, audio });
  await ads.rewarded('test');
  assert(loop.log.includes('pause'),  'loop.pause() вызван до показа');
  assert(loop.log.includes('resume'), 'loop.resume() вызван после показа');
  assert(audio.log.includes('duck'),  'audio.duckForAd() вызван до показа');
  assert(audio.log.includes('unduck'),'audio.unduck() вызван после показа');
}

// ─── rewarded: события EventBus ──────────────────────────────────────────
console.log('\n[rewarded: события]');
{
  const platform = await makePlatform({ rewardedResult: true });
  const bus  = new EventBus();
  const evts = [];
  bus.on('ads:rewarded:start',   () => evts.push('start'));
  bus.on('ads:rewarded:granted', () => evts.push('granted'));
  bus.on('ads:rewarded:end',     e  => evts.push(`end:${e.granted}`));
  const ads = new AdsSystem({ platform, events: bus });
  await ads.rewarded('r');
  assert(evts.includes('start'),       'эмит rewarded:start');
  assert(evts.includes('granted'),     'эмит rewarded:granted при успехе');
  assert(evts.includes('end:true'),    'эмит rewarded:end с granted=true');
}

// ─── interstitial: показывается ──────────────────────────────────────────
console.log('\n[interstitial: показ]');
{
  const platform = await makePlatform();
  const loop  = makeLoop();
  const audio = makeAudio();
  const ads = new AdsSystem({ platform, loop, audio, interstitialIntervalMs: 0 });
  await ads.interstitial('menu');
  assert(loop.log.includes('pause'),   'loop.pause() при interstitial');
  assert(loop.log.includes('resume'),  'loop.resume() после interstitial');
  assert(audio.log.includes('duck'),   'duck при interstitial');
  assert(audio.log.includes('unduck'), 'unduck после interstitial');
}

// ─── interstitial: интервал (второй вызов пропускается) ──────────────────
console.log('\n[interstitial: интервал]');
{
  const platform = await makePlatform();
  const bus  = new EventBus();
  const evts = [];
  bus.on('ads:interstitial:start',   () => evts.push('start'));
  bus.on('ads:interstitial:skipped', () => evts.push('skipped'));
  const ads = new AdsSystem({ platform, events: bus, interstitialIntervalMs: 60000 });

  await ads.interstitial('first');  // показывается
  await ads.interstitial('second'); // пропускается (интервал не истёк)

  const starts  = evts.filter(e => e === 'start').length;
  const skipped = evts.filter(e => e === 'skipped').length;
  assertEqual(starts,  1, 'первый interstitial показан');
  assertEqual(skipped, 1, 'второй interstitial пропущен');
}

// ─── interstitial: после сброса таймера — снова показывается ─────────────
console.log('\n[interstitial: сброс таймера]');
{
  const platform = await makePlatform();
  const bus  = new EventBus();
  let starts = 0;
  bus.on('ads:interstitial:start', () => starts++);
  const ads = new AdsSystem({ platform, events: bus, interstitialIntervalMs: 60000 });

  await ads.interstitial('a');
  ads.resetInterstitialTimer();
  await ads.interstitial('b');
  assertEqual(starts, 2, 'после resetInterstitialTimer снова показывается');
}

// ─── interstitial: события EventBus ──────────────────────────────────────
console.log('\n[interstitial: события]');
{
  const platform = await makePlatform();
  const bus  = new EventBus();
  const evts = [];
  bus.on('ads:interstitial:start', () => evts.push('start'));
  bus.on('ads:interstitial:end',   () => evts.push('end'));
  const ads = new AdsSystem({ platform, events: bus, interstitialIntervalMs: 0 });
  await ads.interstitial('x');
  assert(evts.includes('start'), 'эмит interstitial:start');
  assert(evts.includes('end'),   'эмит interstitial:end');
}

// ─── конкурентный rewarded игнорируется ──────────────────────────────────
console.log('\n[конкурентный rewarded]');
{
  const platform = await makePlatform({ rewardedDelay: 50 });
  const ads = new AdsSystem({ platform });

  // Запускаем два rewarded одновременно
  const [r1, r2] = await Promise.all([
    ads.rewarded('a'),
    ads.rewarded('b'), // второй должен вернуть false немедленно
  ]);
  // Один из них true (первый), другой false (второй отклонён)
  assert((r1 && !r2) || (!r1 && r2), 'конкурентный rewarded отклоняется');
}

// ─── конструктор без platform → кидает ────────────────────────────────────
console.log('\n[ошибка: без platform]');
{
  let threw = false;
  try { new AdsSystem({}); } catch { threw = true; }
  assert(threw, 'конструктор кидает без platform');
}

// ─── isShowing ────────────────────────────────────────────────────────────
console.log('\n[isShowing]');
{
  const platform = await makePlatform({ rewardedDelay: 50 });
  const ads = new AdsSystem({ platform });
  assert(!ads.isShowing, 'isShowing=false до показа');
  const p = ads.rewarded('x');
  assert(ads.isShowing, 'isShowing=true во время показа');
  await p;
  assert(!ads.isShowing, 'isShowing=false после показа');
}

console.log(`\n${'='.repeat(40)}`);
if (failed === 0) {
  console.log(`✅ Все ${passed} тестов прошли`);
} else {
  console.log(`❌ Провалено: ${failed} / ${passed + failed}`);
  process.exit(1);
}
