# STATE — @abeestudio/ui

## Готово

- [x] Структура пакета (первый тик 2026-08-03)
  - `package.json`, `src/index.js` (скелет)
  - `PLAN.md`, `BACKLOG.md`, `LOG.md`, `API.md`
  - `tools/check-showcase.py` (Playwright через PyPI — npm заблокирован)

## В работе

_пусто_

## Следующий шаг

**Фаза 1, пункт 2:** Система тем — `src/themes/index.js` + 5 CSS-файлов тем × light/dark, `switchTheme()`, `getCurrentTheme()`

## Сломано / блокеры

_нет_

## Проверено

Первый тик — витрина ещё не создана. `check-showcase.py` отработал с кодом 0 (штатно: нет showcase/index.html).

## Вес библиотеки (runtime)

`src/index.js`: ~1 КБ  
Темы: не созданы  
Целевой бюджет пустого проекта: < 150 КБ

## Среда исполнения (зафиксировано 2026-08-03)

- `registry.npmjs.org` — 403 в этой песочнице. `npm install` / `npx` не работают.
- PyPI и `cdn.playwright.dev` доступны.
- Chromium: `pip install playwright && python3 -m playwright install chromium` (~113 МБ в `~/.cache/ms-playwright`).
- Рабочий путь проверки витрины: `python3 -m http.server 8901 & python3 packages/ui/tools/check-showcase.py`
