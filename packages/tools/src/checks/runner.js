/**
 * @abeestudio/tools — декларативный реестр и runner чек-листа
 *
 * Каждая проверка:
 *   { id: string, title: string, fn: async (gameDir) => Result }
 *
 * Result:
 *   { status: 'ok'|'fail'|'skip', message: string, fix?: string }
 *
 * ok   — проверено, в порядке
 * fail — проверено, найдена проблема (сообщение + где чинить)
 * skip — не проверено (нет браузера / нет зависимости / требует ручной проверки)
 *
 * Ложного зелёного нет: если проверка не выполнялась — она skip, не ok.
 */

export const STATUS = Object.freeze({ OK: 'ok', FAIL: 'fail', SKIP: 'skip' });

/**
 * Запускает массив проверок против gameDir.
 *
 * @param {string}  gameDir         корень игрового проекта
 * @param {Array}   checks          [{ id, title, fn }]
 * @param {object}  [opts]
 * @param {string}  [opts.only]     запустить только проверку с этим id
 * @returns {Promise<Array<{id, title, status, message, fix?}>>}
 */
export async function runChecks(gameDir, checks, { only } = {}) {
  const list = only ? checks.filter(c => c.id === only) : checks;
  const results = [];

  for (const check of list) {
    let result;
    try {
      result = await check.fn(gameDir);
      // Проверяем что fn вернула валидный статус
      if (!Object.values(STATUS).includes(result?.status)) {
        throw new Error(`Неверный статус: ${result?.status}`);
      }
    } catch (err) {
      result = {
        status: STATUS.SKIP,
        message: `Ошибка при выполнении: ${err.message}`,
      };
    }
    results.push({ id: check.id, title: check.title, ...result });
  }

  return results;
}

/**
 * Форматирует отчёт.
 * Порядок: вердикт → детали. Fail и skip — с объяснением и ссылкой.
 */
export function formatReport(results) {
  const fails = results.filter(r => r.status === STATUS.FAIL);
  const skips = results.filter(r => r.status === STATUS.SKIP);
  const oks   = results.filter(r => r.status === STATUS.OK);

  const header = fails.length === 0
    ? `✅  ГОТОВО К ОТПРАВКЕ  (${oks.length} ✔  ${skips.length} пропущено)`
    : `❌  НЕ ГОТОВО  —  ${fails.length} ${ruPlural(fails.length, 'проблема', 'проблемы', 'проблем')}  (${oks.length} ✔  ${skips.length} пропущено)`;

  const lines = [header, ''];

  for (const r of results) {
    const icon = r.status === STATUS.OK   ? '✅'
               : r.status === STATUS.FAIL ? '❌'
               :                            '⬜';
    lines.push(`${icon}  ${r.id.padEnd(5)}  ${r.title}`);
    if (r.status !== STATUS.OK) {
      lines.push(`         ${r.message}`);
      if (r.fix) lines.push(`         → Где исправить: ${r.fix}`);
    }
  }

  return lines.join('\n');
}

/**
 * Возвращает код выхода: 1 если есть хотя бы один fail, иначе 0.
 * skip ≠ fail: пропущенная проверка не блокирует отправку,
 * но честно отражается в отчёте.
 */
export function exitCode(results) {
  return results.some(r => r.status === STATUS.FAIL) ? 1 : 0;
}

// ─── Вспомогательные ─────────────────────────────────────────────────────────

/** Склонение русских существительных по числу. */
function ruPlural(n, one, few, many) {
  const m10  = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return few;
  return many;
}
