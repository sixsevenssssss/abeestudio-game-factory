#!/usr/bin/env node
/**
 * @abeestudio/tools — npm run check
 *
 * Использование:
 *   node tools/check.js [gameDir] [--only=id] [--json]
 *
 * Флаги:
 *   gameDir      Путь к игре (default: текущая директория)
 *   --only=id    Запустить только одну проверку по id
 *   --json       Вывод в JSON вместо читаемого текста
 */

import { runChecks, formatReport, exitCode } from './checks/runner.js';
import { parseArgs } from './serve.js';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { readdirSync } from 'node:fs';

// ─── Загрузка проверок из checks/ (автообнаружение) ──────────────────────────

/**
 * Динамически импортирует все файлы из checks/, кроме runner.js.
 * Файл экспортирует `default` — либо одну проверку `{ id, title, fn }`,
 * либо массив проверок (когда одна тема даёт несколько пунктов: L1–L4 и т.п.).
 */
async function loadChecks() {
  const checksDir = join(dirname(fileURLToPath(import.meta.url)), 'checks');
  let files;
  try {
    const NOT_CHECKS = new Set(['runner.js', 'util.js']);
    files = readdirSync(checksDir)
      .filter(f => f.endsWith('.js') && !NOT_CHECKS.has(f))
      .sort();  // детерминированный порядок
  } catch {
    return [];
  }

  const checks = [];
  for (const file of files) {
    try {
      const mod = await import(pathToFileURL(join(checksDir, file)).href);
      const exported = Array.isArray(mod.default) ? mod.default : [mod.default];
      for (const check of exported) {
        if (check && check.id && typeof check.fn === 'function') {
          checks.push(check);
        }
      }
    } catch (err) {
      // Если файл проверки не загрузился — не падаем, просто пропускаем.
      // Пропущенный файл не даёт зелёного: реестр станет меньше, а при пустом
      // реестре check вернёт код 2 («вердикт не выдан»).
      process.stderr.write(`⚠️  Не удалось загрузить ${file}: ${err.message}\n`);
    }
  }
  return checks;
}

// ─── Точка входа ─────────────────────────────────────────────────────────────

const __filename = fileURLToPath(import.meta.url);

if (process.argv[1] === __filename) {
  const args    = parseArgs(process.argv.slice(2));
  const gameDir = resolve(args._[0] ?? '.');
  const only    = typeof args.only === 'string' ? args.only : undefined;
  const asJson  = Boolean(args.json);

  const checks  = await loadChecks();
  const results = await runChecks(gameDir, checks, { only });

  if (asJson) {
    console.log(JSON.stringify(results, null, 2));
  } else {
    console.log(formatReport(results));
  }

  process.exit(exitCode(results));
}

// Экспорт для тестов и сторонних скриптов
export { loadChecks, runChecks, formatReport, exitCode };
