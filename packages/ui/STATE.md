# STATE — @abeestudio/ui

## Готово

- [x] Структура пакета (тик 1, 2026-08-03)
  - `package.json`, `src/index.js` (скелет)
  - `PLAN.md`, `BACKLOG.md`, `LOG.md`, `API.md`
  - `tools/check-showcase.py`

- [x] Система тем (тик 2, 2026-08-03)
  - `src/themes/index.js` — `switchTheme()`, `getCurrentTheme()`, `AVAILABLE_THEMES`
  - `src/themes/abee-default.css` — янтарь + тёмный синий
  - `src/themes/crystal-light.css` — индиго + белый
  - `src/themes/cosmic-dark.css` — фиолетовый + тёмный космос
  - `src/themes/meadow-warm.css` — зелёный + тёплые земляные тона
  - `src/themes/steel-sharp.css` — циан + тёмная сталь
  - Каждая тема: dark/light вариант, ~45 CSS custom properties

## В работе

_пусто_

## Следующий шаг

**Фаза 1, пункт 3:** Базовые стили — `src/base/base.css`:
запрет контекстного меню / выделения текста / скролла страницы,
`touch-action: manipulation`, `safe-area-inset`, `prefers-reduced-motion`

## Сломано / блокеры

_нет_

## Проверено

Тик 2 — витрины ещё нет, `check-showcase.py` вышел с кодом 0 (штатно).
Темы проверены линтером CSS, нет синтаксических ошибок.

## Вес библиотеки (runtime)

`src/index.js`:               ~1 КБ  
`src/themes/index.js`:        ~1 КБ  
`src/themes/abee-default.css`: ~3.5 КБ  
`src/themes/crystal-light.css`:~3.2 КБ  
`src/themes/cosmic-dark.css`:  ~3.4 КБ  
`src/themes/meadow-warm.css`:  ~3.3 КБ  
`src/themes/steel-sharp.css`:  ~3.4 КБ  
Итого тем: ~17 КБ (игра включает только нужные)  
Целевой бюджет: < 150 КБ

## Среда исполнения

- `registry.npmjs.org` → 403. npm/npx не работают.
- Playwright: `pip install playwright` + `python3 -m playwright install chromium`
- Проверка: `python3 -m http.server 8901 & python3 packages/ui/tools/check-showcase.py`
