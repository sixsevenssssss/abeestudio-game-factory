import { Button,   updateButton   } from './components/Button.js';
import { Toggle,   updateToggle   } from './components/Toggle.js';
import { Slider,   updateSlider   } from './components/Slider.js';
import { Tabs,     updateTabs     } from './components/Tabs.js';
import { Input,    updateInput    } from './components/Input.js';
import { Checkbox, updateCheckbox } from './components/Checkbox.js';
import { Panel, Card               } from './components/Panel.js';
import { Modal                     } from './components/Modal.js';
import { switchTheme, getCurrentTheme, AVAILABLE_THEMES } from './themes/index.js';

export const UI = {
  version: '0.1.2',
  Button, updateButton, Toggle, updateToggle, Slider, updateSlider,
  Tabs, updateTabs, Input, updateInput, Checkbox, updateCheckbox,
  Panel, Card, Modal,
  switchTheme, getCurrentTheme, AVAILABLE_THEMES,
};
