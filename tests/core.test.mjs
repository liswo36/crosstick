// 配置・採点エンジン（src/core.js）の不変条件テスト。 実行: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ctx = {};
vm.createContext(ctx);
vm.runInContext(readFileSync(join(ROOT, 'src/core.js'), 'utf8') +
  ';this.api={PALETTE,colorFor,parseTickers,buildLayout,pointsFor,scoreRange};', ctx);
const { PALETTE, colorFor, parseTickers, buildLayout, pointsFor, scoreRange } = ctx.api;

test('点数: 0文字=-3, 1=+1, 2=+3, 3=+6', () => {
  assert.deepEqual([...[0, 1, 2, 3].map(pointsFor)], [-3, 1, 3, 6]);
});

test('パレットは11色、12色目以降は暗くした別色になる', () => {
  assert.equal(PALETTE.length, 11);
  const seen = new Set(Array.from({ length: 22 }, (_, i) => colorFor(i)));
  assert.equal(seen.size, 22);
});

test('parseTickers: 大文字化・全角→半角・重複除去・2〜6文字の英数字のみ（3文字限定とVN上場判定は app.js 側）', () => {
  const p = parseTickers('ab, ＸＹＺ  toolonggg 12  SSI ssi');
  assert.deepEqual([...p.words], ['AB', 'XYZ', '12', 'SSI']);
  assert.deepEqual([...p.bad], ['TOOLONGGG']);
  assert.equal(p.over, false);
});
test('parseTickers: 41銘柄以上は先頭40件に切り詰めて over=true', () => {
  const many = Array.from({ length: 45 }, (_, i) => 'A' + String(i).padStart(2, '0')).join(' ');
  const p = parseTickers(many);
  assert.equal(p.words.length, 40);
  assert.equal(p.over, true);
});

const SET = 'SSI CTR VCI FRT FPT DGW DPM MWG HPG VPB DMX';
for (const clean of [false, true]) for (const pattern of [1, 2, 3]) {
  test(`配置の整合性 clean=${clean} pattern=${pattern}: 各セルの文字が語と一致し、全銘柄が置かれる`, () => {
    const { words } = parseTickers(SET);
    const L = buildLayout(words, pattern, clean);
    for (const pl of L.placed) {
      const w = words[pl.wi];
      for (let k = 0; k < w.length; k++) {
        const x = pl.x + (pl.dir === 0 ? k : 0), y = pl.y + (pl.dir === 1 ? k : 0);
        assert.equal(L.cells.get(x + ',' + y).ch, w[k]);
      }
    }
    assert.equal(L.placed.length + L.unplaced.length, words.length);
  });
}

test('同じ入力・同じパターンなら結果は毎回同じ（決定的）', () => {
  const { words } = parseTickers(SET);
  const a = buildLayout(words, 1, false), b = buildLayout(words, 1, false);
  assert.equal(a.raw, b.raw);
  assert.equal(a.W + 'x' + a.H, b.W + 'x' + b.H);
});

test('スコア: 0〜100に収まり、パターン1が最高得点', () => {
  const { words } = parseTickers(SET);
  const L1 = buildLayout(words, 1, false);
  assert.ok(L1.score100 >= 0 && L1.score100 <= 100);
  const r = scoreRange(words);
  assert.equal(r.min, -3 * words.length);
  for (const p of [2, 3]) assert.ok(buildLayout(words, p, false).raw <= L1.raw);
});

test('スコア: 組み合わせられない銘柄（共通文字なし）があると総合スコアが下がる。ない場合は従来どおり', () => {
  // 従来: 孤立銘柄の点数は上限にも下限にも同じ値が入り、総合スコアに影響しなかった（SSI VCI FPT HNG は 100）
  const a = buildLayout(['SSI', 'VCI', 'FPT', 'HNG'], 1, false);
  assert.equal(a.min, -12);
  assert.equal(a.ub, 14);               // SSI +1, VCI +1, FPT 6（満点扱い）, HNG 6（満点扱い）
  assert.equal(a.raw, -4);              // SSI +1, VCI +1, FPT -3, HNG -3
  assert.equal(a.score100, Math.round((-4 + 12) / (14 + 12) * 100)); // 31
  assert.ok(a.score100 < 50);
  // 孤立銘柄がなければ上限は変わらない
  const b = scoreRange(['SSI', 'VCI']);
  assert.deepEqual([b.min, b.ub], [-6, 2]);
  // 孤立銘柄を1つ足すと、足す前より下がる
  const base = parseTickers(SET).words;
  const withIso = buildLayout(base.concat('ONE'), 1, false), without = buildLayout(base, 1, false);
  assert.ok(withIso.score100 < without.score100, `${withIso.score100} < ${without.score100}`);
});

test('共通文字のない2銘柄は交差せず、両方置かれる', () => {
  const L = buildLayout(['ABC', 'XYZ'], 1, false);
  assert.equal(L.placed.length, 2);
  assert.equal(L.unplaced.length, 0);
});

test('空入力は null', () => {
  assert.equal(buildLayout([], 1, false), null);
});

test('ティッカー一覧: 大文字英数3文字・重複なし・1,500件以上・主要銘柄を含む', () => {
  const codes = readFileSync(join(ROOT, 'src/data/vn-tickers.txt'), 'utf8')
    .split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));
  assert.ok(codes.length >= 1500);
  assert.equal(new Set(codes).size, codes.length);
  for (const c of codes) assert.match(c, /^[A-Z0-9]{3}$/);
  for (const c of ['VIC', 'VHM', 'FPT', 'HPG', 'SSI', 'MBB']) assert.ok(codes.includes(c), c);
});
