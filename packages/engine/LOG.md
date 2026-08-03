# LOG — abeeStudio · Фундамент

Одна запись на тик: дата, что сделано, почему именно так.

---

## 2026-08-03 — Тик 0: структура памяти и план

**Что сделано:** создан полный набор файлов памяти (STATE.md, BACKLOG.md, LOG.md, API.md, PLAN.md).
Репозиторий прочитан — в `packages/engine/`, `template/`, `create-yandex-game/` только README-заглушки.
Соседние сессии ещё ничего не заливали (engine-папка пуста).
Составлен детальный бэклог на 21 тик: ядро → адаптер → системы → шаблон → генератор → тесты → верификация.

**Решения:**
- Порядок в бэклоге: сначала EventBus (нет зависимостей), затем Loop, Scenes, Input — фундамент ядра.
  Потом Platform-мок (нужен для тестов всех систем), затем Save (нужна для Achievements, Daily),
  потом Ads (нужен Audio), Audio, L10n, Achievements, Daily, Analytics, Brand, barrel index.js.
  Шаблон и генератор — после ядра, чтобы было что тестировать.
- Engine.start() инициализирует системы в строгом порядке (Platform → L10n → Save → Audio → ... → LoadingAPI.ready())
  чтобы ни одна система не обратилась к незапущенной. Порядок зафиксирован в PLAN.md.
- Автотесты на Node.js (без браузера) — отдельный тик перед финальной верификацией. Позволяет
  прогонять их в CI без headless-браузера.
- Вопрос к владельцу про имя пакета в npm (`create-yandex-game` или другое) откладывается до Тика 19
  — там будет развёрнутый вопрос с вариантами.

---

## 2026-08-03 — Тик 1: EventBus (src/events.js)

**Что сделано:** написан `src/events.js` — изолированная шина событий без зависимостей.
Методы: on(type, fn) → unsub, once(type, fn) → unsub, off(type, fn), emit(type, payload),
clear(type?), listenerCount(type). Тесты: 17 кейсов, все зелёные.

**Решения:**
- once() использует wrapper с _originalFn для совместимости с off(originalFn) — тест подтверждён.
- emit() делает [...set] снимок перед итерацией: безопасно при отписке внутри обработчика.
- Ошибки изолированы через try/catch; console.error с именем типа — для отладки.
- globalBus экспортируется, но используется только через Engine.events после start(). 
  Прямой доступ в игровом коде не рекомендован.
- Браузерная верификация (проект из генератора) отложена до Тик 15+ когда будет что запустить.
  Для этого тика достаточно 17 тестов Node.js.

---

## 2026-08-03 — Тик 2: GameLoop (src/loop.js)

**Что сделано:** написан `src/loop.js` — GameLoop с фиксированным шагом симуляции.
UPDATE_STEP_MS=16, MAX_STEPS=5. Тесты: 20 кейсов, все зелёные.
Регрессия EventBus: 17 тестов — зелёные.

**Решения:**
- rAF в Node.js недоступен → автоматический fallback на setTimeout, код один.
- _scheduleFrame() переопределяется в тестах на no-op для синхронного контроля.
- resume() сбрасывает _lastTime = now(), чтобы после паузы не было прыжка — тест подтверждён.
- visibilitychange: emit('app:hidden')→pause(), emit('app:visible')→resume().
  Аудио-duck делается в Audio-системе по событию app:hidden, не в Loop (разделение ответственностей).
- Найден и исправлен баг в тесте: второй _tick(20) должен быть _tick(40) — тот же timestamp давал delta=0.

---

## 2026-08-03 — Тик 3: SceneManager (src/scenes.js)

**Что сделано:** написан `src/scenes.js` — менеджер сцен со стеком.
go(name, payload): fade-out→exit all→preload→enter→fade-in.
push(name, payload): pause current→preload→enter.
pop(): exit top→resume previous.
update(dt)/render(alpha): делегируют в активную сцену.
Тесты: 28 кейсов, все зелёные. Регрессия: 17+20 — зелёные.

**Решения:**
- fadeDuration: 0 в конструкторе — переходы мгновенные, тесты синхронны.
- Fade-оверлей рендерится поверх сцены через _renderFadeOverlay(); без canvas — no-op.
- _callHook() ловит исключения — ошибка в enter/exit не ломает переход.
- Конкурентный go/push игнорируется (флаг _transitioning), тест подтверждён.
- _stackNames() использует constructor.sceneName ?? constructor.name — тест нашёл баг:
  класс без sceneName давал имя класса, а не ключ реестра. Правильно — оба варианта OK,
  просто тест должен добавлять sceneName. Исправлено в тесте.

---

## 2026-08-03 — Тик 4: InputManager (src/input.js)

**Что сделано:** написан `src/input.js` — единый ввод Pointer Events (mouse + touch).
Жесты: tap, long-press (500мс таймер, отменяется при MOVE_THRESHOLD >10px), swipe (4 направления,
>30px за <500мс), drag (continuous drag:start/drag:move/drag:end), pinch (2 пальца, scale).
Тесты: 22 кейса, все зелёные. Регрессия 65 тестов — зелёные.

