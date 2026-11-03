"""画面の自動チェック（Playwright）。 実行: npm run build && python3 tests/e2e/run_all.py
- 各画面サイズ×3言語（日本語・ベトナム語・英語）でページ全体がスクロールしない・横にはみ出さない・JSエラーが出ない
- 言語選択で表示言語・タイトル・点数の単位が切り替わる
- 除外メッセージ（注意）が出ても、入力欄・ボタン・盤面の位置と大きさが動かない（メッセージの場所は最初から確保）
- 入力が1行から3行に増えても、入力欄・ボタン・盤面の位置と大きさが動かない（入力欄は2行ぶんで固定）。PCでは入力欄と再配置ボタンの上端がそろう
- 入力中にスペースなどを足して銘柄が変わらないときは、盤面を描き直さない（ちらつき防止）。銘柄が変わると描き直す
- 入力したティッカーがブラウザ内に保存され、再読み込みで戻る（空にすると初期の銘柄に戻る）。通信は発生しない
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
LANGS = [('ja', '点', 'ベトナム株'), ('vi', 'điểm', 'Biến mã'), ('en', 'pts', 'Turn Vietnamese')]
fails = []

with sync_playwright() as p:
    kw = {'args': ['--no-sandbox']}
    if os.environ.get('CHROME'): kw['executable_path'] = os.environ['CHROME']
    b = p.chromium.launch(**kw)
    for lang, unit, _ in LANGS:
        for w, h in SIZES:
            pg = b.new_page(viewport={'width': w, 'height': h}); errs = []
            pg.on('pageerror', lambda e: errs.append(str(e)))
            pg.goto(URL + '#' + lang); pg.wait_for_timeout(1000)
            m = pg.evaluate('''()=>{const s=document.scrollingElement;return {v:s.scrollHeight-s.clientHeight,hz:s.scrollWidth-s.clientWidth}}''')
            ok = m['v'] <= 1 and m['hz'] <= 0 and not errs and pg.evaluate('document.documentElement.lang') == lang
            print(('OK  ' if ok else 'FAIL'), lang, f'{w}x{h}', m, errs)
            if not ok: fails.append(f'{lang} {w}x{h}')
            pg.close()
    # 言語の切り替え（選択 → 表示言語・タイトル・点数の単位）
    pg = b.new_page(viewport={'width': 1280, 'height': 720}); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(URL); pg.wait_for_timeout(800)
    for lang, unit, title_part in LANGS:
        pg.select_option('#lang', lang); pg.wait_for_timeout(300)
        got = (pg.evaluate('document.documentElement.lang'), pg.title(), pg.inner_text('.sc-unit'))
        ok = got[0] == lang and title_part in got[1] and got[2] == unit and not errs
        print(('OK  ' if ok else 'FAIL'), 'switch', lang, got, errs)
        if not ok: fails.append('switch ' + lang)
    pg.close()
    # 注意メッセージが出ても画面が動かない（入力欄は同じ行数のまま比べる）
    for w, h in [(1280, 720), (390, 780), (360, 640)]:
        pg = b.new_page(viewport={'width': w, 'height': h}); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.goto(URL + '#ja'); pg.wait_for_timeout(700)
        snap = lambda: pg.evaluate("""()=>['tickers','shuffle','board','hint'].map(i=>{const r=document.getElementById(i).getBoundingClientRect();return [Math.round(r.top),Math.round(r.height)]})""")
        pg.fill('#tickers', 'SSI CTR VCI'); pg.wait_for_timeout(700)
        a = snap(); had_a = pg.inner_text('#hint').strip()
        pg.fill('#tickers', 'SSI CTR ZZZ'); pg.wait_for_timeout(700)
        c = snap(); had_c = pg.inner_text('#hint').strip()
        ok = a == c and not had_a and bool(had_c) and not errs
        print(('OK  ' if ok else 'FAIL'), 'hint-stable', f'{w}x{h}', a == c, repr(had_c)[:40], errs)
        if not ok: fails.append(f'hint-stable {w}x{h}')
        pg.close()
    # 入力が増えて何行になっても枠が動かない（入力欄は最初から2行ぶん。上端は再配置ボタンとそろう）
    for w, h in [(1280, 720), (390, 780), (360, 640)]:
        pg = b.new_page(viewport={'width': w, 'height': h}); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.goto(URL + '#ja'); pg.wait_for_timeout(700)
        snap = lambda: pg.evaluate("""()=>['tickers','shuffle','board','hint'].map(i=>{const r=document.getElementById(i).getBoundingClientRect();return [Math.round(r.top),Math.round(r.height)]})""")
        pg.fill('#tickers', 'SSI'); pg.wait_for_timeout(600); a = snap()
        pg.fill('#tickers', 'SSI CTR VCI FRT FPT DGW DPM MWG HPG VPB DMX BID CTG VNM VIC'); pg.wait_for_timeout(600); c = snap()
        sc = pg.evaluate('(()=>{const s=document.scrollingElement;return s.scrollHeight-s.clientHeight})()')
        aligned = True if w < 761 else abs(a[0][0] - a[1][0]) <= 1
        ok = a == c and aligned and sc <= 1 and not errs
        print(('OK  ' if ok else 'FAIL'), 'ta-fixed', f'{w}x{h}', a == c, 'aligned', aligned, 'scroll', sc, errs)
        if not ok: fails.append(f'ta-fixed {w}x{h}')
        pg.close()
    # 銘柄が変わらない入力（末尾のスペース・入力途中の文字）では盤面を描き直さない
    pg = b.new_page(viewport={'width': 1280, 'height': 720}); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(URL + '#ja'); pg.wait_for_timeout(700)
    pg.fill('#tickers', 'SSI CTR VCI'); pg.wait_for_timeout(700)
    pg.evaluate("window.__svg=document.querySelector('#stage svg')")
    same = lambda: pg.evaluate("document.querySelector('#stage svg')===window.__svg")
    pg.fill('#tickers', 'SSI CTR VCI '); pg.wait_for_timeout(700); s1 = same()
    pg.fill('#tickers', 'SSI CTR VCI  F'); pg.wait_for_timeout(700); s2 = same()
    pg.fill('#tickers', 'SSI CTR VCI FPT'); pg.wait_for_timeout(700); s3 = same()
    ok = s1 and s2 and not s3 and not errs
    print(('OK  ' if ok else 'FAIL'), 'no-redraw', s1, s2, 'redraw-on-change', not s3, errs)
    if not ok: fails.append('no-redraw')
    pg.close()
    # 入力したティッカーの保持（このブラウザの中だけ）
    ctx = b.new_context(viewport={'width': 1280, 'height': 720}); pg = ctx.new_page(); errs = []; reqs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.on('request', lambda r: reqs.append(r.url) if not r.url.startswith('file:') else None)
    pg.goto(URL); pg.wait_for_timeout(600)
    default = pg.input_value('#tickers')
    pg.fill('#tickers', 'ssi vci'); pg.wait_for_timeout(700)
    pg.reload(); pg.wait_for_timeout(600)
    kept = pg.input_value('#tickers')
    pg.fill('#tickers', ''); pg.wait_for_timeout(700)
    pg.reload(); pg.wait_for_timeout(600)
    back = pg.input_value('#tickers')
    ok = kept == 'SSI VCI' and back == default and not errs and not reqs
    print(('OK  ' if ok else 'FAIL'), 'persist', repr(kept), back == default, errs, reqs)
    if not ok: fails.append('persist')
    ctx.close()
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
