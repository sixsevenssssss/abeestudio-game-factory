/**
 * Автотесты L10nSystem — Node.js.
 */
import { L10nSystem } from '../src/l10n.js';
import { EventBus } from '../src/events.js';

let passed = 0, failed = 0;
function assert(c, m)   { if (c) { console.log(`  ✓ ${m}`); passed++; } else { console.error(`  ✗ FAIL: ${m}`); failed++; } }
function assertEqual(a, b, m) { assert(a === b, `${m} (exp ${JSON.stringify(b)}, got ${JSON.stringify(a)})`); }

const DICTS = {
  ru: {
    'menu.play':    'Играть',
    'menu.exit':    'Выход',
    'score':        'Очки: {{value}}',
    'welcome':      'Привет, {{name}}!',
    'days':         '{{n}} {{form}}',
    'ru_only':      'только русский',
  },
  en: {
    'menu.play':    'Play',
    'menu.exit':    'Exit',
    'score':        'Score: {{value}}',
    'welcome':      'Hello, {{name}}!',
    'days':         '{{n}} {{form}}',
    'en_only':      'English only',
  },
};

function make(lang = 'ru', warnMissing = false) {
  const bus = new EventBus();
  const l   = new L10nSystem({ events: bus, warnMissingKeys: warnMissing });
  l.init(lang, DICTS);
  return { l, bus };
}

// ─── init ─────────────────────────────────────────────────────────────────
console.log('\n[init]');
{
  const { l } = make('ru');
  assertEqual(l.lang,          'ru',  'lang после init ru');
  assert(l.isInitialized,            'isInitialized=true');
  assert(l.availableLangs.includes('ru'), 'availableLangs содержит ru');
  assert(l.availableLangs.includes('en'), 'availableLangs содержит en');
}

// ─── базовый перевод ──────────────────────────────────────────────────────
console.log('\n[t: базовый перевод]');
{
  const { l } = make('ru');
  assertEqual(l.t('menu.play'), 'Играть', 'ru перевод');
  const { l: en } = make('en');
  assertEqual(en.t('menu.play'), 'Play', 'en перевод');
}

// ─── подстановка {{var}} ──────────────────────────────────────────────────
console.log('\n[t: подстановка]');
{
  const { l } = make('ru');
  assertEqual(l.t('score', { value: 42 }),       'Очки: 42',        'одна переменная');
  assertEqual(l.t('welcome', { name: 'Алиса' }), 'Привет, Алиса!', 'подстановка имени');
}

// ─── несколько переменных ─────────────────────────────────────────────────
console.log('\n[t: несколько переменных]');
{
  const { l } = make('ru');
  assertEqual(
    l.t('days', { n: 5, form: 'дней' }),
    '5 дней',
    'несколько переменных'
  );
}

// ─── отсутствующая переменная остаётся как {{name}} ──────────────────────
console.log('\n[t: отсутствующая переменная]');
{
  const { l } = make();
  const result = l.t('score', {}); // нет 'value'
  assertEqual(result, 'Очки: {{value}}', 'незаменённая переменная сохраняется');
}

// ─── ключ не найден → возвращаем ключ ────────────────────────────────────
console.log('\n[t: ключ не найден]');
{
  const { l } = make();
  const result = l.t('no.such.key');
  assertEqual(result, 'no.such.key', 'неизвестный ключ возвращается как есть');
}

// ─── setLang горячая смена ────────────────────────────────────────────────
console.log('\n[setLang]');
{
  const { l } = make('ru');
  assertEqual(l.t('menu.play'), 'Играть', 'до смены — ru');
  l.setLang('en');
  assertEqual(l.lang, 'en', 'lang = en после setLang');
  assertEqual(l.t('menu.play'), 'Play', 'после смены — en');
}

// ─── setLang тот же язык — игнорируется ──────────────────────────────────
console.log('\n[setLang: тот же язык]');
{
  const { l, bus } = make('ru');
  let changed = 0;
  bus.on('l10n:changed', () => changed++);
  l.setLang('ru');
  assertEqual(changed, 0, 'событие не эмитится при смене на тот же язык');
}

