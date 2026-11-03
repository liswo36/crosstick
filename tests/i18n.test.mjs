// 画面の文言（src/i18n.js）の検査。 実行: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ctx = {};
vm.createContext(ctx);
vm.runInContext(readFileSync(join(ROOT, 'src/i18n.js'), 'utf8') + ';this.api={I18N};', ctx);
const { I18N } = ctx.api;
const LANGS = ['ja', 'vi', 'en'];
const body = readFileSync(join(ROOT, 'src/body.html'), 'utf8');
const cfg = JSON.parse(readFileSync(join(ROOT, 'site.config.json'), 'utf8'));
const keysOf = (l) => Object.keys(I18N[l]).sort();

test('日本語・ベトナム語・英語が同じキーを持つ', () => {
  assert.deepEqual(Object.keys(I18N).sort(), [...LANGS].sort());
  for (const l of ['vi', 'en']) assert.deepEqual(keysOf(l), keysOf('ja'), l);
});

test('各キーの型（文字列／関数）が言語間でそろい、空でない', () => {
  for (const k of keysOf('ja')) {
    for (const l of LANGS) {
      assert.equal(typeof I18N[l][k], typeof I18N.ja[k], `${l}.${k}`);
      if (typeof I18N[l][k] === 'string') assert.ok(I18N[l][k].length > 0, `${l}.${k}`);
    }
  }
});

test('関数の文言は引数を含む文字列を返す', () => {
  for (const l of LANGS) {
    const t = I18N[l];
    assert.ok(t.scoreSr(78).includes('78'), l);
    const chip = t.chip('SSI', t.down, 1, 3, '+1');
    for (const part of ['SSI', t.down, '1/3', '+1']) assert.ok(chip.includes(part), `${l}: ${chip}`);
    assert.ok(t.zeroNote('ABC, XYZ').startsWith('ABC, XYZ'), l);
  }
});

test('body.html の data-i / data-i-aria / data-i-ph のキーが全言語にある', () => {
  const used = new Set();
  for (const re of [/data-i="([^"]+)"/g, /data-i-aria="([^"]+)"/g, /data-i-ph="([^"]+)"/g]) {
    for (const m of body.matchAll(re)) used.add(m[1]);
  }
  assert.ok(used.size >= 30, `使用キー数 ${used.size}`);
  for (const k of used) for (const l of LANGS) assert.ok(k in I18N[l], `${l}.${k}`);
});

test('body.html に書いてある日本語（既定の表示）が I18N.ja と一致する', () => {
  for (const m of body.matchAll(/data-i="([^"]+)"[^>]*>([^<]*)</g)) {
    assert.equal(m[2], I18N.ja[m[1]], `テキスト ${m[1]}`);
  }
  for (const m of body.matchAll(/data-i-aria="([^"]+)" aria-label="([^"]*)"/g)) {
    assert.equal(m[2], I18N.ja[m[1]], `aria-label ${m[1]}`);
  }
  for (const m of body.matchAll(/data-i-ph="([^"]+)" placeholder="([^"]*)"/g)) {
    assert.equal(m[2], I18N.ja[m[1]], `placeholder ${m[1]}`);
  }
});

test('プライバシー文はどの言語でも「アクセスの記録（ログ）が残ることがある」旨を含む', () => {
  assert.ok(I18N.ja.privacy.includes('アクセスの記録が残ることがあります'));
  assert.ok(I18N.vi.privacy.includes('nhật ký truy cập'));
  assert.ok(I18N.en.privacy.includes('access logs'));
  for (const l of LANGS) assert.ok(/Google Fonts/.test(I18N[l].privacy) && /Cloudflare/.test(I18N[l].privacy), l);
});

test('site.config.json にベトナム語・英語のタイトルと説明がある', () => {
  for (const l of ['vi', 'en']) {
    const m = cfg.i18n[l];
    assert.ok(m && m.title.includes('Crosstick') && m.description.length > 40, l);
  }
  assert.notEqual(cfg.i18n.vi.title, cfg.i18n.en.title);
});
