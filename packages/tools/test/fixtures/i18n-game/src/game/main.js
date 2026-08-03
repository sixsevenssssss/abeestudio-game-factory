import { Engine, L10n } from '../engine/index.js';
import { GameplayScene } from './scenes/gameplay-scene.js';
import { BALANCE } from './data/balance.js';

// Точка входа геймплея. Весь текст — только через L10n.t.
Engine.start({
  scenes: { gameplay: GameplayScene },
  config: BALANCE,
});
