/**
 * Тесты для src/serve.js
 * Запуск: node --test test/serve.test.js
 *        (из директории packages/tools)
 */

import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import { spawn }  from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

import { parseArgs, MIME, injectIntoHtml } from '../src/serve.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SERVE_JS  = join(__dirname, '../src/serve.js');
const PORT      = 13742;  // нестандартный порт чтобы не конфликтовать

// ─── Тест-фикстура ────────────────────────────────────────────────────────────

const FIXTURE_DIR = join(tmpdir(), `abee-serve-test-${Date.now()}`);

let serverProcess;

function startServer(extraArgs = []) {
  return new Promise((resolve, reject) => {
    const proc = spawn(
      process.execPath,
      [SERVE_JS, FIXTURE_DIR, '--port', String(PORT), ...extraArgs],
      { stdio: ['ignore', 'pipe', 'pipe'] }
    );
    let ready = false;
    proc.stdout.on('data', (d) => {
      if (!ready && d.toString().includes('запущен')) {
        ready = true;
        resolve(proc);
      }
    });
    proc.stderr.on('data', (d) => {
      if (!ready) reject(new Error('stderr: ' + d.toString()));
    });
    proc.on('error', reject);
    setTimeout(() => { if (!ready) reject(new Error('Сервер не запустился за 5с')); }, 5000);
  });
}

async function get(urlPath) {
  return fetch(`http://127.0.0.1:${PORT}${urlPath}`);
}

before(async () => {
  mkdirSync(join(FIXTURE_DIR, 'assets'), { recursive: true });
  writeFileSync(join(FIXTURE_DIR, 'index.html'),
    '<html><head></head><body><h1>Тест</h1></body></html>');
  writeFileSync(join(FIXTURE_DIR, 'app.js'),
    '// game script\nconsole.log("hello");');
  writeFileSync(join(FIXTURE_DIR, 'style.css'),
    'body { margin: 0; }');
  writeFileSync(join(FIXTURE_DIR, 'assets', 'sprite.png'),
    'FAKE_PNG_DATA');  // не настоящий PNG, но Content-Type нас интересует

  serverProcess = await startServer();
});

after(() => {
  serverProcess?.kill('SIGTERM');
  rmSync(FIXTURE_DIR, { recursive: true, force: true });
});

// ─── Юнит-тесты (без сервера) ─────────────────────────────────────────────────

describe('parseArgs', () => {
  test('позиционный аргумент попадает в _', () => {
    const r = parseArgs(['/path/to/game']);
    assert.deepEqual(r._, ['/path/to/game']);
  });

  test('--port 8080 парсится как строка', () => {
    const r = parseArgs(['--port', '8080']);
    assert.equal(r.port, '8080');
  });

  test('--port=8080 через = тоже работает', () => {
    const r = parseArgs(['--port=8080']);
    assert.equal(r.port, '8080');
  });

  test('--mobile без значения становится true', () => {
    const r = parseArgs(['--mobile']);
    assert.equal(r.mobile, true);
  });

  test('несколько флагов одновременно', () => {
    const r = parseArgs(['/game', '--port', '4000', '--mobile', '--throttle', '200']);
    assert.deepEqual(r._, ['/game']);
    assert.equal(r.port, '4000');
    assert.equal(r.mobile, true);
    assert.equal(r.throttle, '200');
  });
});

describe('MIME', () => {
  test('.html → text/html', () => {
    assert.ok(MIME['.html'].startsWith('text/html'));
  });
  test('.js → application/javascript', () => {
    assert.ok(MIME['.js'].includes('javascript'));
  });
  test('.css → text/css', () => {
    assert.ok(MIME['.css'].startsWith('text/css'));
  });
  test('.png → image/png', () => {
    assert.equal(MIME['.png'], 'image/png');
  });
  test('.json → application/json', () => {
    assert.ok(MIME['.json'].startsWith('application/json'));
  });
  test('.mp3 → audio/mpeg', () => {
    assert.equal(MIME['.mp3'], 'audio/mpeg');
  });
});

