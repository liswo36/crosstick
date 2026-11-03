"""本番と同じ _headers（CSP など）を付けてサイトを配信し、実ブラウザで操作して CSP 違反が出ないことを確かめる。
実行: npm run build && python3 tests/e2e/csp_check.py   （Chrome の場所は環境変数 CHROME）
- 'unsafe-inline' が無いこと、script/style のハッシュが実物と一致することも検査する
- 入力・言語切替・色チップ・画像保存ダイアログ・再読み込みを操作して、securitypolicyviolation を集める
- 外部（Googleフォント）への読み込みはこの環境では失敗してよい（違反としては数えない）
"""
import os, re, sys, base64, hashlib, threading, pathlib, http.server, socketserver
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parents[2]
SITE = ROOT / 'dist/site'
hdr_text = (SITE / '_headers').read_text(encoding='utf8')
star = hdr_text.split('\n/favicon.svg')[0]
HEADERS = {}
for line in star.splitlines()[1:]:
    k, v = line.strip().split(': ', 1)
    HEADERS[k] = v
fails = []

def sha(s): return "'sha256-" + base64.b64encode(hashlib.sha256(s.encode('utf8')).digest()).decode() + "'"

csp = HEADERS['Content-Security-Policy']
if "'unsafe-inline'" in csp or "'unsafe-eval'" in csp: fails.append("CSP に unsafe-inline/unsafe-eval が残っている")
for name in ['index.html', 'terms.html', 'privacy.html']:
    h = (SITE / name).read_text(encoding='utf8')
    for m in re.finditer(r'<script(?![^>]*\bsrc=)[^>]*>(.*?)</script>', h, re.S):
        if sha(m.group(1)) not in csp: fails.append(f'{name}: script のハッシュが CSP に無い')
    for m in re.finditer(r'<style[^>]*>(.*?)</style>', h, re.S):
        if sha(m.group(1)) not in csp: fails.append(f'{name}: style のハッシュが CSP に無い')
    if re.search(r'\sstyle=|\son[a-z]+=', h): fails.append(f'{name}: style 属性またはイベント属性が残っている')

class H(http.server.SimpleHTTPRequestHandler):
    def __init__(s, *a, **k): super().__init__(*a, directory=str(SITE), **k)
    def end_headers(s):
        for k, v in HEADERS.items(): s.send_header(k, v)
        super().end_headers()
    def log_message(s, *a): pass

srv = socketserver.TCPServer(('127.0.0.1', 0), H)
threading.Thread(target=srv.serve_forever, daemon=True).start()
BASE = f'http://127.0.0.1:{srv.server_address[1]}/'

HOOK = """window.__v=[];document.addEventListener('securitypolicyviolation',function(e){window.__v.push(e.violatedDirective+' '+e.blockedURI+' '+(e.sample||''))});"""

with sync_playwright() as p:
    kw = {'args': ['--no-sandbox']}
    if os.environ.get('CHROME'): kw['executable_path'] = os.environ['CHROME']
    b = p.chromium.launch(**kw)
    ctx = b.new_context(viewport={'width': 1280, 'height': 720}, accept_downloads=True)
    ctx.add_init_script(HOOK)
    pg = ctx.new_page()
    errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.route(re.compile(r'https://fonts\.(googleapis|gstatic)\.com/.*'), lambda r: r.abort())
    for page_name in ['', 'terms', 'privacy']:
        pg.goto(BASE + page_name); pg.wait_for_timeout(600)
        v = pg.evaluate('window.__v')
        if v: fails.append(f'/{page_name}: CSP 違反 {v}')
    pg.goto(BASE + '#ja'); pg.wait_for_timeout(800)
    pg.fill('#tickers', 'VCB FPT HPG MWG VNM SSI ACB') if pg.query_selector('#tickers') else pg.fill('textarea', 'VCB FPT HPG MWG VNM SSI ACB')
    pg.wait_for_timeout(900)
    n_pop = pg.evaluate("document.querySelectorAll('svg#puzzle .pop').length")
    o_ok = pg.evaluate("Array.from(document.querySelectorAll('svg#puzzle .pop')).every(g=>g.style.getPropertyValue('--o')!=='')")
    c_ok = pg.evaluate("Array.from(document.querySelectorAll('.chip')).every(b=>b.style.getPropertyValue('--c')!=='')")
    ink = pg.evaluate("document.querySelectorAll('svg#puzzle text.ink').length")
    if n_pop == 0: fails.append('盤面が描かれていない')
    if not o_ok: fails.append('アニメ順 --o が設定されていない')
    if not c_ok: fails.append('チップの色 --c が設定されていない')
    for lang in ['vi', 'en', 'ja']:
        pg.select_option('#lang', lang); pg.wait_for_timeout(500)
    pg.click('.chip'); pg.wait_for_timeout(300)
    pg.click('#shootBtn'); pg.wait_for_timeout(400)
    pg.click('label[for=r-3]'); pg.wait_for_timeout(200)
    with pg.expect_download(timeout=15000) as d: pg.click('#saveBtn')
    if not re.match(r'crosstick-\d{8}-\d{6}-9x16\.png$', d.value.suggested_filename) and not d.value.suggested_filename.endswith('.png'):
        fails.append('ダウンロード名が不正 ' + d.value.suggested_filename)
    pg.reload(); pg.wait_for_timeout(800)
    v = pg.evaluate('window.__v')
    if v: fails.append(f'操作中に CSP 違反 {v}')
    if errs: fails.append(f'JSエラー {errs}')
    # 敵対入力: スクリプトや属性を含む入力・不正なハッシュでも何も実行されない
    pg.goto(BASE + '#"><img src=x onerror=window.__x=1>'); pg.wait_for_timeout(500)
    pg.fill('textarea', '<img src=x onerror=window.__x=1> <script>window.__x=1</script> VCB'); pg.wait_for_timeout(900)
    if pg.evaluate('window.__x') is not None: fails.append('敵対入力でスクリプトが実行された')
    if pg.evaluate("document.querySelectorAll('img[src=x]').length"): fails.append('敵対入力が DOM に挿入された')
    b.close()

srv.shutdown()
print('NG:\n' + '\n'.join(fails) if fails else 'CSP OK（違反なし・ハッシュ一致・敵対入力は無害）')
sys.exit(1 if fails else 0)
