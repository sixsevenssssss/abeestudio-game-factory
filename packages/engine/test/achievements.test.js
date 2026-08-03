/**
 * Автотесты AchievementsSystem — Node.js.
 */
import { AchievementsSystem } from '../src/achievements.js';
import { SaveSystem, MockStorage } from '../src/save.js';
import { EventBus } from '../src/events.js';

let passed = 0, failed = 0;
function assert(c, m)   { if (c) { console.log(`  ✓ ${m}`); passed++; } else { console.error(`  ✗ FAIL: ${m}`); failed++; } }
function assertEqual(a, b, m) { assert(a === b, `${m} (exp ${JSON.stringify(b)}, got ${JSON.stringify(a)})`); }

const CATALOG = [
  { id: 'first_game',  type: 'one-shot',  reward: { coins: 50 } },
  { id: 'score_1000',  type: 'progress',  target: 1000, reward: { coins: 100 } },
  { id: 'play_10',     type: 'progress',  target: 10,   reward: { gems: 5 } },
];

async function makeSave(initial = {}) {
  const storage = new MockStorage(initial);
  const save = new SaveSystem({ storage, version: 1 });
  await save.load();
  return save;
}

function makeAch(save, events, opts = {}) {
  return new AchievementsSystem({ catalog: CATALOG, save, events, ...opts });
}

// ─── init загружает состояние ─────────────────────────────────────────────
console.log('\n[init]');
{
  const save = await makeSave();
  const ach  = makeAch(save, null);
  ach.init();
  assert(!ach.isUnlocked('first_game'), 'новое достижение не открыто');
  assertEqual(ach.getProgress('score_1000'), 0, 'прогресс = 0 при старте');
  assertEqual(ach.getAll().length, 3, 'getAll возвращает всё из каталога');
}

// ─── unlock (one-shot) ────────────────────────────────────────────────────
console.log('\n[unlock one-shot]');
{
  const save = await makeSave();
  const ach  = makeAch(save, null);
  ach.init();
  ach.unlock('first_game');
  assert(ach.isUnlocked('first_game'), 'isUnlocked после unlock');
}

// ─── unlock идемпотентен ──────────────────────────────────────────────────
console.log('\n[unlock: идемпотентен]');
{
  const bus  = new EventBus();
  const save = await makeSave();
  const ach  = makeAch(save, bus);
  ach.init();

  let count = 0;
  bus.on('achievements:unlocked', () => count++);
  ach.unlock('first_game');
  ach.unlock('first_game');
  assertEqual(count, 1, 'событие эмитится только один раз');
}

// ─── unlock несуществующего — не кидает ───────────────────────────────────
console.log('\n[unlock: неизвестный id]');
{
  const ach = makeAch(null, null);
  ach.init();
  let ok = true;
  try { ach.unlock('nonexistent'); } catch { ok = false; }
  assert(ok, 'unlock несуществующего id не кидает');
}

// ─── progress → auto-unlock при достижении target ─────────────────────────
console.log('\n[progress: auto-unlock]');
{
  const bus  = new EventBus();
  const save = await makeSave();
  const ach  = makeAch(save, bus);
  ach.init();

  const events = [];
  bus.on('achievements:unlocked', e => events.push(e.id));

  ach.progress('score_1000', 500);
  assert(!ach.isUnlocked('score_1000'), 'не открыто при 500/1000');
  assertEqual(ach.getProgress('score_1000'), 500, 'прогресс = 500');

  ach.progress('score_1000', 1000);
  assert(ach.isUnlocked('score_1000'), 'открыто при 1000/1000');
  assert(events.includes('score_1000'), 'событие achievements:unlocked эмитится');
}

// ─── progress только растёт ───────────────────────────────────────────────
console.log('\n[progress: только растёт]');
{
  const save = await makeSave();
  const ach  = makeAch(save, null);
  ach.init();
  ach.progress('score_1000', 800);
  ach.progress('score_1000', 300); // меньше текущего — не должен уменьшаться
  assertEqual(ach.getProgress('score_1000'), 800, 'прогресс не уменьшается');
}

// ─── addProgress (дельта) ─────────────────────────────────────────────────
console.log('\n[addProgress]');
{
  const save = await makeSave();
  const ach  = makeAch(save, null);
  ach.init();
  ach.addProgress('play_10', 3);
  ach.addProgress('play_10', 3);
  ach.addProgress('play_10', 4);
  assert(ach.isUnlocked('play_10'), 'play_10 открыт после addProgress 3+3+4=10');
}

