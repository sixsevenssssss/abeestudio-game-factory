/**
 * Автотесты BrandModule — Node.js (без DOM).
 * null-container → showSplash() resolves мгновенно.
 */
import { BrandModule } from '../src/brand.js';
import { EventBus } from '../src/events.js';

let passed = 0, failed = 0;
function assert(c, m)   { if (c) { console.log(`  ✓ ${m}`); passed++; } else { console.error(`  ✗ FAIL: ${m}`); failed++; } }
function assertEqual(a, b, m) { assert(a === b, `${m} (exp ${JSON.stringify(b)}, got ${JSON.stringify(a)})`); }

// ─── null-режим: showSplash немедленно resolves ───────────────────────────
console.log('\n[showSplash: null container]');
{
  const brand = new BrandModule({ container: null });
  let resolved = false;
  await brand.showSplash().then(() => { resolved = true; });
  assert(resolved, 'showSplash resolves в null-режиме');
}

// ─── config: studioName ───────────────────────────────────────────────────
console.log('\n[config: studioName]');
{
  const brand = new BrandModule({ config: { studioName: 'TestStudio' } });
  assertEqual(brand.studioName, 'TestStudio', 'studioName из конфига');
}

// ─── config: дефолтное имя ────────────────────────────────────────────────
console.log('\n[config: default studioName]');
{
  const brand = new BrandModule();
  assertEqual(brand.studioName, 'abeeStudio', 'default studioName = abeeStudio');
}

// ─── config: games[] ─────────────────────────────────────────────────────
console.log('\n[config: games]');
{
  const games = [
    { id: 'game1', title: 'Игра 1' },
    { id: 'game2', title: 'Игра 2' },
  ];
  const brand = new BrandModule({ config: { studioName: 'abeeStudio', games } });
  assertEqual(brand.games.length, 2, 'games.length = 2');
  assertEqual(brand.games[0].id, 'game1', 'games[0].id корректен');
}

// ─── config: пустой games по умолчанию ───────────────────────────────────
console.log('\n[config: empty games]');
{
  const brand = new BrandModule();
  assert(Array.isArray(brand.games), 'games — массив');
  assertEqual(brand.games.length, 0, 'games пуст по умолчанию');
}

// ─── logoSvg содержит ключевые элементы ──────────────────────────────────
console.log('\n[logoSvg]');
{
  const brand = new BrandModule();
  const svg = brand.logoSvg;
  assert(typeof svg === 'string',           'logoSvg — строка');
  assert(svg.includes('<svg'),              'logoSvg содержит <svg>');
  assert(svg.includes('abeeStudio'),        'logoSvg содержит название студии');
  assert(svg.includes('polygon'),           'logoSvg содержит шестиугольник');
  assert(svg.includes('ellipse'),           'logoSvg содержит пчелу (эллипс)');
  // xmlns='http://www.w3.org/2000/svg' — обязательное пространство имён, не внешняя ссылка
  assert(!svg.includes('xlink:href') && !svg.includes('src='), 'logoSvg без внешних ресурсов');
  assert(!svg.includes('data:image'),       'logoSvg без встроенных картинок');
}

// ─── showSplash возвращает Promise ────────────────────────────────────────
console.log('\n[showSplash: возвращает Promise]');
{
  const brand = new BrandModule({ container: null });
  const result = brand.showSplash();
  assert(result instanceof Promise, 'showSplash() возвращает Promise');
  await result;
}

// ─── config.games обновляется ─────────────────────────────────────────────
console.log('\n[config: изменение games]');
{
  const config = { studioName: 'abeeStudio', games: [] };
  const brand  = new BrandModule({ config });
  assertEqual(brand.games.length, 0, 'games пуст');
  // Добавить игру через изменение конфига
  config.games.push({ id: 'new_game', title: 'Новая игра' });
  assertEqual(brand.games.length, 1, 'games обновился через ссылку на конфиг');
}

// ─── EventBus в null-режиме не эмитит brand:splash:done ──────────────────
console.log('\n[null-режим: нет события bus]');
{
  const bus = new EventBus();
  let fired = false;
  bus.on('brand:splash:done', () => { fired = true; });
  const brand = new BrandModule({ container: null, events: bus });
  await brand.showSplash();
  assert(!fired, 'brand:splash:done НЕ эмитится в null-режиме (нет DOM)');
}

// ─── splashMaxMs из конструктора ──────────────────────────────────────────
console.log('\n[splashMaxMs]');
{
  const brand = new BrandModule({ container: null, splashMaxMs: 500 });
  // В null-режиме resolves мгновенно независимо от splashMaxMs
  const start = Date.now();
  await brand.showSplash();
  const elapsed = Date.now() - start;
  assert(elapsed < 100, 'null-режим resolves мгновенно (< 100мс)');
}

console.log(`\n${'='.repeat(40)}`);
if (failed === 0) {
  console.log(`✅ Все ${passed} тестов прошли`);
} else {
  console.log(`❌ Провалено: ${failed} / ${passed + failed}`);
  process.exit(1);
}
