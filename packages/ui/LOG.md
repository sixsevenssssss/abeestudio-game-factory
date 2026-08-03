# LOG — @abeestudio/ui

## 2026-08-03 — Тик 6: варианты price + ad

**Пункт бэклога:** «Кнопки: price и ad-reward + витрина»

**Что изменено:**

- `src/components/Button.js` — добавлен параметр `price` (строка для отображения в бейдже). `ad`-вариант использует иконку по умолчанию (`_AD_ICON_DEFAULT` — SVG треугольника воспроизведения), которую можно переопределить через `icon`. `updateButton` теперь поддерживает обновление `price`.
- `src/components/Button.css` — добавлены два варианта:
  - `.ui-btn--price`: `justify-content: space-between`, `min-width: 120px`, стиль бейджа `.ui-btn__price` (фон primary, контрастный текст).
  - `.ui-btn--ad`: мягкая пульсирующая анимация `ui-btn-ad-pulse` (box-shadow ← → primary-surface), пауза при hover, отключается при `prefers-reduced-motion` и `.prefers-reduced-motion`.
- `showcase/showcase.js` — рефакторинг: единая фабрика `_demoGroup(variant, labelKey, opts)`, 6 вариантов в секции «Кнопки».

**Яндекс Игры п. 1.16:** `ad`-кнопка инициирует НАСТОЯЩУЮ рекламу через `Ads.rewarded()` — это разрешено. Пульсация привлекает внимание, но не провоцирует случайный клик. В витрине используется демо без реальной рекламы.

**Проверка:** check-showcase.py — код 0. 2 темы × 3 viewport × RU+EN.

---

## 2026-08-03 — Тик 5: Button.js (primary/secondary/danger/icon)

Первый реальный компонент. Исправлен icon+loading overflow (3px).

---

## 2026-08-03 — Тик 4: скелет витрины

showcase/index.html + showcase.js + showcase.css. Исправлен HTTP-сервер.

---

## 2026-08-03 — Тик 3: базовые стили

src/base/base.css — п. 1.6 Яндекс Игр.

---

## 2026-08-03 — Тик 2: система тем

5 тем × dark/light. switchTheme().

---

## 2026-08-03 — Тик 1: bootstrap

Структура пакета, PLAN.md, BACKLOG.md, tools/check-showcase.py.
