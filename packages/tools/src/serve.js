#!/usr/bin/env node
/**
 * @abeestudio/tools — локальный dev-сервер
 *
 * Использование:
 *   node tools/serve.js [gameDir] [options]
 *
 * Флаги:
 *   --port N       Порт (default: 3000)
 *   --mobile       Viewport 390×844, максимальный масштаб 1
 *   --throttle N   Задержка ответа N мс (эмуляция медленной сети)
 *   --open         Открыть браузер автоматически
 *
 * Зависимости: только Node.js stdlib (http, fs, path, url, child_process)
 */

import http   from 'node:http';
import fs     from 'node:fs';
import fsp    from 'node:fs/promises';
import path   from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';

// ─── MIME-типы ────────────────────────────────────────────────────────────────

export const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.mjs':  'application/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif':  'image/gif',
  '.svg':  'image/svg+xml; charset=utf-8',
  '.webp': 'image/webp',
  '.mp3':  'audio/mpeg',
  '.ogg':  'audio/ogg',
  '.wav':  'audio/wav',
  '.ico':  'image/x-icon',
  '.woff': 'font/woff',
  '.woff2':'font/woff2',
};

// ─── Аргументы командной строки ───────────────────────────────────────────────

/**
 * Парсим argv вида: [gameDir] [--key value] [--flag]
 * Возвращает объект { _: [positional], key: value, flag: true }
 */
export function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const eq = a.indexOf('=');
      if (eq !== -1) {
        out[a.slice(2, eq)] = a.slice(eq + 1);
      } else if (argv[i + 1] && !argv[i + 1].startsWith('--')) {
        out[a.slice(2)] = argv[++i];
      } else {
        out[a.slice(2)] = true;
      }
    } else {
      out._.push(a);
    }
  }
  return out;
}

// ─── Инжект в HTML ────────────────────────────────────────────────────────────

const SSE_SCRIPT = `<script>
/* @abeestudio/tools dev-reload */
(function(){
  var es=new EventSource('/__sse__');
  es.addEventListener('reload',function(){location.reload();});
  es.onerror=function(){setTimeout(function(){location.reload();},2000);};
})();
</script>`;

const MOBILE_VIEWPORT = '<meta name="viewport" content="width=390,initial-scale=1,maximum-scale=1,user-scalable=no">';

/**
 * Вставляет SSE-скрипт перед </body>.
 * При mobile=true добавляет мобильный viewport перед </head>.
 * Экспортируется для юнит-тестов.
 */
export function injectIntoHtml(html, { mobile = false } = {}) {
  let result = html;

  if (mobile) {
    // Если уже есть viewport — не дублируем
    if (!result.includes('name="viewport"')) {
      result = result.replace(/<\/head>/i, MOBILE_VIEWPORT + '\n</head>');
      if (result === html) {
        // Нет </head> — добавляем в начало
        result = MOBILE_VIEWPORT + '\n' + result;
      }
    }
  }

  // SSE-скрипт перед </body>
  const injected = result.replace(/<\/body>/i, SSE_SCRIPT + '\n</body>');
  return injected !== result ? injected : result + '\n' + SSE_SCRIPT;
}

// ─── Сборка сервера ───────────────────────────────────────────────────────────

/**
 * Создаёт и возвращает http.Server + функцию закрытия.
 * Принимает конфиг вместо process.argv, чтобы тесты могли вызывать напрямую.
 */
