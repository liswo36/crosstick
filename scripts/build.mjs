#!/usr/bin/env node
/**
 * Crosstick ビルド（外部パッケージ不要・Node 18以上）
 *
 *   node scripts/build.mjs
 *
 * src/ の部品を1つのHTMLに組み立てて dist/ に出力する。
 *   dist/site/index.html  … Cloudflare Pages などに公開する版（public/ の中身も一緒にコピー）
 *   dist/artifact.html    … Claude の Artifact に貼る版（<html>や<head>を含まない断片）
 * dist/ は生成物なので直接は編集しない。変更は src/ ・ public/ ・ site.config.json に加える。
 */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, readdirSync, copyFileSync, cpSync, rmSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const cfg = JSON.parse(read('site.config.json'));

/* ---------- 部品の読み込み ---------- */
const css = read('src/styles.css');
const core = read('src/core.js');          // 配置・採点のエンジン（画面に依存しない。tests/ で単体テストする）
const i18n = read('src/i18n.js');          // 画面の文言（日本語・ベトナム語・英語）
let app = read('src/app.js');              // 画面の処理
const logoSymbol = read('src/partials/logo-symbol.html');
let body = read('src/body.html').replace('<!--@LOGO_SYMBOL@-->', logoSymbol);
const headArtifact = read('src/head.artifact.html');

/* ---------- ベトナム株ティッカー一覧を app.js に埋め込む ---------- */
export function loadTickers() {
  const codes = read('src/data/vn-tickers.txt')
    .split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));
  for (const c of codes) {
    if (!/^[A-Z0-9]{3}$/.test(c)) throw new Error(`ティッカーの形式が不正です: ${c}（大文字英数3文字のみ）`);
  }
  if (new Set(codes).size !== codes.length) throw new Error('ティッカーに重複があります');
  return codes;
}
const codes = loadTickers();
const perLine = 22;
const rows = [];
for (let i = 0; i < codes.length; i += perLine) rows.push(codes.slice(i, i + perLine).join(' '));
if (!app.includes('/*@VN_TICKERS@*/')) throw new Error('src/app.js に /*@VN_TICKERS@*/ がありません');
app = app.replace('/*@VN_TICKERS@*/', rows.join('\n'));

/* ---------- 言語ごとのタイトル・説明（site.config.json）を app.js に埋め込む ---------- */
const siteMeta = { ja: { title: cfg.title, description: cfg.description }, ...cfg.i18n };
for (const l of ['ja', 'vi', 'en']) {
  if (!siteMeta[l] || !siteMeta[l].title || !siteMeta[l].description) throw new Error(`site.config.json に ${l} のタイトル・説明がありません`);
}
if (!app.includes('/*@SITE_META@*/null')) throw new Error('src/app.js に /*@SITE_META@*/null がありません');
const metaJson = JSON.stringify(siteMeta).replace(/</g, '\\u003c');
app = app.replace('/*@SITE_META@*/null', () => metaJson);

const scriptBody = `\n${core}\n${i18n}${app}`;
const script = `<script>${scriptBody}</script>`;

/* ---------- Claude Artifact 版（断片） ---------- */
const artifact = `${headArtifact}<style>${css}</style>${body.replace(/<!--LEGAL-->[\s\S]*?<!--\/LEGAL-->/g, '')}${script}\n`;

/* ---------- 公開サイト版 ---------- */
const fonts = [
  '<link rel="preconnect" href="https://fonts.googleapis.com">',
  '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>',
  '<link href="https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;500;700;800;900&family=Noto+Sans+JP:wght@400;500;700&display=swap" rel="stylesheet">',
].join('\n');
const esc = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const T = esc(cfg.title), D = esc(cfg.description);
const site = `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${T}</title>
<meta name="description" content="${D}">
<meta name="color-scheme" content="light dark">
<meta name="theme-color" content="${cfg.themeColorLight}" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="${cfg.themeColorDark}" media="(prefers-color-scheme: dark)">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${esc(cfg.name)}">
<meta property="og:title" content="${T}">
<meta property="og:description" content="${D}">
<meta property="og:url" content="${cfg.siteUrl}">
<meta property="og:image" content="${cfg.siteUrl}og.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="favicon.svg" type="image/svg+xml">
<link rel="icon" href="favicon-32.png" type="image/png" sizes="32x32">
<link rel="apple-touch-icon" href="apple-touch-icon.png">
${fonts}
<style>${css}</style>
</head>
<body>
<noscript><p class="nojs">このツールを使うにはJavaScriptを有効にしてください。</p></noscript>
${body.replace(/^\n+/, '')}${script}

</body>
</html>
`;


/* ---------- 利用規約・プライバシーポリシー（src/pages/*.body.html を共通の枠に入れて出力） ---------- */
const op = cfg.operator || {};
const contactChannel = op.contactChannel || '';
const contactHtml = /^https?:\/\//.test(op.contactUrl || '')
  ? `<a href="${esc(op.contactUrl)}" target="_blank" rel="noopener">${esc(contactChannel)}</a>`
  : `${esc(contactChannel)}（${esc(op.contactUrl || '')}）`;
const fillPage = (html) => html
  .replace('制定日：{{ENACTED}}', `制定日：${esc(op.enacted)}${op.revised ? '　改定日：' + esc(op.revised) : ''}`)
  .replaceAll('{{OPERATOR}}', esc(op.name))
  .replaceAll('{{CONTACT_CHANNEL}}', esc(contactChannel))
  .replaceAll('{{CONTACT}}', contactHtml)
  .replaceAll('{{COURT}}', esc(op.court))
  .replaceAll('{{SITE_URL}}', cfg.siteUrl);