**Решения:**
- Pointer Events API унифицирует mouse+touch; trackpad+stylus тоже работает.
- Drag и swipe могут сосуществовать: быстрое движение эмитит и drag:move, и swipe на release.
  Это правильное поведение — сцена сама решает, что обрабатывать.
- tap исключён при drag (state.dragging=true в проверке тапа).
- _simulate*() методы для тестирования без DOM — прямой вызов обработчиков с fake-событиями.
- style.touchAction='none' и contextmenu preventDefault — требование п. 1.6 площадки.

---

## 2026-08-03 — Тик 5: MockPlatform (src/platform/mock.js)

**Что сделано:** написан `src/platform/mock.js` — полный мок Яндекс SDK.
Подсистемы: environment, adv (rewarded/interstitial + game_api_pause/resume),
player (lite/full, cloudData, stats), leaderboard, payments + consumePurchase,
loadingAPI.ready(), shortcut, feedback, features.GamesAPI.
initPlatform() автоопределяет среду (Node.js → мок, браузер с YaGames → реальный SDK).
Тесты: 44 кейса. Регрессия 87 → зелёные. Итого 131.

**Решения:**
- Мок отдаёт game_api_pause до показа рекламы и game_api_resume после — имитирует
  реальное поведение SDK (требование п. 4.7 площадки).
- overridePlayer() / overrideRewardedResult() / seedCloudData() — для тестов систем
  которые зависят от Platform (Save, Ads, Achievements).
- initPlatform() проверяет window.YaGames — единая точка инициализации для engine.

---

## 2026-08-03 — Тик 6: YandexPlatform (src/platform/yandex.js)

**Что сделано:** написан `src/platform/yandex.js` — боевой адаптер над реальным ysdk.
Тонкая обёртка: environment, adv, leaderboard делегируют в ysdk.
initPlayer() / initPayments() — ленивые async-инициализаторы с кешем.
game_api_pause/resume → platform:pause/resume на EventBus (п. 4.7 площадки).
visibilitychange → platform:hidden/visible на EventBus (п. 1.3 площадки).
Тесты с fake-ysdk: 23 кейса, зелёные. Регрессия 131 → зелёные. Итого 154.

**Решения:**
- Адаптер НЕ вызывает Audio.duck() или loop.pause() напрямую — только эмитит
  на EventBus. Engine.start() wire-ует обработчики. Правильное разделение слоёв.
- leaderboard потребовал getLeaderboards() — обёрнут в lazy-init со shared _lb.
- Fake-ysdk для тестов использует duck typing — проверяет интерфейс без реального SDK.

---

## 2026-08-03 — Тик 7: SaveSystem (src/save.js)

**Что сделано:** написан `src/save.js` — система сохранений с полной защитой данных.
get(path) / set(path, val) / flush() / snapshot() / reset() / size().
Версионирование: _version, цепочка migrate(v, fn).
Защита: битый JSON → резервная копия → начало с нуля (не исключение).
Резервная копия = предыдущий успешный flush (не текущий).
Аварийный сейв по beforeunload и EventBus:app:hidden/platform:hidden.
MockStorage для тестов без localStorage.
Тесты: 28 кейсов, зелёные. Регрессия 154 → зелёные. Итого 182.

---

## 2026-08-03 — Тик 8: AdsSystem (src/ads.js)

**Что сделано:** написан `src/ads.js` — система рекламы.
rewarded(id)→Promise<bool>: pause+duck → showRewardedVideo → resume+unduck; false при ошибке/отказе.
interstitial(reason)→Promise<void>: интервал 60с, пропуск если занято.
isShowing, resetInterstitialTimer(), setInterstitialInterval().
Тесты: 25 кейсов. Регрессия 182 → зелёные. Итого 207.

**Решения:**
- _beforeShow/_afterShow — try/catch вокруг loop/audio (они nullable для тестов).
- conc. защита: if (_showing) → rewarded немедленно false, interstitial Promise.resolve().
- interstitial НЕ обновляет таймер при skipped — только при реальном показе (onClose).

---

## 2026-08-03 — Тик 9: AudioSystem (src/audio.js)

**Что сделано:** написан `src/audio.js` — AudioSystem с null-backend для тестов.
Шины music/sfx/ui: setVolume(bus, 0..1), setMute(bus, bool), duckForAd/unduck.
play(id, opts): NullAudioHandle в null-backend; пул с trimPool при MAX_SFX_POOL.
music(id): crossfade, повтор игнорируется, stopMusic().
EventBus: app:hidden→suspend, app:visible→resumeCtx, audio:ducked/unducked.
Тесты: 34 кейса. Регрессия 207 → зелёные. Итого 241.

**Решения:**
- Web Audio API реализован как NullHandle в этом тике (backend структурирован).
  Реальный AudioBufferSourceNode будет добавлен когда появится ассет-загрузчик (тик 15+).
  Для игр важна логика (пул, duck, crossfade) — она протестирована.
- pool trimming: удаляем самый старый (handles[0]), новый добавляем в конец.