// ─── setLang событие EventBus ─────────────────────────────────────────────
console.log('\n[setLang: событие]');
{
  const { l, bus } = make('ru');
  let evt;
  bus.on('l10n:changed', e => evt = e);
  l.setLang('en');
  assertEqual(evt?.lang, 'en',  'evt.lang = en');
  assertEqual(evt?.prev, 'ru',  'evt.prev = ru');
}

// ─── нормализация кода языка ──────────────────────────────────────────────
console.log('\n[нормализация lang]');
{
  const l = new L10nSystem({ warnMissingKeys: false });
  l.init('ru-RU', DICTS);
  assertEqual(l.lang, 'ru', 'ru-RU → ru');
  l.setLang('en_US');
  assertEqual(l.lang, 'en', 'en_US → en');
}

// ─── plural: русский ──────────────────────────────────────────────────────
console.log('\n[plural: русский]');
{
  const { l } = make('ru');
  const forms = ['день', 'дня', 'дней'];
  assertEqual(l.plural(1, forms),  'день', '1 → день');
  assertEqual(l.plural(2, forms),  'дня',  '2 → дня');
  assertEqual(l.plural(5, forms),  'дней', '5 → дней');
  assertEqual(l.plural(11, forms), 'дней', '11 → дней (исключение)');
  assertEqual(l.plural(21, forms), 'день', '21 → день');
  assertEqual(l.plural(22, forms), 'дня',  '22 → дня');
  assertEqual(l.plural(25, forms), 'дней', '25 → дней');
  assertEqual(l.plural(100, forms),'дней', '100 → дней');
  assertEqual(l.plural(101, forms),'день', '101 → день');
  assertEqual(l.plural(111, forms),'дней', '111 → дней (исключение)');
  assertEqual(l.plural(0, forms),  'дней', '0 → дней');
}

// ─── plural: английский ───────────────────────────────────────────────────
console.log('\n[plural: английский]');
{
  const { l } = make('en');
  const forms = ['day', 'days', 'days'];
  assertEqual(l.plural(1, forms),  'day',  '1 → day');
  assertEqual(l.plural(2, forms),  'days', '2 → days');
  assertEqual(l.plural(0, forms),  'days', '0 → days');
  assertEqual(l.plural(11, forms), 'days', '11 → days');
}

// ─── plural: смена языка меняет форму ─────────────────────────────────────
console.log('\n[plural: смена языка]');
{
  const { l } = make('ru');
  const ruForms = ['день', 'дня', 'дней'];
  assertEqual(l.plural(21, ruForms), 'день', 'RU: 21 → день');
  l.setLang('en');
  const enForms = ['day', 'days', 'days'];
  assertEqual(l.plural(21, enForms), 'days', 'EN: 21 → days');
}

// ─── паритет ключей: предупреждение ───────────────────────────────────────
console.log('\n[паритет ключей]');
{
  const warns = [];
  const orig = console.warn;
  console.warn = (...a) => warns.push(a.join(' '));
  const l = new L10nSystem({ warnMissingKeys: true });
  l.init('ru', DICTS);
  console.warn = orig;
  // ru_only есть в ru, нет в en; en_only есть в en, нет в ru
  const hasRuWarning = warns.some(w => w.includes('ru_only'));
  const hasEnWarning = warns.some(w => w.includes('en_only'));
  assert(hasRuWarning, 'Warning для ru_only (есть в ru, нет в en)');
  assert(hasEnWarning, 'Warning для en_only (есть в en, нет в ru)');
}

// ─── фоллбэк на другой язык ──────────────────────────────────────────────
console.log('\n[фоллбэк]');
{
  const { l } = make('en', false);
  // ru_only есть только в ru словаре
  const result = l.t('ru_only');
  assertEqual(result, 'только русский', 'фоллбэк на ru когда ключ нет в en');
}

console.log(`\n${'='.repeat(40)}`);
if (failed === 0) {
  console.log(`✅ Все ${passed} тестов прошли`);
} else {
  console.log(`❌ Провалено: ${failed} / ${passed + failed}`);
  process.exit(1);
}
