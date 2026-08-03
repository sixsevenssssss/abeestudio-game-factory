#!/usr/bin/env python3
"""
check-showcase.py — проверяльщик витрины @abeestudio/ui
Запускать из корня локальной копии репозитория:

    python3 packages/ui/tools/check-showcase.py [--screenshots]

Требует:
    pip install --quiet playwright
    python3 -m playwright install chromium   # ~113 MB, только если ~/.cache/ms-playwright пуст

Если showcase/index.html не существует — выходит с кодом 0 (штатно для тиков до создания витрины).
Возвращает ненулевой код и список проблем при любой найденной проблеме.
"""

import sys
import os
import subprocess
import time
import argparse

# Путь до папки витрины относительно корня репозитория
SHOWCASE_DEFAULT = os.path.join(os.path.dirname(__file__), '..', 'showcase')
PORT = 8901
VIEWPORTS = [
    {'width': 360,  'height': 740,  'name': 'phone'},
    {'width': 820,  'height': 1180, 'name': 'tablet'},
    {'width': 1440, 'height': 900,  'name': 'desktop'},
]
# Минимальная зона нажатия (Яндекс Игры п. 1.6)
MIN_TAP_PX = 44
# Допустимое превышение scrollWidth над viewport (1px — допуск на субпиксельное округление)
OVERFLOW_TOLERANCE = 1
# Темы для проверки (CSS-классы на <html>)
THEMES = ['theme-abee-default', 'theme-cosmic-dark']
# Переключатели языка (data-атрибуты, ищем в витрине)
LANG_TOGGLE_SELECTOR = '[data-lang="en"], #lang-en, [data-action="lang-en"]'


def main():
    parser = argparse.ArgumentParser(description='Проверка витрины @abeestudio/ui')
    parser.add_argument('--dir', default=SHOWCASE_DEFAULT, help='Путь к папке витрины')
    parser.add_argument('--screenshots', action='store_true',
                        help='Сохранять скриншоты в /tmp/showcase-screenshots/')
    parser.add_argument('--verbose', '-v', action='store_true',
                        help='Подробный вывод даже при успехе')
    args = parser.parse_args()

    showcase_dir = os.path.abspath(args.dir)
    index_html = os.path.join(showcase_dir, 'index.html')

    if not os.path.isfile(index_html):
        print(f'[check-showcase] Витрина не найдена ({index_html}). OK — пропуск для этого тика.')
        sys.exit(0)

    print(f'[check-showcase] Проверяем: {showcase_dir}')

    # Запускаем встроенный HTTP-сервер Python
    server_proc = subprocess.Popen(
        [sys.executable, '-m', 'http.server', str(PORT), '--directory', showcase_dir],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )
    time.sleep(1.5)  # ждём старта

    problems = []
    try:
        problems = _run_checks(args, showcase_dir)
    finally:
        server_proc.terminate()
        try:
            server_proc.wait(timeout=5)
        except subprocess.TimeoutExpired:
            server_proc.kill()

    if problems:
        print(f'[check-showcase] ПРОБЛЕМЫ ({len(problems)}):')
        for p in problems:
            print(f'  ✗ {p}')
        sys.exit(1)
    else:
        print('[check-showcase] ОК — нарушений не найдено.')
        sys.exit(0)


