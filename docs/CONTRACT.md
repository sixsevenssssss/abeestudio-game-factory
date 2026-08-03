# Общий контракт (менять нельзя без владельца)

Все три сессии опираются на него. Он зафиксирован до начала работ, чтобы параллельная разработка
не разъехалась.

## Импорт

```js
import { Engine, Save, Ads, Achievements, Daily, Audio, L10n, Analytics, Platform } from '../engine/index.js';
import { UI } from '../ui/index.js';
```

## Сигнатуры

```js
Engine.start({ scenes, config });
Engine.scenes.go(name, payload);
Engine.loop.pause() / .resume();
Engine.events.on(type, fn) / .emit(type, payload);

Save.get(path, fallback) / Save.set(path, value) / Save.flush();
Ads.rewarded(rewardId) -> Promise<boolean>;
Ads.interstitial(reason) -> Promise<void>;
Achievements.unlock(id) / .progress(id, value);
Daily.claim() / Daily.state();
Audio.play(id, opts) / Audio.music(id) / Audio.setVolume(bus, v) / Audio.duckForAd();
L10n.t(key, vars) / L10n.setLang(lang) / L10n.lang;
Analytics.event(name, params);
Platform.player / Platform.leaderboard / Platform.isYandex;
```

## Структура проекта игры

```
my-game/
├── index.html
├── game.config.js
├── assets/
├── src/{game,engine,ui,platform,i18n}/
├── tools/
├── store/
└── TEMPLATE_VERSION
```

## Железные правила

- Игра не обращается к SDK площадки напрямую — только через `platform/`.
- Игра не пишет в localStorage мимо `Save`.
- Любой текст на экране — только через `L10n.t`, словари `ru.json` и `en.json` совпадают ключ в ключ.
- Перед любой полноэкранной рекламой — пауза и выключение звука, после — возврат.
- Элементы интерфейса не знают игровой логики: получают данные, отдают события.
- Инструменты не меняют игровой код без явного флага.
