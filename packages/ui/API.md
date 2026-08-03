# API — @abeestudio/ui

Библиотека UI-элементов для браузерных игр abeeStudio.  
Чистые ES-модули, ноль внешних зависимостей в рантайме.

## Подключение

```js
// Весь пакет:
import { UI } from '../ui/index.js';

// Или отдельные части напрямую (рекомендуется для контроля веса):
import { switchTheme } from '../ui/src/themes/index.js';
import { Button }      from '../ui/src/components/Button.js'; // появится позже
```

---

## Система тем

Подключи CSS нужных тем в `index.html` игры:
```html
<link rel="stylesheet" href="ui/src/themes/abee-default.css">
<!-- или любую другую / несколько -->
```

### switchTheme(name, light?)

```js
import { switchTheme, getCurrentTheme, AVAILABLE_THEMES } from '../ui/src/themes/index.js';

switchTheme('abee-default');        // тёмный вариант (умолчание)
switchTheme('abee-default', true);  // светлый вариант
switchTheme('cosmic-dark');
switchTheme('crystal-light', true); // светлый вариант crystal-light

getCurrentTheme(); // → { name: 'cosmic-dark', light: false }

console.log(AVAILABLE_THEMES);
// ['abee-default', 'crystal-light', 'cosmic-dark', 'meadow-warm', 'steel-sharp']
```

Смена темы мгновенна — меняет классы на `<html>` без перезагрузки.  
Событие `ui:theme:change` на `document`: `{ detail: { name, light } }`.

### Доступные темы

| Имя | Характер | Акцент (dark/light) |
|---|---|---|
| `abee-default`  | Фирменная тёмная, пружинная | #f0a500 / #d08800 |
| `crystal-light` | Чистая светлая, плавная    | #5c6bc0 / #7986cb |
| `cosmic-dark`   | Космическая, с глоу        | #7c4dff / #651fff |
| `meadow-warm`   | Природная, органичная      | #56a358 / #388e3c |
| `steel-sharp`   | Технологичная, острая      | #00bcd4 / #0097a7 |

### CSS custom properties (полный список)

Каждая тема задаёт ~45 переменных. Игра переопределяет нужные через `<style>`:

```css
/* Переопределение в index.html игры: */
:root, [class*="theme-"] {
  --ui-primary: #e23d7f;  /* свой акцент поверх любой темы */
}
```

Основные группы:
- Фон: `--ui-bg`, `--ui-bg-2`
- Поверхности: `--ui-surface`, `--ui-surface-2`, `--ui-surface-3`
- Рамки: `--ui-border`, `--ui-border-2`
- Текст: `--ui-text`, `--ui-text-2`, `--ui-text-3`, `--ui-text-inv`
- Акцент: `--ui-primary`, `--ui-primary-hover`, `--ui-primary-active`, `--ui-primary-surface`, `--ui-primary-text`
- Вторичный: `--ui-secondary`, `--ui-secondary-hover`, `--ui-secondary-active`, `--ui-secondary-text`
- Состояния: `--ui-danger/*`, `--ui-success/*`, `--ui-warn/*`, `--ui-info/*`
- Оверлей: `--ui-overlay`
- Радиусы: `--ui-r-xs/sm/md/lg/xl/pill`
- Тени: `--ui-shadow-sm/md/lg`, `--ui-shadow-glow`
- Шрифт: `--ui-font`, `--ui-fs-xs/sm/md/lg/xl`, `--ui-fw-n/m/b`, `--ui-lh`
- Анимации: `--ui-dur`, `--ui-dur-s`, `--ui-ease`, `--ui-spring`, `--ui-snap`

---

## Готовые элементы

_Идёт разработка. Элементы появятся здесь по завершении тиков Фазы 2–5._

---

## Версия

`0.0.2` — система тем, 2026-08-03
