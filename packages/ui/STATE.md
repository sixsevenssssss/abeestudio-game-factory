# STATE — @abeestudio/ui

## Готово

- [x] Структура пакета (тик 1, 2026-08-03)
  - `package.json`, `src/index.js` (скелет)
  - `PLAN.md`, `BACKLOG.md`, `LOG.md`, `API.md`
  - `tools/check-showcase.py`

- [x] Система тем (тик 2, 2026-08-03)
  - `src/themes/index.js` — `switchTheme()`, `getCurrentTheme()`, `AVAILABLE_THEMES`
  - 5 CSS-файлов: abee-default, crystal-light, cosmic-dark, meadow-warm, steel-sharp
  - Каждая тема: dark/light вариант, ~45 CSS custom properties

- [x] Базовые стили (тик 3, 2026-08-03)
  - `src/base/base.css` — обязательные требования Яндекс Игр п. 1.6:
    запрет контекстного меню (`-webkit-touch-callout: none`),
    запрет выделения текста (`user-select: none`),
    запрет скролла страницы (`overflow: hidden`, `overscroll-behavior: none`),
    `touch-action: manipulation` для интерактивных элементов,
    `touch-action: none` на `<html>` (запрет pinch-zoom),
    безопасные зоны (`env(safe-area-inset-*)`),
    `prefers-reduced-motion` (медиа-запрос + CSS-класс `.prefers-reduced-motion`),
    минимальные зоны нажатия `min-height/width: 44px`,
    утилиты `.ui-scroll`, `.ui-scroll-x`, `.ui-hidden`, `.ui-sr-only`

## В работе

_пусто_

## Следующий шаг

**Фаза 1, пункт 4:** Скелет витрины — `showcase/index.html` + `showcase.js`:
переключатели темы / языка (mock L10n) / viewport, пустые секции под все элементы.
После этого тика check-showcase.py начнёт реально проверять витрину.

## Сломано / блокеры

_нет_

## Проверено

Тик 3 — витрины ещё нет, `check-showcase.py` вышел с кодом 0 (штатно).
`base.css` проверен вручную: нет синтаксических ошибок.

## Вес библиотеки (runtime)

`src/base/base.css`:    ~5.0 КБ (минимально необходимый CSS)
`src/themes/*.css`:     ~17 КБ (5 тем, игра берёт только нужные)
`src/themes/index.js`:  ~1 КБ
`src/index.js`:         ~1 КБ
Итого сейчас:          ~24 КБ
Целевой бюджет:        < 150 КБ

## Среда исполнения

- `registry.npmjs.org` → 403. npm/npx не работают.
- Playwright: `pip install playwright` + `python3 -m playwright install chromium`
