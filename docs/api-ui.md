# API — Интерфейс (@abeestudio/ui)

Этот файл ведёт сессия «Интерфейс». Не редактировать другим сессиям.

---

## Подключение

```js
import { UI }          from '../ui/index.js';
import { switchTheme } from '../ui/src/themes/index.js';
import { Button }      from '../ui/src/components/Button.js'; // (появится в Фазе 2)
```

---

## Система тем

### HTML

```html
<!-- В index.html игры — подключить нужные темы: -->
<link rel="stylesheet" href="ui/src/themes/abee-default.css">
```

### JS

```js
import { switchTheme, getCurrentTheme, AVAILABLE_THEMES } from '../ui/src/themes/index.js';

// Переключить тему (мгновенно, без перезагрузки):
switchTheme('abee-default');        // тёмный вариант
switchTheme('abee-default', true);  // светлый вариант

// Получить текущую:
getCurrentTheme(); // → { name: 'abee-default', light: false }

// Слушать смену темы (из игровой логики):
document.addEventListener('ui:theme:change', e => {
  console.log(e.detail); // { name, light }
});
```

### Темы

| Класс на html | Характер |
|---|---|
| `theme-abee-default` + `.dark/.light` | Фирменная, янтарь |
| `theme-crystal-light` + `.dark/.light` | Чистая, индиго |
| `theme-cosmic-dark` + `.dark/.light` | Космос, фиолет |
| `theme-meadow-warm` + `.dark/.light` | Природа, зелёный |
| `theme-steel-sharp` + `.dark/.light` | Технология, циан |

### Переопределение палитры игрой

```html
<style>
  /* В index.html игры — переопределить любой токен: */
  :root, [class*="theme-"] {
    --ui-primary:       #e23d7f;
    --ui-primary-hover: #f04d8d;
    --ui-primary-text:  #ffffff;
  }
</style>
```

---

## Элементы

_Идёт разработка (Фаза 2). Каждый элемент появится здесь по завершении своего тика._

### Формат записи (для справки)

```js
// Button — кнопка
// Параметры:
//   label    {string}    — переведённая строка (через L10n.t('ключ'))
//   variant  {string}    — 'primary'|'secondary'|'danger'|'icon'|'price'|'ad'
//   disabled {boolean}   — по умолчанию false
//   loading  {boolean}   — показывает спиннер, по умолчанию false
//   onClick  {function}  — коллбэк нажатия
//   price    {string}    — только для variant='price'
//   icon     {string}    — SVG-строка (для icon и ad)
// Возвращает: HTMLButtonElement
//
// Пример:
const btn = Button({ label: L10n.t('ui.start'), variant: 'primary', onClick: startGame });
document.querySelector('#menu').appendChild(btn);
```

---

## Версия

`0.0.2` — система тем, 2026-08-03
