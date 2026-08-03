# STATE — @abeestudio/ui

## Готово

- [x] Структура пакета (тик 1)
- [x] Система тем — 5 тем × dark/light (тик 2)
- [x] Базовые стили — src/base/base.css (тик 3)
- [x] Скелет витрины (тик 4)
- [x] Button.js — 6 вариантов × 3 состояния (тики 5–6)
- [x] Toggle.js — переключатель on/off (тик 7, 2026-08-03)
  - `src/components/Toggle.js` — `Toggle(opts)`, `updateToggle(el, changes)`
  - `src/components/Toggle.css` — трек, ползунок, пружинная анимация, disabled, reduced-motion
  - Витрина: секция Формы — 4 переключателя + 2 disabled

## В работе

_пусто_

## Следующий шаг

**Фаза 2, пункт 4:** Ползунок — `Slider.js` (горизонтальный, с метками) + витрина

## Сломано / блокеры

_нет_

## Проверено на живом Chromium (тик 7)

check-showcase.py — код 0. 2 темы × 3 viewport × RU+EN. Ноль overflow, ноль console errors, все зоны ≥ 44px.

Примечание: тик 7 потерял первую попытку (лок не был снят из-за обрыва сессии в 21:17 UTC). Файлы пережили песочницу, коммит выполнен при повторном запуске в 22:19 UTC.

## Вес библиотеки (runtime)

`src/base/base.css`:         ~5 КБ
`src/themes/abee-default.css`: ~4 КБ
`src/components/Button.js`:  ~2.5 КБ
`src/components/Button.css`: ~3 КБ
`src/components/Toggle.js`:  ~2 КБ
`src/components/Toggle.css`: ~2 КБ
`src/index.js`:              ~0.5 КБ
**Итого (1 тема + Button + Toggle):** **~19 КБ**
