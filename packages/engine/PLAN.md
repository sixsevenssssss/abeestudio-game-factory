# PLAN — abeeStudio · Фундамент

Детальный план разработки пакета `@abeestudio/engine` + генератора `create-yandex-game`.
Составлен на первом тике. Обновляется по мере выполнения.

---

## Цель

Разработчик пишет одну команду — получает работающий проект за 10 секунд.
Шаблон уже содержит всё кроме геймплея.

---

## Структура артефактов

```
packages/engine/
├── src/
│   ├── events.js          EventBus
│   ├── loop.js            GameLoop
│   ├── scenes.js          SceneManager
│   ├── input.js           InputManager
│   ├── save.js            SaveSystem
│   ├── ads.js             AdsSystem
│   ├── audio.js           AudioSystem
│   ├── l10n.js            L10nSystem
│   ├── achievements.js    AchievementsSystem
│   ├── daily.js           DailySystem
│   ├── analytics.js       AnalyticsSystem
│   ├── brand.js           BrandModule
│   └── platform/
│       ├── mock.js        Полный мок Яндекс SDK
│       └── yandex.js      Обёртка над ysdk
├── index.js               Barrel export + Engine.start()
├── STATE.md
├── BACKLOG.md
├── LOG.md
├── API.md
└── PLAN.md

template/
├── index.html
├── game.config.js
├── TEMPLATE_VERSION
├── assets/
│   ├── audio/             placeholder
│   └── images/            placeholder
├── i18n/
│   ├── ru.json
│   └── en.json
└── src/
    ├── game/
    │   ├── main.js
    │   ├── scenes/
    │   │   └── gameplay-scene.js
    │   └── data/
    │       └── balance.js
    └── screens/
        ├── menu-screen.js
        ├── settings-screen.js
        ├── pause-screen.js
        ├── achievements-screen.js
        ├── daily-screen.js
        ├── language-screen.js
        ├── about-screen.js
        └── error-screen.js

create-yandex-game/
├── package.json
├── bin/
│   └── create-yandex-game.js
├── prompts.js
└── utils/
    └── substitute.js
```

---

## Порядок инициализации в Engine.start()

```
1. Platform.init()          — определить площадку, язык, загрузить ysdk
2. L10n.init()              — загрузить словари из game.config.js
3. Save.init()              — загрузить сейв, прогнать миграции
4. Audio.init()             — создать AudioContext, зарегистрировать ассеты
5. Achievements.init()      — загрузить каталог из config, состояние из Save
6. Daily.init()             — загрузить конфиг наград, состояние из Save
7. Analytics.init()         — запустить буфер и таймер flush
8. Ads.init()               — подключить Platform-адаптер рекламы
9. Scenes.register(all)     — зарегистрировать все сцены из Engine.start({ scenes })
10. Loop.start()            — запустить rAF
11. Brand.showSplash()      — показать заставку (await, ≤1.5с)
12. Platform.ready()        — вызов LoadingAPI.ready() — игрок видит игру
13. Scenes.go(firstScene)   — переход на первую сцену
```

---

## Ключевые решения

### Шина событий — единственный межслойный транспорт
Все системы общаются только через Engine.events. Никаких прямых ссылок между Save и Daily,
между Ads и Audio. Это позволяет тестировать системы изолированно.

### Save — защита от потери прогресса
При сохранении: запись идёт в `abeestudio_save` + дублируется в `abeestudio_save_backup`.
При загрузке: парсим основной, если битый — парсим бэкап, если тоже битый — начинаем с нуля
с версией 0 (не кидаем исключение, не обнуляем). lastGood обновляется только после успешного
парса. Аварийный сейв на `visibilitychange`→hidden и `beforeunload` через Save.flush().

### L10n — ни одной строки в коде
Все ключи только в ru.json и en.json. При L10n.setLang() Engine.events.emit('l10n:changed')
— каждый экран подписывается и перерисовывает себя. Проверка паритета ключей запускается
при L10n.init() и печатает Warning в консоль (не кидает ошибку).

### Platform-адаптер — детектирование площадки
```js
const isYandex = typeof ysdk !== 'undefined' || window.location.host.includes('yandex');
```
Если ysdk нет — автоматически мок. Мок полностью воспроизводит все события, включая
game_api_pause / game_api_resume (симуляция через setTimeout 2с после rewarded/interstitial).

### Генератор — офлайн-первый
По умолчанию читает шаблон из npm-пакета (bundled). Флаг `--from-git` читает из
`github.com/sixsevenssssss/abeestudio-game-factory/template` через degit.
Флаг `--from-local /path/to/template` — из локальной папки-донора.

---

## Критерии готовности (из раздела 4 промпта)

1. `npm create yandex-game@latest my-game && cd my-game && npm start` — браузер без ошибок.
2. В браузере работают: заставка, выбор языка, меню, настройки, пауза, Save/Load, ежедневная
   награда, достижение, звук, rewarded, interstitial (оба через мок).
3. Смена языка — весь интерфейс меняется без перезагрузки.
4. Перезагрузка страницы — прогресс сохранён.
5. Вес пустого проекта ≤ 150 КБ (без ассетов игры).
6. API.md совпадает с кодом (проверка: все экспорты из index.js описаны в API.md).
