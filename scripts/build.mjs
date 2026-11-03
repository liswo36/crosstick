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
import { readFileSync, writeFileSync, mkdirSync, readdirSync, copyFileSync, rmSync, existsSync } from 'node:fs';
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

const script = `<script>\n${core}\n${i18n}${app}</script>`;

/* ---------- Claude Artifact 版（断片） ---------- */
const artifact = `${headArtifact}<style>${css}</style>${body}${script}\n`;

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
<noscript><p style="padding:24px;font:700 18px sans-serif">このツールを使うにはJavaScriptを有効にしてください。</p></noscript>
${body.replace(/^\n+/, '')}${script}

</body>
</html>
`;

/* ---------- 出力 ---------- */
const dist = join(ROOT, 'dist');
rmSync(dist, { recursive: true, force: true });
mkdirSync(join(dist, 'site'), { recursive: true });
writeFileSync(join(dist, 'artifact.html'), artifact);
writeFileSync(join(dist, 'site', 'index.html'), site);
for (const f of readdirSync(join(ROOT, 'public'))) copyFileSync(join(ROOT, 'public', f), join(dist, 'site', f));
const kb = (s) => (Buffer.byteLength(s) / 1024).toFixed(1) + ' KB';
console.log(`ティッカー ${codes.length} 件`);
console.log(`dist/site/index.html  ${kb(site)}`);
console.log(`dist/artifact.html    ${kb(artifact)}`);
