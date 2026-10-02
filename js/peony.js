/* Peony bouquet: SVG construction + bloom timeline.
 *
 * A florist "dome" bouquet like real Sarah Bernhardt peony bouquets: ~70
 * cupped, half-open blooms (magenta, hot pink, soft pink, blush, white) and a
 * few tight buds packed into a round dome, framed by layered pink paper and
 * long satin ribbons.
 *
 * Each bloom is a cup of ruffled petals (outer ring, inner cup, heart) over a
 * dark body; gradients are shared per colour, so the dome stays light on phones.
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
      // the half-open centre
      stops(el('radialGradient', { id: 'eye' + i, cx: '0.5', cy: '0.6', r: '0.6' }, defs),
        [['0', p.crease], ['0.7', p.deep], ['1', p.mid, 0]]);
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
    // darkens the dome's rim so it reads as a ball
    stops(el('radialGradient', { id: 'domeShade', cx: '0.5', cy: '0.42', r: '0.55' }, defs),
      [['0.72', '#4A0F2E', 0], ['1', '#4A0F2E', 0.22]]);
    stops(el('radialGradient', { id: 'domeShadow' }, defs),
      [['0', '#6A1544', 1], ['0.93', '#5A1238', 1], ['1', '#5A1238', 0]]);
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

  function buildBloom(layer, b, rnd, pal) {
    var g = el('g', {}, layer);
    var r = b.r;
    var inner = el('g', { transform: 'rotate(' + n((rnd() - 0.5) * 50) + ')' }, g);
    var fill = 'url(#pet' + b.palette + ')';
    var stroke = { stroke: pal.rim, 'stroke-opacity': 0.75, 'stroke-width': n(Math.max(0.5, r * 0.035)) };
    // dark body: what shows between the petals
    el('circle', { r: n(r * 0.92), fill: 'url(#ball' + b.palette + ')' }, inner);
    var open = el('g', {}, inner);
    // ring of outer petals, rims facing outwards; the far (top) ones first
    var outer = b.bud ? 3 : 6, angs = [];
    var off = rnd() * 360;
    for (var i = 0; i < outer; i++) angs.push(off + i * 360 / outer + (rnd() - 0.5) * 18);
    angs.sort(function (p, q) { return Math.sin(p * Math.PI / 180) - Math.sin(q * Math.PI / 180); });
    angs.forEach(function (a) {
      var w = r * (b.bud ? 1.05 : 0.95) * (0.9 + rnd() * 0.2), h = r * (0.62 + rnd() * 0.12);
      var pp = polar(0, 0, r * 0.38, a);
      el('path', Object.assign({ d: cupPath(w, h, rnd), fill: fill, transform: 'translate(' + n(pp[0]) + ' ' + n(pp[1]) + ') rotate(' + n(a + 90) + ')' }, stroke), open);
    });
    if (!b.bud) {
      // inner cup and the ruffled heart
      for (i = 0; i < 4; i++) {
        var a2 = off + 45 + i * 90 + (rnd() - 0.5) * 30;
        var p2 = polar(0, 0, r * 0.16, a2);
        el('path', Object.assign({ d: cupPath(r * 0.62, r * 0.4, rnd), fill: fill, transform: 'translate(' + n(p2[0]) + ' ' + n(p2[1]) + ') rotate(' + n(a2 + 90) + ')' }, stroke), open);
      }
      el('ellipse', { rx: n(r * 0.17), ry: n(r * 0.12), fill: 'url(#eye' + b.palette + ')' }, open);
      el('path', Object.assign({ d: cupPath(r * 0.34, r * 0.2, rnd), fill: fill, transform: 'translate(0 ' + n(r * 0.08) + ')' }, stroke), open);
    } else {
      el('path', { d: leafletPath(r * 0.85, r * 0.62), fill: 'url(#leafg)', transform: 'translate(0 ' + n(r * 0.8) + ') rotate(152)' }, inner);
      el('path', { d: leafletPath(r * 0.85, r * 0.62), fill: 'url(#leafg)', transform: 'translate(0 ' + n(r * 0.8) + ') rotate(-152)' }, inner);
    }
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
        if (dx * dx + dy * dy < Math.pow((o.r + r) * 0.7, 2)) { ok = false; break; }
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
      if (near > 8) blooms.push({ x: x, y: y, r: Math.min(13, near + 6), d: d / DOME.R, bud: true, palette: cfg.budPalette });
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
        el('path', { d: sheetPath(L[1] * (0.94 + rnd() * 0.12), L[2], rnd), fill: 'url(#' + L[3] + ')', stroke: 'rgba(160,40,90,0.25)', 'stroke-width': 0.8 }, g);
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
