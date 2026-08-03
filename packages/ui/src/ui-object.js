import { Button, updateButton } from './components/Button.js';
import { Toggle, updateToggle } from './components/Toggle.js';
import { Slider, updateSlider } from './components/Slider.js';
import { switchTheme, getCurrentTheme, AVAILABLE_THEMES } from './themes/index.js';

export const UI = {
  version: '0.0.7',
  Button, updateButton,
  Toggle, updateToggle,
  Slider, updateSlider,
  switchTheme, getCurrentTheme, AVAILABLE_THEMES,
};
