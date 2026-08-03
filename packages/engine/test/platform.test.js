/**
 * Автотесты MockPlatform — Node.js, без браузера.
 */
import { MockPlatform, initPlatform } from '../src/platform/mock.js';

let passed = 0, failed = 0;
function assert(c, m)   { if (c) { console.log(`  ✓ ${m}`); passed++; } else { console.error(`  ✗ FAIL: ${m}`); failed++; } }
function assertEqual(a, b, m) { assert(a === b, `${m} (exp ${JSON.stringify(b)}, got ${JSON.stringify(a)})`); }

async function make(opts = {}) {
  const p = new MockPlatform(opts);
  await p.init();
  return p;
}

// ─── init ─────────────────────────────────────────────────────────────────
console.log('\n[init]');
{
  const p = await make({ lang: 'en' });
  assertEqual(p.environment.i18n.lang, 'en', 'lang из опций');
  assert(p.adv         !== null, 'adv доступен после init');
  assert(p.player      !== null, 'player доступен после init');
  assert(p.leaderboard !== null, 'leaderboard доступен после init');
  assert(p.payments    !== null, 'payments доступен после init');
  assert(p.loadingAPI  !== null, 'loadingAPI доступен после init');
}

// ─── initPlatform → мок (window.YaGames недоступен в Node.js) ─────────────
console.log('\n[initPlatform]');
{
  const { sdk, isYandex } = await initPlatform({ lang: 'ru' });
  assert(!isYandex, 'isYandex=false в Node.js (нет window.YaGames)');
  assertEqual(sdk.environment.i18n.lang, 'ru', 'мок язык передаётся');
}

// ─── loadingAPI.ready() ───────────────────────────────────────────────────
console.log('\n[loadingAPI.ready]');
{
  const p = await make();
  assert(!p._loadingReady, 'до ready() флаг false');
  p.loadingAPI.ready();
  assert(p._loadingReady, 'после ready() флаг true');
}

// ─── player (гость) ───────────────────────────────────────────────────────
console.log('\n[player: гость]');
{
  const p = await make({ isAuthorized: false, playerName: 'Аноним' });
  assertEqual(p.player.getMode(), 'lite', 'режим lite для гостя');
  assert(!p.player.isAuthorized(), 'гость не авторизован');
  assertEqual(p.player.getName(), 'Аноним', 'имя гостя');
  const data = await p.player.getData();
  assert(typeof data === 'object', 'getData возвращает объект');
}

// ─── player (авторизованный) ──────────────────────────────────────────────
console.log('\n[player: авторизован]');
{
  const p = await make({ isAuthorized: true, playerName: 'Игрок', playerId: 'u42' });
  assertEqual(p.player.getMode(), 'full', 'режим full для авторизованного');
  assert(p.player.isAuthorized(), 'авторизован');
  assertEqual(p.player.getUniqueID(), 'u42', 'уникальный ID');
}

// ─── облачные данные ──────────────────────────────────────────────────────
console.log('\n[cloudData]');
{
  const p = await make({ cloudData: { coins: 100 } });
  const d1 = await p.player.getData();
  assertEqual(d1.coins, 100, 'начальные облачные данные');

  await p.player.setData({ coins: 200, level: 3 });
  const d2 = await p.player.getData();
  assertEqual(d2.coins, 200, 'setData обновляет coins');
  assertEqual(d2.level, 3,   'setData добавляет level');
}

// ─── stats ────────────────────────────────────────────────────────────────
console.log('\n[stats]');
{
  const p = await make();
  await p.player.setStats({ highScore: 9999 });
  const s = await p.player.getStats();
  assertEqual(s.highScore, 9999, 'setStats / getStats');
}

// ─── rewarded (успех) ─────────────────────────────────────────────────────
console.log('\n[adv: rewarded успех]');
{
  const p = await make({ rewardedResult: true, rewardedDelay: 10 });
  const result = await new Promise(resolve => {
    let rewarded = false;
    p.adv.showRewardedVideo({
      callbacks: {
        onRewarded: () => { rewarded = true; },
        onClose: (wasShown) => resolve({ rewarded, wasShown }),
        onError: (e) => resolve({ error: e }),
      },
    });
  });
  assert(result.rewarded,  'onRewarded вызван');
  assert(result.wasShown,  'onClose(true) при успехе');
}

// ─── rewarded (отказ) ─────────────────────────────────────────────────────
console.log('\n[adv: rewarded отказ]');
{
  const p = await make({ rewardedResult: false, rewardedDelay: 10 });
  const result = await new Promise(resolve => {
    let rewarded = false;
    p.adv.showRewardedVideo({
      callbacks: {
        onRewarded: () => { rewarded = true; },
        onClose: (wasShown) => resolve({ rewarded, wasShown }),
      },
    });
  });
  assert(!result.rewarded,   'onRewarded НЕ вызван при отказе');
  assert(!result.wasShown,   'onClose(false) при отказе');
}

