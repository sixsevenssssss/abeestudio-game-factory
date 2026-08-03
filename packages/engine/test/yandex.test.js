/**
 * Автотесты YandexPlatform — Node.js.
 * Реальный ysdk недоступен → тестируем адаптер с фейковым ysdk-объектом (duck typing).
 */
import { YandexPlatform, isYandexEnvironment } from '../src/platform/yandex.js';
import { EventBus } from '../src/events.js';

let passed = 0, failed = 0;
function assert(c, m)   { if (c) { console.log(`  ✓ ${m}`); passed++; } else { console.error(`  ✗ FAIL: ${m}`); failed++; } }
function assertEqual(a, b, m) { assert(a === b, `${m} (exp ${JSON.stringify(b)}, got ${JSON.stringify(a)})`); }

/** Создать минимальный фейковый ysdk */
function makeFakeYsdk(opts = {}) {
  const handlers = {};
  return {
    environment: {
      i18n: { lang: opts.lang ?? 'ru', tld: 'ru' },
      app:  { id: 'test-game', version: '1.0' },
      payload: null,
    },
    loadingAPI: { ready: () => {} },
    shortcut:   { canShowPrompt: () => Promise.resolve({ canShow: false }) },
    feedback:   { canReview: () => Promise.resolve({ value: false }) },
    features:   { GamesAPI: { getAllGames: () => Promise.resolve([]) } },
    adv: {
      showRewardedVideo: opts.showRewarded ?? (({ callbacks = {} }) => {
        callbacks.onRewarded?.();
        callbacks.onClose?.(true);
      }),
      showFullscreenAdv: opts.showInterstitial ?? (({ callbacks = {} }) => {
        callbacks.onClose?.(true);
      }),
    },
    getPlayer: () => Promise.resolve({
      getMode:       () => 'lite',
      isAuthorized:  () => false,
      getUniqueID:   () => 'ysdk-player',
      getName:       () => 'YPlayer',
      getPhoto:      () => '',
      getData:       () => Promise.resolve({}),
      setData:       () => Promise.resolve(),
      getStats:      () => Promise.resolve({}),
      setStats:      () => Promise.resolve(),
    }),
    getPayments: () => Promise.resolve({
      purchase:        ({ id }) => Promise.resolve({ productID: id, purchaseToken: 'tok1' }),
      getPurchases:    () => Promise.resolve([]),
      getCatalog:      () => Promise.resolve([]),
      consumePurchase: () => Promise.resolve(),
    }),
    getLeaderboards: () => Promise.resolve({
      setLeaderboardScore:      () => Promise.resolve(),
      getLeaderboardEntries:    (name) => Promise.resolve({ leaderboard: { name }, entries: [] }),
      getLeaderboardPlayerEntry:() => Promise.reject(new Error('not present')),
    }),
    on:  (event, h) => { handlers[event] = handlers[event] ?? []; handlers[event].push(h); },
    off: (event, h) => { handlers[event] = (handlers[event] ?? []).filter(x => x !== h); },
    _emit: (event, data) => { for (const h of handlers[event] ?? []) h(data); },
  };
}

// ─── конструктор ──────────────────────────────────────────────────────────
console.log('\n[конструктор]');
{
  const ysdk = makeFakeYsdk();
  const p = new YandexPlatform(ysdk);
  assert(p.isYandex,             'isYandex = true');
  assert(p.environment !== null, 'environment доступен');
  assert(p.loadingAPI  !== null, 'loadingAPI доступен');
  assert(p.adv         !== null, 'adv доступен');
  assert(p.leaderboard !== null, 'leaderboard доступен');
}

// ─── environment прокинут из ysdk ─────────────────────────────────────────
console.log('\n[environment]');
{
  const ysdk = makeFakeYsdk({ lang: 'en' });
  const p = new YandexPlatform(ysdk);
  assertEqual(p.environment.i18n.lang, 'en', 'lang из ysdk.environment');
}

// ─── adv: rewarded (делегирование) ───────────────────────────────────────
console.log('\n[adv rewarded]');
{
  const ysdk = makeFakeYsdk();
  const p = new YandexPlatform(ysdk);
  let rewarded = false, closed = false;
  p.adv.showRewardedVideo({ callbacks: {
    onRewarded: () => { rewarded = true; },
    onClose:    () => { closed   = true; },
  }});
  assert(rewarded, 'onRewarded делегируется в реальный ysdk');
  assert(closed,   'onClose делегируется в реальный ysdk');
}

