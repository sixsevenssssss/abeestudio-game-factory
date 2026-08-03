# LOG — @abeestudio/ui

## 2026-08-03 — Тик 3: базовые стили

**Пункт бэклога:** «Базовые стили: src/base/base.css»

**Что создано:**
`src/base/base.css` — единственный файл, подключается первым в index.html игры перед темой.

**Реализованные требования Яндекс Игр:**
- п. 1.6 — `user-select: none` на всём, `-webkit-touch-callout: none` (iOS контекстное меню),
  `overflow: hidden` + `overscroll-behavior: none` на html/body (запрет скролла страницы),
  `touch-action: none` на `<html>` (запрет pinch-zoom на странице)
- п. 1.6 — `touch-action: manipulation` на button/a/input/etc. (убирает задержку 300ms)
- Минимальные зоны нажатия: `min-height: 44px; min-width: 44px` на нативных button/a
- `-webkit-tap-highlight-color: transparent` — убирает синюю вспышку на Android
- `pointer-events: none` на img/canvas/svg (не перехватывают клики), с override `[data-interactive]`

**prefers-reduced-motion:**
Дублируем двумя путями: медиа-запрос (автоматически) + класс `.prefers-reduced-motion` на `<html>` (управляется из JS редьюсером, который будет в Фазе 7). Анимации сокращаются до 1ms, а не удаляются — плавные ≠ обязательные.

**Безопасные зоны:** классы `.ui-safe-top/bottom/left/right/all` для явного применения в компонентах (BottomSheet использует `ui-safe-bottom`).

**Внутренний скролл:** `.ui-scroll` и `.ui-scroll-x` — стандартные классы для прокручиваемых областей (без `scrollbar`-ов, с `overscroll-behavior: contain`).

**Решение — pointer-events на изображениях:**
По умолчанию `pointer-events: none` на img/canvas/svg — игра не должна кликаться «насквозь» через оверлеи. Если элемент должен принимать клики, добавляем `data-interactive`.

**Проверка:** check-showcase.py — код 0 (витрины ещё нет).

---

## 2026-08-03 — Тик 2: система тем

Создано 5 тем × dark/light: abee-default (янтарь), crystal-light (индиго), cosmic-dark (фиолет), meadow-warm (зелёный), steel-sharp (циан). `switchTheme()`, `getCurrentTheme()`, `AVAILABLE_THEMES`.

---

## 2026-08-03 — Тик 1: bootstrap

Структура пакета, PLAN.md (7 фаз), BACKLOG.md (35+ пунктов), tools/check-showcase.py (Playwright через PyPI — npm заблокирован 403).