def _run_checks(args, showcase_dir):
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print('[check-showcase] ОШИБКА: playwright не установлен. Запустите:')
        print('  pip install --quiet playwright')
        print('  python3 -m playwright install chromium')
        return ['playwright не установлен — проверка невозможна']

    problems = []
    base_url = f'http://127.0.0.1:{PORT}/'

    if args.screenshots:
        scr_dir = '/tmp/showcase-screenshots'
        os.makedirs(scr_dir, exist_ok=True)
    else:
        scr_dir = None

    with sync_playwright() as p:
        browser = p.chromium.launch()

        for theme in THEMES:
            for vp in VIEWPORTS:
                label = f'{theme}/{vp["name"]}'
                console_errors = []

                ctx = browser.new_context(viewport={'width': vp['width'], 'height': vp['height']})
                page = ctx.new_page()
                page.on('console', lambda msg, t=None:
                    console_errors.append(msg.text) if msg.type == 'error' else None)
                page.on('pageerror', lambda err:
                    console_errors.append(f'PAGE ERROR: {err}'))

                try:
                    page.goto(base_url, wait_until='networkidle', timeout=15000)
                except Exception as e:
                    problems.append(f'{label}: страница не загрузилась — {e}')
                    ctx.close()
                    continue

                # Применяем тему (если переключатель есть — кликаем, иначе меняем класс в JS)
                try:
                    theme_btn = page.query_selector(f'[data-theme="{theme}"]')
                    if theme_btn:
                        theme_btn.click()
                        page.wait_for_timeout(200)
                    else:
                        page.evaluate(f'document.documentElement.className = "{theme}"')
                        page.wait_for_timeout(100)
                except Exception:
                    pass

                # --- Проверка 1: ошибки консоли ---
                for err in console_errors:
                    problems.append(f'{label}: console error — {err}')

                # --- Проверка 2: горизонтальное переполнение ---
                scroll_w = page.evaluate('document.documentElement.scrollWidth')
                if scroll_w > vp['width'] + OVERFLOW_TOLERANCE:
                    problems.append(
                        f'{label}: горизонтальное переполнение '
                        f'{scroll_w}px > {vp["width"]}px'
                    )

                # --- Проверка 3: зоны нажатия ≥ 44px ---
                small = page.evaluate(f'''() => {{
                    const MIN = {MIN_TAP_PX};
                    const sel = 'button, a[href], [role="button"], input[type="checkbox"], '
                              + 'input[type="radio"], input[type="range"], select, [data-tap]';
                    const issues = [];
                    document.querySelectorAll(sel).forEach(el => {{
                        const r = el.getBoundingClientRect();
                        // Только видимые элементы
                        if (r.width > 0 && r.height > 0 && r.width < MIN || r.height < MIN) {{
                            if (r.width > 0 && r.height > 0) {{
                                const desc = el.tagName.toLowerCase()
                                    + (el.id ? '#' + el.id : '')
                                    + (el.className ? '.' + String(el.className).trim().split(/\\s+/)[0] : '');
                                issues.push(desc + ': ' + Math.round(r.width) + 'x' + Math.round(r.height) + 'px');
                            }}
                        }}
                    }});
                    return issues.slice(0, 5);  // не более 5 в отчёте
                }}''')
                for s in small:
                    problems.append(f'{label}: малая зона нажатия < 44px — {s}')

                # --- Проверка 4: смена языка на EN не ломает вёрстку ---
                try:
                    lang_btn = page.query_selector(LANG_TOGGLE_SELECTOR)
                    if lang_btn:
                        lang_btn.click()
                        page.wait_for_timeout(400)

                        # overflow после смены языка
                        sw_en = page.evaluate('document.documentElement.scrollWidth')
                        if sw_en > vp['width'] + OVERFLOW_TOLERANCE:
                            problems.append(
                                f'{label}/EN: горизонтальное переполнение после смены языка '
                                f'{sw_en}px > {vp["width"]}px'
                            )

                        # обрезание текста в кнопках (scrollWidth > clientWidth)
                        clipped = page.evaluate('''() => {
                            const issues = [];
                            document.querySelectorAll('button, .ui-btn, [role="button"]').forEach(el => {
                                if (el.scrollWidth > el.clientWidth + 2 && el.clientWidth > 0) {
                                    const desc = el.className
                                        ? String(el.className).trim().split(/\\s+/)[0]
                                        : el.tagName.toLowerCase();
                                    issues.push(desc);
                                }
                            });
                            return issues.slice(0, 3);
                        }''')
                        for c in clipped:
                            problems.append(f'{label}/EN: текст обрезан в элементе — {c}')
                except Exception:
                    pass  # Переключатель языка может ещё не существовать

                # --- Скриншот ---
                if scr_dir:
                    shot_name = f'{theme.replace("-","_")}_{vp["name"]}.png'
                    page.screenshot(path=os.path.join(scr_dir, shot_name), full_page=True)

                ctx.close()

        browser.close()

    return problems


if __name__ == '__main__':
    main()
