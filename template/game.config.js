/**
 * game.config.js — ВСЯ настройка игры abeeStudio.
 * Этот файл — единственное место настройки. Ядро (engine/) его не редактирует.
 * Переменные {{...}} заменяются генератором при создании проекта.
 */
export const gameConfig = {
  id:          '{{GAME_ID}}',
  title:       '{{GAME_TITLE}}',
  orientation: '{{GAME_ORIENTATION}}', // 'portrait' | 'landscape' | 'both'
  firstScene:  'language',  // при первом запуске; после выбора языка → 'menu'

  brand: {
    studioName: 'abeeStudio',
    games: [], // { id, title } — ссылки через Platform.features.GamesAPI (п. 8.4)
  },

  i18n: {
    defaultLang:  'ru',
    dictionaries: null, // заполняется в main.js из i18n/ru.json + en.json
  },

  audio: {
    music: { volume: 0.7 },
    sfx:   { volume: 1.0 },
    ui:    { volume: 0.9 },
  },

  ads: {
    interstitialIntervalMs: 60_000, // 60 секунд между межстраничными
  },

  save: {
    version:    1,
    migrations: [], // заполни в main.js: save.migrate(0, fn)
  },

  achievements: [
    { id: 'first_game', type: 'one-shot', reward: { coins: 50 } },
    { id: 'score_1000', type: 'progress', target: 1000, reward: { coins: 100 } },
  ],

  daily: {
    rewards: [
      { coins: 50  }, { coins: 100 }, { coins: 150 }, { coins: 200 },
      { coins: 300 }, { coins: 400 }, { coins: 500 },
    ],
  },

  economy: {
    startCoins: 0,
  },
};
