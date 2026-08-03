# BACKLOG — abeeStudio · Фундамент

Один пункт = один тик (~30 мин). Берём сверху вниз, по одному.

## Ядро

- [x] **Тик 0** — Первый тик: создать структуру памяти проекта (STATE, BACKLOG, LOG, API, PLAN), зафиксировать в репо.
- [x] **Тик 1** — `packages/engine/src/events.js` — шина событий: EventBus.on / off / once / emit. Полностью изолирована, без зависимостей.
- [x] **Тик 2** — `packages/engine/src/loop.js` — игровой цикл: rAF, фиксированный шаг симуляции (UPDATE_STEP=16мс), накопитель остатка, защита от прыжка (cap=5 шагов), пауза/возобновление. Обрабатывает visibilitychange (мута, пауза).
- [ ] **Тик 3** — `packages/engine/src/scenes.js` — менеджер сцен: register(name, scene), go(name, payload) с затемнением, push/pop для стека (пауза поверх геймплея), enter/exit хуки, предзагрузка следующей сцены через preload().
- [ ] **Тик 4** — `packages/engine/src/input.js` — единый ввод мыши и тача: tap, long-press (500мс), swipe (порог 30px, 4 направления), drag (pointermove), pinch-zoom (2 пальца, расстояние). Нет контекстного меню, нет выделения текста.

## Платформенный адаптер

- [ ] **Тик 5** — `packages/engine/src/platform/mock.js` — полный мок ysdk: YandexGames.init() → Promise, реклама (rewarded / interstitial) с симуляцией задержки, player (авторизация мок), getCloudData / setCloudData (localStorage), leaderboard (мок), purchases (мок), environment.i18n.lang → 'ru', features.GamesAPI, LoadingAPI.ready(), shortcut.canShow/show, review.canReview/requestReview. Все методы предсказуемы и возвращают данные.
- [ ] **Тик 6** — `packages/engine/src/platform/yandex.js` — боевой адаптер: тонкая обёртка над window.ysdk, тот же интерфейс что и у мока, обрабатывает game_api_pause / game_api_resume (пауза + звук), visibilitychange.

## Игровые системы

- [ ] **Тик 7** — `packages/engine/src/save.js` — Save: схема с VERSION, массив функций-миграций, Save.get(path, fallback) / Save.set(path, val) / Save.flush(), отложенная запись пачками (debounce 300мс), аварийный сейв на beforeunload/visibilitychange→hidden, защита: bitый JSON → откат к lastGood, запись 200КБ-лимит.
- [ ] **Тик 8** — `packages/engine/src/ads.js` — Ads: Ads.rewarded(id) → Promise<boolean>, Ads.interstitial(reason) → Promise<void>, минимальный интервал между interstitial (configurable, default 60с), Engine.loop.pause() + Audio.duckForAd() до показа и resume после, честный false при ошибке rewarded, работает через Platform-адаптер.
- [ ] **Тик 9** — `packages/engine/src/audio.js` — Audio: три шины (music / sfx / ui), Web Audio API с fallback на HTMLAudioElement, Audio.play(id, {bus, loop, volume}), Audio.music(id) с плавным кроссфейдом (1с), Audio.setVolume(bus, 0..1), Audio.duckForAd() (−80% музыка), разблокировка по первому pointerdown/keydown, пул одновременных экземпляров (sfx макс 8).
- [ ] **Тик 10** — `packages/engine/src/l10n.js` — L10n: L10n.init(lang) из Platform, L10n.t(key, vars) с подстановкой {{var}}, склонение числа (plural(n, forms[3]) для RU), L10n.setLang(lang) — горячая смена без перезагрузки, консольное предупреждение о ключе, отсутствующем в одном из словарей.
- [ ] **Тик 11** — `packages/engine/src/achievements.js` — Achievements: каталог из game.config.js (id, type: one-shot|progress, target, reward), Achievements.unlock(id), .progress(id, value), персистенция через Save, всплывающее уведомление (DOM-оверлей, 3с, очередь).
- [ ] **Тик 12** — `packages/engine/src/daily.js` — Daily: Daily.state() → {streak, nextClaimAt, weekAheadRewards[]}, Daily.claim() → reward, честный «новый день» по UTC-полуночи (не доверяем клиенту: сравниваем timestamp last_claim против Date.now()), предпросмотр наград на 7 дней вперёд из конфига.
- [ ] **Тик 13** — `packages/engine/src/analytics.js` — Analytics: Analytics.event(name, params), внутренний буфер (flush по beforeunload и каждые 30с), отправка через Platform.sendAnalytics, локальный журнал (sessionStorage, последние 100 событий). Стандартные события студии: session_start, first_session, session_end, ad_watched, ad_skipped, achievement_unlocked, purchase.
- [ ] **Тик 14** — `packages/engine/src/brand.js` — Brand: SVG-логотип abeeStudio кодом (hexagon + bee + текст), заставка (canvas или DOM, ≤1.5с, пропускается по тапу), конфиг студии в game.config.js (studio name, games[] для перекрёстных ссылок через GamesAPI), функция Brand.showSplash() → Promise.

