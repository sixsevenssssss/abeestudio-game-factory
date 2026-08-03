// @abeestudio/ui — точка входа библиотеки интерфейса
// Импортируй нужные элементы напрямую:
//   import { Button } from '../ui/index.js';
//   import { UI }    from '../ui/index.js';
//
// Все элементы — чистые ES-модули, без шага сборки, ноль зависимостей в рантайме.

// ---------- Элементы ----------
export { Button, updateButton } from './components/Button.js';
// export { Toggle }        from './components/Toggle.js';       // тик 6
// export { Slider }        from './components/Slider.js';       // тик 7
// export { Tabs }          from './components/Tabs.js';         // тик 8
// export { Input }         from './components/Input.js';        // тик 9
// export { Checkbox }      from './components/Checkbox.js';     // тик 10
// export { Panel, Card }   from './components/Panel.js';        // тик 11
// export { Modal }         from './components/Modal.js';        // тик 12
// ... (остальные — по бэклогу)

// ---------- Система тем ----------
export { switchTheme, getCurrentTheme, AVAILABLE_THEMES } from './themes/index.js';

// ---------- Объект UI — для удобного импорта всей библиотеки ----------
// import { UI } from '../ui/index.js';
// UI.Button({ label: 'Старт', variant: 'primary', onClick: startGame })
export { UI } from './ui-object.js';
