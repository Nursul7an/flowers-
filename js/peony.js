/* Peony bouquet: SVG construction + bloom timeline.
 *
 * A florist-style bouquet: double "bomb" peonies (guard petals + a dome of
 * ruffled, cupped petals) in mixed pinks and cream, wrapped in paper.
 *
 * Every animated SVG node is wrapped in a Part. GSAP tweens the Part's plain
 * numeric fields; Part.render() writes them back as a single `transform`
 * attribute. This keeps every pivot point explicit (no bbox-based origins)
 * and identical across browsers. */
(function (NS) {
  'use strict';

  var SVGNS = 'http://www.w3.org/2000/svg';
  var VIEW = { x: -10, y: 80, w: 420, h: 480 };
  var PIVOT = { x: 200, y: 552 }; // where the paper cone narrows to
  var TIE = { x: 200, y: 486 };

  function n(v) { return Math.round(v * 100) / 100; }

  function el(tag, attrs, parent) {
    var node = document.createElementNS(SVGNS, tag);
    for (var k in attrs) node.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(node);
    return node;
  }

  // Deterministic random so the bouquet looks the same on every replay
  function makeRng(seed) {
    return function () {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
  }

  /* ── Part ─────────────────────────────────────────── */
  function Part(node, base) {
    this.node = node;
    this.base = base || '';
    this.x = 0; this.y = 0; this.r = 0;
    this.s = 1; this.sx = 1; this.sy = 1;
    this.o = 1;
    this._t = ''; this._o = '';
  }
  Part.prototype.render = function () {
    var t = this.base + ' translate(' + n(this.x) + ' ' + n(this.y) + ') rotate(' + n(this.r) +
      ') scale(' + n(this.s * this.sx) + ' ' + n(this.s * this.sy) + ')';
    if (t !== this._t) { this.node.setAttribute('transform', t); this._t = t; }
    var o = String(n(this.o));
    if (o !== this._o) { this.node.setAttribute('opacity', o); this._o = o; }
  };

  /* ── Shapes ───────────────────────────────────────── */
  // Broad guard petal, base at (0,0) pointing up (-y), soft wavy rim. W ≈ half-width.
  function petalPath(L, W, rnd) {
    function j(k) { return 1 + (rnd() - 0.5) * (k || 0.16); }
    var notch = 0.88 + rnd() * 0.08;
    return 'M0 0' +
      ' C' + n(-0.95 * W) + ' ' + n(-0.1 * L) + ' ' + n(-1.2 * W * j()) + ' ' + n(-0.58 * L) + ' ' + n(-0.8 * W) + ' ' + n(-0.9 * L * j(0.08)) +
      ' C' + n(-0.55 * W) + ' ' + n(-1.08 * L * j(0.08)) + ' ' + n(-0.2 * W) + ' ' + n(-1.02 * L) + ' 0 ' + n(-notch * L) +
      ' C' + n(0.2 * W) + ' ' + n(-1.02 * L) + ' ' + n(0.55 * W) + ' ' + n(-1.08 * L * j(0.08)) + ' ' + n(0.8 * W) + ' ' + n(-0.9 * L * j(0.08)) +
      ' C' + n(1.2 * W * j()) + ' ' + n(-0.58 * L) + ' ' + n(0.95 * W) + ' ' + n(-0.1 * L) + ' 0 0Z';
  }

  // Cupped inner petal seen from the side: ruffled upper rim, rounded belly.
  // Centred at (0,0); w = width, h = height of the rim above the centre.
  function cupPath(w, h, rnd) {
    function j() { return 1 + (rnd() - 0.5) * 0.22; }
    var hw = w / 2;
    return 'M' + n(-hw) + ' 0' +
      ' C' + n(-hw) + ' ' + n(-0.55 * h) + ' ' + n(-0.78 * hw) + ' ' + n(-h * j()) + ' ' + n(-0.42 * hw) + ' ' + n(-0.92 * h) +
      ' Q' + n(-0.2 * hw) + ' ' + n(-1.06 * h * j()) + ' 0 ' + n(-0.93 * h) +
      ' Q' + n(0.2 * hw) + ' ' + n(-1.06 * h * j()) + ' ' + n(0.42 * hw) + ' ' + n(-0.92 * h) +
      ' C' + n(0.78 * hw) + ' ' + n(-h * j()) + ' ' + n(hw) + ' ' + n(-0.55 * h) + ' ' + n(hw) + ' 0' +
      ' C' + n(0.62 * hw) + ' ' + n(0.32 * h) + ' ' + n(-0.62 * hw) + ' ' + n(0.32 * h) + ' ' + n(-hw) + ' 0Z';
  }

  function leafletPath(L, W) {
    return 'M0 0 C' + n(-0.55 * W) + ' ' + n(-0.2 * L) + ' ' + n(-0.62 * W) + ' ' + n(-0.68 * L) + ' 0 ' + n(-L) +
      ' C' + n(0.62 * W) + ' ' + n(-0.68 * L) + ' ' + n(0.55 * W) + ' ' + n(-0.2 * L) + ' 0 0Z';
  }

  // Wrapping-paper sheet, pivot at the bottom, pointing up
  function sheetPath(L, W, rnd) {
    function j() { return 1 + (rnd() - 0.5) * 0.1; }
    return 'M0 0 C' + n(-0.25 * W) + ' ' + n(-0.25 * L) + ' ' + n(-0.62 * W) + ' ' + n(-0.62 * L) + ' ' + n(-0.52 * W) + ' ' + n(-0.95 * L) +
      ' Q' + n(-0.26 * W) + ' ' + n(-1.04 * L * j()) + ' 0 ' + n(-0.98 * L) +
      ' Q' + n(0.26 * W) + ' ' + n(-1.04 * L * j()) + ' ' + n(0.52 * W) + ' ' + n(-0.95 * L) +
      ' C' + n(0.62 * W) + ' ' + n(-0.62 * L) + ' ' + n(0.25 * W) + ' ' + n(-0.25 * L) + ' 0 0Z';
  }

  /* ── Gradients ────────────────────────────────────── */
  function stops(grad, list) {
    list.forEach(function (s) {
      var a = { offset: s[0], 'stop-color': s[1] };
      if (s[2] !== undefined) a['stop-opacity'] = s[2];
      el('stop', a, grad);
    });
  }

  function addDefs(svg, palettes) {
    var defs = el('defs', {}, svg);
    palettes.forEach(function (p, i) {
      // guard petals: deep at the base → pale rim
      stops(el('radialGradient', { id: 'pg' + i, cx: '0.5', cy: '1', fx: '0.5', fy: '1', r: '1.1' }, defs),
        [['0', p.deep], ['0.45', p.mid], ['1', p.light]]);
      // cupped dome petals: pale lit rim → shaded belly
      stops(el('linearGradient', { id: 'pc' + i, x1: '0', y1: '0', x2: '0', y2: '1' }, defs),
        [['0', p.light], ['0.4', p.mid], ['1', p.deep]]);
      // bud ball
      stops(el('radialGradient', { id: 'pb' + i, cx: '0.4', cy: '0.35', r: '0.75' }, defs),
        [['0', p.light], ['0.55', p.mid], ['1', p.deep]]);
      // soft shadow cast by the dome onto the guard petals
      stops(el('radialGradient', { id: 'ps' + i }, defs),
        [['0.5', p.shade, 0.55], ['1', p.shade, 0]]);
    });
    stops(el('linearGradient', { id: 'leafg', x1: '0', y1: '0', x2: '1', y2: '0' }, defs),
      [['0', '#6A9872'], ['0.5', '#4F7A5A'], ['1', '#2F5640']]);
    stops(el('linearGradient', { id: 'paperBack', x1: '0', y1: '0', x2: '0', y2: '1' }, defs),
      [['0', '#F6F0EC'], ['0.6', '#E6DAD5'], ['1', '#CDBDB8']]);
    stops(el('linearGradient', { id: 'paperFront', x1: '0', y1: '0', x2: '1', y2: '0' }, defs),
      [['0', '#E9DFDA'], ['0.35', '#FFFDFB'], ['0.7', '#F6F0EC'], ['1', '#E2D6D1']]);
    stops(el('linearGradient', { id: 'ribg', x1: '0', y1: '0', x2: '0', y2: '1' }, defs),
      [['0', '#FBDDE7'], ['0.55', '#F0AFC6'], ['1', '#C9789A']]);
    stops(el('radialGradient', { id: 'shadowg' }, defs),
      [['0.55', '#2B1B2F', 0.3], ['1', '#2B1B2F', 0]]);
  }

  /* ── Builders ─────────────────────────────────────── */
  function buildPeony(layer, f, rnd, pal) {
    var R = f.r;
    var g = el('g', {}, layer);
    var head = new Part(g, 'translate(' + f.x + ' ' + f.y + ') rotate(' + (f.tilt || 0) + ')');
    var flower = { head: head, rings: [], dome: [], f: f };
    var stroke = 'rgba(120, 40, 80, 0.18)';

    flower.shadow = new Part(el('ellipse', { cx: 2, cy: R * 0.16, rx: R * 1.1, ry: R * 0.98, fill: 'url(#shadowg)' }, g), '');

    // outer guard petals (radiating, slightly squashed for a 3/4 view) + a second ring
    [[9, 1.0, 0.52, 0, 0.88], [8, 0.8, 0.44, 0.5, 0.9]].forEach(function (spec) {
      var ring = [];
      for (var i = 0; i < spec[0]; i++) {
        var a = (i + spec[3]) / spec[0] * 360 + (rnd() - 0.5) * 16;
        var p = el('path', {
          d: petalPath(R * spec[1] * (0.9 + rnd() * 0.18), R * spec[2] * (0.9 + rnd() * 0.2), rnd),
          fill: 'url(#pg' + pal + ')', stroke: stroke, 'stroke-width': 0.5
        }, g);
        ring.push(new Part(p, 'scale(1 ' + spec[4] + ') translate(0 ' + n(-R * 0.06) + ') rotate(' + n(a) + ')'));
      }
      flower.rings.push(ring);
    });

    // shadow under the dome gives the ball its depth
    var D = R * 0.64, cy = -R * 0.1;
    flower.inner = new Part(el('ellipse', { cx: 0, cy: n(cy + D * 0.15), rx: n(D * 1.12), ry: n(D * 1.0), fill: 'url(#ps' + pal + ')' }, g), '');

    // the dome: ruffled cupped petals scattered over a ball (jittered grid),
    // drawn back-to-front so lower petals overlap the ones behind them
    var cell = R * 0.2, cups = [];
    for (var gy = -D; gy <= D * 0.9; gy += cell * 0.82) {
      for (var gx = -D; gx <= D; gx += cell) {
        var x = gx + (rnd() - 0.5) * cell * 0.9;
        var yy = gy + (rnd() - 0.5) * cell * 0.7;
        var e = (x * x) / (D * D) + (yy * yy) / (D * D * 0.92);
        if (e > 1) continue;
        cups.push({ x: x, y: yy, e: e });
      }
    }
    cups.sort(function (a, b) { return a.y - b.y; });
    cups.forEach(function (cpos) {
      var front = (cpos.y / D + 1) / 2; // 0 back … 1 front
      var cw = R * (0.26 + 0.2 * front + rnd() * 0.12) * (1 - cpos.e * 0.25);
      var p = el('path', {
        d: cupPath(cw, cw * (0.45 + rnd() * 0.3), rnd),
        fill: 'url(#pc' + pal + ')', stroke: stroke, 'stroke-width': 0.45
      }, g);
      var rot = (cpos.x / D) * 38 + (rnd() - 0.5) * 34;
      var part = new Part(p, 'translate(' + n(cpos.x) + ' ' + n(cy + cpos.y) + ') rotate(' + n(rot) + ')');
      part.row = front * 5;
      flower.dome.push(part);
    });

    // closed bud shown before the bloom
    var bg = el('g', {}, g);
    el('path', { d: leafletPath(R * 0.45, R * 0.3), fill: 'url(#leafg)', transform: 'translate(0 ' + n(R * 0.1) + ') rotate(-140)' }, bg);
    el('path', { d: leafletPath(R * 0.45, R * 0.3), fill: 'url(#leafg)', transform: 'translate(0 ' + n(R * 0.1) + ') rotate(140)' }, bg);
    el('circle', { r: n(R * 0.32), fill: 'url(#pb' + pal + ')' }, bg);
    flower.bud = new Part(bg, '');
    return flower;
  }

  function buildBud(layer, b) {
    var g = el('g', {}, layer);
    el('path', { d: leafletPath(b.r * 1.6, b.r * 1.1), fill: 'url(#leafg)', transform: 'rotate(-150)' }, g);
    el('path', { d: leafletPath(b.r * 1.6, b.r * 1.1), fill: 'url(#leafg)', transform: 'rotate(150)' }, g);
    el('ellipse', { rx: b.r, ry: b.r * 1.1, fill: 'url(#pb' + (b.palette || 0) + ')' }, g);
    el('path', {
      d: 'M' + n(-b.r * 0.5) + ' ' + n(-b.r * 0.5) + ' Q0 ' + n(-b.r * 1.2) + ' ' + n(b.r * 0.5) + ' ' + n(-b.r * 0.5),
      fill: 'none', stroke: 'rgba(255,255,255,0.35)', 'stroke-width': 1.2
    }, g);
    return new Part(g, 'translate(' + b.x + ' ' + b.y + ') rotate(' + (b.tilt || 0) + ')');
  }

  function buildLeaf(layer, x, y, angle, L, compound) {
    var g = el('g', {}, layer);
    var angles = compound ? [-34, 0, 34] : [0];
    angles.forEach(function (a, i) {
      var len = compound && i !== 1 ? L * 0.72 : L;
      var lg = el('g', { transform: 'rotate(' + a + ')' }, g);
      el('path', { d: leafletPath(len, len * 0.36), fill: 'url(#leafg)' }, lg);
      el('path', {
        d: 'M0 0 Q' + n(len * 0.03) + ' ' + n(-len * 0.5) + ' 0 ' + n(-len * 0.92),
        fill: 'none', stroke: 'rgba(200, 235, 205, 0.35)', 'stroke-width': 0.9
      }, lg);
    });
    return new Part(g, 'translate(' + n(x) + ' ' + n(y) + ') rotate(' + n(angle) + ')');
  }

  // [angle, length, width]
  var BACK_SHEETS = [[-24, 350, 168], [-8, 380, 166], [8, 380, 166], [24, 350, 168]];
  var FRONT_SHEETS = [[-22, 226, 196], [22, 226, 196]];

  function buildSheet(layer, spec, front, rnd) {
    var g = el('g', {}, layer);
    el('path', {
      d: sheetPath(spec[1], spec[2], rnd),
      fill: front ? 'url(#paperFront)' : 'url(#paperBack)',
      stroke: 'rgba(120, 95, 95, 0.28)', 'stroke-width': 0.8
    }, g);
    // soft fold creases
    el('path', {
      d: 'M0 -10 Q' + n(spec[2] * 0.08) + ' ' + n(-spec[1] * 0.5) + ' ' + n(-spec[2] * 0.12) + ' ' + n(-spec[1] * 0.94),
      fill: 'none', stroke: front ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.55)', 'stroke-width': 2
    }, g);
    el('path', {
      d: 'M4 -14 Q' + n(spec[2] * 0.12) + ' ' + n(-spec[1] * 0.5) + ' ' + n(-spec[2] * 0.06) + ' ' + n(-spec[1] * 0.92),
      fill: 'none', stroke: 'rgba(140, 110, 110, 0.16)', 'stroke-width': 1.4
    }, g);
    var part = new Part(g, 'translate(' + PIVOT.x + ' ' + PIVOT.y + ') rotate(' + spec[0] + ')');
    part.angle = spec[0];
    return part;
  }

  function buildRibbon(layer) {
    var g = el('g', {}, layer);
    var y = TIE.y;
    // band around the paper
    el('path', { d: 'M168 ' + (y - 9) + ' Q200 ' + (y - 3) + ' 232 ' + (y - 9) + ' L230 ' + (y + 7) + ' Q200 ' + (y + 13) + ' 170 ' + (y + 7) + 'Z', fill: 'url(#ribg)' }, g);
    // tails
    el('path', { d: 'M196 ' + (y + 6) + ' C186 ' + (y + 30) + ' 174 ' + (y + 52) + ' 162 ' + (y + 72) + ' L177 ' + (y + 69) + ' L183 ' + (y + 80) + ' C190 ' + (y + 56) + ' 198 ' + (y + 32) + ' 202 ' + (y + 8) + 'Z', fill: 'url(#ribg)' }, g);
    el('path', { d: 'M204 ' + (y + 6) + ' C214 ' + (y + 30) + ' 226 ' + (y + 52) + ' 240 ' + (y + 70) + ' L225 ' + (y + 69) + ' L219 ' + (y + 80) + ' C210 ' + (y + 56) + ' 202 ' + (y + 32) + ' 198 ' + (y + 8) + 'Z', fill: 'url(#ribg)' }, g);
    // loops
    el('path', { d: 'M200 ' + y + ' C178 ' + (y - 32) + ' 148 ' + (y - 24) + ' 152 ' + (y - 3) + ' C156 ' + (y + 15) + ' 182 ' + (y + 11) + ' 200 ' + y + 'Z', fill: 'url(#ribg)', stroke: 'rgba(150,70,100,0.3)', 'stroke-width': 0.8 }, g);
    el('path', { d: 'M200 ' + y + ' C222 ' + (y - 32) + ' 252 ' + (y - 24) + ' 248 ' + (y - 3) + ' C244 ' + (y + 15) + ' 218 ' + (y + 11) + ' 200 ' + y + 'Z', fill: 'url(#ribg)', stroke: 'rgba(150,70,100,0.3)', 'stroke-width': 0.8 }, g);
    el('ellipse', { cx: 200, cy: y, rx: 8, ry: 9, fill: '#E59AB6', stroke: 'rgba(150,70,100,0.4)', 'stroke-width': 0.8 }, g);
    return new Part(g, '');
  }

  /* ── Public: build bouquet ────────────────────────── */
  NS.buildBouquet = function (container, cfg) {
    var rnd = makeRng(cfg.seed || 7);
    var svg = el('svg', {
      xmlns: SVGNS,
      viewBox: VIEW.x + ' ' + VIEW.y + ' ' + VIEW.w + ' ' + VIEW.h,
      preserveAspectRatio: 'xMidYMax meet',
      focusable: 'false'
    });
    addDefs(svg, cfg.palettes);
    var backLayer = el('g', {}, svg);
    var leafLayer = el('g', {}, svg);
    var frontLayer = el('g', {}, svg);
    var flowerLayer = el('g', {}, svg);
    var ribbonLayer = el('g', {}, svg);
    container.appendChild(svg);

    var parts = [];
    var backSheets = BACK_SHEETS.map(function (s) { return buildSheet(backLayer, s, false, rnd); });
    var frontSheets = FRONT_SHEETS.map(function (s) { return buildSheet(frontLayer, s, true, rnd); });
    var leaves = (cfg.leaves || []).map(function (l) { return buildLeaf(leafLayer, l[0], l[1], l[2], l[3], l[4]); });
    parts.push.apply(parts, backSheets.concat(frontSheets, leaves));

    var flowers = cfg.flowers.slice(0, cfg.flowerCount || cfg.flowers.length);
    var buds = (cfg.buds || []).map(function (b) { var bp = buildBud(flowerLayer, b); parts.push(bp); return bp; });

    // flowers: draw back (higher up) first so the front row overlaps
    var built = {};
    flowers.slice().sort(function (a, b) { return a.y - b.y; }).forEach(function (f) {
      built[flowers.indexOf(f)] = buildPeony(flowerLayer, f, rnd, f.palette || 0);
    });
    var peonies = flowers.map(function (_, i) { return built[i]; });
    peonies.forEach(function (p) {
      parts.push(p.head, p.bud, p.shadow, p.inner);
      p.rings.forEach(function (r) { parts.push.apply(parts, r); });
      parts.push.apply(parts, p.dome);
    });

    var ribbon = buildRibbon(ribbonLayer);
    parts.push(ribbon);

    function renderAll() { for (var i = 0; i < parts.length; i++) parts[i].render(); }

    /* Timeline: paper unfolds (scene 4) → peonies open one by one (scene 5) */
    function timeline(reduced) {
      var tl = gsap.timeline({ paused: true });
      tl.set(svg, { visibility: 'visible' }, 0);

      if (reduced) {
        // prefers-reduced-motion: nothing grows, everything just fades in
        tl.set(parts, { s: 1, r: 0, x: 0, y: 0, o: 1 }, 0);
        peonies.forEach(function (p) { tl.set(p.bud, { o: 0 }, 0); });
        tl.fromTo(svg, { opacity: 0 }, { opacity: 1, duration: 1.6, ease: 'power1.inOut' }, 0);
        return tl;
      }

      tl.set(svg, { opacity: 1 }, 0);
      // wrapping paper fans open from the bottom
      tl.fromTo(backSheets, { s: 0.35, o: 0, r: function (i, p) { return -p.angle * 0.8; } },
        { s: 1, o: 1, r: 0, duration: 1.3, ease: 'power3.out', stagger: { each: 0.08, from: 'center' } }, 0);
      tl.fromTo(frontSheets, { s: 0.4, o: 0, r: function (i, p) { return -p.angle * 0.7; } },
        { s: 1, o: 1, r: 0, duration: 1.1, ease: 'power3.out', stagger: 0.08 }, 0.25);
      tl.fromTo(leaves, { s: 0, o: 0 }, { s: 1, o: 1, duration: 0.9, ease: 'back.out(1.6)', stagger: 0.05 }, 0.45);
      tl.fromTo(ribbon, { s: 0.6, o: 0, y: 10 }, { s: 1, o: 1, y: 0, duration: 0.8, ease: 'back.out(1.8)' }, 0.7);

      var BLOOM = 1.1;
      var order = cfg.bloomOrder || peonies.map(function (_, i) { return i; });
      order.forEach(function (idx, k) {
        var p = peonies[idx];
        if (!p) return;
        var t0 = BLOOM + k * (cfg.bloomGap || 0.24);
        // bud swells…
        tl.fromTo(p.head, { s: 0.45, r: -14, o: 1 }, { s: 1, r: 0, duration: 2.3, ease: 'power2.out' }, t0 - 0.35);
        tl.fromTo(p.bud, { s: 0, o: 1 }, { s: 1, duration: 0.45, ease: 'back.out(2)' }, t0 - 0.45);
        tl.to(p.bud, { s: 1.3, o: 0, duration: 0.55, ease: 'power1.in' }, t0 + 0.2);
        // …the ruffled dome opens from its centre…
        tl.fromTo(p.dome,
          { s: 0.15, o: 0, y: function (i, d) { return (2.5 - d.row) * p.f.r * 0.06; } },
          { s: 1, o: 1, y: 0, duration: 1.2, ease: 'power3.out', stagger: { each: 0.025, from: 'center' } }, t0);
        tl.fromTo([p.shadow, p.inner], { o: 0 }, { o: 1, duration: 1.2, ease: 'power1.inOut' }, t0 + 0.2);
        // …then the guard petals unfold outwards
        p.rings.slice().reverse().forEach(function (ring, ri) {
          tl.fromTo(ring, { s: 0.12, o: 0, r: function () { return (rnd() - 0.5) * 60; } },
            { s: 1, r: 0, o: 1, duration: 1.3, ease: 'power3.out', stagger: { each: 0.04, from: 'random' } }, t0 + 0.15 + ri * 0.18);
        });
      });
      tl.fromTo(buds, { s: 0, o: 0 }, { s: 1, o: 1, duration: 0.7, ease: 'back.out(2)', stagger: 0.25 }, BLOOM + 1.2);
      return tl;
    }

    renderAll();

    return {
      svg: svg,
      parts: parts,
      renderAll: renderAll,
      timeline: timeline,
      aspect: VIEW.w / VIEW.h
    };
  };
})(window.Flowers = window.Flowers || {});
