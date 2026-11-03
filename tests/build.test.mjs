// ビルドの検査。 実行: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
execFileSync('node', [join(ROOT, 'scripts/build.mjs')], { stdio: 'pipe' });
const site = readFileSync(join(ROOT, 'dist/site/index.html'), 'utf8');
const art = readFileSync(join(ROOT, 'dist/artifact.html'), 'utf8');

test('プレースホルダが残っていない', () => {
  for (const h of [site, art]) {
    assert.ok(!h.includes('@LOGO_SYMBOL@'));
    assert.ok(!h.includes('@VN_TICKERS@'));
    assert.ok(!h.includes('@SITE_META@'));
  }
});
test('公開版は doctype を持ち、Artifact版は持たない', () => {
  assert.ok(site.startsWith('<!doctype html>'));
  assert.ok(!art.includes('<!doctype'));
});
test('OGP の URL が site.config.json と一致', () => {
  const cfg = JSON.parse(readFileSync(join(ROOT, 'site.config.json'), 'utf8'));
  assert.ok(site.includes(`<meta property="og:url" content="${cfg.siteUrl}">`));
  assert.ok(site.includes(`content="${cfg.siteUrl}og.png"`));
});
test('公開に必要なファイルが dist/site にある', () => {
  for (const f of ['index.html', '_headers', 'favicon.svg', 'favicon-32.png', 'apple-touch-icon.png', 'og.png', 'terms.html', 'privacy.html'])
    assert.ok(existsSync(join(ROOT, 'dist/site', f)), f);
});
test('言語ごとのタイトル・説明と文言が埋め込まれている（公開版は日本語が既定）', () => {
  const cfg = JSON.parse(readFileSync(join(ROOT, 'site.config.json'), 'utf8'));
  assert.ok(site.includes('<html lang="ja">'));
  for (const l of ['vi', 'en']) assert.ok(site.includes(JSON.stringify(cfg.i18n[l].title).slice(1, -1)), l);
  for (const h of [site, art]) assert.ok(h.includes('var I18N = {') && h.includes('id="lang"'));
});
test('外部通信しない（CSP の connect-src none と矛盾する fetch/XHR が無い）', () => {
  assert.ok(!/\bfetch\s*\(|XMLHttpRequest|WebSocket/.test(site));
});

test('利用規約・プライバシーポリシーのページ: 未置換なし・要点を含む・外部スクリプトなし・相互リンク', () => {
  const dir = join(ROOT, 'dist/site');
  const t = readFileSync(join(dir, 'terms.html'), 'utf8');
  const p = readFileSync(join(dir, 'privacy.html'), 'utf8');
  for (const [n, h] of [['terms', t], ['privacy', p]]) {
    assert.ok(!/\{\{[A-Z_]+\}\}/.test(h), `${n}: 未置換`);
    assert.ok(h.includes('<html lang="ja">') && !/<script/i.test(h), `${n}: lang / script`);
  }
  assert.ok(t.includes('<title>利用規約') && t.includes('href="privacy.html"'));
  assert.ok(p.includes('<title>プライバシーポリシー') && p.includes('href="terms.html"'));
  for (const w of ['localStorage', 'crosstick:tickers', 'Cloudflare', 'Google Fonts', 'fonts.gstatic.com', 'アクセス解析ツールを使っていません', 'Cookie を設定しません']) {
    assert.ok(p.includes(w), `privacy: ${w}`);
  }
  for (const w of ['投資の助言', '消費者契約法', '専属的合意管轄裁判所']) assert.ok(t.includes(w), `terms: ${w}`);
});

test('アプリ内のダイアログから規約へのリンクがあり、Artifact版には入らない', () => {
  const site = readFileSync(join(ROOT, 'dist/site/index.html'), 'utf8');
  const art = readFileSync(join(ROOT, 'dist/artifact.html'), 'utf8');
  assert.ok(site.includes('href="terms.html"') && site.includes('href="privacy.html"'));
  assert.ok(!art.includes('terms.html') && !art.includes('<!--LEGAL-->'));
});
