import { L10n, Save } from '../../engine/index.js';
import { BALANCE } from '../data/balance.js';

export class GameplayScene {
  enter() {
    this.score = Save.get('score', 0);
    // Подписи берём из словаря, а не из кода
    this.label = L10n.t('gameplay.score', { n: this.score });
    this.pausedLabel = L10n.t('gameplay.paused');
  }

  render(ctx) {
    ctx.fillStyle = '#1a1a2e';
    ctx.font = '16px sans-serif';
    ctx.fillText(this.label, BALANCE.hud.x, BALANCE.hud.y);
  }

  update(dt) {
    this.score += BALANCE.scorePerTick * dt;
  }
}
