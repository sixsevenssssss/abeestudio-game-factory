/**
 * GameplayScene — замени содержимое своей игровой логикой.
 * API: import { Engine, Save, Ads, Audio, L10n, Achievements, Daily } from '../../engine/index.js';
 */
import { Engine } from '../../engine/index.js';

export class GameplayScene {
  _canvas = null; _ctx = null;

  async preload() { /* загрузка ресурсов */ }

  enter(payload) {
    this._canvas = document.getElementById('game-canvas');
    this._ctx    = this._canvas?.getContext('2d') ?? null;
    this._unsubTap   = Engine.events.on('input:tap',   ({x,y})  => this._onTap(x,y));
    this._unsubPause = Engine.events.on('ui:pause_requested', () => Engine.scenes.push('pause'));
  }

  exit()   { this._unsubTap?.(); this._unsubPause?.(); }
  pause()  {}
  resume() {}

  /** @param {number} dt — шаг в секундах (0.016) */
  update(dt) { /* физика, AI, коллизии */ }

  /** @param {number} alpha — 0..1 */
  render(alpha) {
    if (!this._ctx || !this._canvas) return;
    const { width, height } = this._canvas;
    const ctx = this._ctx;
    ctx.fillStyle = '#0d0d1a';
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = '#f5c518';
    ctx.font = `bold ${Math.min(width, height) * 0.07}px Arial, sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('Hello, game!', width / 2, height / 2 - 30);
    ctx.font = `${Math.min(width, height) * 0.032}px Arial, sans-serif`;
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillText('Открой src/game/ и начни писать геймплей', width / 2, height / 2 + 20);
    // Кнопка паузы (верхний левый угол)
    ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.fillRect(16, 16, 48, 48);
    ctx.fillStyle = '#fff'; ctx.fillRect(26, 26, 10, 28); ctx.fillRect(44, 26, 10, 28);
  }

  _onTap(x, y) {
    if (x < 64 && y < 64) Engine.events.emit('ui:pause_requested');
  }
}
