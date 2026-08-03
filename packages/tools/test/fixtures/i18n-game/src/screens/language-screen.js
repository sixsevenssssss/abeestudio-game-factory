import { L10n } from '../engine/index.js';

// Экран первого запуска: выбор языка
export class LanguageScreen {
  enter() {
    this.title = L10n.t('lang.choose');
  }
}