// ─── game_api_pause / resume события ─────────────────────────────────────
console.log('\n[game_api_pause / resume]');
{
  const p = await make({ rewardedDelay: 10 });
  const events = [];
  p.on('game_api_pause',  () => events.push('pause'));
  p.on('game_api_resume', () => events.push('resume'));

  await new Promise(resolve => {
    p.adv.showRewardedVideo({ callbacks: { onClose: resolve } });
  });
  assert(events.includes('pause'),  'game_api_pause эмитится перед рекламой');
  assert(events.includes('resume'), 'game_api_resume эмитится после рекламы');
}

// ─── interstitial ─────────────────────────────────────────────────────────
console.log('\n[adv: interstitial]');
{
  const p = await make({ interstitialDelay: 10 });
  const events = [];
  p.on('game_api_pause',  () => events.push('pause'));
  p.on('game_api_resume', () => events.push('resume'));

  const result = await new Promise(resolve => {
    p.adv.showFullscreenAdv({
      callbacks: { onClose: (shown) => resolve(shown) },
    });
  });
  assert(result, 'onClose(true) для interstitial');
  assert(events.includes('pause'),  'game_api_pause при interstitial');
  assert(events.includes('resume'), 'game_api_resume после interstitial');
}

// ─── leaderboard ──────────────────────────────────────────────────────────
console.log('\n[leaderboard]');
{
  const p = await make({ playerId: 'p1', playerName: 'Алиса' });
  await p.leaderboard.setLeaderboardScore('main', 1500);
  const { entries } = await p.leaderboard.getLeaderboardEntries('main');
  assert(entries.length > 0, 'есть записи после setScore');
  assertEqual(entries[0].score, 1500, 'score корректен');
  assertEqual(entries[0].player.name, 'Алиса', 'имя игрока');
}

// ─── payments ─────────────────────────────────────────────────────────────
console.log('\n[payments]');
{
  const p = await make();
  const purchase = await p.payments.purchase({ id: 'coins_100' });
  assertEqual(purchase.productID, 'coins_100', 'productID после покупки');
  assert(typeof purchase.purchaseToken === 'string', 'purchaseToken — строка');

  const list = await p.payments.getPurchases();
  assertEqual(list.length, 1, 'покупка в списке');

  await p.payments.consumePurchase(purchase.purchaseToken);
  const list2 = await p.payments.getPurchases();
  assertEqual(list2.length, 0, 'consumePurchase удаляет покупку');
}

// ─── shortcut / feedback ──────────────────────────────────────────────────
console.log('\n[shortcut / feedback]');
{
  const p = await make();
  const sc = await p.shortcut.canShowPrompt();
  assert(!sc.canShow, 'canShowPrompt → false (мок)');
  const fb = await p.feedback.canReview();
  assert(!fb.value, 'canReview → false (мок)');
}

// ─── features.GamesAPI ────────────────────────────────────────────────────
console.log('\n[GamesAPI]');
{
  const p = await make();
  const games = await p.features.GamesAPI.getAllGames();
  assert(Array.isArray(games), 'getAllGames → массив');
}

// ─── overridePlayer / overrideRewardedResult ──────────────────────────────
console.log('\n[override методы]');
{
  const p = await make({ playerName: 'Первый' });
  p.overridePlayer({ name: 'Второй', authorized: true });
  assertEqual(p.player.getName(), 'Второй', 'overridePlayer.name работает');
  assert(p.player.isAuthorized(), 'overridePlayer.authorized работает');

  p.overrideRewardedResult(false);
  const result = await new Promise(resolve => {
    let r = false;
    p.adv.showRewardedVideo({
      callbacks: { onRewarded: () => { r=true; }, onClose: () => resolve(r) },
    });
  });
  assert(!result, 'overrideRewardedResult(false) работает');
}

// ─── on / off ─────────────────────────────────────────────────────────────
console.log('\n[on / off]');
{
  const p = await make();
  let count = 0;
  const h = () => count++;
  p.on('test_event', h);
  p._emit('test_event');
  p._emit('test_event');
  p.off('test_event', h);
  p._emit('test_event');
  assertEqual(count, 2, 'off снимает подписку на событие площадки');
}

console.log(`\n${'='.repeat(40)}`);
if (failed === 0) {
  console.log(`✅ Все ${passed} тестов прошли`);
} else {
  console.log(`❌ Провалено: ${failed} / ${passed + failed}`);
  process.exit(1);
}
