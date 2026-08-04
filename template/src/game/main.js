/**
 * main.js — точка входа геймплея.
 * 1. Загружает словари локализации
 * 2. Регистрирует сцены
 * 3. Запускает Engine.start()
 */
import { Engine }        from '../engine/index.js';
import { gameConfig }    from '../../game.config.js';
import { GameplayScene } from './scenes/gameplay-scene.js';

async function loadDictionaries() {
  const [ru, en] = await Promise.all([
    fetch('./i18n/ru.json').then(r => r.json()),
    fetch('./i18n/en.json').then(r => r.json()),
  ]);
  return { ru, en };
}

async function main() {
  const preloader = document.getElementById('preloader');
  try {
    gameConfig.i18n.dictionaries = await loadDictionaries();
    const canvas    = document.getElementById('game-canvas');
    const container = document.getElementById('game-ui');
    function resizeCanvas() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    await Engine.start({
      scenes:    { gameplay: GameplayScene },
      config:    gameConfig,
      container,
      canvas,
    });
    preloader?.remove();
  } catch (err) {
    console.error('[main] Критическая ошибка:', err);
    if (preloader) {
      preloader.innerHTML = `<div style="color:#f5c518;font:16px Arial;text-align:center;padding:20px">
        <p>Ошибка загрузки. ${err.message}</p>
        <button onclick="location.reload()" style="margin-top:12px;padding:8px 20px;background:#f5c518;border:none;border-radius:4px;cursor:pointer">Перезагрузить</button>
      </div>`;
    }
  }
}
main();
