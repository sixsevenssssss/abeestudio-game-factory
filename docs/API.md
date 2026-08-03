# Публичный API фабрики

Единый интерфейс, на который опираются все игры студии. Каждая сессия правит **только свой раздел**.

## Импорт

```js
import { Engine, Save, Ads, Achievements, Daily, Audio, L10n, Analytics, Platform } from '../engine/index.js';
import { UI } from '../ui/index.js';
```

---

## engine — сессия «Фундамент»

_Раздел заполняет сессия «Фундамент». Ниже — согласованный контракт, от которого нельзя отступать._

```js
Engine.start({ scenes, config });        // поднимает всё и запускает первую сцену
Engine.scenes.go(name, payload);         // переход между сценами
Engine.loop.pause() / .resume();         // пауза: реклама, сворачивание вкладки
Engine.events.on(type, fn) / .emit(type, payload);

Save.get(path, fallback) / Save.set(path, value) / Save.flush();
Ads.rewarded(rewardId) -> Promise<boolean>;   // true только если награда засчитана
Ads.interstitial(reason) -> Promise<void>;
Achievements.unlock(id) / .progress(id, value);
Daily.claim() / Daily.state();
Audio.play(id, opts) / Audio.music(id) / Audio.setVolume(bus, v) / Audio.duckForAd();
L10n.t(key, vars) / L10n.setLang(lang) / L10n.lang;
Analytics.event(name, params);
Platform.player / Platform.leaderboard / Platform.isYandex;
```

Правила: игра никогда не обращается к SDK площадки напрямую и не пишет в localStorage мимо `Save`.
Любой текст на экране — только через `L10n.t`.

---

## ui — сессия «Интерфейс»

_Раздел заполняет сессия «Интерфейс»: список элементов, их параметры, события и пример на три строки._

---

## tools — сессия «Инструменты»

_Раздел заполняет сессия «Инструменты»: команды, флаги, коды возврата._

---

## Двуязычность

Русский и английский равноправны. Выбор языка при первом запуске, переключение в настройках
без перезагрузки, ключи в `ru.json` и `en.json` совпадают один в один.
