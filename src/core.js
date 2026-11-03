/*CORE_START*/
var PALETTE = ['#0083b1','#4e53a7','#7636a8','#be36a2','#b7395f','#cd6c2f','#fc5101','#ff9100','#f7c30b','#8bc80b','#00b29c'];
var GREY = '#cfd4d9';

function darken(hex, f) {
  var c = [1,3,5].map(function(i){ return Math.round(parseInt(hex.substr(i,2),16) * (1 - f)); });
  return '#' + c.map(function(v){ return ('0' + v.toString(16)).slice(-2); }).join('');
}
// 11色を4つ飛ばしで使い、入力順で隣り合う銘柄の色相が離れるようにする
function colorFor(i) {
  var base = PALETTE[(i * 4) % 11];
  var cycle = Math.floor(i / 11);
  return cycle ? darken(base, Math.min(0.55, 0.25 * cycle)) : base;
}
function lum(hex) {
  var c = [1,3,5].map(function(i){ return parseInt(hex.substr(i,2),16) / 255; })
    .map(function(v){ return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
function contrast(a, b) {
  var x = lum(a), y = lum(b);
  if (x < y) { var t = x; x = y; y = t; }
  return (x + 0.05) / (y + 0.05);
}
function inkFor(cols) {
  var dark = '#16191c', light = '#ffffff';
  function worst(c) { return Math.min.apply(null, cols.map(function(col){ return contrast(c, col); })); }
  return worst(dark) >= worst(light) ? dark : light;
}

function mulberry32(a) {
  return function() {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    var t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function hashStr(s) {
  var h = 2166136261;
  for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

function parseTickers(text) {
  var raw = text.normalize('NFKC').split(/[\s,、，;；\/]+/).map(function(s){ return s.trim().toUpperCase(); }).filter(Boolean);
  var words = [], bad = [];
  raw.forEach(function(t) {
    if (/^[A-Z0-9]{2,6}$/.test(t)) { if (words.indexOf(t) < 0) words.push(t); }
    else if (bad.indexOf(t) < 0) bad.push(t);
  });
  var over = words.length > 40;
  return { words: words.slice(0, 40), bad: bad, over: over };
}

// dir 0 = 横, 1 = 縦
function tryBuild(words, rng, clean) {
  var cells = new Map(), placed = [];
  var areaW = [0.1, 0.5, 1][Math.floor(rng() * 3)];
  var temp = [3, 10, 25][Math.floor(rng() * 3)];
  var minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  function key(x, y) { return x + ',' + y; }

  function check(wi, x, y, dir) {
    var w = words[wi], L = w.length, dx = dir === 0 ? 1 : 0, dy = dir === 1 ? 1 : 0, ov = 0;
    for (var k = 0; k < L; k++) {
      var cx = x + dx * k, cy = y + dy * k, c = cells.get(key(cx, cy));
      if (c) {
        if (c.ch !== w[k] || c.dirs[dir]) return null;
        ov++;
      } else if (clean) {
        if (cells.has(key(cx + dy, cy + dx)) || cells.has(key(cx - dy, cy - dx))) return null;
      }
    }
    if (ov === 0) return null;
    if (clean && (cells.has(key(x - dx, y - dy)) || cells.has(key(x + dx * L, y + dy * L)))) return null;
    var nx0 = Math.min(minX, x), ny0 = Math.min(minY, y);
    var nx1 = Math.max(maxX, x + dx * (L - 1)), ny1 = Math.max(maxY, y + dy * (L - 1));
    var W = nx1 - nx0 + 1, H = ny1 - ny0 + 1;
    return { wi: wi, x: x, y: y, dir: dir, cost: areaW * (W * H + 2 * Math.abs(W - 1.25 * H)) - ov * 5 };
  }
  function place(wi, x, y, dir) {
    var w = words[wi], dx = dir === 0 ? 1 : 0, dy = dir === 1 ? 1 : 0;
    for (var k = 0; k < w.length; k++) {
      var cx = x + dx * k, cy = y + dy * k, kk = key(cx, cy), c = cells.get(kk);
      if (!c) { c = { ch: w[k], dirs: [false, false], owners: [], x: cx, y: cy }; cells.set(kk, c); }
      c.dirs[dir] = true;
      c.owners.push({ wi: wi, dir: dir, order: placed.length });
      if (cx < minX) minX = cx; if (cx > maxX) maxX = cx;
      if (cy < minY) minY = cy; if (cy > maxY) maxY = cy;
    }
    placed.push({ wi: wi, x: x, y: y, dir: dir });
  }

  // 共通する文字を持つ相手が少ない銘柄ほど、早めに置く
  var partners = words.map(function(w, i) {
    var n = 0;
    words.forEach(function(o, j) {
      if (i !== j && w.split('').some(function(ch){ return o.indexOf(ch) >= 0; })) n++;
    });
    return n + rng() * 2.5;
  });
  var rem = words.map(function(_, i){ return i; });
  rem.sort(function(a, b){ return partners[a] - partners[b]; });
  if (rng() < 0.5) {
    var f = Math.floor(rng() * rem.length), tmp = rem[0]; rem[0] = rem[f]; rem[f] = tmp;
  }
  var first = rem.shift();
  place(first, 0, 0, rng() < 0.5 ? 0 : 1);

  function bestFor(wi) {
    var best = null, w = words[wi];
    for (var k = 0; k < w.length; k++) {
      cells.forEach(function(c) {
        if (c.ch !== w[k]) return;
        for (var dir = 0; dir < 2; dir++) {
          if (c.dirs[dir]) continue;
          var x = c.x - (dir === 0 ? k : 0), y = c.y - (dir === 1 ? k : 0);
          var r = check(wi, x, y, dir);
          if (!r) continue;
          r.cost += rng() * temp;
          if (!best || r.cost < best.cost) best = r;
        }
      });
    }
    return best;
  }

  // 交差できる場所がない銘柄は、最後の手段として既存の文字に接するように置く（ぎゅっと詰めるときだけ）
  function touchFor(wi) {
    var best = null, w = words[wi], L = w.length;
    cells.forEach(function(c) {
      for (var dir = 0; dir < 2; dir++) {
        var dx = dir === 0 ? 1 : 0, dy = dir === 1 ? 1 : 0;
        for (var k = 0; k < L; k++) {
          // k文字目が、cの上下左右のどれかに来る置き方を試す
          var nb = [[1,0],[-1,0],[0,1],[0,-1]];
          for (var q = 0; q < 4; q++) {
            var px = c.x + nb[q][0], py = c.y + nb[q][1];
            var x = px - dx * k, y = py - dy * k, ok = true;
            for (var m = 0; m < L; m++) {
              if (cells.has(key(x + dx * m, y + dy * m))) { ok = false; break; }
            }
            if (!ok) continue;
            var nx0 = Math.min(minX, x), ny0 = Math.min(minY, y);
            var nx1 = Math.max(maxX, x + dx * (L - 1)), ny1 = Math.max(maxY, y + dy * (L - 1));
            var W = nx1 - nx0 + 1, H = ny1 - ny0 + 1;
            var cost = areaW * (W * H + 2 * Math.abs(W - 1.25 * H)) + rng() * temp;
            if (!best || cost < best.cost) best = { wi: wi, x: x, y: y, dir: dir, cost: cost };
          }
        }
      }
    });
    return best;
  }

  if (rng() < 0.5) {
    // 全ての残り銘柄から、いちばん盤面が小さく済む置き方を選ぶ
    while (rem.length) {
      var best = null;
      for (var a = 0; a < rem.length; a++) {
        var r = bestFor(rem[a]);
        if (r && (!best || r.cost < best.cost)) best = r;
      }
      if (!best) break;
      place(best.wi, best.x, best.y, best.dir);
      rem.splice(rem.indexOf(best.wi), 1);
    }
  } else {
    // 並び順どおりに置く。置けなかった銘柄は後で再挑戦する
    var progress = true;
    while (rem.length && progress) {
      progress = false;
      rem.slice().forEach(function(wi) {
        var r = bestFor(wi);
        if (!r) return;
        place(r.wi, r.x, r.y, r.dir);
        rem.splice(rem.indexOf(wi), 1);
        progress = true;
      });
    }
  }

  var touched = 0;
  if (!clean) {
    var again = true;
    while (rem.length && again) {
      again = false;
      var pick = null;
      for (var b = 0; b < rem.length; b++) {
        var cx = bestFor(rem[b]) || null;
        if (cx) { pick = cx; break; }
      }
      if (!pick) {
        for (var b2 = 0; b2 < rem.length; b2++) {
          var tc = touchFor(rem[b2]);
          if (tc) { tc.touch = true; pick = tc; touched++; break; }
        }
      }
      if (pick) { place(pick.wi, pick.x, pick.y, pick.dir); if (pick.touch) placed[placed.length - 1].touch = true; rem.splice(rem.indexOf(pick.wi), 1); again = true; }
    }
  }

  // 重なる文字がない銘柄（接しただけ・置けなかった銘柄）は、かたまりの右端に1列あけて寄せる
  var lone = [];
  placed = placed.filter(function(p) {
    var dx = p.dir === 0 ? 1 : 0, dy = p.dir === 1 ? 1 : 0, o = 0, k;
    for (k = 0; k < words[p.wi].length; k++) if (cells.get(key(p.x + dx * k, p.y + dy * k)).owners.length > 1) o++;
    if (o > 0) return true;
    for (k = 0; k < words[p.wi].length; k++) cells.delete(key(p.x + dx * k, p.y + dy * k));
    lone.push(p.wi);
    return false;
  });
  rem.forEach(function(wi) { lone.push(wi); });
  rem = [];
  if (lone.length) {
    lone.sort(function(a, b) { return a - b; });
    minX = Infinity; maxX = -Infinity; minY = Infinity; maxY = -Infinity;
    cells.forEach(function(c) {
      if (c.x < minX) minX = c.x; if (c.x > maxX) maxX = c.x;
      if (c.y < minY) minY = c.y; if (c.y > maxY) maxY = c.y;
    });
    if (!cells.size) { minX = 0; maxX = -2; minY = 0; maxY = -1; }
    var lx = maxX + 2, ly = minY;
    lone.forEach(function(wi, i) { place(wi, lx, ly + i, 0); });
  }

  var cross = 0;
  cells.forEach(function(c){ if (c.owners.length > 1) cross++; });
  var W = maxX - minX + 1, H = maxY - minY + 1;

  // 採点: 銘柄ごとに「他の銘柄と重なっている文字数」を数える
  var per = {}, raw = 0, max = 0;
  function addPer(wi, o) {
    var L = words[wi].length, pts = pointsFor(o), mx = pointsFor(L);
    per[wi] = { o: o, L: L, pts: pts, max: mx };
    raw += pts; max += mx;
  }
  var touchedN = 0;
  placed.forEach(function(p) {
    var dx = p.dir === 0 ? 1 : 0, dy = p.dir === 1 ? 1 : 0, o = 0;
    for (var k = 0; k < words[p.wi].length; k++) {
      if (cells.get(key(p.x + dx * k, p.y + dy * k)).owners.length > 1) o++;
    }
    p.touch = o === 0;
    if (o === 0) touchedN++;
    addPer(p.wi, o);
  });
  rem.forEach(function(wi) { addPer(wi, 0); });

  return {
    placed: placed, cells: cells, minX: minX, minY: minY, W: W, H: H, cross: cross, unplaced: rem, touched: touchedN,
    per: per, raw: raw, max: max, score100: Math.round(raw / max * 100), area: W * H + 2 * Math.abs(W - 1.25 * H)
  };
}

// 重なった文字が多いほど高得点（1文字+1、2文字+3、3文字+6）。まったく重ならない銘柄は-3
function pointsFor(o) { return o === 0 ? -3 : o * (o + 1) / 2; }

// 銘柄セットごとの点数の幅。下限は「全銘柄が重ならない」、上限は「ほかの銘柄にも使われている文字が全部重なる」場合。
// 銘柄数が多いほど有利にならないよう、総合スコアはこの幅の中での位置（0〜100）で出す。
// ただし、ほかの銘柄と共通する文字が1つもない銘柄（組み合わせられない銘柄）は、上限でも満点を取れたものとして数える。
// そのため、そうした銘柄が混ざっているセットは、総合スコアが下がる。
function scoreRange(words) {
  var ub = 0;
  words.forEach(function(w, i) {
    var o = 0;
    for (var k = 0; k < w.length; k++) {
      var ch = w[k];
      if (words.some(function(x, j){ return j !== i && x.indexOf(ch) >= 0; })) o++;
    }
    ub += o === 0 ? pointsFor(w.length) : pointsFor(o);
  });
  return { min: pointsFor(0) * words.length, ub: ub };
}

function buildLayout(words, pattern, clean) {
  if (!words.length) return null;
  var rng = mulberry32((Math.imul(pattern, 2654435761) ^ hashStr(words.join(',') + (clean ? 'c' : 't'))) >>> 0);
  var tries = [];
  for (var t = 0; t < 250; t++) tries.push(tryBuild(words, rng, clean));
  var maxPlaced = Math.max.apply(null, tries.map(function(r){ return r.placed.length; }));
  tries = tries.filter(function(r){ return r.placed.length === maxPlaced; });
  var maxRaw = Math.max.apply(null, tries.map(function(r){ return r.raw; }));
  // パターン1は最高得点の配置。2以降は最高得点から2点以内の配置からランダムに選び、見た目に変化をつける
  var slack = pattern === 1 ? 0 : 2;
  var range = scoreRange(words);
  tries.forEach(function(r) {
    r.min = range.min; r.ub = range.ub;
    r.score100 = range.ub > range.min ? Math.round((r.raw - range.min) / (range.ub - range.min) * 100) : null;
  });
  var pool = tries.filter(function(r){ return r.raw >= maxRaw - slack; });
  var minArea = Math.min.apply(null, pool.map(function(r){ return r.area; }));
  pool = pool.filter(function(r){ return r.area <= minArea + 6; });
  if (pattern === 1) {
    pool.sort(function(a, b){ return b.raw - a.raw || a.area - b.area; });
    return pool[0];
  }
  return pool[Math.floor(rng() * pool.length)];
}
/*CORE_END*/