// ─── adv: interstitial (делегирование) ───────────────────────────────────
console.log('\n[adv interstitial]');
{
  const ysdk = makeFakeYsdk();
  const p = new YandexPlatform(ysdk);
  let closed = false;
  p.adv.showFullscreenAdv({ callbacks: { onClose: (shown) => { closed = shown; } }});
  assert(closed, 'onClose(true) делегируется для interstitial');
}

// ─── game_api_pause → platform:pause на EventBus ──────────────────────────
console.log('\n[game_api_pause → EventBus]');
{
  const ysdk   = makeFakeYsdk();
  const bus    = new EventBus();
  const events = [];
  bus.on('platform:pause',  () => events.push('pause'));
  bus.on('platform:resume', () => events.push('resume'));

  const p = new YandexPlatform(ysdk, bus);
  ysdk._emit('game_api_pause');
  ysdk._emit('game_api_resume');

  assert(events.includes('pause'),  'game_api_pause → platform:pause на шине');
  assert(events.includes('resume'), 'game_api_resume → platform:resume на шине');
}

// ─── initPlayer() ────────────────────────────────────────────────────────
console.log('\n[initPlayer]');
{
  const ysdk = makeFakeYsdk();
  const p    = new YandexPlatform(ysdk);
  assert(p.player === null, 'player null до initPlayer()');
  await p.initPlayer();
  assert(p.player !== null, 'player доступен после initPlayer()');
  assert(!p.player.isAuthorized(), 'isAuthorized() делегируется');
  assertEqual(p.player.getUniqueID(), 'ysdk-player', 'getUniqueID делегируется');
}

// ─── initPlayer() кешируется ─────────────────────────────────────────────
console.log('\n[initPlayer кеш]');
{
  let calls = 0;
  const ysdk = makeFakeYsdk();
  ysdk.getPlayer = () => { calls++; return Promise.resolve({ isAuthorized: () => false, getUniqueID: () => 'x', getName: () => 'x', getPhoto: () => '', getMode: () => 'lite', getData: () => Promise.resolve({}), setData: () => Promise.resolve(), getStats: () => Promise.resolve({}), setStats: () => Promise.resolve() }); };
  const p = new YandexPlatform(ysdk);
  await p.initPlayer();
  await p.initPlayer();
  assertEqual(calls, 1, 'getPlayer() вызывается только один раз');
}

// ─── leaderboard (делегирование) ─────────────────────────────────────────
console.log('\n[leaderboard]');
{
  const ysdk = makeFakeYsdk();
  const p    = new YandexPlatform(ysdk);
  await p.leaderboard.setLeaderboardScore('main', 999);
  const { entries } = await p.leaderboard.getLeaderboardEntries('main');
  assert(Array.isArray(entries), 'getLeaderboardEntries → массив');
}

// ─── initPayments() ──────────────────────────────────────────────────────
console.log('\n[initPayments]');
{
  const ysdk = makeFakeYsdk();
  const p    = new YandexPlatform(ysdk);
  assert(p.payments === null, 'payments null до initPayments()');
  await p.initPayments();
  assert(p.payments !== null, 'payments доступны после initPayments()');
  const purchase = await p.payments.purchase({ id: 'coins_50' });
  assertEqual(purchase.productID, 'coins_50', 'purchase делегируется');
}

// ─── конструктор без ysdk — кидает ────────────────────────────────────────
console.log('\n[ошибка: ysdk не передан]');
{
  let threw = false;
  try { new YandexPlatform(null); } catch { threw = true; }
  assert(threw, 'конструктор кидает если ysdk=null');
}

// ─── isYandexEnvironment() ───────────────────────────────────────────────
console.log('\n[isYandexEnvironment]');
{
  assert(!isYandexEnvironment(), 'false в Node.js (нет window.YaGames)');
}

// ─── on / off проксируются ────────────────────────────────────────────────
console.log('\n[on / off]');
{
  const ysdk = makeFakeYsdk();
  const p = new YandexPlatform(ysdk);
  let count = 0;
  const h = () => count++;
  p.on('custom_event', h);
  ysdk._emit('custom_event');
  ysdk._emit('custom_event');
  p.off('custom_event', h);
  ysdk._emit('custom_event');
  assertEqual(count, 2, 'on/off проксируются в ysdk');
}

console.log(`\n${'='.repeat(40)}`);
if (failed === 0) {
  console.log(`✅ Все ${passed} тестов прошли`);
} else {
  console.log(`❌ Провалено: ${failed} / ${passed + failed}`);
  process.exit(1);
}
