

(function () {
  var DEFAULT = 'SSI CTR VCI FRT FPT DGW DPM MWG HPG VPB';
  var $ = function (id) { return document.getElementById(id); };
  var ta = $('tickers'), hint = $('hint'), stage = $('stage'),
      legend = $('legend'), notes = $('notes'), scoreEl = $('score'),
      board = $('board'), lcol = $('lcol'), frame = $('frame'), under = $('under'), rcol = $('rcol'), shootbar = $('shootbar');
  // ベトナム株市場（HOSE・HNX・UPCoM）に上場している3文字コード（Vietstock Finance調べ、2026-11-03時点。1,543件のうち3文字の1,519件）
  var VN = {};
  `
/*@VN_TICKERS@*/
  `.split(/\s+/).forEach(function (t) { if (t) VN[t] = 1; });
  var words = [], layout = null, pattern = 1, focus = null, timer = null;
  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* 言語（日本語・ベトナム語・英語）。文言は i18n.js。選んだ言語は保存せず、URLの #ja / #vi / #en とブラウザの言語設定で決める */
  var SITE_META = /*@SITE_META@*/null;
  var lang = 'ja', hintInfo = { notVn: [], bad: [], over: false };
  var langSel = $('lang');
  var seo = !!document.querySelector('meta[name="description"]'); // Artifact版にはタイトル・説明のメタ情報が無い
  function msg(k) { return I18N[lang][k]; }
  function dirName(d) { return d === 0 ? msg('across') : msg('down'); }
  // 画像の単位（点・điểm・pts）の字体。ベトナム語・英語ではNoto Sansを先に使う
  function uiFont() { return lang === 'ja' ? '"Noto Sans JP","Noto Sans",sans-serif' : '"Noto Sans","Noto Sans JP",sans-serif'; }
  function renderHint() {
    var msgs = [];
    if (hintInfo.notVn.length) msgs.push(msg('exNotVn') + hintInfo.notVn.join(', '));
    if (hintInfo.bad.length) msgs.push(msg('exBad') + hintInfo.bad.join(', '));
    if (hintInfo.over) msgs.push(msg('over'));
    hint.textContent = msgs.length ? msgs.join(msg('sep')) + msg('end') : '';
  }
  function detectLang() {
    var m = /^#(ja|vi|en)$/.exec(location.hash);
    if (m) return m[1];
    var ls = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || 'ja'];
    for (var i = 0; i < ls.length; i++) {
      var l = String(ls[i]).toLowerCase();
      if (l.indexOf('ja') === 0) return 'ja';
      if (l.indexOf('vi') === 0) return 'vi';
      if (l.indexOf('en') === 0) return 'en';
    }
    return 'en';
  }
  function setLang(code, redraw) {
    if (!I18N[code]) code = 'ja';
    lang = code;
    document.documentElement.setAttribute('lang', code);
    document.querySelectorAll('[data-i]').forEach(function (el) { el.textContent = msg(el.getAttribute('data-i')); });
    document.querySelectorAll('[data-i-aria]').forEach(function (el) { el.setAttribute('aria-label', msg(el.getAttribute('data-i-aria'))); });
    document.querySelectorAll('[data-i-ph]').forEach(function (el) { el.setAttribute('placeholder', msg(el.getAttribute('data-i-ph'))); });
    var sm = SITE_META && SITE_META[code];
    if (seo && sm) {
      document.title = sm.title;
      document.querySelector('meta[name="description"]').setAttribute('content', sm.description);
    }
    langSel.value = code;
    $('langCode').textContent = code.toUpperCase();
    if (redraw) { renderHint(); render(false); }
  }

  function opt(name) { return document.querySelector('input[name="' + name + '"]:checked').value; }

  function wordInfo() {
    var info = {};
    if (layout) layout.placed.forEach(function (p, order) { info[p.wi] = { dir: p.dir, order: order, touch: !!p.touch }; });
    return info;
  }
  function wcolor(wi) { return (focus === null || focus === wi) ? colorFor(wi) : GREY; }

  var S = 72;
  // 盤面の描画データを作る。画面（SVG）と画像保存（canvas）の両方で同じものを使う
  function buildOps() {
    var s = S, pad = 0.6 * s, m = 0.14 * s;
    var VW = layout.W * s + pad * 2, VH = layout.H * s + pad * 2;
    var look = opt('look'), tile = look === 'tile', plate = look === 'plate', ovm = opt('ov'), black = ovm === 'black', split0 = ovm !== 'single';
    var groups = [], clips = {}, list = [];
    layout.cells.forEach(function (c) { list.push(c); });
    list.sort(function (a, b) { return a.owners[0].order - b.owners[0].order; });
    list.forEach(function (c) {
      var x0 = pad + (c.x - layout.minX) * s, y0 = pad + (c.y - layout.minY) * s;
      var o = c.owners.slice().sort(function (a, b) { return a.dir - b.dir; }); // 横が先
      var two = split0 && o.length > 1;
      var cA = wcolor(o[0].wi), cB = two ? wcolor(o[1].wi) : null;
      if (!split0 && o.length > 1) cA = wcolor(c.owners[0].wi);
      if (focus !== null) {
        // 強調中は、選んだ銘柄が通る文字をその銘柄の単色にする（斜めに分けない）
        two = false;
        cA = c.owners.some(function (q) { return q.wi === focus; }) ? colorFor(focus) : GREY;
      }
      var cid = 'k' + (c.x - layout.minX) + '_' + (c.y - layout.minY), items = [];
      if (two) clips[cid] = [[x0 + s + m, y0 - m], [x0 + s + m, y0 + s + m], [x0 - m, y0 + s + m]];
      var cx = x0 + s / 2;
      if (tile) {
        var t = s * 0.9, off = (s - t) / 2, fs = s * 0.78, ty = y0 + s / 2 + fs * 0.357;
        items.push({ k: 'rect', x: x0 + off, y: y0 + off, w: t, h: t, r: s * 0.16, f: cA });
        if (two) items.push({ k: 'rect', x: x0 + off, y: y0 + off, w: t, h: t, r: s * 0.16, f: cB, clip: cid });
        items.push({ k: 'text', x: cx, y: ty, fs: fs, f: black ? '#16191c' : '#ffffff', w: 800, ch: c.ch });
      } else {
        var f2 = (plate ? 0.78 : 0.92) * s, ty2 = y0 + s / 2 + f2 * 0.357;
        if (plate) {
          var pt = s * 0.9, po = (s - pt) / 2;
          items.push({ k: 'rect', x: x0 + po, y: y0 + po, w: pt, h: pt, r: s * 0.16, f: '@plate' });
        }
        if (black) {
          // 黒文字: 色は板やタイルに任せ、文字はすべて黒（ダークテーマでは明るい文字色）にする
          var on = focus === null || c.owners.some(function (q) { return q.wi === focus; });
          items.push({ k: 'text', x: cx, y: ty2, fs: f2, f: on ? '@ink' : GREY, w: 900, ch: c.ch });
        } else {
          items.push({ k: 'text', x: cx, y: ty2, fs: f2, f: cA, w: 900, ch: c.ch });
          if (two) items.push({ k: 'text', x: cx, y: ty2, fs: f2, f: cB, w: 900, ch: c.ch, clip: cid });
        }
      }
      groups.push({ order: c.owners[0].order, items: items });
    });
    return { VW: VW, VH: VH, groups: groups, clips: clips };
  }

  function opsToSvg(b, animate, label) {
    var defs = '', body = '';
    Object.keys(b.clips).forEach(function (id) {
      defs += '<clipPath id="' + id + '"><polygon points="' + b.clips[id].map(function (q) { return q[0] + ',' + q[1]; }).join(' ') + '"/></clipPath>';
    });
    b.groups.forEach(function (g) {
      body += '<g class="pop" style="--o:' + g.order + '">';
      g.items.forEach(function (it) {
        var clip = it.clip ? ' clip-path="url(#' + it.clip + ')"' : '';
        if (it.k === 'rect') {
          body += '<rect' + (it.f === '@plate' ? ' class="plate"' : ' fill="' + it.f + '"') + ' x="' + it.x + '" y="' + it.y + '" width="' + it.w + '" height="' + it.h + '" rx="' + it.r + '"' + clip + '/>';
        } else {
          body += '<text class="g' + (it.w === 800 ? ' t' : '') + '" x="' + it.x + '" y="' + it.y + '" text-anchor="middle" font-size="' + it.fs + '" ' +
            (it.f === '@ink' ? 'style="fill:var(--on-surface)"' : 'fill="' + it.f + '"') + clip + '>' + it.ch + '</text>';
        }
      });
      body += '</g>';
    });
    return '<svg id="puzzle" class="' + (animate ? 'anim' : '') + '" viewBox="0 0 ' + b.VW + ' ' + b.VH +
      '" role="img" aria-label="' + msg('puzzleAria') + label + '"><defs>' + defs + '</defs>' + body + '</svg>';
  }

  function render(animate) {
    if (!layout) {
      stage.innerHTML = '<p class="empty">' + msg('empty') + '</p>';
      notes.innerHTML = ''; legend.innerHTML = ''; scoreEl.innerHTML = '';
      fit();
      return;
    }
    var label = layout.placed.map(function (p) { return words[p.wi] + '(' + dirName(p.dir) + ')'; }).join(msg('comma'));
    stage.innerHTML = opsToSvg(buildOps(), animate, label);
    renderScore(animate);
    renderLegend(wordInfo());
    renderNotes();
    fit();
  }

  function pts(n) { return (n > 0 ? '+' : n < 0 ? '−' : '') + Math.abs(n); }

  function countUp(el, to, animate) {
    if (!animate || reduced) { el.textContent = to; return; }
    var t0 = performance.now(), dur = 700;
    el.textContent = 0;
    (function step(now) {
      var k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3);
      el.textContent = Math.round(to * e);
      if (k < 1) requestAnimationFrame(step);
    })(t0);
  }

  function renderScore(animate) {
    if (layout.score100 === null) {
      scoreEl.innerHTML = '<div class="sc-sub">' + msg('noScore') + '</div>';
      return;
    }
    scoreEl.innerHTML =
      '<span class="sr-only">' + msg('scoreSr')(layout.score100) + '</span>' +
      '<div class="sc-main" aria-hidden="true"><span class="sc-num"></span><span class="sc-unit">' + msg('unit') + '</span></div>';
    countUp(scoreEl.querySelector('.sc-num'), layout.score100, animate);
  }

  function renderLegend(info) {
    if (!layout) return;
    info = info || wordInfo();
    legend.innerHTML = words.map(function (w, i) {
      var p = info[i], sc = layout.per[i];
      var d = p ? dirName(p.dir) : msg('unplaced');
      var label = msg('chip')(w, d, sc.o, sc.L, pts(sc.pts));
      return '<button type="button" class="chip' + (p ? '' : ' off') + (focus !== null && focus !== i ? ' dim' : '') + '" data-i="' + i + '" aria-pressed="' + (focus === i) + '" aria-label="' + label + '" title="' + label + '" style="--c:' + colorFor(i) + '">' +
        '<span class="sw" aria-hidden="true"></span><span class="tk">' + w + '</span><span class="dir">' + d + '</span>' +
        '<span class="pt ' + (sc.pts < 0 ? 'm3' : sc.pts >= 6 ? 'p6' : sc.pts >= 3 ? 'p3' : 'p1') + '">' + pts(sc.pts) + '</span></button>';
    }).join('');
  }

  function renderNotes() {
    var out = '';
    if (layout) {
      var zero = layout.placed.filter(function (p) { return p.touch; }).map(function (p) { return words[p.wi]; });
      if (zero.length) {
        out += '<p class="note">' + msg('zeroNote')(zero.join(msg('comma'))) + '</p>';
      }
    }
    notes.innerHTML = out;
  }

  function generate(animate) {
    var p = parseTickers(ta.value);
    focus = null;
    var known = [], notVn = [];
    p.words.forEach(function (w) { if (VN[w]) known.push(w); else notVn.push(w); });
    words = known;
    hintInfo = { notVn: notVn, bad: p.bad, over: !!p.over };
    renderHint();
    layout = buildLayout(words, pattern, false);
    render(animate);
  }

  function grow() {
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight + 2, 96) + 'px';
  }

  // 全角英数字は半角に、小文字は大文字にそろえる（変換中は触らず、確定した時点で直す）
  function normalizeInput() {
    var v = ta.value, pos = ta.selectionStart, n = v.normalize('NFKC').toUpperCase();
    if (n === v) return;
    var np = v.slice(0, pos).normalize('NFKC').toUpperCase().length;
    ta.value = n;
    try { ta.setSelectionRange(np, np); } catch (e) {}
  }
  function onType() {
    normalizeInput(); grow();
    clearTimeout(timer);
    timer = setTimeout(function () { generate(true); }, 300);
  }
  ta.addEventListener('input', function (e) { if (!e.isComposing) onType(); });
  ta.addEventListener('compositionend', onType);
  $('shuffle').addEventListener('click', function () { pattern++; generate(true); });
  document.querySelectorAll('input[name="look"], input[name="ov"]').forEach(function (el) {
    el.addEventListener('change', function () { render(false); });
  });
  legend.addEventListener('click', function (e) {
    var b = e.target.closest('button[data-i]');
    if (!b) return;
    var i = +b.getAttribute('data-i');
    focus = (focus === i) ? null : i;
    render(false);
  });

  /* 言語の切り替え */
  langSel.addEventListener('change', function () {
    setLang(langSel.value, true);
    try { history.replaceState(null, '', '#' + lang); } catch (e) {}
  });
  window.addEventListener('hashchange', function () {
    var m = /^#(ja|vi|en)$/.exec(location.hash);
    if (m && m[1] !== lang) setLang(m[1], true);
  });

  /* 採点のしくみ */
  var rulesBtn = $('rulesBtn'), dlg = $('rules');
  function openRules() { if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', ''); }
  function closeRules() { if (typeof dlg.close === 'function') dlg.close(); else dlg.removeAttribute('open'); }
  rulesBtn.addEventListener('click', openRules);
  $('rulesClose').addEventListener('click', closeRules);
  dlg.addEventListener('click', function (e) { if (e.target === dlg) closeRules(); });

  /* 撮影モード */
  function ratioVal() {
    var v = document.querySelector('input[name="ratio"]:checked').value;
    return v === '1:1' ? 1 : v === '16:9' ? 16 / 9 : 9 / 16;
  }
  // パズルの枠は正方形（撮影モードでは選んだ比率）。画面に収まる大きさを計算して決める
  var narrowMQ = window.matchMedia('(max-width: 760px)');
  function fit() {
    var shoot = document.body.classList.contains('shoot'), narrow = narrowMQ.matches;
    var bw = board.clientWidth, bh = Math.max(board.clientHeight, narrow ? 300 : 420), ar = 1, sq, reserve = 0;
    if (shoot) { ar = ratioVal(); reserve = shootbar.offsetHeight + 32; sq = Math.min(bw, (bh - reserve) * ar); }
    else if (narrow) { sq = Math.min(bw, 620, bh - under.offsetHeight - 10 - 8 - rcol.offsetHeight); }
    else { sq = Math.min(bh - under.offsetHeight - 12, bw - 16 - 240, 620); }
    sq = Math.max(shoot ? 160 : 200, Math.floor(sq));
    board.style.setProperty('--sq', sq + 'px');
    board.style.setProperty('--ar', String(ar));
    board.style.paddingBottom = shoot ? reserve + 'px' : '';
    rcol.style.height = (!shoot && !narrow) ? lcol.offsetHeight + 'px' : '';
  }
  function setShoot(on) {
    document.body.classList.toggle('shoot', on);
    shootbar.hidden = !on;
    if (dlg.open) closeRules();
    if (on) { focus = null; render(false); }
    fit();
    if (on) $('shootClose').focus(); else $('shootBtn').focus();
  }
  /* 画像保存: 画面と同じ描画データをcanvasに描いてPNGにする（フォントは読み込み済みのNoto Sansを使う） */
  var dl = null;
  function themeColors() {
    var cs = getComputedStyle(document.documentElement);
    function v(n) { return cs.getPropertyValue(n).trim(); }
    return { plate: v('--plate'), ink: v('--on-surface'), dim: v('--dim'), stage: v('--stage'), sb: v('--score-bg'), onsb: v('--on-score') };
  }
  /* ロゴ: ヘッダーと同じパスデータ（#cx-logo）をPath2Dで描く */
  var LOGO = null;
  function logoData() {
    if (LOGO) return LOGO;
    var sym = document.getElementById('cx-logo');
    var vb = sym.getAttribute('viewBox').split(/\s+/).map(Number);
    var ps = [].map.call(sym.querySelectorAll('path'), function (p) {
      var tr = p.getAttribute('transform') || '', t = /translate\(\s*([-\d.]+)[ ,]+([-\d.]+)\s*\)/.exec(tr), sc = /scale\(\s*([-\d.]+)\s*\)/.exec(tr);
      return { p: new Path2D(p.getAttribute('d')), f: p.getAttribute('fill'), x: t ? +t[1] : 0, y: t ? +t[2] : 0, s: sc ? +sc[1] : 1 };
    });
    return (LOGO = { vb: vb, ps: ps });
  }
  function drawLogo(ctx, cx, y, hgt) {
    var L = logoData(), k = hgt / L.vb[3], w = L.vb[2] * k;
    ctx.save(); ctx.translate(cx - w / 2, y); ctx.scale(k, k); ctx.translate(-L.vb[0], -L.vb[1]);
    L.ps.forEach(function (q) { ctx.save(); ctx.translate(q.x, q.y); ctx.scale(q.s, q.s); ctx.fillStyle = q.f; ctx.fill(q.p); ctx.restore(); });
    ctx.restore();
  }
  function roundRectPath(ctx, x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function drawOps(ctx, b, ox, oy, k, th) {
    b.groups.forEach(function (g) {
      g.items.forEach(function (it) {
        ctx.save();
        if (it.clip) {
          ctx.beginPath();
          b.clips[it.clip].forEach(function (q, i) { if (i) ctx.lineTo(ox + q[0] * k, oy + q[1] * k); else ctx.moveTo(ox + q[0] * k, oy + q[1] * k); });
          ctx.closePath(); ctx.clip();
        }
        ctx.fillStyle = it.f === '@plate' ? th.plate : it.f === '@ink' ? th.ink : it.f === GREY ? th.dim : it.f;
        if (it.k === 'rect') { roundRectPath(ctx, ox + it.x * k, oy + it.y * k, it.w * k, it.h * k, it.r * k); ctx.fill(); }
        else {
          ctx.font = it.w + ' ' + (it.fs * k) + 'px "Noto Sans","Noto Sans JP",sans-serif';
          ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
          ctx.fillText(it.ch, ox + it.x * k, oy + it.y * k);
        }
        ctx.restore();
      });
    });
  }
  function makePng() {
    var ar = ratioVal(), W = ar === 1 ? 1600 : ar > 1 ? 1920 : 1080, H = ar === 1 ? 1600 : ar > 1 ? 1080 : 1920;
    var cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    var ctx = cv.getContext('2d'), th = themeColors();
    ctx.fillStyle = th.stage; ctx.fillRect(0, 0, W, H);
    var unit = Math.min(W, H), m = unit * 0.04, has = layout.score100 !== null && showScore.checked, pillH = has ? unit * 0.085 : 0;
    var logoH = unit * 0.09, gap = m * 0.6, mb = m * 1.6, ly = H - mb - logoH;
    var aw = W - 2 * m, ah = H - m - mb - logoH - (has ? pillH + gap : 0) - m * 0.8;
    // 盤面は文字の外周ぴったりで切り出す（画面用の余白 0.6マスは除く）
    var b = buildOps(), pad = 0.6 * S, trim = pad - 0.05 * S, cw = b.VW - 2 * trim, chh = b.VH - 2 * trim;
    var k = Math.min(aw / cw, ah / chh, unit * 0.2 / S);
    drawOps(ctx, b, m + (aw - cw * k) / 2 - trim * k, m + (ah - chh * k) / 2 - trim * k, k, th);
    if (has) {
      var num = String(layout.score100);
      var f1 = pillH * 0.66, f2 = pillH * 0.36, padX = pillH * 0.62, g1 = pillH * 0.08;
      ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
      ctx.font = '900 ' + f1 + 'px "Noto Sans","Noto Sans JP",sans-serif'; var w1 = ctx.measureText(num).width;
      ctx.font = '700 ' + f2 + 'px ' + uiFont(); var w2 = ctx.measureText(msg('unit')).width;
      var pw = padX * 2 + w1 + g1 + w2, px = (W - pw) / 2, py = ly - gap - pillH, base = py + pillH / 2;
      ctx.fillStyle = th.sb; roundRectPath(ctx, px, py, pw, pillH, pillH / 2); ctx.fill();
      ctx.fillStyle = th.onsb;
      var x = px + padX;
      ctx.font = '900 ' + f1 + 'px "Noto Sans","Noto Sans JP",sans-serif'; ctx.fillText(num, x, base + f1 * 0.357); x += w1 + g1;
      ctx.font = '700 ' + f2 + 'px ' + uiFont(); ctx.fillText(msg('unit'), x, base + f1 * 0.357);
    }
    drawLogo(ctx, W / 2, ly, logoH);
    return new Promise(function (res) { cv.toBlob(res, 'image/png'); });
  }
  var saveBtn = $('saveBtn'), shootMsg = $('shootMsg'), msgTimer = null;
  function say(t) { shootMsg.textContent = t; clearTimeout(msgTimer); if (t) msgTimer = setTimeout(function () { shootMsg.textContent = ''; }, 4000); }
  saveBtn.addEventListener('click', function () {
    if (!layout || !dl) return;
    saveBtn.disabled = true;
    var fontsReady = document.fonts ? Promise.all([document.fonts.load('900 64px "Noto Sans"'), document.fonts.load('800 64px "Noto Sans"'), document.fonts.load('700 32px ' + (lang === 'ja' ? '"Noto Sans JP"' : '"Noto Sans"'), msg('unit'))]).catch(function () {}) : Promise.resolve();
    fontsReady.then(makePng).then(function (blob) {
      var rv = document.querySelector('input[name="ratio"]:checked').value.replace(':', 'x');
      var d = new Date(), z = function (n) { return (n < 10 ? '0' : '') + n; };
      var stamp = d.getFullYear() + z(d.getMonth() + 1) + z(d.getDate()) + '-' + z(d.getHours()) + z(d.getMinutes()) + z(d.getSeconds());
      return dl.save({ filename: 'crosstick-' + stamp + '-' + rv + '.png', data: blob });
    }).then(function () { say(msg('saved')); }, function (e) {
      if (e && e.code === 'declined') say(''); else say(msg('saveFail'));
    }).then(function () { saveBtn.disabled = false; });
  });
  if (window.claude && typeof window.claude.use === 'function') {
    window.claude.use('downloads').then(function (d) { dl = d; saveBtn.hidden = !d; fit(); }, function () {});
  } else {
    /* 通常のWebサイトとして開いたとき: 端末のダウンロードで保存する（外部へは送信しない） */
    dl = {
      save: function (r) {
        var url = URL.createObjectURL(r.data), a = document.createElement('a');
        a.href = url; a.download = r.filename; a.rel = 'noopener';
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(function () { URL.revokeObjectURL(url); }, 20000);
        return Promise.resolve({ status: 'saved' });
      }
    };
    saveBtn.hidden = false; fit();
  }
  var showScore = $('showScore');
  showScore.addEventListener('change', function () { document.body.classList.toggle('score-on', showScore.checked); fit(); });
  $('shootBtn').addEventListener('click', function () { setShoot(true); });
  $('shootClose').addEventListener('click', function () { setShoot(false); });
  document.querySelectorAll('input[name="ratio"]').forEach(function (el) { el.addEventListener('change', fit); });
  window.addEventListener('resize', fit);
  if (window.ResizeObserver) new ResizeObserver(fit).observe(board);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit);
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    if (dlg.open) return;
    if (document.body.classList.contains('shoot')) setShoot(false);
  });

  setLang(detectLang(), false);
  ta.value = DEFAULT;
  grow();
  generate(false);
})();