// ─── персистенция через Save ──────────────────────────────────────────────
console.log('\n[персистенция]');
{
  const storage = new MockStorage();
  const save1   = new SaveSystem({ storage, version: 1 });
  await save1.load();
  const ach1 = makeAch(save1, null);
  ach1.init();
  ach1.unlock('first_game');
  ach1.progress('score_1000', 750);
  await save1.flush();

  // Перезагрузка
  const save2 = new SaveSystem({ storage, version: 1 });
  await save2.load();
  const ach2 = makeAch(save2, null);
  ach2.init();
  assert(ach2.isUnlocked('first_game'), 'состояние unlock сохранено и загружено');
  assertEqual(ach2.getProgress('score_1000'), 750, 'прогресс сохранён и загружен');
}

// ─── события EventBus ─────────────────────────────────────────────────────
console.log('\n[события]');
{
  const bus  = new EventBus();
  const save = await makeSave();
  const ach  = makeAch(save, bus);
  ach.init();

  let evt;
  bus.on('achievements:unlocked', e => evt = e);
  ach.unlock('first_game');
  assertEqual(evt?.id, 'first_game', 'evt.id корректен');
  assert(evt?.reward?.coins === 50, 'evt.reward из каталога');
}

// ─── unlockedCount ────────────────────────────────────────────────────────
console.log('\n[unlockedCount]');
{
  const save = await makeSave();
  const ach  = makeAch(save, null);
  ach.init();
  assertEqual(ach.unlockedCount, 0, 'счётчик = 0 при старте');
  ach.unlock('first_game');
  assertEqual(ach.unlockedCount, 1, 'счётчик = 1 после первого unlock');
}

// ─── getAll: структура ────────────────────────────────────────────────────
console.log('\n[getAll]');
{
  const save = await makeSave();
  const ach  = makeAch(save, null);
  ach.init();
  ach.unlock('first_game');
  ach.progress('score_1000', 300);
  const all = ach.getAll();
  const fg  = all.find(a => a.id === 'first_game');
  const sc  = all.find(a => a.id === 'score_1000');
  assert(fg?.unlocked,            'first_game unlocked в getAll');
  assertEqual(sc?.progress, 300, 'score_1000 progress в getAll');
  assert(typeof fg?.unlockedAt === 'number', 'unlockedAt — число');
}

// ─── очередь уведомлений ──────────────────────────────────────────────────
console.log('\n[очередь уведомлений]');
{
  const shown = [];
  const save  = await makeSave();
  const ach   = makeAch(save, null, {
    showToast: (a) => shown.push(a.id),
  });
  ach.init();
  ach.unlock('first_game');
  // Первое уведомление показывается немедленно (showToast вызван)
  assertEqual(shown.length, 1, 'первое уведомление показано немедленно');
  assertEqual(shown[0], 'first_game', 'показано правильное достижение');
}

// ─── очередь: второе уведомление ожидает ─────────────────────────────────
console.log('\n[очередь: второе в ожидании]');
{
  const shown = [];
  const save  = await makeSave();
  const ach   = makeAch(save, null, {
    showToast: (a) => shown.push(a.id),
  });
  ach.init();
  ach.unlock('first_game');
  ach.progress('score_1000', 1000); // второй unlock
  // Первое показано, второе в очереди
  assertEqual(shown.length, 1,          'только первое показано сразу');
  assertEqual(ach.toastQueue.length, 1, 'второе в очереди');
  assertEqual(ach.toastQueue[0], 'score_1000', 'score_1000 ждёт в очереди');
}

// ─── progress для one-shot → Warning, не crash ────────────────────────────
console.log('\n[progress на one-shot: игнорируется]');
{
  const save = await makeSave();
  const ach  = makeAch(save, null);
  ach.init();
  let ok = true;
  try { ach.progress('first_game', 5); } catch { ok = false; }
  assert(ok, 'progress на one-shot не кидает исключение');
  assert(!ach.isUnlocked('first_game'), 'one-shot не открывается через progress');
}

console.log(`\n${'='.repeat(40)}`);
if (failed === 0) {
  console.log(`✅ Все ${passed} тестов прошли`);
} else {
  console.log(`❌ Провалено: ${failed} / ${passed + failed}`);
  process.exit(1);
}
