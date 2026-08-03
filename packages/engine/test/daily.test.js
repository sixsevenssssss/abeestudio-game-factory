/**
 * Автотесты DailySystem — Node.js.
 * Инжектируем now() для полного контроля времени.
 */
import { DailySystem } from '../src/daily.js';
import { SaveSystem, MockStorage } from '../src/save.js';
import { EventBus } from '../src/events.js';

let passed = 0, failed = 0;
function assert(c, m)   { if (c) { console.log(`  ✓ ${m}`); passed++; } else { console.error(`  ✗ FAIL: ${m}`); failed++; } }
function assertEqual(a, b, m) { assert(a === b, `${m} (exp ${JSON.stringify(b)}, got ${JSON.stringify(a)})`); }

const DAY_MS = 86_400_000;
const REWARDS = [
  { coins: 50 },
  { coins: 100 },
  { coins: 150 },
  { coins: 200 },
  { coins: 300 },
  { coins: 400 },
  { coins: 500 },
];

// UTC полночь 2026-01-01
const JAN1 = Date.UTC(2026, 0, 1, 0, 0, 0, 0);

async function makeSave() {
  const storage = new MockStorage();
  const save = new SaveSystem({ storage, version: 1 });
  await save.load();
  return save;
}

function makeDaily(nowFn, save = null, events = null) {
  const d = new DailySystem({ rewards: REWARDS, save, events, now: nowFn });
  d.init();
  return d;
}

// ─── начальное состояние ──────────────────────────────────────────────────
console.log('\n[начальное состояние]');
{
  const d = makeDaily(() => JAN1 + 1000); // 1 января 00:00:01
  const s = d.state();
  assert(s.canClaim,    'canClaim=true при первом запуске');
  assertEqual(s.streak, 0, 'стрик = 0');
  assertEqual(s.weekAheadRewards.length, 7, 'weekAheadRewards = 7 элементов');
}

// ─── claim возвращает награду ─────────────────────────────────────────────
console.log('\n[claim: награда]');
{
  const d = makeDaily(() => JAN1 + 1000);
  const r = d.claim();
  assertEqual(r?.coins, 50, 'первая награда = 50 монет (день 1)');
  assertEqual(d.streak, 1,  'стрик = 1 после первого claim');
  assertEqual(d.totalClaims, 1, 'totalClaims = 1');
}

// ─── повторный claim того же дня → null ───────────────────────────────────
console.log('\n[claim: повтор того же дня]');
{
  const d = makeDaily(() => JAN1 + 1000);
  d.claim();
  const r2 = d.claim();
  assert(r2 === null, 'второй claim того же дня → null');
  assertEqual(d.streak, 1, 'стрик не меняется при повторе');
}

// ─── state.canClaim = false после claim ──────────────────────────────────
console.log('\n[state: canClaim после claim]');
{
  const d = makeDaily(() => JAN1 + 1000);
  d.claim();
  const s = d.state();
  assert(!s.canClaim, 'canClaim=false после получения');
  assertEqual(s.nextClaimAt, JAN1 + DAY_MS, 'nextClaimAt = следующая полночь');
}

// ─── стрик растёт при последовательных днях ───────────────────────────────
console.log('\n[стрик: последовательные дни]');
{
  let t = JAN1 + 1000;
  const d = makeDaily(() => t);
  d.claim(); // день 1
  t += DAY_MS; // сдвигаемся в день 2
  d.claim(); // день 2
  t += DAY_MS;
  d.claim(); // день 3
  assertEqual(d.streak, 3, 'стрик = 3 после трёх дней подряд');
}

// ─── стрик сбрасывается при пропуске дня ──────────────────────────────────
console.log('\n[стрик: сброс при пропуске]');
{
  let t = JAN1 + 1000;
  const d = makeDaily(() => t);
  d.claim(); // день 1
  assertEqual(d.streak, 1, 'стрик = 1');
  t += DAY_MS * 2; // пропустили день 2, сейчас день 3
  d.claim();
  assertEqual(d.streak, 1, 'стрик сброшен к 1 после пропуска');
}

// ─── стрик не сбрасывается при получении в один день ─────────────────────
console.log('\n[стрик: в пределах того же дня не сбрасывается]');
{
  let t = JAN1 + 500; // начало дня
  const d = makeDaily(() => t);
  d.claim(); // забрали в 00:00:00.5
  t = JAN1 + DAY_MS - 1000; // 23:59:59 того же дня
  // canClaim = false (тот же день)
  assert(!d.state().canClaim, 'canClaim=false в конце того же дня');
  assertEqual(d.streak, 1, 'стрик = 1');
}

