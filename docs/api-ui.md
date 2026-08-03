# API — Интерфейс (@abeestudio/ui)

Этот файл ведёт сессия «Интерфейс». Не редактировать другим сессиям.

---

## Подключение в index.html игры

```html
<!-- 1. Базовые стили (первыми, обязательно) -->
<link rel="stylesheet" href="ui/src/base/base.css">

<!-- 2. Тема игры -->
<link rel="stylesheet" href="ui/src/themes/abee-default.css">

<!-- 3. Точка входа игры -->
<script type="module" src="src/game/main.js"></script>
```

---

## src/base/base.css

Обязательный CSS, реализует требования Яндекс Игр:

- **Нет контекстного меню** — `-webkit-touch-callout: none`
- **Нет выделения текста** — `user-select: none` (разрешено в `input`/`textarea`)
- **Нет скролла страницы** — `html, body { overflow: hidden; overscroll-behavior: none }`
- **Нет pinch-zoom** — `html { touch-action: none }`
- **Быстрый отклик** — `touch-action: manipulation` на button/a/input
- **Зоны нажатия ≥ 44px** — `min-height/width: 44px` на нативных button/a
- **prefers-reduced-motion** — медиа-запрос + класс `.prefers-reduced-motion` на `<html>`
- **Безопасные зоны** — `.ui-safe-top/bottom/left/right/all`
- **Внутренний скролл** — `.ui-scroll`, `.ui-scroll-x` (не страница)
- **Утилиты** — `.ui-hidden`, `.ui-invisible`, `.ui-sr-only`

---

## Система тем (src/themes/)

```js
import { switchTheme, getCurrentTheme, AVAILABLE_THEMES } from '../ui/src/themes/index.js';

switchTheme('cosmic-dark');
switchTheme('abee-default', true); // true = светлый вариант
getCurrentTheme(); // → { name: 'abee-default', light: false }

document.addEventListener('ui:theme:change', e => {
  const { name, light } = e.detail;
});
```

Доступные темы: `abee-default`, `crystal-light`, `cosmic-dark`, `meadow-warm`, `steel-sharp`.  
Каждая: dark (умолчание) + light вариант.

Переопределение палитры игрой:
```html
<style>
  [class*="theme-"] { --ui-primary: #e23d7f; }
</style>
```

---

## Компоненты

_Разрабатываются (Фаза 2–5). Каждый появится здесь по завершении тика._

---

## Версия

`0.0.3` — базовые стили, 2026-08-03
