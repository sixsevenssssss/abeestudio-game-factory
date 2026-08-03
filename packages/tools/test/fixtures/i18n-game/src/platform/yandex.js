// Адаптер площадки: ЕДИНСТВЕННОЕ место, где разрешён ysdk.
// Игровой код обращается только к Platform, никогда к ysdk напрямую.
let ysdk = null;

export const Platform = {
  async init() {
    ysdk = await YaGames.init();
    return ysdk;
  },
  get lang() {
    return ysdk?.environment?.i18n?.lang ?? 'ru';
  },
  ready() {
    ysdk?.features?.LoadingAPI?.ready();
  },
};