// ─── циклические награды (streak > rewards.length) ────────────────────────
console.log('\n[награды: цикл]');
{
  let t = JAN1 + 500;
  const d = makeDaily(() => t);
  for (let i = 0; i < 7; i++) {
    d.claim();
    t += DAY_MS;
  }
  // 8-й день: цикл возвращается к rewards[0]
  const r = d.claim();
  assertEqual(r?.coins, 50, '8-й день = rewards[0] (цикл)');
  assertEqual(d.streak, 8, 'стрик = 8');
}

// ─── weekAheadRewards учитывает текущий стрик ────────────────────────────
console.log('\n[weekAheadRewards]');
{
  let t = JAN1 + 500;
  const d = makeDaily(() => t);
  d.claim(); // streak = 1
  t += DAY_MS;
  const s = d.state();
  // Предпросмотр начинается со streak=1 (уже получили), но weekAhead = со следующего
  // Текущий streak=1, следующие = streak+0..+6 = [1,2,3,4,5,6,7] → rewards[0..6]
  assertEqual(s.weekAheadRewards[0]?.coins, 50,  'завтра = день 2 → 100... wait');
  // Стрик уже 1, weekAheadRewards[0] = _rewardForStreak(1+0) = rewards[0] = 50
  // weekAheadRewards[1] = _rewardForStreak(1+1) = rewards[1] = 100
  assertEqual(s.weekAheadRewards[0]?.coins, 50,  'weekAhead[0] = steak 1 (50)');
  assertEqual(s.weekAheadRewards[1]?.coins, 100, 'weekAhead[1] = streak 2 (100)');
  assertEqual(s.weekAheadRewards[6]?.coins, 500, 'weekAhead[6] = streak 7 (500)');
}

// ─── персистенция ────────────────────────────────────────────────────────
console.log('\n[персистенция]');
{
  const storage = new MockStorage();
  let t = JAN1 + 500;
  const save1 = new SaveSystem({ storage, version: 1 });
  await save1.load();
  const d1 = makeDaily(() => t, save1);
  d1.claim();
  await save1.flush();

  // Перезагрузка
  const save2 = new SaveSystem({ storage, version: 1 });
  await save2.load();
  const d2 = makeDaily(() => t + DAY_MS, save2);
  assertEqual(d2.streak, 1, 'стрик загружен из Save');
  assert(d2.state().canClaim, 'canClaim=true после reload + нового дня');
}

// ─── события EventBus ─────────────────────────────────────────────────────
console.log('\n[события]');
{
  const bus = new EventBus();
  const d   = makeDaily(() => JAN1 + 500, null, bus);
  let evt;
  bus.on('daily:claimed', e => evt = e);
  d.claim();
  assertEqual(evt?.streak, 1,  'evt.streak = 1');
  assertEqual(evt?.reward?.coins, 50, 'evt.reward.coins = 50');
}

// ─── nextClaimAt до claim ─────────────────────────────────────────────────
console.log('\n[nextClaimAt]');
{
  const d = makeDaily(() => JAN1 + 500);
  // Сегодня ещё не получали — nextClaimAt = сегодняшняя полночь (уже прошла)
  assertEqual(d.state().nextClaimAt, JAN1, 'nextClaimAt = текущая полночь (canClaim=true)');
  d.claim();
  // После получения — следующая полночь
  assertEqual(d.state().nextClaimAt, JAN1 + DAY_MS, 'nextClaimAt = следующая полночь после claim');
}

// ─── init без save — не кидает ────────────────────────────────────────────
console.log('\n[init без save]');
{
  const d = new DailySystem({ rewards: REWARDS, now: () => JAN1 + 500 });
  let ok = true;
  try { d.init(); d.claim(); } catch { ok = false; }
  assert(ok, 'работает без save (in-memory only)');
  assertEqual(d.streak, 1, 'стрик растёт в памяти');
}

console.log(`\n${'='.repeat(40)}`);
if (failed === 0) {
  console.log(`✅ Все ${passed} тестов прошли`);
} else {
  console.log(`❌ Провалено: ${failed} / ${passed + failed}`);
  process.exit(1);
}
