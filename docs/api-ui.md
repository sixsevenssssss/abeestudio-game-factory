# API — Интерфейс (@abeestudio/ui)

Этот файл ведёт сессия «Интерфейс». Не редактировать другим сессиям.

---

## Подключение

```js
// Весь пакет через объект UI:
import { UI } from '../ui/index.js';

// Или отдельные компоненты (рекомендуется — меньше вес):
import { Button } from '../ui/src/components/Button.js';
import { switchTheme } from '../ui/src/themes/index.js';
```

---

## Система тем

_В разработке (Фаза 1, пункт 2)._

Планируемый API:

```js
import { switchTheme, getCurrentTheme } from '../ui/src/themes/index.js';

switchTheme('cosmic-dark');         // тёмная тема
switchTheme('abee-default', true);  // true = светлый вариант
getCurrentTheme();                  // { name: 'abee-default', light: false }
```

Доступные имена тем: `abee-default`, `crystal-light`, `cosmic-dark`, `meadow-warm`, `steel-sharp`.

Переопределение из игры (в `index.html` игры):
```html
<style>
  :root {
    --ui-color-primary: #e23d7f;
    --ui-color-bg:      #1a0030;
  }
</style>
```

---

## Элементы

_Идёт разработка. Каждый элемент появится здесь по завершении своего тика._

Формат записи каждого элемента:

```js
// Button — кнопка
// Параметры:
//   label    {string}   — уже локализованная строка или ключ i18n
//   variant  {string}   — 'primary' | 'secondary' | 'danger' | 'icon' | 'price' | 'ad'
//   disabled {boolean}  — заблокировать, по умолчанию false
//   loading  {boolean}  — показать спиннер, по умолчанию false
//   onClick  {function} — коллбэк клика
//   price    {string}   — (только variant='price') строка цены, уже отформатированная
//   icon     {string}   — SVG-строка или URL иконки (для variant='icon' и 'ad')
// Возвращает: HTMLButtonElement
//
// Пример:
const btn = Button({ label: L10n.t('ui.start'), variant: 'primary', onClick: startGame });
document.querySelector('#menu').appendChild(btn);
```

---

## Версия

`0.0.1` — bootstrap, 2026-08-03
