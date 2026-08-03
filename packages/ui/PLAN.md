# PLAN — @abeestudio/ui
Развёрнутый раздел 3 системного промпта. Источник правды для структуры бэклога.
Менять только при изменении архитектуры — с записью причины в LOG.md.

---

## Архитектура пакета

```
packages/ui/
├── src/
│   ├── index.js              # точка входа — re-export всех компонентов + объект UI
│   ├── themes/
│   │   ├── index.js          # switchTheme(), getCurrentTheme(), список тем
│   │   ├── abee-default.css  # тема бренда abeeStudio (умолчание)
│   │   ├── crystal-light.css # светлая чистая тема
│   │   ├── cosmic-dark.css   # тёмная космическая тема
│   │   ├── meadow-warm.css   # тёплая природная тема
│   │   └── steel-sharp.css   # холодная технологичная тема
│   ├── base/
│   │   └── base.css          # запреты ПКМ/выделения/скролла, safe-area, touch-action
│   ├── components/           # по одному файлу на элемент
│   │   ├── Button.js         ├── Modal.js          ├── ProgressBar.js
│   │   ├── Toggle.js         ├── BottomSheet.js    ├── ProgressCircle.js
│   │   ├── Slider.js         ├── Tooltip.js        ├── Timer.js
│   │   ├── Tabs.js           ├── Toast.js          ├── Counter.js
│   │   ├── Input.js          ├── Banner.js         ├── Badge.js
│   │   ├── Checkbox.js       ├── Panel.js          ├── Avatar.js
│   │   ├── Card.js           ├── ScrollList.js     ├── RewardCard.js
│   │   ├── ChestReveal.js    ├── DailyRewards.js   ├── Achievement.js
│   │   ├── Leaderboard.js    ├── Shop.js           └── NoCoins.js
│   └── effects/
│       ├── transitions.js       # появление/исчезновение окон
│       ├── effects.js           # пульсация, подсветка, тряска, вспышка
│       ├── FloatingNumber.js    # цифры урона/дохода
│       ├── FlyingCoins.js       # монеты к счётчику
│       ├── Confetti.js          # конфетти, салют
│       ├── Particles.js         # частицы общего назначения
│       ├── Skeleton.js          # скелетоны загрузки
│       ├── screenTransitions.js # переходы между экранами
│       └── BrandSplash.js       # логотип-заставка abeeStudio
├── showcase/
│   ├── index.html               # живая витрина — каталог всех элементов
│   └── showcase.js              # JS переключателей (тема/lang/viewport)
└── tools/
    └── check-showcase.py        # Playwright-проверяльщик (PyPI, не npm)
```

---

## Принципы реализации компонентов

**1. Чистые веб-стандарты.** Компонент — функция, возвращающая HTMLElement.
Никаких фреймворков, никаких зависимостей в рантайме.

```js
// Контракт компонента:
const btn = Button({ label: 'ui.btn.confirm', variant: 'primary', onClick: handler });
container.appendChild(btn);

// Деструктуризация (удобно из игры):
const { el, destroy } = Button({ ... });
```

**2. Только ключи локализации.** Компонент не знает про язык.
Игра передаёт уже переведённую строку через `L10n.t('ключ')` или сразу строку.

**3. Темы через CSS custom properties.** Переключение = смена класса на `<html>`:
```js
document.documentElement.className = 'theme-cosmic-dark';
```

```css
/* Пример переменных темы */
:root, .theme-abee-default {
  --ui-color-primary:       #f0a500;
  --ui-color-primary-text:  #fff;
  --ui-color-bg:            #1a1a2e;
  --ui-color-surface:       rgba(255,255,255,0.08);
  --ui-radius-sm:           8px;
  --ui-radius-md:           12px;
  --ui-radius-lg:           20px;
  --ui-shadow-sm:           0 2px 8px rgba(0,0,0,0.2);
  --ui-shadow-md:           0 4px 16px rgba(0,0,0,0.3);
  --ui-font-stack:          system-ui, -apple-system, sans-serif;
  --ui-anim-duration:       200ms;
  --ui-anim-spring:         cubic-bezier(0.34, 1.56, 0.64, 1);
  --ui-anim-ease:           cubic-bezier(0.4, 0, 0.2, 1);
}
.prefers-reduced-motion *, .prefers-reduced-motion *::before, .prefers-reduced-motion *::after {
  animation-duration: 1ms !important;
  transition-duration: 1ms !important;
}
```

**4. События + коллбэки.** Компоненты эмитят CustomEvent и принимают коллбэки:
```js
// Игра слушает:
document.addEventListener('ui:button:click', e => { /* e.detail.id, e.detail.variant */ });
// Или проще:
Button({ onClick: () => startGame() });
```

**5. Зоны нажатия ≥ 44px** (требование Яндекс Игр п. 1.6 + UX).
Визуально меньше — через ::after с position:absolute и отрицательными отступами.

**6. Безопасные зоны.** `padding-bottom: env(safe-area-inset-bottom)` у BottomSheet и нижних элементов.

---

## Система тем (5 тем × 2 варианта)

| CSS-класс | Характер |
|---|---|
| `theme-abee-default` | Фирменная abeeStudio: янтарный акцент, тёмно-синий фон |
| `theme-crystal-light` | Светлая, воздушная, минималистичная |
| `theme-cosmic-dark` | Тёмная, фиолетово-синяя, звёздная |
| `theme-meadow-warm` | Тёплая, зелёно-коричневая, органичная |
| `theme-steel-sharp` | Холодная, серо-синяя, технологичная |

Каждая тема — light/dark варианты + auto через prefers-color-scheme.
Игра переопределяет конкретные переменные через `<style>` тег в index.html своей игры.

---

## Живая витрина (showcase/index.html)

Самодостаточный HTML-файл, без шага сборки.

- Переключатель темы: кнопки `[data-theme]`, меняют className на `<html>`.
- Переключатель языка: кнопки `[data-lang]`, mock L10n → все data-label-ru/en обновляются.
- Переключатель viewport: `[data-viewport=phone|tablet|desktop]`, масштабирует `#showcase-frame`.
- Каждый компонент — в своей `<section>` с заголовком, все варианты и состояния.

Если элемента нет в витрине — он не существует.

---

## check-showcase.py (Playwright, PyPI)

```bash
# npm заблокирован (403) — только через PyPI:
pip install --quiet playwright
python3 -m playwright install chromium  # только один раз, ~113MB
# Запуск:
python3 packages/ui/tools/check-showcase.py [--screenshots]
```

Матрица проверок: обе темы × оба языка × три ширины (360 / 820 / 1440 px).

Критерии:
- Ноль ошибок в консоли браузера
- scrollWidth == viewport width (нет горизонтального переполнения)
- Все кнопки/ссылки/[role=button] имеют bounding box ≥ 44×44 px
- После переключения языка (EN) те же проверки повторяются
- Тексты в кнопках не обрезаются (scrollWidth > clientWidth → ошибка)

Выходной код: 0 = OK, ≠ 0 = список проблем.

---

## Бюджет размера

Цель для пустого шаблона: < 150 КБ, время до первого кадра < 2 с.
Вклад этой библиотеки в runtime: только подключённые компоненты (tree-shaking через ES import).
CSS тем: ~5–10 КБ на тему. JS компонентов: ~0.5–2 КБ на элемент.
