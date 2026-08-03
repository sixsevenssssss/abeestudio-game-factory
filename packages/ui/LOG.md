# LOG — @abeestudio/ui

## 2026-08-03 — Тик 2: система тем

**Пункт бэклога:** «Система тем: src/themes/index.js + 5 CSS-файлов тем × light/dark, switchTheme(), getCurrentTheme()»

**Что создано:**
- `src/themes/index.js` — JS-модуль: `switchTheme(name, light?)`, `getCurrentTheme()`, `AVAILABLE_THEMES`
- `src/themes/abee-default.css` — фирменная тема: янтарный акцент (#f0a500), тёмно-синий фон (#1a1a2e), glassmorphism-поверхности, пружинные анимации, большие радиусы (14/22px)
- `src/themes/crystal-light.css` — чистая: индиго (#5c6bc0), белый фон (#f8f9fc), мягкие многослойные тени, умеренные радиусы (10/16px)
- `src/themes/cosmic-dark.css` — космическая: фиолетовый (#7c4dff), почти чёрный фон (#0d0d1a), двойной глоу, sci-fi радиусы (12/20px)
- `src/themes/meadow-warm.css` — природная: лесной зелёный (#56a358), тёмный лес (#0e1a10), тёплые тени, органичные большие радиусы (16/24px)
- `src/themes/steel-sharp.css` — технологичная: циан (#00bcd4), тёмная сталь (#0f1923), монопространственный шрифт, острые радиусы (4/7px), быстрые анимации (120ms)

**Архитектурное решение — switchTheme:**
Всегда добавляет явный `.dark` или `.light` класс на `<html>`, не полагается на `prefers-color-scheme`.
Причина: игры имеют конкретную визуальную идентичность, auto-режим — дело игры (она может проверить медиа-запрос и вызвать `switchTheme(name, true/false)` сама).
Событие `ui:theme:change` позволяет игре реагировать на смену темы.

**Архитектурное решение — CSS custom properties:**
Все токены — на классе темы (`.theme-X`), не на `:root`. Это позволяет:
- иметь несколько тем одновременно на разных DOM-поддеревьях (e.g. витрина)
- избежать конфликтов с CSS игры

**Переменные в каждой теме (~45 штук):**
`--ui-bg`, `--ui-bg-2`, `--ui-surface/*`, `--ui-border/*`, `--ui-text/*`, `--ui-primary/*`, `--ui-secondary/*`, `--ui-danger/success/warn/info/*`, `--ui-overlay`, `--ui-r-*`, `--ui-shadow-*`, `--ui-font`, `--ui-fs-*`, `--ui-fw-*`, `--ui-lh`, `--ui-dur/*`, `--ui-ease`, `--ui-spring`, `--ui-snap`

**Проверка:** check-showcase.py — код 0 (витрина ещё не создана).

---

## 2026-08-03 — Тик 1: bootstrap

**Пункт бэклога:** первый тик — структура пакета

**Что создано:**
- `package.json` — `@abeestudio/ui` v0.0.1, ES modules
- `src/index.js` — точка входа с закомментированными экспортами
- `PLAN.md` — 7 фаз, 35+ позиций, принципы реализации
- `BACKLOG.md`, `STATE.md`, `LOG.md`, `API.md`
- `tools/check-showcase.py` — Playwright-проверяльщик

**Решение — среда:**
`registry.npmjs.org` → 403. `npx` не работает. Playwright через PyPI. Проверено.
