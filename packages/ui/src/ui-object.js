/**
 * ui-object.js — объект UI для удобного импорта всей библиотеки
 * import { UI } from '../ui/index.js';
 * UI.Button(...), UI.switchTheme(...), etc.
 */

import { Button, updateButton } from './components/Button.js';
import { switchTheme, getCurrentTheme, AVAILABLE_THEMES } from './themes/index.js';

export const UI = {
  version: '0.0.5',

  // Компоненты
  Button,
  updateButton,

  // Темы
  switchTheme,
  getCurrentTheme,
  AVAILABLE_THEMES,
};
