# API — @abeestudio/engine

Публичный API пакета ядра. Правит только сессия «Фундамент».
Состояние: **в разработке**, код не написан.

---

## Импорт

```js
import { Engine, Save, Ads, Achievements, Daily, Audio, L10n, Analytics, Platform, Brand }
  from '../engine/index.js';
```

---

## Engine

```js
Engine.start({ scenes: Map<name, SceneClass>, config: GameConfig }) → Promise<void>
  // Инициализирует все системы в порядке:
  // Platform → L10n → Save → Audio → Achievements → Daily → Analytics → Ads
  // → регистрирует сцены → запускает Loop → Brand.showSplash() → LoadingAPI.ready()
  // → переходит на первую сцену из config.firstScene

Engine.scenes.go(name: string, payload?: any) → void
  // Переход к сцене с затемнением (fade 150мс). Вызывает exit() на текущей и enter(payload) на новой.

Engine.scenes.push(name: string, payload?: any) → void
  // Поместить сцену на стек (пауза поверх геймплея). Текущая не вызывает exit, только pause().

Engine.scenes.pop() → void
  // Снять верхнюю сцену со стека. Предыдущая получает resume().

Engine.loop.pause() → void
Engine.loop.resume() → void
  // Остановить/продолжить игровой цикл. Вызывается автоматически при рекламе и visibilitychange.

Engine.events.on(type: string, fn: Function) → () => void   // возвращает unsubscribe
Engine.events.once(type: string, fn: Function) → () => void
Engine.events.emit(type: string, payload?: any) → void
Engine.events.off(type: string, fn: Function) → void
```

---

## Save

```js
Save.get(path: string, fallback?: any) → any
  // Точечный доступ: Save.get('coins') или Save.get('settings.sound', true)

Save.set(path: string, value: any) → void
  // Точечная запись. Батчинг: реальный flush через 300мс.

Save.flush() → Promise<void>
  // Принудительно записать прямо сейчас. Используется перед рекламой и закрытием.

Save.migrate(fromVersion: number, fn: (data) => data) → void
  // Регистрирует функцию миграции. Save автоматически прогоняет цепочку при загрузке.

// Защита: если JSON битый — откат к lastGood-снимку. Данные не обнуляются.
// Лимит: 200КБ (ограничение платформы). Save.size() → number (байт).
```

---

## Ads

```js
Ads.rewarded(rewardId: string) → Promise<boolean>
  // true только если ролик досмотрен и награда засчитана платформой.
  // false при ошибке, пропуске или отсутствии рекламы.
  // Автоматически: Engine.loop.pause() + Audio.duckForAd() до показа, resume после.
  // Задержка от вызова до показа ≤ 0.33с (требование площадки).

Ads.interstitial(reason: string) → Promise<void>
  // Показывает межстраничную рекламу, соблюдая минимальный интервал (конфиг: ads.interstitialInterval, default 60с).
  // Если интервал не истёк — возвращает resolved Promise без показа.
  // Автоматически: пауза + выкл. звука до показа, возврат после.
```

---

## Achievements

```js
Achievements.unlock(id: string) → void
  // Засчитать одиночное достижение. Игнорирует повторный вызов.

Achievements.progress(id: string, value: number) → void
  // Обновить прогресс для прогрессивного достижения.
  // Автоматически вызывает unlock при достижении target из конфига.

Achievements.isUnlocked(id: string) → boolean
Achievements.getProgress(id: string) → number
Achievements.getAll() → AchievementState[]
  // Возвращает массив: { id, unlocked, progress, target, ... }
```

---

## Daily

```js
Daily.state() → {
  canClaim: boolean,
  streak: number,
  nextClaimAt: number,      // timestamp UTC
  weekAheadRewards: Reward[] // следующие 7 дней из конфига
}

Daily.claim() → Reward | null
  // Получить ежедневную награду. null если нельзя (ещё не наступил новый день).
  // Сохраняет streak и timestamp через Save.
```

---

## Audio

```js
Audio.play(id: string, opts?: { bus?: 'sfx'|'ui', loop?: boolean, volume?: number }) → AudioHandle

Audio.music(id: string, opts?: { crossfade?: number }) → void
  // Плавная смена музыки. crossfade в мс (default 1000).

Audio.stop(id: string) → void
Audio.setVolume(bus: 'music'|'sfx'|'ui', volume: 0..1) → void
Audio.setMute(bus: 'music'|'sfx'|'ui', muted: boolean) → void

Audio.duckForAd() → void       // −80% громкость музыки
Audio.unduck() → void          // восстановить

// Звук разблокируется автоматически по первому pointerdown/keydown.
// Пул sfx: максимум 8 одновременных экземпляров одного звука.
```

---

## L10n

```js
L10n.init(lang: string, dictionaries: { [lang]: Record<string,string> }) → void
  // Инициализация. Вызывается в Engine.start().

L10n.t(key: string, vars?: Record<string, string|number>) → string
  // Перевод с подстановкой {{var}}. Консоль-предупреждение если ключ отсутствует.

L10n.plural(n: number, forms: [one: string, few: string, many: string]) → string
  // Склонение числа по правилам русского. Для EN: forms[0] = единственное, forms[1] = множественное.

L10n.setLang(lang: string) → void
  // Горячая смена языка без перезагрузки. Генерирует событие Engine.events.emit('l10n:changed').

L10n.lang → string   // текущий язык ('ru' | 'en')
```

---

## Analytics

```js
Analytics.event(name: string, params?: Record<string, any>) → void
  // Отправить событие. Буферизуется, flush каждые 30с и на beforeunload.

// Стандартные события студии (вызывай их именно так):
Analytics.event('session_start', { lang, platform })
Analytics.event('first_session', { lang, platform })
Analytics.event('session_end', { duration_s })
Analytics.event('ad_watched', { ad_id, reward_id })
Analytics.event('ad_skipped', { ad_id })
Analytics.event('achievement_unlocked', { achievement_id })
Analytics.event('purchase', { product_id, price })
```

---

## Platform

```js
Platform.isYandex → boolean
Platform.lang → string              // язык из среды площадки

Platform.player → {
  isAuthorized: boolean,
  id?: string,
  name?: string,
  photo?: string
}

Platform.leaderboard → {
  setScore(name: string, score: number) → Promise<void>,
  getEntries(name: string, opts?) → Promise<LeaderboardEntry[]>
}

Platform.cloudSave → {
  get() → Promise<Record<string, any>>,
  set(data: Record<string, any>) → Promise<void>
}

Platform.features.GamesAPI → {
  getAllGames() → Promise<GameInfo[]>
  // Используй для перекрёстных ссылок на игры студии (п. 8.4 правил площадки)
}

Platform.ready() → void   // вызов LoadingAPI.ready() — только когда игрок может играть
```

---

## Brand

```js
Brand.showSplash() → Promise<void>
  // Показать заставку abeeStudio (SVG-анимация, ≤1.5с, пропускается по тапу).
  // Вызывается автоматически в Engine.start() до LoadingAPI.ready().

Brand.config → {
  studioName: string,
  games: Array<{ id: string, title: string }>  // из game.config.js
}
```
