#!/usr/bin/env python3
"""
check-showcase.py — проверяльщик витрины @abeestudio/ui
Запускать из корня локальной копии репозитория:

    python3 packages/ui/tools/check-showcase.py [--screenshots]

Требует:
    pip install --quiet playwright
    python3 -m playwright install chromium   # ~113 MB, только если кэш пуст

HTTP-сервер поднимается из packages/ui/ (не из showcase/), чтобы относительные
пути ../src/base/base.css и ../src/themes/*.css разрешались корректно.
URL витрины: http://127.0.0.1:PORT/showcase/

Если showcase/index.html не существует — выходит с кодом 0 (штатно для тиков
до создания витрины).
Ненулевой код + список проблем при любой найденной проблеме.
"""

import sys
import os
import subprocess
import time
import argparse

# Директория витрины (showcase/index.html)
SHOWCASE_DIR_DEFAULT = os.path.join(os.path.dirname(__file__), '..', 'showcase')
# Корень пакета (packages/ui/) — отсюда поднимается HTTP-сервер
PKG_ROOT_DEFAULT = os.path.join(os.path.dirname(__file__), '..')

PORT = 8901
VIEWPORTS = [
    {'width': 360,  'height': 740,  'name': 'phone'},
    {'width': 820,  'height': 1180, 'name': 'tablet'},
    {'width': 1440, 'height': 900,  'name': 'desktop'},
]
MIN_TAP_PX = 44           # минимальная зона нажатия (Яндекс Игры п. 1.6)
OVERFLOW_TOL = 1          # допуск 1px (субпиксельное округление)
# Темы для проверки (значение data-theme в HTML)
THEMES = ['theme-abee-default', 'theme-cosmic-dark']
LANG_EN_SELECTOR = '[data-lang="en"], #lang-en, [data-action="lang-en"]'


def main():
    parser = argparse.ArgumentParser(description='Проверка витрины @abeestudio/ui')
    parser.add_argument('--dir', default=SHOWCASE_DIR_DEFAULT,
                        help='Путь к папке витрины (ищет index.html)')
    parser.add_argument('--pkg-root', default=PKG_ROOT_DEFAULT,
                        help='Корень пакета (откуда поднимается HTTP-сервер)')
    parser.add_argument('--screenshots', action='store_true',
                        help='Сохранять скриншоты в /tmp/showcase-screenshots/')
    parser.add_argument('--verbose', '-v', action='store_true')
    args = parser.parse_args()

    showcase_dir = os.path.abspath(args.dir)
    pkg_root     = os.path.abspath(args.pkg_root)
    index_html   = os.path.join(showcase_dir, 'index.html')

    if not os.path.isfile(index_html):
        print(f'[check-showcase] Витрина не найдена ({index_html}). OK — пропуск.')
        sys.exit(0)

    # Имя папки витрины относительно pkg_root (обычно "showcase")
    showcase_rel = os.path.relpath(showcase_dir, pkg_root)
    base_url = f'http://127.0.0.1:{PORT}/{showcase_rel}/'
    print(f'[check-showcase] Сервер: {pkg_root}  URL: {base_url}')

    server_proc = subprocess.Popen(
        [sys.executable, '-m', 'http.server', str(PORT), '--directory', pkg_root],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )
    time.sleep(1.5)

    problems = []
    try:
        problems = _run_checks(args, base_url)
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
        print('[check-showcase] ОК.')
        sys.exit(0)


def _run_checks(args, base_url):
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print('[check-showcase] ОШИБКА: нет playwright. Запустите:')
        print('  pip install --quiet playwright')
        print('  python3 -m playwright install chromium')
        return ['playwright не установлен']

    problems = []
    scr_dir = None
    if args.screenshots:
        scr_dir = '/tmp/showcase-screenshots'
        os.makedirs(scr_dir, exist_ok=True)

    with sync_playwright() as p:
        browser = p.chromium.launch()

        for theme in THEMES:
            for vp in VIEWPORTS:
                label = f'{theme}/{vp["name"]}'
                console_errors = []

                ctx  = browser.new_context(viewport={'width': vp['width'], 'height': vp['height']})
                page = ctx.new_page()
                page.on('console',   lambda m:   console_errors.append(m.text) if m.type == 'error' else None)
                page.on('pageerror', lambda err: console_errors.append(f'PAGE: {err}'))

                try:
                    page.goto(base_url, wait_until='networkidle', timeout=20000)
                except Exception as e:
                    problems.append(f'{label}: страница не загрузилась — {e}')
                    ctx.close()
                    continue

                # Применяем тему
                try:
                    tb = page.query_selector(f'[data-theme="{theme}"]')
                    if tb:
                        tb.click()
                        page.wait_for_timeout(250)
                    else:
                        page.evaluate(
                            f'document.documentElement.className = document.documentElement.className'
                            f'.replace(/theme-\\S+/g,"").trim() + " {theme} dark"')
                        page.wait_for_timeout(100)
                except Exception:
                    pass

                # 1. Ошибки консоли
                for err in console_errors:
                    problems.append(f'{label}: console error — {err}')

                # 2. Горизонтальное переполнение
                sw = page.evaluate('document.documentElement.scrollWidth')
                if sw > vp['width'] + OVERFLOW_TOL:
                    problems.append(f'{label}: горизонт. переполнение {sw}px > {vp["width"]}px')

                # 3. Зоны нажатия < 44px
                small = page.evaluate(f'''() => {{
                    const MIN = {MIN_TAP_PX};
                    const sel = 'button, a[href], [role="button"], input[type="checkbox"],'
                        + 'input[type="radio"], input[type="range"], select, [data-tap]';
                    const issues = [];
                    document.querySelectorAll(sel).forEach(el => {{
                        const r = el.getBoundingClientRect();
                        if (r.width > 0 && r.height > 0 && (r.width < MIN || r.height < MIN)) {{
                            const id = el.id ? '#'+el.id : (el.className
                                ? '.'+String(el.className).trim().split(/\\s+/)[0] : el.tagName.toLowerCase());
                            issues.push(id+': '+Math.round(r.width)+'×'+Math.round(r.height)+'px');
                        }}
                    }});
                    return issues.slice(0, 5);
                }}''')
                for s in small:
                    problems.append(f'{label}: зона нажатия < 44px — {s}')

                # 4. Переключение языка EN → проверяем повторно
                try:
                    lang_btn = page.query_selector(LANG_EN_SELECTOR)
                    if lang_btn:
                        lang_btn.click()
                        page.wait_for_timeout(400)

                        sw_en = page.evaluate('document.documentElement.scrollWidth')
                        if sw_en > vp['width'] + OVERFLOW_TOL:
                            problems.append(f'{label}/EN: переполнение после смены языка {sw_en}px')

                        clipped = page.evaluate('''() => {
                            const issues = [];
                            document.querySelectorAll('button, .ui-btn, [role="button"]').forEach(el => {
                                if (el.clientWidth > 0 && el.scrollWidth > el.clientWidth + 2) {
                                    issues.push(String(el.className).trim().split(/\\s+/)[0]
                                        || el.tagName.toLowerCase());
                                }
                            });
                            return issues.slice(0, 3);
                        }''')
                        for c in clipped:
                            problems.append(f'{label}/EN: текст обрезан в — {c}')
                except Exception:
                    pass

                # 5. Скриншот
                if scr_dir:
                    shot = f'{theme.replace("-","_")}_{vp["name"]}.png'
                    page.screenshot(path=os.path.join(scr_dir, shot), full_page=False)

                ctx.close()

        browser.close()

    return problems


if __name__ == '__main__':
    main()
