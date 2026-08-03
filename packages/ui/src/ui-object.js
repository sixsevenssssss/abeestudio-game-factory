/**
 * ui-object.js — объект UI для удобного импорта
 * import { UI } from '../ui/index.js';
 */
import { Button, updateButton } from './components/Button.js';
import { Toggle, updateToggle } from './components/Toggle.js';
import { switchTheme, getCurrentTheme, AVAILABLE_THEMES } from './themes/index.js';

export const UI = {
  version: '0.0.6',
  Button, updateButton,
  Toggle, updateToggle,
  switchTheme, getCurrentTheme, AVAILABLE_THEMES,
};