export function createDevServer({ root, port = 3000, mobile = false, throttle = 0 }) {
  const sseClients = new Set();
  const ROOT = path.resolve(root);

  function notifyReload() {
    for (const res of sseClients) {
      try { res.write('event: reload\ndata: {}\n\n'); } catch { /* клиент отключился */ }
    }
  }

  const server = http.createServer(async (req, res) => {
    // ── SSE ──────────────────────────────────────────────────────────────────
    if (req.url === '/__sse__') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
      });
      res.write('retry: 2000\n\n');
      sseClients.add(res);
      req.on('close', () => sseClients.delete(res));
      return;
    }

    // ── Throttle ─────────────────────────────────────────────────────────────
    if (throttle > 0) await new Promise(r => setTimeout(r, throttle));

    // ── Resolve path ─────────────────────────────────────────────────────────
    let urlPath;
    try {
      urlPath = decodeURIComponent(req.url.split('?')[0]);
    } catch {
      res.writeHead(400); res.end('Bad Request'); return;
    }
    if (urlPath === '/') urlPath = '/index.html';

    const filePath = path.join(ROOT, urlPath);

    // Защита от path traversal
    const safeRoot = ROOT.endsWith(path.sep) ? ROOT : ROOT + path.sep;
    if (filePath !== ROOT && !filePath.startsWith(safeRoot)) {
      res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('403 Forbidden');
      return;
    }

    // ── Stat ──────────────────────────────────────────────────────────────────
    let stat;
    try { stat = await fsp.stat(filePath); }
    catch {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(`404 Not Found: ${urlPath}`);
      return;
    }

    // Директория без index.html
    if (stat.isDirectory()) {
      const idx = path.join(filePath, 'index.html');
      try { await fsp.stat(idx); }
      catch {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end(`404 Not Found: ${urlPath}`);
        return;
      }
      const loc = (urlPath.endsWith('/') ? urlPath : urlPath + '/') + 'index.html';
      res.writeHead(302, { Location: loc }); res.end(); return;
    }

    // ── Serve file ─────────────────────────────────────────────────────────────
    const ext  = path.extname(filePath).toLowerCase();
    const mime = MIME[ext] ?? 'application/octet-stream';

    if (ext === '.html') {
      try {
        const raw     = await fsp.readFile(filePath, 'utf-8');
        const content = injectIntoHtml(raw, { mobile });
        const buf     = Buffer.from(content, 'utf-8');
        res.writeHead(200, {
          'Content-Type': mime,
          'Content-Length': buf.byteLength,
          'Cache-Control': 'no-store',
        });
        res.end(buf);
      } catch { res.writeHead(500); res.end('Internal Server Error'); }
    } else {
      res.writeHead(200, {
        'Content-Type': mime,
        'Content-Length': stat.size,
        'Cache-Control': 'no-store',
      });
      fs.createReadStream(filePath).pipe(res);
    }
  });

  return { server, notifyReload };
}

// ─── Запуск (только когда запускают напрямую) ─────────────────────────────────

const __filename = fileURLToPath(import.meta.url);
if (process.argv[1] === __filename) {
  const args     = parseArgs(process.argv.slice(2));
  const root     = args._[0] ?? '.';
  const port     = parseInt(args.port     ?? '3000', 10);
  const throttle = parseInt(args.throttle ?? '0',    10);
  const mobile   = Boolean(args.mobile);
  const open     = Boolean(args.open);

  const ROOT = path.resolve(root);
  const { server, notifyReload } = createDevServer({ root: ROOT, port, mobile, throttle });

  // Следим за файлами
  const watchers = [];
  try {
    const w = fs.watch(ROOT, { recursive: true }, (_evt, filename) => {
      if (!filename) return;
      if (filename.includes('node_modules') || filename.includes('.git')) return;
      notifyReload();
    });
    watchers.push(w);
  } catch {
    // Linux fallback — Puppeteer/CI: polling каждые 2с
    watchers.push(setInterval(notifyReload, 2000));
  }

  server.listen(port, '127.0.0.1', () => {
    const url = `http://localhost:${port}`;
    console.log(`\n🎮 abeeStudio dev-сервер запущен`);
    console.log(`   → ${url}`);
    if (mobile)   console.log(`   → мобильный viewport 390×844`);
    if (throttle) console.log(`   → throttle ${throttle}мс`);
    console.log(`   → авто-перезагрузка (SSE)`);
    console.log(`   Ctrl+C для остановки\n`);

    if (open) {
      const cmd = process.platform === 'darwin' ? 'open'
                : process.platform === 'win32'  ? 'start'
                : 'xdg-open';
      execFile(cmd, [url], () => {});
    }
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`❌ Порт ${port} занят. Используй --port N`);
      process.exit(1);
    }
    console.error('Ошибка сервера:', err.message);
    process.exit(1);
  });

  process.on('SIGINT', () => {
    watchers.forEach(w => typeof w.close === 'function' ? w.close() : clearInterval(w));
    server.close(() => process.exit(0));
  });
}
