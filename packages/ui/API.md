# API — @abeestudio/ui

Библиотека UI-элементов для браузерных игр abeeStudio.  
Чистые ES-модули, ноль внешних зависимостей в рантайме.

## Подключение

```js
// Весь пакет:
import { UI } from '../ui/index.js';

// Или отдельные компоненты (рекомендуется для экономии веса):
import { Button } from '../ui/src/components/Button.js';
```

## Готовые элементы

_Идёт разработка. Каждый элемент появится здесь по завершении своего тика._

## Система тем

_В разработке (следующий тик)._

Планируемый API:
```js
import { switchTheme, getCurrentTheme } from '../ui/src/themes/index.js';
switchTheme('cosmic-dark');         // переключить тему
switchTheme('abee-default', true);  // второй аргумент true = светлый вариант
getCurrentTheme();                  // → { name: 'cosmic-dark', light: false }
```

## Версия

`0.0.1` — bootstrap, 2026-08-03
