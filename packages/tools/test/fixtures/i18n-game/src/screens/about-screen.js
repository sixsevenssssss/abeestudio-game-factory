import { L10n, Brand } from '../engine/index.js';

// Окно «Об игре»: подпись студии и перекрёстные ссылки
export class AboutScreen {
  enter() {
    this.studio = Brand.config.studioName;
    this.title = L10n.t('about.title');
  }
}
