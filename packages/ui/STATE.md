# STATE — @abeestudio/ui

## Готово

- [x] Структура пакета (тик 1)
- [x] Система тем — 5 тем × dark/light (тик 2)
- [x] Базовые стили — src/base/base.css (тик 3)
- [x] Скелет витрины (тик 4)
- [x] Button.js — кнопка (тик 5, 2026-08-03)
  - `src/components/Button.js` — 4 варианта: primary, secondary, danger, icon
  - `src/components/Button.css` — все состояния: default, hover, active, disabled, loading
  - `src/ui-object.js` — объект UI для удобного импорта всей библиотеки
  - Витрина: секция Кнопки с 4×3 матрицей (4 варианта × 3 состояния)
  - Исправлен баг: icon-кнопка в loading скрывает иконку (иначе overflow 3px)

## В работе

_пусто_

## Следующий шаг

**Фаза 2, пункт 2:** Кнопки price (с ценой) и ad-reward (с иконкой рекламы) + витрина

## Сломано / блокеры

_нет_

## Проверено на живом Chromium (тик 5)

check-showcase.py прошёл чисто после фикса icon-loading:
- 2 темы × 3 viewport (360/820/1440) × RU+EN — ОК
- Ноль console errors
- Ноль горизонтальных переполнений
- Все зоны нажатия ≥ 44px
- EN-строки не обрезаются

## Вес библиотеки (runtime, только подключённое)

`src/base/base.css`:        ~5 КБ  
`src/themes/abee-default.css`: ~4 КБ (пример)  
`src/themes/index.js`:      ~1 КБ  
`src/components/Button.js`: ~2.5 КБ  
`src/components/Button.css`:~3 КБ  
`src/index.js`:             ~1 КБ  
**Итого (1 тема + Button):** **~17 КБ**  
Цель: < 150 КБ
