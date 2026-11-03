"""画面の自動チェック（Playwright）。 実行: npm run build && python3 tests/e2e/run_all.py
- 各画面サイズでページ全体がスクロールしない・横にはみ出さない・JSエラーが出ない
- 画像保存ダイアログが開き、PNGがダウンロードできる
Chromeの場所は環境変数 CHROME で指定（未指定なら Playwright 同梱のChromium）。
ネットワークに出ない環境でも動くよう、Googleフォントの<link>は取り除いて読み込む。
"""
import os, re, sys, tempfile, pathlib
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parents[2]
SRC = (ROOT / 'dist/site/index.html').read_text(encoding='utf8')
SRC = re.sub(r'<link[^>]*fonts\.(googleapis|gstatic)[^>]*>', '', SRC)
tmp = pathlib.Path(tempfile.mkdtemp()) / 'page.html'
tmp.write_text(SRC, encoding='utf8')
URL = tmp.as_uri()
SIZES = [(1280, 720), (1440, 900), (1024, 640), (390, 780), (390, 700), (360, 640)]
fails = []

with sync_playwright() as p:
    kw = {'args': ['--no-sandbox']}
    if os.environ.get('CHROME'): kw['executable_path'] = os.environ['CHROME']
    b = p.chromium.launch(**kw)
    for w, h in SIZES:
        pg = b.new_page(viewport={'width': w, 'height': h}); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.goto(URL); pg.wait_for_timeout(1000)
        m = pg.evaluate('''()=>{const s=document.scrollingElement;return {v:s.scrollHeight-s.clientHeight,hz:s.scrollWidth-s.clientWidth}}''')
        ok = m['v'] <= 1 and m['hz'] <= 0 and not errs
        print(('OK  ' if ok else 'FAIL'), f'{w}x{h}', m, errs)
        if not ok: fails.append(f'{w}x{h}')
        pg.close()
    # 画像保存
    pg = b.new_page(viewport={'width': 1280, 'height': 720}, accept_downloads=True)
    pg.goto(URL); pg.wait_for_timeout(800)
    pg.click('#shootBtn'); pg.wait_for_timeout(400)
    with pg.expect_download(timeout=10000) as d:
        pg.click('#saveBtn')
    name = d.value.suggested_filename
    ok = bool(re.match(r'crosstick-\d{8}-\d{6}-(1x1|16x9|9x16)\.png$', name))
    print(('OK  ' if ok else 'FAIL'), 'download', name)
    if not ok: fails.append('download')
    b.close()
sys.exit(1 if fails else 0)
