# STATE — @abeestudio/ui

## Готово

- [x] Структура пакета (тик 1)
- [x] Система тем — 5 тем × dark/light (тик 2)
- [x] Базовые стили — src/base/base.css (тик 3)
- [x] Скелет витрины (тик 4, 2026-08-03)
  - `showcase/index.html` — 9 секций для всех групп элементов
  - `showcase/showcase.css` — адаптивный хедер с переключателями, секции-карточки
  - `showcase/showcase.js` — switchTheme, applyLang (mock L10n RU/EN), applyViewport
  - `tools/check-showcase.py` — обновлён: сервер из pkg root, URL `/showcase/`

## В работе

_пусто_

## Следующий шаг

**Фаза 2, пункт 1:** Кнопки — `src/components/Button.js` + секция в витрине:
варианты primary, secondary, danger, icon + все состояния (default, hover, active, disabled, loading).

## Сломано / блокеры

_нет_

## Проверено на живом Chromium (тик 4)

check-showcase.py прошёл чисто:
- 2 темы (abee-default, cosmic-dark) × 3 viewport (360/820/1440) — ОК
- Ноль ошибок в консоли
- Ноль горизонтальных переполнений
- Зоны нажатия ≥ 44px (все sc-btn)
- После переключения на EN — вёрстка не ломается

## Вес библиотеки (runtime)

`src/base/base.css`:     ~5 КБ  
`src/themes/*.css`:      ~17 КБ (5 тем)  
`src/themes/index.js`:   ~1 КБ  
`src/index.js`:          ~1 КБ  
**Итого:**               **~24 КБ**  
Витрина (dev-only):      showcase/ ~15 КБ  
Цель (без витрины):      < 150 КБ

## Среда исполнения

- npm → 403. Playwright — через PyPI.
- check-showcase.py: сервер из `packages/ui/`, URL `/showcase/`