const PAGE_CSS = `
:root{--bg:#f4f8fc;--surface:#fff;--on:#14202b;--on-var:#41505e;--outline:#c3ccd5;--primary:#00658f;--primary-c:#c5e7ff;--seg:#e8eef4}
@media (prefers-color-scheme:dark){:root{--bg:#0d1215;--surface:#161d22;--on:#e3eaf0;--on-var:#b3c0cc;--outline:#3b4750;--primary:#7fd0ff;--primary-c:#004c6b;--seg:#202a31}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--on);font:400 1.0625rem/1.85 'Noto Sans','Noto Sans JP',sans-serif}
.wrap{max-width:760px;margin:0 auto;padding:16px 16px 56px}
.top{display:flex;align-items:center;gap:10px;min-height:56px}
.top a{display:inline-flex;align-items:center;gap:10px;min-height:48px;padding:0 18px 0 12px;border-radius:999px;background:var(--primary-c);color:var(--primary);font-weight:700;text-decoration:none}
.top a:focus-visible,a:focus-visible{outline:3px solid var(--primary);outline-offset:2px}
.top img{width:28px;height:28px}
main{background:var(--surface);border-radius:28px;padding:28px 24px 32px;border:1px solid var(--outline)}
h1{margin:0 0 4px;font-size:1.75rem;line-height:1.4;font-weight:800}
h2{margin:32px 0 8px;font-size:1.25rem;line-height:1.5;font-weight:700}
p{margin:12px 0}
ul,ol{margin:12px 0;padding-left:1.5em}
li{margin:6px 0}
a{color:var(--primary);font-weight:500}
code{background:var(--seg);border-radius:6px;padding:2px 6px;font-size:.95em}
.meta{color:var(--on-var);font-size:.95rem;margin:0 0 20px}
.tbl{overflow-x:auto;margin:12px 0}
table{border-collapse:collapse;width:100%}
th,td{border-bottom:1px solid var(--outline);padding:10px 10px 10px 0;font-size:.95rem;text-align:left;vertical-align:top}
th{color:var(--on-var);font-weight:700}
footer{margin-top:20px;display:flex;flex-wrap:wrap;gap:6px 20px;font-size:.95rem}
@media (max-width:480px){main{padding:22px 18px 26px;border-radius:22px}}
`;
const pageHtml = (title, desc, bodyFile, other) => `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}｜${esc(cfg.name)}</title>
<meta name="description" content="${esc(desc)}">
<meta name="color-scheme" content="light dark">
<meta name="theme-color" content="${cfg.themeColorLight}" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="${cfg.themeColorDark}" media="(prefers-color-scheme: dark)">
<link rel="icon" href="favicon.svg" type="image/svg+xml">
${fonts}
<style>${PAGE_CSS}</style>
</head>
<body>
<div class="wrap">
<nav class="top"><a href="./"><img src="favicon.svg" alt="" width="28" height="28">Crosstick</a></nav>
<main>
${fillPage(read(bodyFile))}</main>
<footer><a href="./">Crosstick に戻る</a><a href="${other.href}">${other.label}</a></footer>
</div>
</body>
</html>
`;
const pages = {
  'terms.html': pageHtml('利用規約', 'Crosstick（クロスティック）の利用規約です。', 'src/pages/terms.body.html', { href: 'privacy.html', label: 'プライバシーポリシー' }),
  'privacy.html': pageHtml('プライバシーポリシー', 'Crosstick（クロスティック）が扱う情報と、外部サービスへの通信についての説明です。', 'src/pages/privacy.body.html', { href: 'terms.html', label: '利用規約' }),
};
for (const [name, html] of Object.entries(pages)) {
  if (/\{\{[A-Z_]+\}\}/.test(html)) throw new Error(`${name} に未置換の {{...}} があります`);
}
if ([op.name, op.contactUrl].some((v) => !v || /【/.test(v))) console.warn('⚠ site.config.json の operator（運営者名・連絡先）が未入力です。公開前に入力してください。');

/* ---------- 出力 ---------- */
const dist = join(ROOT, 'dist');
rmSync(dist, { recursive: true, force: true });
mkdirSync(join(dist, 'site'), { recursive: true });
writeFileSync(join(dist, 'artifact.html'), artifact);
writeFileSync(join(dist, 'site', 'index.html'), site);
for (const [name, html] of Object.entries(pages)) writeFileSync(join(dist, 'site', name), html);
for (const f of readdirSync(join(ROOT, 'public'))) {
  if (f === '_headers') continue;
  cpSync(join(ROOT, 'public', f), join(dist, 'site', f), { recursive: true });
}
/* ---------- _headers: インラインの script / style は SHA-256 ハッシュで許可（'unsafe-inline' は使わない） ---------- */
const sha = (str) => `'sha256-${createHash('sha256').update(str, 'utf8').digest('base64')}'`;
const styleHashes = [css, PAGE_CSS].map(sha);
const headers = read('public/_headers')
  .replace('{{SCRIPT_HASH}}', sha(scriptBody))
  .replace('{{STYLE_HASHES}}', styleHashes.join(' '));
if (/\{\{[A-Z_]+\}\}/.test(headers)) throw new Error('public/_headers に未置換の {{...}} があります');
writeFileSync(join(dist, 'site', '_headers'), headers);
const kb = (s) => (Buffer.byteLength(s) / 1024).toFixed(1) + ' KB';
console.log(`ティッカー ${codes.length} 件`);
console.log(`dist/site/index.html  ${kb(site)}`);
console.log(`dist/artifact.html    ${kb(artifact)}`);