## Сборка ядра

- [ ] **Тик 15** — `packages/engine/index.js` — barrel export: { Engine, Save, Ads, Achievements, Daily, Audio, L10n, Analytics, Platform, Brand }. Engine.start({ scenes, config }) инициализирует все системы в правильном порядке (Platform → L10n → Save → Audio → Achievements → Daily → Analytics → Ads → Scenes → Loop → Brand.showSplash → LoadingAPI.ready).

## Шаблон игры

- [ ] **Тик 16** — `template/` — каркас: index.html (один файл, подключение ysdk, ES-модули), game.config.js (полный конфиг: id, brand, i18n, audio, ads, achievements каталог, daily rewards, economy), assets/ (пустые placeholder-файлы), src/game/main.js (точка входа геймплея, регистрирует GameplayScene), src/game/scenes/gameplay-scene.js (заглушка — «Hello, game!» на canvas), src/game/data/balance.js, i18n/ru.json, i18n/en.json, TEMPLATE_VERSION.
- [ ] **Тик 17** — `template/src/screens/` — все экраны: menu-screen.js, settings-screen.js (язык, звук, музыка, вибрация, уменьшенная анимация, сброс прогресса + подтверждение), pause-screen.js, achievements-screen.js, daily-screen.js, language-screen.js (выбор при первом запуске), about-screen.js, error-screen.js. Все тексты — L10n.t. Все экраны рабочие, не заглушки.
- [ ] **Тик 18** — Расширить i18n/ru.json и i18n/en.json: все ключи всех экранов, подстановки, склонения. Проверить паритет ключей (ни одного лишнего в одном из файлов).

## Генератор

- [ ] **Тик 19** — `create-yandex-game/` — генератор: package.json (name TBD — уточнить у владельца), bin/create-yandex-game.js (интерактивные промпты: gameName, gameId, orientation portrait|landscape|both, palette light|dark|custom), копирование template/ в целевую папку, подстановка переменных в game.config.js и TEMPLATE_VERSION, git init + начальный коммит, финальный вывод трёх строк. Флаги --minimal (без экранов, только ядро) и --example (+ src/game/scenes/example-scene.js с демо-геймплеем).

## Тесты

- [ ] **Тик 20** — Автотесты Node.js (без браузера): test/save.test.js (миграции, битый JSON, батчинг), test/l10n.test.js (ключи, склонение RU, горячая смена), test/events.test.js (on/off/once/emit), test/ads.test.js (интервал, mock resolve/reject), test/daily.test.js (стрик, смена дня). Все тесты зелёные.

## Финальная верификация

- [ ] **Тик 21** — Финальная проверка 6 критериев готовности (раздел 4 промпта): сгенерировать проект генератором в /tmp, npm start, браузер без ошибок, все экраны, сохранение после перезагрузки, смена языка на лету, вес ≤150КБ, API.md совпадает с кодом. Обновить docs/CHANGELOG.md v0.1.0.
