# LOG — @abeestudio/ui

## 2026-08-03 — Тик 7: Toggle.js (с задержкой из-за обрыва сессии)

**Пункт бэклога:** «Переключатель: Toggle.js (on/off) + витрина»

**Что создано:**

- `src/components/Toggle.js` — `Toggle(opts)` возвращает `HTMLLabelElement`. Реальный `<input type="checkbox" role="switch">` скрыт визуально, обеспечивает доступность и клавиатурный ввод. `updateToggle(el, { checked, disabled, label })` — обновление без перерендеринга. Событие `ui:toggle:change` на document. Параметры: checked, disabled, label, labelPos ('left'|'right'), id, onChange.
- `src/components/Toggle.css` — трек 52×28px pill, ползунок 22px. Пружинная анимация `var(--ui-spring)`. Гоу-эффект при включённом состоянии (`box-shadow: shadow-glow`). Минимальная tap-зона ≥ 44px на корневом label. Disabled через `:has(:disabled)` + класс.
- `src/index.js` — обновлён: экспортирует Toggle, updateToggle.
- `src/ui-object.js` — обновлён: добавлены Toggle, updateToggle.
- `showcase/showcase.js` — добавлен import Toggle, функция `initForms()` (4 переключателя + 2 disabled). Метки обновляются при смене языка через `_demoToggles` реестр.
- `showcase/showcase.css` — добавлен `.sc-demo-row--col` для вертикального стека переключателей.

**Обстоятельства:** первая попытка тика (21:17 UTC) была прервана до выполнения коммита — файлы существовали в песочнице, лок остался `running`. Файлы пережили сессию. Повторный запуск в 22:19 UTC (через 62 минуты) обнаружил истёкший лок, подобрал готовые файлы и завершил тик.

**Проверка:** check-showcase.py — код 0.

---

## 2026-08-03 — Тик 6: Button price + ad

price-бейдж (space-between, min-width:120px), ad-пульс (@keyframes ui-btn-ad-pulse).

---

## 2026-08-03 — Тик 5: Button.js (primary/secondary/danger/icon)

Первый реальный компонент. Исправлен icon+loading overflow (3px).

---

## 2026-08-03 — Тик 4: скелет витрины

showcase/. Исправлен HTTP-сервер (из pkg root).

---

## 2026-08-03 — Тик 3: базовые стили

src/base/base.css — п. 1.6 Яндекс Игр.

---

## 2026-08-03 — Тик 2: система тем; Тик 1: bootstrap