describe('injectIntoHtml', () => {
  test('вставляет SSE-скрипт перед </body>', () => {
    const html = '<html><body><p>Привет</p></body></html>';
    const result = injectIntoHtml(html);
    assert.ok(result.includes('__sse__'), 'должен содержать /__sse__');
    assert.ok(result.indexOf('__sse__') < result.indexOf('</body>') ||
              !result.includes('</body>'),
              'SSE-скрипт должен быть до </body>');
  });

  test('не вставляет viewport без флага mobile', () => {
    const html = '<html><head></head><body></body></html>';
    const result = injectIntoHtml(html, { mobile: false });
    assert.ok(!result.includes('viewport'), 'viewport не должен быть вставлен');
  });

  test('вставляет viewport при mobile:true', () => {
    const html = '<html><head></head><body></body></html>';
    const result = injectIntoHtml(html, { mobile: true });
    assert.ok(result.includes('viewport'), 'viewport должен быть вставлен');
    assert.ok(result.includes('width=390'), 'ширина 390');
  });

  test('не дублирует viewport если он уже есть', () => {
    const html = '<html><head><meta name="viewport" content="width=device-width"></head><body></body></html>';
    const result = injectIntoHtml(html, { mobile: true });
    const count = (result.match(/name="viewport"/g) ?? []).length;
    assert.equal(count, 1, 'viewport должен встречаться ровно один раз');
  });

  test('работает без </body> — добавляет скрипт в конец', () => {
    const html = '<html><body><p>Игра</p>';
    const result = injectIntoHtml(html);
    assert.ok(result.includes('__sse__'), 'SSE-скрипт должен быть добавлен');
  });
});

// ─── Интеграционные тесты (с живым сервером) ──────────────────────────────────

describe('сервер', () => {
  test('отдаёт index.html → 200 text/html', async () => {
    const res = await get('/');
    assert.equal(res.status, 200);
    assert.ok(res.headers.get('content-type').startsWith('text/html'),
      `Content-Type: ${res.headers.get('content-type')}`);
    const body = await res.text();
    assert.ok(body.includes('<h1>Тест</h1>'));
  });

  test('вставляет SSE-скрипт в HTML', async () => {
    const res = await get('/');
    const body = await res.text();
    assert.ok(body.includes('__sse__'), 'SSE-скрипт должен быть в ответе HTML');
  });

  test('отдаёт .js → 200 application/javascript', async () => {
    const res = await get('/app.js');
    assert.equal(res.status, 200);
    const ct = res.headers.get('content-type');
    assert.ok(ct.includes('javascript'), `Content-Type: ${ct}`);
    await res.body?.cancel();
  });

  test('отдаёт .css → 200 text/css', async () => {
    const res = await get('/style.css');
    assert.equal(res.status, 200);
    const ct = res.headers.get('content-type');
    assert.ok(ct.includes('css'), `Content-Type: ${ct}`);
    await res.body?.cancel();
  });

  test('отдаёт .png → 200 image/png', async () => {
    const res = await get('/assets/sprite.png');
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('content-type'), 'image/png');
    await res.body?.cancel();
  });

  test('404 для несуществующего файла', async () => {
    const res = await get('/nonexistent-xyz-' + Date.now() + '.js');
    assert.equal(res.status, 404);
    await res.body?.cancel();
  });

  test('SSE endpoint → 200 text/event-stream', async () => {
    const ac = new AbortController();
    setTimeout(() => ac.abort(), 500);
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/__sse__`, {
        signal: ac.signal,
      });
      assert.equal(res.status, 200);
      const ct = res.headers.get('content-type');
      assert.ok(ct.includes('event-stream'), `Content-Type: ${ct}`);
      await res.body?.cancel();
    } catch (e) {
      // AbortError — соединение SSE удержалось и было прервано нами → это ок
      if (e.name !== 'AbortError') throw e;
    }
  });

  test('403 или 404 при path traversal', async () => {
    // URL-encoded path traversal
    const res = await get('/..%2F..%2Fetc%2Fpasswd');
    assert.ok(
      res.status === 403 || res.status === 404,
      `Ожидался 403/404, получен ${res.status}`
    );
    await res.body?.cancel();
  });
});
