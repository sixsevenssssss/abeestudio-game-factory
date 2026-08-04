// ВСЯ настройка игры в одном месте
export default {
  id: 'PLACEHOLDER_GAME_ID',   // идентификатор из консоли площадки подставляет владелец
  firstScene: 'gameplay',

  // Бренд студии: отсюда ядро берёт заставку и подпись
  brand: {
    studioName: 'abeeStudio',
    splashDuration: 1200,
    games: [],                 // перекрёстные ссылки только через Platform.features.GamesAPI
  },

  i18n: { default: 'ru', supported: ['ru', 'en'] },
  audio: { music: 0.6, sfx: 0.8, ui: 0.8 },
  ads:   { interstitialInterval: 60000 },
};
