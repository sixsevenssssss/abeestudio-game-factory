# API — @abeestudio/tools

Публичный API пакета `@abeestudio/tools`. Версия: 0.0.0 (в разработке).

---

## Команды

| Команда | Статус | Описание |
|---|---|---|
| `npm start` | 🔧 тик 1 | Dev-сервер со статикой и авто-перезагрузкой |
| `npm run check` | 🔧 тик 2–9 | Полный чек-лист готовности |
| `npm run pack` | 🔧 тик 10 | Упаковка zip для площадки |
| `npm test` | 🔧 тик 11 | Прогон тестов без браузера |
| `npm run sim` | 🔧 тик 12 | Симулятор экономики |
| `npm run shots` | 🔧 тик 20 | Скриншоты для карточки (требует Puppeteer) |

---

## npm start

```
node tools/serve.js [options]

--port N       Порт (default: 3000)
--mobile       Viewport 390×844, эмуляция тача
--throttle N   Задержка ответа N мс (эмуляция медленной сети)
--open         Открыть браузер автоматически
```

Выходные коды: 0 — штатный запуск, 1 — порт занят или директория не найдена.

---

## npm run check

```
node tools/check.js [options] [gameDir]

gameDir        Путь к игре (default: текущая директория)
--only=id      Запустить только одну проверку по id
--json         Вывод в JSON вместо текста
```

**Коды возврата:**
- `0` — все проверки ok или skip
- `1` — есть хотя бы одна fail
- `2` — внутренняя ошибка инструмента

**Статусы проверок:**
- `ok` — проверено, в порядке
- `fail` — проверено, найдена проблема (сообщение + где чинить)
- `skip` — не проверено (указана причина: нет браузера / нет зависимости / требует ручной проверки)

**Формат отчёта:**

```
✅ ГОТОВО К ОТПРАВКЕ  (или ❌ НЕ ГОТОВО — N проблем)

✅ L1  Ключи i18n совпадают (ru: 42 ключа, en: 42 ключа)
❌ L3  Строки вне L10n.t: src/game/scenes/gameplay.js:34 — "Score: "
⬜ N1  Сетевые запросы — не проверено: нет браузера
```

**ID проверок:** L1–L4 (i18n), P1–P3 (платформа), A1–A3 (архив), M1 (магические числа),
B1–B3 (бренд), AD1–AD2 (реклама), S1–S3 (карточка),
N1 (сеть), C1 (консоль), AD2r (пауза реклама), V1 (видимость), SV1–SV2 (сохранения).

---

## npm run pack

```
node tools/pack.js [options] [gameDir]

gameDir        Путь к игре (default: текущая директория)
--out DIR      Директория для zip (default: build/)
--dry-run      Показать список файлов без создания zip
```

**Коды возврата:** 0 — ok, 1 — ошибка (нет index.html, превышен лимит 100МБ).

---

## npm test

```
node tools/test.js [options]

--watch        Следить за изменениями
```

Запускает `test/**/*.test.js` через `node --test` (Node.js v18+). В monorepo также запускает `packages/engine/test/`.

**Коды возврата:** 0 — все тесты зелёные, 1 — есть упавшие.

---

## npm run sim

```
node tools/sim.js [options] [gameDir]

--hours N      Прогнать модель на N часов (default: 8, max: 168)
```

Читает поля `economy.*` из `game.config.js`. Выводит ASCII-кривую и текстовый диагноз.

---

## npm run shots

```
node tools/shots.js [options] [gameDir]

--lang ru|en|both    Язык (default: both)
--device mobile|desktop|both   Устройство (default: both)
```

**Требует:** Puppeteer (`npm install puppeteer --save-dev`). При отсутствии — skip с объяснением.

---

## Подключение в игру

Скрипты копируются в `tools/` игрового проекта генератором `create-yandex-game`.
Игровой `package.json`:

```json
{
  "scripts": {
    "start":  "node tools/serve.js",
    "check":  "node tools/check.js",
    "pack":   "node tools/pack.js",
    "test":   "node tools/test.js",
    "shots":  "node tools/shots.js",
    "sim":    "node tools/sim.js"
  }
}
```
