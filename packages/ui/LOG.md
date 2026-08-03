# LOG — @abeestudio/ui

## 2026-08-03 — Тик 5: Button.js

**Пункт бэклога:** «Кнопки: Button.js — варианты primary, secondary, danger, icon + витрина»

**Что создано:**

- `src/components/Button.js` — функция `Button(opts)`, возвращает `HTMLButtonElement`. Автоматически подключает `Button.css` через `_loadStyles()` (инжектирует `<link>` при первом вызове). Варианты: primary, secondary, danger, icon. Состояния: default, disabled, loading. Событие `ui:button:click` на document. `updateButton(btn, changes)` для обновления без перерендеринга.
- `src/components/Button.css` — все стили через CSS custom properties тем. Hover/active/disabled/loading. Спиннер `@keyframes ui-btn-spin`. Кольцо фокуса `:focus-visible`.
- `src/ui-object.js` — объект `UI` со всеми экспортами для удобного `import { UI } from '../ui/index.js'`.
- `src/index.js` — обновлён: экспортирует `Button`, `updateButton`, `switchTheme`, `getCurrentTheme`, `AVAILABLE_THEMES`, `UI`.
- `showcase/showcase.js` — добавлен импорт Button, функция `initButtons()` (4×3 матрица: 4 варианта × 3 состояния).
- `showcase/showcase.css` — добавлены стили для демо-группировки (`.sc-demo-group`, `.sc-demo-row`, `.sc-demo-variant`).

**Найденный и исправленный баг:**

При loading у `ui-btn--icon`: иконка (20px) + gap (8px) + спиннер (18px) = 46px ≥ inner width (46px), что давало 3px overflow в scrollWidth. Исправлено: `.ui-btn--icon.ui-btn--loading .ui-btn__icon { display: none }` — в loading скрываем иконку, показываем только спиннер (18px << 46px).

---

## 2026-08-03 — Тик 4: скелет витрины

showcase/index.html + showcase.js + showcase.css. Исправлен HTTP-сервер (из pkg root). Playwright прошёл.

---

## 2026-08-03 — Тик 3: базовые стили

src/base/base.css — п. 1.6 Яндекс Игр.

---

## 2026-08-03 — Тик 2: система тем

5 тем × dark/light. switchTheme().

---

## 2026-08-03 — Тик 1: bootstrap

Структура пакета, PLAN.md, BACKLOG.md, check-showcase.py.
