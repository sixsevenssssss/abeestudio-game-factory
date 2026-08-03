# API — @abeestudio/ui

Библиотека UI-элементов для браузерных игр abeeStudio.  
Чистые ES-модули, ноль внешних зависимостей в рантайме.

## Подключение в index.html игры

```html
<!-- 1. Базовые стили (обязательно первыми) -->
<link rel="stylesheet" href="ui/src/base/base.css">

<!-- 2. Тема (выбрать одну или несколько) -->
<link rel="stylesheet" href="ui/src/themes/abee-default.css">

<!-- 3. JS -->
<script type="module" src="src/game/main.js"></script>
```

---

## Базовые стили (src/base/base.css)

Подключается один раз. Реализует обязательные требования Яндекс Игр:

| Требование | Реализация |
|---|---|
| Нет контекстного меню (п. 1.6) | `-webkit-touch-callout: none` |
| Нет выделения текста (п. 1.6) | `user-select: none` (разрешено в `input`/`textarea`) |
| Нет скролла страницы (п. 1.6) | `overflow: hidden`, `overscroll-behavior: none` |
| Нет pinch-zoom страницы | `touch-action: none` на `<html>` |
| Без задержки 300ms | `touch-action: manipulation` на кнопках и ссылках |
| Зоны нажатия ≥ 44px | `min-height/width: 44px` на `button`, `a` |
| Без синей вспышки Android | `-webkit-tap-highlight-color: transparent` |
| prefers-reduced-motion | Медиа-запрос + класс `.prefers-reduced-motion` на `<html>` |

### Утилиты

```html
<!-- Безопасные зоны (iPhone notch) -->
<div class="ui-safe-bottom">...</div>
<div class="ui-safe-all">...</div>

<!-- Внутренний скролл (не страница!) -->
<div class="ui-scroll">длинный список</div>
<div class="ui-scroll-x">горизонтальная лента</div>

<!-- Утилиты отображения -->
<div class="ui-hidden">скрыт</div>
<div class="ui-invisible">невидим (место занимает)</div>
<span class="ui-sr-only">только для screen reader</span>

<!-- Интерактивный canvas/svg (pointer-events включены) -->
<canvas data-interactive></canvas>
```

---

## Система тем (src/themes/)

```html
<link rel="stylesheet" href="ui/src/themes/abee-default.css">
```

```js
import { switchTheme, getCurrentTheme, AVAILABLE_THEMES } from '../ui/src/themes/index.js';

switchTheme('abee-default');        // тёмный вариант
switchTheme('abee-default', true);  // светлый вариант
getCurrentTheme(); // → { name: 'abee-default', light: false }
```

| Тема | Характер | Акцент |
|---|---|---|
| `abee-default` | Фирменная, янтарь, glassmorphism | #f0a500 |
| `crystal-light` | Чистая, индиго, тени | #5c6bc0 |
| `cosmic-dark` | Космос, фиолет, глоу | #7c4dff |
| `meadow-warm` | Природа, зелёный, мягкий | #56a358 |
| `steel-sharp` | Технология, циан, острые углы | #00bcd4 |

CSS custom properties: ~45 переменных (`--ui-bg`, `--ui-primary`, `--ui-r-md`, `--ui-shadow-glow`, `--ui-spring`, …).  
Переопределение в игре: `[class*="theme-"] { --ui-primary: #e23d7f; }`

---

## Готовые компоненты

_Идёт разработка (Фаза 2–5). Каждый компонент появится здесь по завершении своего тика._

---

## Версия

`0.0.3` — базовые стили, 2026-08-03
