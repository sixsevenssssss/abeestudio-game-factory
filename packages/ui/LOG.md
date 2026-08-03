# LOG — @abeestudio/ui

## 2026-08-03 — Тик 4: скелет витрины

**Пункт бэклога:** «Скелет витрины: showcase/index.html + showcase.js»

**Что создано:**
- `showcase/index.html` — 9 секций (Кнопки, Формы, Вкладки, Панели, Оверлеи, Уведомления, Прогресс, Игровые элементы, Эффекты). Все переключатели с data-атрибутами. Подключает все 5 тем и base.css через относительные пути.
- `showcase/showcase.css` — стили витрины: адаптивный хедер с flex-wrap (работает на 360px без overflow), секции-карточки через CSS custom properties тем.
- `showcase/showcase.js` — логика: `applyTheme()`, `applyLang()` с mock I18N (RU/EN), `applyViewport()`. Делегированный обработчик кликов.
- `tools/check-showcase.py` — исправлен критический баг: раньше HTTP-сервер поднимался из `showcase/`, поэтому пути `../src/base/base.css` не работали. Теперь сервер из `packages/ui/` (pkg root), витрина доступна по `/showcase/`.

**Решение — mock L10n:**
EN-строки намеренно длиннее RU (требование студии). Самая длинная секция в EN: «reward cards, chest reveal, daily rewards streak, achievement badge, leaderboard, shop, no-coins dialog» — в кнопках управления вместо «Тёмная/Светлая» идут «Dark/Light» (короче, OK).

**Решение — overflow на 360px:**
`flex-wrap: wrap` на `.sc-controls` и `.sc-row`. Каждая группа переключателей переносится на новую строку. `overflow: hidden` на `.sc-header` — страховка. Проверено Playwright — ноль overflow на 360px.

**Проверка:** check-showcase.py — код 0. 2 темы × 3 viewport, ноль ошибок консоли, ноль overflow, все зоны нажатия ≥ 44px, EN не ломает вёрстку.

---

## 2026-08-03 — Тик 3: базовые стили

`src/base/base.css` — п. 1.6 Яндекс Игр: запрет меню/выделения/скролла/pinch-zoom, safe-area, reduced-motion, зоны ≥ 44px.

---

## 2026-08-03 — Тик 2: система тем

5 тем × dark/light. `switchTheme()`, `getCurrentTheme()`. CSS custom properties.

---

## 2026-08-03 — Тик 1: bootstrap

Структура пакета, PLAN.md (7 фаз), BACKLOG.md (35+ пунктов), tools/check-showcase.py.
