/* Peony bouquet: SVG construction + bloom timeline.
 *
 * A florist "dome" bouquet like real Sarah Bernhardt peony bouquets: ~70
 * cupped, half-open blooms (magenta, hot pink, soft pink, blush, white) and a
 * few tight buds packed into a round dome, framed by layered pink paper and
 * long satin ribbons.
 *
 * Each bloom: contact shadow, shaded ball, far petals, a crumpled crown of
 * ruffled edges with creases, broad guard petals cupping it, and globe
 * lighting. Gradients are shared per colour, so the dome stays light on phones.
 *
 * Every animated SVG node is wrapped in a Part. GSAP tweens the Part's plain
 * numeric fields; Part.render() writes them back as a single `transform`
 * attribute, so every pivot point is explicit and identical across browsers. */
(function (NS) {
  'use strict';

  var SVGNS = 'http://www.w3.org/2000/svg';
  var VIEW = { x: -20, y: 20, w: 440, h: 590 };
  var DOME = { x: 200, y: 222, R: 166 };
  var TIE = { x: 200, y: 478 };

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
  function polar(cx, cy, r, deg) {
    var a = deg * Math.PI / 180;
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
  }
  function arc(cx, cy, r, a0, a1) {
    var p0 = polar(cx, cy, r, a0), p1 = polar(cx, cy, r, a1);
    return 'M' + n(p0[0]) + ' ' + n(p0[1]) + 'A' + n(r) + ' ' + n(r) + ' 0 ' + (a1 - a0 > 180 ? 1 : 0) + ' 1 ' + n(p1[0]) + ' ' + n(p1[1]);
  }

  function leafletPath(L, W) {
    return 'M0 0 C' + n(-0.55 * W) + ' ' + n(-0.2 * L) + ' ' + n(-0.62 * W) + ' ' + n(-0.68 * L) + ' 0 ' + n(-L) +
      ' C' + n(0.62 * W) + ' ' + n(-0.68 * L) + ' ' + n(0.55 * W) + ' ' + n(-0.2 * L) + ' 0 0Z';
  }

  // Wrapping-paper sheet, pivot at the bottom, pointing up, soft wavy edge
  function sheetPath(L, W, rnd) {
    function j() { return 1 + (rnd() - 0.5) * 0.12; }
    return 'M0 0 C' + n(-0.3 * W) + ' ' + n(-0.25 * L) + ' ' + n(-0.62 * W) + ' ' + n(-0.6 * L) + ' ' + n(-0.5 * W) + ' ' + n(-0.94 * L) +
      ' Q' + n(-0.26 * W) + ' ' + n(-1.05 * L * j()) + ' 0 ' + n(-0.97 * L) +
      ' Q' + n(0.26 * W) + ' ' + n(-1.05 * L * j()) + ' ' + n(0.5 * W) + ' ' + n(-0.94 * L) +
      ' C' + n(0.62 * W) + ' ' + n(-0.6 * L) + ' ' + n(0.3 * W) + ' ' + n(-0.25 * L) + ' 0 0Z';
  }

  /* ── Gradients ────────────────────────────────────── */
  function stops(grad, list) {
    list.forEach(function (s) {
      var a = { offset: s[0], 'stop-color': s[1] };
      if (s[2] !== undefined) a['stop-opacity'] = s[2];
      el('stop', a, grad);
    });
    return grad;
  }

  function addDefs(svg, palettes) {
    var defs = el('defs', {}, svg);
    palettes.forEach(function (p, i) {
      // sphere shading: lit from the upper left
      stops(el('radialGradient', { id: 'ball' + i, cx: '0.38', cy: '0.32', r: '0.78' }, defs),
        [['0', p.light], ['0.5', p.mid], ['0.88', p.deep], ['1', p.deep]]);
      // cupped petal: light ruffled rim → deep base (the bloom's centre)
      stops(el('linearGradient', { id: 'pet' + i, x1: '0', y1: '0', x2: '0', y2: '1' }, defs),
        [['0', p.light], ['0.45', p.mid], ['1', p.deep]]);
      // far petals sit in shadow
      stops(el('linearGradient', { id: 'petb' + i, x1: '0', y1: '0', x2: '0', y2: '1' }, defs),
        [['0', p.mid], ['1', p.deep]]);
      // the crown: deep between the ruffles
      stops(el('radialGradient', { id: 'core' + i, cx: '0.45', cy: '0.4', r: '0.6' }, defs),
        [['0', p.mid], ['0.65', p.deep], ['1', p.crease]]);
    });
    stops(el('linearGradient', { id: 'leafg', x1: '0', y1: '0', x2: '1', y2: '0' }, defs),
      [['0', '#6A9872'], ['0.5', '#4F7A5A'], ['1', '#2F5640']]);
    stops(el('linearGradient', { id: 'paperHot', x1: '0', y1: '1', x2: '0', y2: '0' }, defs),
      [['0', '#D93C85'], ['0.6', '#EE5E9F'], ['1', '#F78BBB']]);
    stops(el('linearGradient', { id: 'paperPale', x1: '0', y1: '1', x2: '0', y2: '0' }, defs),
      [['0', '#F1B3CB'], ['0.6', '#F9D2E1'], ['1', '#FDE7EF']]);
    stops(el('linearGradient', { id: 'paperFront', x1: '0', y1: '0', x2: '1', y2: '0' }, defs),
      [['0', '#F2B8CE'], ['0.4', '#FDE6EE'], ['0.75', '#F9D3E1'], ['1', '#EFA9C4']]);
    stops(el('linearGradient', { id: 'ribg', x1: '0', y1: '0', x2: '1', y2: '0' }, defs),
      [['0', '#F6D9E4'], ['0.45', '#FFFFFF'], ['1', '#EFC6D6']]);
    stops(el('radialGradient', { id: 'glight', cx: '0.32', cy: '0.26', r: '0.82' }, defs),
      [['0', '#FFF4F8', 0.16], ['0.45', '#FFFFFF', 0], ['0.66', '#3A0A26', 0], ['0.92', '#3A0A26', 0.24], ['1', '#3A0A26', 0.12]]);
    stops(el('radialGradient', { id: 'bshadow' }, defs),
      [['0.55', '#2E0820', 0.5], ['1', '#2E0820', 0]]);
    // darkens the dome's rim so it reads as a ball
    stops(el('radialGradient', { id: 'domeShade', cx: '0.5', cy: '0.42', r: '0.55' }, defs),
      [['0.72', '#4A0F2E', 0], ['1', '#4A0F2E', 0.22]]);
    stops(el('radialGradient', { id: 'domeShadow' }, defs),
      [['0', '#8A2160', 1], ['0.93', '#6E1A4C', 1], ['1', '#6E1A4C', 0]]);
  }

  /* ── One cupped peony ─────────────────────────────── */
  // A cupped petal seen from above: ruffled rim at the top (-y), rounded base.
  function cupPath(w, h, rnd) {
    function j() { return 1 + (rnd() - 0.5) * 0.24; }
    var hw = w / 2;
    return 'M' + n(-hw) + ' 0' +
      ' C' + n(-hw) + ' ' + n(-0.6 * h) + ' ' + n(-0.75 * hw) + ' ' + n(-h * j()) + ' ' + n(-0.38 * hw) + ' ' + n(-0.94 * h) +
      ' Q' + n(-0.18 * hw) + ' ' + n(-1.06 * h * j()) + ' 0 ' + n(-0.95 * h) +
      ' Q' + n(0.18 * hw) + ' ' + n(-1.06 * h * j()) + ' ' + n(0.38 * hw) + ' ' + n(-0.94 * h) +
      ' C' + n(0.75 * hw) + ' ' + n(-h * j()) + ' ' + n(hw) + ' ' + n(-0.6 * h) + ' ' + n(hw) + ' 0' +
      ' C' + n(0.6 * hw) + ' ' + n(0.42 * h) + ' ' + n(-0.6 * hw) + ' ' + n(0.42 * h) + ' ' + n(-hw) + ' 0Z';
  }

  // crumpled petal edge: a thin, wavy crescent around (cx, cy)
  function ruffle(cx, cy, rr, a0, a1, t, rnd) {
    var N = 10, waves = 1 + Math.floor(rnd() * 2), ph = rnd() * 6.28, out = [], inn = [];
    for (var k = 0; k <= N; k++) {
      var u = k / N, a = (a0 + (a1 - a0) * u) * Math.PI / 180;
      var wob = Math.sin(u * Math.PI * waves + ph) * rr * 0.045;
      var thick = t * Math.sin(u * Math.PI);
      out.push(n(cx + Math.cos(a) * (rr + wob)) + ' ' + n(cy + Math.sin(a) * (rr + wob)));
      inn.push(n(cx + Math.cos(a) * (rr + wob - thick)) + ' ' + n(cy + Math.sin(a) * (rr + wob - thick)));
    }
    return 'M' + out.join(' L') + ' L' + inn.reverse().join(' L') + 'Z';
  }

  // lumpy, petal-scalloped outline of a bloom (radius r)
  function blobPath(r, rnd, lobes) {
    var N = lobes * 3, pts = [], ph = rnd() * 6.28;
    for (var k = 0; k < N; k++) {
      var a = (k / N) * Math.PI * 2;
      var rr = r * (1 + 0.055 * Math.cos(a * lobes + ph) + (rnd() - 0.5) * 0.03);
      pts.push([Math.cos(a) * rr, Math.sin(a) * rr]);
    }
    var d = '';
    for (k = 0; k < N; k++) {
      var p0 = pts[(k - 1 + N) % N], p1 = pts[k], p2 = pts[(k + 1) % N], p3 = pts[(k + 2) % N];
      if (!k) d = 'M' + n(p1[0]) + ' ' + n(p1[1]);
      d += ' C' + n(p1[0] + (p2[0] - p0[0]) / 6) + ' ' + n(p1[1] + (p2[1] - p0[1]) / 6) + ' ' +
        n(p2[0] - (p3[0] - p1[0]) / 6) + ' ' + n(p2[1] - (p3[1] - p1[1]) / 6) + ' ' + n(p2[0]) + ' ' + n(p2[1]);
    }
    return d + 'Z';
  }

  function buildBloom(layer, b, rnd, pal) {
    var g = el('g', {}, layer);
    var r = b.r, P = b.palette;
    // soft contact shadow cast on the blooms below/behind
    el('circle', { cx: n(r * 0.12), cy: n(r * 0.2), r: n(r * 1.04), fill: 'url(#bshadow)' }, g);
    var inner = el('g', { transform: 'rotate(' + n((rnd() - 0.5) * 30) + ')' }, g);
    var outline = blobPath(r * 0.96, rnd, b.bud ? 4 : 7);
    el('path', { d: outline, fill: 'url(#ball' + P + ')' }, inner);
    var open = el('g', {}, inner);

    if (!b.bud) {
      // far petals peeking behind the crown
      [-125 + rnd() * 20, -55 - rnd() * 20].forEach(function (a) {
        var pp = polar(0, 0, r * 0.52, a);
        el('path', { d: cupPath(r * 0.72, r * 0.42, rnd), fill: 'url(#petb' + P + ')', transform: 'translate(' + n(pp[0]) + ' ' + n(pp[1]) + ') rotate(' + n(a + 90) + ')' }, open);
      });
      // the crumpled crown: deep core, ruffled edges catching the light, creases below them
      var ox = (rnd() - 0.5) * r * 0.16, oy = -r * (0.06 + rnd() * 0.1);
      el('ellipse', { cx: n(ox), cy: n(oy), rx: n(r * 0.6), ry: n(r * 0.5), fill: 'url(#core' + P + ')' }, open);
      var lit = '', crease = '', count = 9 + Math.floor(rnd() * 4);
      for (var k = 0; k < count; k++) {
        var rr = r * (0.1 + 0.42 * Math.sqrt(rnd()));
        var a0 = rnd() * 360, span = 70 + rnd() * 90, t = r * (0.07 + rnd() * 0.06);
        var cx = ox + (rnd() - 0.5) * r * 0.12, cy = oy + (rnd() - 0.5) * r * 0.1;
        crease += ruffle(cx + r * 0.02, cy + r * 0.05, rr * 0.97, a0 + 4, a0 + span - 4, t * 0.9, rnd);
        lit += ruffle(cx, cy, rr, a0, a0 + span, t, rnd);
      }
      el('path', { d: crease, fill: pal.crease, opacity: 0.38 }, open);
      el('path', { d: lit, fill: pal.rim, opacity: 0.55 }, open);
      // broad guard petals cupping the ball from the sides and the front
      var angs = [8 + rnd() * 14, 52 + rnd() * 14, 92 + (rnd() - 0.5) * 14, 128 - rnd() * 14, 172 - rnd() * 14];
      angs.sort(function (p, q) { return Math.sin(p * Math.PI / 180) - Math.sin(q * Math.PI / 180); });
      angs.forEach(function (a) {
        var front = Math.sin(a * Math.PI / 180);
        var pp = polar(0, 0, r * (0.5 + 0.08 * front), a);
        el('path', {
          d: cupPath(r * (0.82 + 0.25 * front) * (0.9 + rnd() * 0.2), r * (0.5 + 0.12 * front), rnd),
          fill: 'url(#pet' + P + ')', stroke: pal.deep, 'stroke-opacity': 0.35, 'stroke-width': n(r * 0.025),
          transform: 'translate(' + n(pp[0]) + ' ' + n(pp[1]) + ') rotate(' + n(a - 90 + (rnd() - 0.5) * 16) + ')'
        }, open);
      });
    } else {
      // tight bud: sepals hug the ball, a spiral seam of petals
      el('path', { d: 'M' + n(-r * 0.62) + ' ' + n(r * 0.1) + ' Q' + n(-r * 0.2) + ' ' + n(-r * 0.75) + ' ' + n(r * 0.5) + ' ' + n(-r * 0.45), fill: 'none', stroke: pal.deep, 'stroke-width': n(r * 0.07), 'stroke-linecap': 'round', opacity: 0.5 }, open);
      el('path', { d: leafletPath(r * 0.95, r * 0.7), fill: 'url(#leafg)', transform: 'translate(0 ' + n(r * 0.85) + ') rotate(150)' }, inner);
      el('path', { d: leafletPath(r * 0.95, r * 0.7), fill: 'url(#leafg)', transform: 'translate(0 ' + n(r * 0.85) + ') rotate(-150)' }, inner);
    }
    // globe lighting: lit upper left, shaded lower right
    el('path', { d: outline, fill: 'url(#glight)' }, inner);

    var part = new Part(g, 'translate(' + n(b.x) + ' ' + n(b.y) + ')');
    var openPart = new Part(open, '');
    return { part: part, open: openPart, d: b.d };
  }

  // Pack blooms into the dome: big in the middle, smaller towards the rim (perspective)
  function packDome(cfg, rnd) {
    var blooms = [];
    var mix = cfg.mix, total = mix.reduce(function (a, b) { return a + b; }, 0);
    function pickPalette() {
      var x = rnd() * total;
      for (var i = 0; i < mix.length; i++) { x -= mix[i]; if (x <= 0) return i; }
      return 0;
    }
    var target = cfg.count || 70, tries = 0;
    while (blooms.length < target && tries < 12000) {
      tries++;
      var a = rnd() * Math.PI * 2, d = Math.sqrt(rnd()) * DOME.R;
      var e = d / DOME.R;
      var r = (cfg.size || 25) * (1.12 - 0.42 * e * e) * (0.88 + rnd() * 0.24);
      if (d + r * 0.15 > DOME.R) continue;
      var x = DOME.x + Math.cos(a) * d, y = DOME.y + Math.sin(a) * d * 0.96;
      var ok = true;
      for (var i = 0; i < blooms.length; i++) {
        var o = blooms[i], dx = o.x - x, dy = o.y - y;
        if (dx * dx + dy * dy < Math.pow((o.r + r) * 0.62, 2)) { ok = false; break; }
      }
      if (!ok) continue;
      var bud = rnd() < (cfg.buds || 0.1);
      blooms.push({ x: x, y: y, r: bud ? r * 0.72 : r, d: e, bud: bud, palette: bud ? cfg.budPalette : pickPalette() });
    }
    // fill the leftover gaps with small buds so no paper shows through the dome
    for (tries = 0; tries < 4000; tries++) {
      a = rnd() * Math.PI * 2; d = Math.sqrt(rnd()) * (DOME.R - 8);
      x = DOME.x + Math.cos(a) * d; y = DOME.y + Math.sin(a) * d * 0.96;
      var near = 1e9;
      for (i = 0; i < blooms.length; i++) {
        o = blooms[i];
        near = Math.min(near, Math.hypot(o.x - x, o.y - y) - o.r);
      }
      if (near > 10) blooms.push({ x: x, y: y, r: Math.min(13, near + 6), d: d / DOME.R, bud: true, palette: cfg.budPalette });
    }
    return blooms;
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
    var ribbonBack = el('g', {}, svg);
    var collarLayer = el('g', {}, svg);
    var frontLayer = el('g', {}, svg);
    var leafLayer = el('g', {}, svg);
    var bloomLayer = el('g', {}, svg);
    var ribbonLayer = el('g', {}, svg);
    container.appendChild(svg);

    var parts = [];

    // paper collar: hot pink outer layer + pale inner layer radiating behind the dome
    var collar = [];
    [[12, 214, 176, 'paperHot', 0], [12, 198, 160, 'paperPale', 0.5]].forEach(function (L) {
      for (var i = 0; i < L[0]; i++) {
        var ang = -150 + (i + L[4]) / (L[0] - 1) * 300 + (rnd() - 0.5) * 8;
        var g = el('g', {}, collarLayer);
        var SL = L[1] * (0.94 + rnd() * 0.12), SW = L[2];
        el('path', { d: sheetPath(SL, SW, rnd), fill: 'url(#' + L[3] + ')', stroke: 'rgba(160,40,90,0.25)', 'stroke-width': 0.8 }, g);
        // soft folds: a lit ridge with a shadow beside it
        var fx = (rnd() - 0.5) * SW * 0.22;
        el('path', { d: 'M' + n(fx * 0.2) + ' ' + n(-SL * 0.3) + ' Q' + n(fx) + ' ' + n(-SL * 0.65) + ' ' + n(fx * 1.2) + ' ' + n(-SL * 0.82), fill: 'none', stroke: 'rgba(255,255,255,0.45)', 'stroke-width': 2.2, 'stroke-linecap': 'round' }, g);
        el('path', { d: 'M' + n(fx * 0.2 + 3) + ' ' + n(-SL * 0.3) + ' Q' + n(fx + 4) + ' ' + n(-SL * 0.65) + ' ' + n(fx * 1.2 + 5) + ' ' + n(-SL * 0.82), fill: 'none', stroke: 'rgba(150,30,80,0.18)', 'stroke-width': 3, 'stroke-linecap': 'round' }, g);
        var p = new Part(g, 'translate(' + DOME.x + ' ' + DOME.y + ') rotate(' + n(ang) + ')');
        p.angle = ang;
        collar.push(p);
      }
    });
    var shadow = new Part(el('ellipse', { cx: DOME.x, cy: DOME.y + 4, rx: DOME.R * 1.04, ry: DOME.R * 1.02, fill: 'url(#domeShadow)' }, collarLayer), '');

    // front wrap: two pale sheets crossing into a cone below the dome
    var front = [[-30, 250, 230], [30, 250, 230], [0, 200, 200]].map(function (f) {
      var g = el('g', {}, frontLayer);
      el('path', { d: sheetPath(f[1], f[2], rnd), fill: 'url(#paperFront)', stroke: 'rgba(170,60,110,0.3)', 'stroke-width': 0.8 }, g);
      el('path', { d: 'M0 -8 Q' + n(f[2] * 0.06) + ' ' + n(-f[1] * 0.5) + ' ' + n(-f[2] * 0.1) + ' ' + n(-f[1] * 0.92), fill: 'none', stroke: 'rgba(255,255,255,0.7)', 'stroke-width': 1.8 }, g);
      var p = new Part(g, 'translate(' + TIE.x + ' ' + (TIE.y + 22) + ') rotate(' + f[0] + ')');
      p.angle = f[0];
      return p;
    });

    // leaves peeking out between the blooms and at the rim
    var leaves = [];
    for (var i = 0; i < (cfg.leaves || 16); i++) {
      var la = -170 + rnd() * 340, ld = DOME.R * (0.55 + rnd() * 0.45);
      var lp = polar(DOME.x, DOME.y, ld, la - 90);
      var lg = el('g', {}, leafLayer);
      var len = 26 + rnd() * 18;
      el('path', { d: leafletPath(len, len * 0.42), fill: 'url(#leafg)' }, lg);
      el('path', { d: 'M0 0 L0 ' + n(-len * 0.9), stroke: 'rgba(200,235,205,0.4)', 'stroke-width': 0.8 }, lg);
      var part = new Part(lg, 'translate(' + n(lp[0]) + ' ' + n(lp[1]) + ') rotate(' + n(la + (rnd() - 0.5) * 30) + ')');
      leaves.push(part);
    }

    // the blooms: rim first, centre last, so the middle bulges towards us
    var specs = packDome(cfg, rnd).sort(function (a, b) { return b.d - a.d; });
    var blooms = specs.map(function (b) { return buildBloom(bloomLayer, b, rnd, cfg.palettes[b.palette]); });
    var domeShade = new Part(el('circle', { cx: DOME.x, cy: DOME.y, fill: 'url(#domeShade)', 'pointer-events': 'none', r: DOME.R + 2 }, bloomLayer), '');

    // satin ribbons: bow at the tie + long tails
    var tails = [];
    [[-18, 112, 10], [-6, 130, -6], [8, 124, 8], [20, 106, -10]].forEach(function (t) {
      var g = el('g', {}, ribbonBack);
      var x = t[0], L = t[1], w = t[2];
      el('path', {
        d: 'M' + x + ' 0 C' + n(x + w) + ' ' + n(L * 0.3) + ' ' + n(x - w) + ' ' + n(L * 0.65) + ' ' + n(x + w * 0.5) + ' ' + L +
          ' L' + n(x + w * 0.5 + 9) + ' ' + n(L - 6) + ' C' + n(x - w + 9) + ' ' + n(L * 0.65) + ' ' + n(x + w + 9) + ' ' + n(L * 0.3) + ' ' + n(x + 9) + ' 0Z',
        fill: 'url(#ribg)', stroke: 'rgba(200,140,170,0.45)', 'stroke-width': 0.6
      }, g);
      var p = new Part(g, 'translate(' + (TIE.x - 4) + ' ' + (TIE.y + 6) + ')');
      tails.push(p);
    });
    var bowG = el('g', {}, ribbonLayer);
    el('path', { d: 'M0 0 C-24 -30 -58 -22 -54 -2 C-50 16 -20 12 0 0Z', fill: 'url(#ribg)', stroke: 'rgba(200,140,170,0.5)', 'stroke-width': 0.8 }, bowG);
    el('path', { d: 'M0 0 C24 -30 58 -22 54 -2 C50 16 20 12 0 0Z', fill: 'url(#ribg)', stroke: 'rgba(200,140,170,0.5)', 'stroke-width': 0.8 }, bowG);
    el('ellipse', { rx: 8, ry: 9, fill: '#FBE3EC', stroke: 'rgba(200,140,170,0.6)', 'stroke-width': 0.8 }, bowG);
    var bow = new Part(bowG, 'translate(' + TIE.x + ' ' + TIE.y + ')');

    parts.push.apply(parts, collar.concat([shadow], front, leaves, tails, [bow, domeShade]));
    blooms.forEach(function (b) { parts.push(b.part, b.open); });

    function renderAll() { for (var i = 0; i < parts.length; i++) parts[i].render(); }

    /* Timeline: paper fans open (scene 4) → blooms open in a wave from the centre (scene 5) */
    function timeline(reduced) {
      var tl = gsap.timeline({ paused: true });
      tl.set(svg, { visibility: 'visible' }, 0);

      if (reduced) {
        tl.set(parts, { s: 1, r: 0, x: 0, y: 0, o: 1 }, 0);
        tl.fromTo(svg, { opacity: 0 }, { opacity: 1, duration: 1.6, ease: 'power1.inOut' }, 0);
        return tl;
      }

      tl.set(svg, { opacity: 1 }, 0);
      tl.fromTo(collar, { s: 0.3, o: 0, r: function (i, p) { return -p.angle * 0.35; } },
        { s: 1, o: 1, r: 0, duration: 1.3, ease: 'power3.out', stagger: { each: 0.035, from: 'center' } }, 0);
      // the dark gaps between blooms only appear together with the blooms
      tl.fromTo(shadow, { o: 0 }, { o: 1, duration: 2.2, ease: 'power1.in' }, 1.1);
      tl.fromTo(front, { s: 0.4, o: 0, r: function (i, p) { return -p.angle * 0.6; } },
        { s: 1, o: 1, r: 0, duration: 1.1, ease: 'power3.out', stagger: 0.08 }, 0.3);
      tl.fromTo(tails, { sy: 0, o: 0 }, { sy: 1, o: 1, duration: 1.4, ease: 'power2.out', stagger: 0.1 }, 0.6);
      tl.fromTo(bow, { s: 0.3, o: 0 }, { s: 1, o: 1, duration: 0.8, ease: 'back.out(2.2)' }, 0.7);
      tl.fromTo(leaves, { s: 0, o: 0 }, { s: 1, o: 1, duration: 0.8, ease: 'back.out(1.8)', stagger: 0.03 }, 0.7);
      tl.fromTo(domeShade, { o: 0 }, { o: 1, duration: 1.5 }, 1.2);

      // a wave of blooms from the centre outwards; each one swells and its petals unfold
      blooms.forEach(function (b) {
        var at = 1.0 + b.d * 2.3 + rnd() * 0.3;
        tl.fromTo(b.part, { s: 0, o: 0, r: -30 + rnd() * 20 }, { s: 1, o: 1, r: 0, duration: 0.85, ease: 'back.out(1.7)' }, at);
        tl.fromTo(b.open, { s: 0.55 }, { s: 1, duration: 1.0, ease: 'power3.out' }, at + 0.15);
      });
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
