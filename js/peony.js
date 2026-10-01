/* Peony bouquet: SVG construction + bloom timeline.
 *
 * Every animated SVG node is wrapped in a Part. GSAP tweens the Part's plain
 * numeric fields; Part.render() writes them back as a single `transform`
 * attribute. This keeps every pivot point explicit (no bbox-based origins)
 * and identical across browsers. */
(function (NS) {
  'use strict';

  var SVGNS = 'http://www.w3.org/2000/svg';
  var VIEW = { x: 0, y: 70, w: 400, h: 490 };
  var TIE = { x: 200, y: 440 };

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
    this.dash = null; // for stems: 1 = hidden, 0 = fully drawn
    this.len = 0;
    this._t = ''; this._o = ''; this._d = '';
  }
  Part.prototype.render = function () {
    var t = this.base + ' translate(' + n(this.x) + ' ' + n(this.y) + ') rotate(' + n(this.r) +
      ') scale(' + n(this.s * this.sx) + ' ' + n(this.s * this.sy) + ')';
    if (t !== this._t) { this.node.setAttribute('transform', t); this._t = t; }
    var o = String(n(this.o));
    if (o !== this._o) { this.node.setAttribute('opacity', o); this._o = o; }
    if (this.dash !== null) {
      var d = String(n(this.dash * this.len));
      if (d !== this._d) { this.node.setAttribute('stroke-dashoffset', d); this._d = d; }
    }
  };

  /* ── Shapes ───────────────────────────────────────── */
  // Petal with base at (0,0) pointing up (-y), ruffled tip. W ≈ half-width.
  function petalPath(L, W, rnd) {
    function j(k) { return 1 + (rnd() - 0.5) * (k || 0.16); }
    var notch = 0.9 + rnd() * 0.06;
    return 'M0 0' +
      ' C' + n(-0.95 * W) + ' ' + n(-0.1 * L) + ' ' + n(-1.18 * W * j()) + ' ' + n(-0.58 * L) + ' ' + n(-0.78 * W) + ' ' + n(-0.9 * L * j(0.08)) +
      ' C' + n(-0.52 * W) + ' ' + n(-1.07 * L * j(0.08)) + ' ' + n(-0.2 * W) + ' ' + n(-1.02 * L) + ' 0 ' + n(-notch * L) +
      ' C' + n(0.2 * W) + ' ' + n(-1.02 * L) + ' ' + n(0.52 * W) + ' ' + n(-1.07 * L * j(0.08)) + ' ' + n(0.78 * W) + ' ' + n(-0.9 * L * j(0.08)) +
      ' C' + n(1.18 * W * j()) + ' ' + n(-0.58 * L) + ' ' + n(0.95 * W) + ' ' + n(-0.1 * L) + ' 0 0Z';
  }

  function leafletPath(L, W) {
    return 'M0 0 C' + n(-0.55 * W) + ' ' + n(-0.2 * L) + ' ' + n(-0.62 * W) + ' ' + n(-0.68 * L) + ' 0 ' + n(-L) +
      ' C' + n(0.62 * W) + ' ' + n(-0.68 * L) + ' ' + n(0.55 * W) + ' ' + n(-0.2 * L) + ' 0 0Z';
  }

  /* ── Gradients ────────────────────────────────────── */
  function addDefs(svg, palettes) {
    var defs = el('defs', {}, svg);
    palettes.forEach(function (p, i) {
      // edge (light) → centre (deep): radial from the petal base
      [['o', p.base, p.mid, p.edge], ['c', p.core, p.base, p.mid]].forEach(function (g) {
        var grad = el('radialGradient', {
          id: 'pg' + g[0] + i, cx: '0.5', cy: '1', fx: '0.5', fy: '1', r: '1.05'
        }, defs);
        el('stop', { offset: '0', 'stop-color': g[1] }, grad);
        el('stop', { offset: '0.5', 'stop-color': g[2] }, grad);
        el('stop', { offset: '1', 'stop-color': g[3] }, grad);
      });
    });
    var leaf = el('linearGradient', { id: 'leafg', x1: '0', y1: '0', x2: '1', y2: '0' }, defs);
    el('stop', { offset: '0', 'stop-color': '#5E8C68' }, leaf);
    el('stop', { offset: '0.5', 'stop-color': '#4F7A5A' }, leaf);
    el('stop', { offset: '1', 'stop-color': '#2F5640' }, leaf);
    var bud = el('radialGradient', { id: 'budg', cx: '0.4', cy: '0.35', r: '0.75' }, defs);
    el('stop', { offset: '0', 'stop-color': '#FFD3DF' }, bud);
    el('stop', { offset: '0.6', 'stop-color': '#EE93AE' }, bud);
    el('stop', { offset: '1', 'stop-color': '#B9567A' }, bud);
    var rib = el('linearGradient', { id: 'ribg', x1: '0', y1: '0', x2: '0', y2: '1' }, defs);
    el('stop', { offset: '0', 'stop-color': '#FFF0D6' }, rib);
    el('stop', { offset: '0.55', 'stop-color': '#FFD9A0' }, rib);
    el('stop', { offset: '1', 'stop-color': '#D9A06A' }, rib);
    var sh = el('radialGradient', { id: 'shadowg' }, defs);
    el('stop', { offset: '0.6', 'stop-color': '#2B1B2F', 'stop-opacity': '0.28' }, sh);
    el('stop', { offset: '1', 'stop-color': '#2B1B2F', 'stop-opacity': '0' }, sh);
  }

  /* ── Builders ─────────────────────────────────────── */
  // ring spec: [count, length, half-width, gradient kind, angle offset, mode]
  var RINGS = [
    [7, 1.00, 0.50, 'o', 0, 'out'],
    [7, 0.86, 0.46, 'o', 0.5, 'out'],
    [6, 0.70, 0.40, 'o', 0.2, 'out'],
    [6, 0.56, 0.34, 'c', 0.7, 'out'],
    [7, 0.50, 0.34, 'o', 0.1, 'cup'],
    [8, 0.30, 0.22, 'c', 0, 'core']
  ];

  function buildPeony(layer, f, rnd, palette) {
    var R = f.r;
    var base = 'translate(' + f.x + ' ' + f.y + ') rotate(' + (f.tilt || 0) + ') scale(1 0.9)';
    var g = el('g', {}, layer);
    var head = new Part(g, base);
    var flower = { head: head, rings: [], bud: null, shadow: null, f: f };

    var shadow = new Part(el('ellipse', { cx: 3, cy: R * 0.12, rx: R * 1.05, ry: R * 0.95, fill: 'url(#shadowg)' }, g), '');
    flower.shadow = shadow;

    RINGS.forEach(function (spec) {
      var count = spec[0], parts = [];
      for (var i = 0; i < count; i++) {
        var a = (i + spec[4]) / count * 360 + (rnd() - 0.5) * 18;
        var L = R * spec[1] * (0.9 + rnd() * 0.2);
        var W = R * spec[2] * (0.9 + rnd() * 0.2);
        var bx = 0, by = 0, rot = a;
        if (spec[5] === 'cup') {
          // petals rooted on a circle, folding inward over the centre → bowl look
          var rad = a * Math.PI / 180, d = R * 0.44;
          bx = Math.sin(rad) * d; by = -Math.cos(rad) * d; rot = a + 180;
        } else if (spec[5] === 'core') {
          bx = (rnd() - 0.5) * R * 0.18; by = (rnd() - 0.5) * R * 0.18;
          rot = rnd() * 360;
        }
        var p = el('path', {
          d: petalPath(L, W, rnd),
          fill: 'url(#pg' + spec[3] + palette + ')',
          stroke: 'rgba(170, 60, 100, 0.22)',
          'stroke-width': '0.5'
        }, g);
        parts.push(new Part(p, 'translate(' + n(bx) + ' ' + n(by) + ') rotate(' + n(rot) + ')'));
      }
      flower.rings.push(parts);
    });

    // closed bud shown at the stem tip before the bloom
    var bg = el('g', {}, g);
    el('path', { d: leafletPath(R * 0.42, R * 0.3), fill: 'url(#leafg)', transform: 'rotate(-140)' }, bg);
    el('path', { d: leafletPath(R * 0.42, R * 0.3), fill: 'url(#leafg)', transform: 'rotate(140)' }, bg);
    el('circle', { r: R * 0.3, fill: 'url(#budg)' }, bg);
    flower.bud = new Part(bg, '');
    return flower;
  }

  function buildBud(layer, b) {
    var g = el('g', {}, layer);
    el('path', { d: leafletPath(b.r * 1.5, b.r * 1.1), fill: 'url(#leafg)', transform: 'rotate(-150)' }, g);
    el('path', { d: leafletPath(b.r * 1.5, b.r * 1.1), fill: 'url(#leafg)', transform: 'rotate(150)' }, g);
    el('ellipse', { rx: b.r, ry: b.r * 1.1, fill: 'url(#budg)' }, g);
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

  function stemPath(i, f, spread) {
    var bx = TIE.x + spread * 2.2, tx = TIE.x + spread;
    var tipY = f.y + f.r * 0.15;
    return 'M' + n(bx) + ' 556 L' + n(tx) + ' ' + TIE.y +
      ' C' + n(tx + (f.x - tx) * 0.15) + ' ' + n(TIE.y - 70) + ' ' + n(f.x) + ' ' + n(tipY + (TIE.y - tipY) * 0.45) +
      ' ' + n(f.x) + ' ' + n(tipY);
  }

  function buildRibbon(layer) {
    var g = el('g', {}, layer);
    var y = TIE.y;
    // tails
    el('path', { d: 'M196 ' + (y + 6) + ' C186 ' + (y + 40) + ' 172 ' + (y + 70) + ' 160 ' + (y + 96) + ' L176 ' + (y + 92) + ' L182 ' + (y + 104) + ' C190 ' + (y + 74) + ' 198 ' + (y + 42) + ' 202 ' + (y + 8) + 'Z', fill: 'url(#ribg)' }, g);
    el('path', { d: 'M204 ' + (y + 6) + ' C214 ' + (y + 40) + ' 228 ' + (y + 70) + ' 242 ' + (y + 94) + ' L226 ' + (y + 92) + ' L220 ' + (y + 104) + ' C210 ' + (y + 74) + ' 202 ' + (y + 42) + ' 198 ' + (y + 8) + 'Z', fill: 'url(#ribg)' }, g);
    // loops
    el('path', { d: 'M200 ' + y + ' C178 ' + (y - 34) + ' 146 ' + (y - 26) + ' 150 ' + (y - 4) + ' C154 ' + (y + 16) + ' 182 ' + (y + 12) + ' 200 ' + y + 'Z', fill: 'url(#ribg)', stroke: 'rgba(160,100,60,0.35)', 'stroke-width': 0.8 }, g);
    el('path', { d: 'M200 ' + y + ' C222 ' + (y - 34) + ' 254 ' + (y - 26) + ' 250 ' + (y - 4) + ' C246 ' + (y + 16) + ' 218 ' + (y + 12) + ' 200 ' + y + 'Z', fill: 'url(#ribg)', stroke: 'rgba(160,100,60,0.35)', 'stroke-width': 0.8 }, g);
    el('ellipse', { cx: 200, cy: y, rx: 9, ry: 10, fill: '#F2C48A', stroke: 'rgba(160,100,60,0.4)', 'stroke-width': 0.8 }, g);
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
    var stemLayer = el('g', { fill: 'none', 'stroke-linecap': 'round' }, svg);
    var leafLayer = el('g', {}, svg);
    var flowerLayer = el('g', {}, svg);
    var ribbonLayer = el('g', {}, svg);
    container.appendChild(svg);

    var flowers = cfg.flowers.slice(0, cfg.flowerCount || cfg.flowers.length);
    var parts = [];
    var stems = [];

    function addStem(target, i, width, spread) {
      var p = el('path', {
        d: stemPath(i, target, spread),
        stroke: i % 2 ? '#4F7A5A' : '#45704F',
        'stroke-width': width
      }, stemLayer);
      var part = new Part(p, '');
      part.len = p.getTotalLength();
      part.dash = 1;
      p.setAttribute('stroke-dasharray', n(part.len) + ' ' + n(part.len + 2));
      stems.push(part);
      parts.push(part);
      return part;
    }

    // stems (flowers then buds)
    flowers.forEach(function (f, i) { f._stem = addStem(f, i, 4.4, (f.x - 200) * 0.06); });
    cfg.buds.forEach(function (b, i) { b._stem = addStem(b, i + 1, 2.8, (b.x - 200) * 0.05); });

    // leaves: a collar of compound leaves at the tie + leaves along the stems
    var leaves = [];
    (cfg.backLeaves || []).forEach(function (b) {
      leaves.push({ part: buildLeaf(leafLayer, b[0], b[1], b[2], b[3], true), at: 0.8 });
    });
    cfg.collar.forEach(function (c) {
      leaves.push({ part: buildLeaf(leafLayer, TIE.x + c[0], TIE.y - 18, c[1], c[2], true), at: 0.45 });
    });
    flowers.forEach(function (f, i) {
      if (i % 2) return;
      var stemNode = f._stem.node, len = f._stem.len;
      var t = 0.62, pt = stemNode.getPointAtLength(len * t), pt2 = stemNode.getPointAtLength(len * t + 2);
      var tangent = Math.atan2(pt2.y - pt.y, pt2.x - pt.x) * 180 / Math.PI + 90;
      var side = f.x < 200 ? -1 : 1;
      leaves.push({ part: buildLeaf(leafLayer, pt.x, pt.y, tangent + side * 58, 34 + rnd() * 10, false), at: t });
    });
    leaves.forEach(function (l) { parts.push(l.part); });

    // flowers: draw back (higher up) first
    var drawOrder = flowers.slice().sort(function (a, b) { return a.y - b.y; });
    var built = {};
    drawOrder.forEach(function (f) {
      built[flowers.indexOf(f)] = buildPeony(flowerLayer, f, rnd, f.palette || 0);
    });
    var peonies = flowers.map(function (_, i) { return built[i]; });
    peonies.forEach(function (p) {
      parts.push(p.head, p.bud, p.shadow);
      p.rings.forEach(function (r) { parts.push.apply(parts, r); });
    });

    var buds = cfg.buds.map(function (b) { var bp = buildBud(flowerLayer, b); parts.push(bp); return bp; });
    var ribbon = buildRibbon(ribbonLayer);
    parts.push(ribbon);

    function renderAll() { for (var i = 0; i < parts.length; i++) parts[i].render(); }

    /* Timeline: stems grow (scene 4) → peonies open one by one (scene 5) */
    function timeline(reduced) {
      var tl = gsap.timeline({ paused: true });
      tl.set(svg, { visibility: 'visible' }, 0);

      if (reduced) {
        // prefers-reduced-motion: no growth, everything just fades in
        tl.set(stems, { dash: 0 }, 0)
          .set(leaves.map(function (l) { return l.part; }), { s: 1, o: 1 }, 0)
          .set(ribbon, { s: 1, o: 1 }, 0)
          .set(buds, { s: 1, o: 1 }, 0);
        peonies.forEach(function (p) {
          tl.set(p.head, { s: 1, r: 0, o: 1 }, 0).set(p.bud, { o: 0 }, 0).set(p.shadow, { o: 1 }, 0);
          p.rings.forEach(function (r) { tl.set(r, { s: 1, r: 0, o: 1 }, 0); });
        });
        tl.fromTo(svg, { opacity: 0 }, { opacity: 1, duration: 1.6, ease: 'power1.inOut' }, 0);
        return tl;
      }

      tl.set(svg, { opacity: 1 }, 0);
      var STEM = 1.9;
      tl.fromTo(stems, { dash: 1 }, { dash: 0, duration: STEM, ease: 'power2.inOut', stagger: 0.04 }, 0);
      leaves.forEach(function (l, i) {
        tl.fromTo(l.part, { s: 0, o: 0 }, { s: 1, o: 1, duration: 0.9, ease: 'back.out(1.6)' }, STEM * l.at * 0.75 + i * 0.03);
      });
      tl.fromTo(ribbon, { s: 0.6, o: 0, y: 10 }, { s: 1, o: 1, y: 0, duration: 0.8, ease: 'back.out(1.8)' }, 1.0);
      tl.fromTo(buds, { s: 0, o: 0 }, { s: 1, o: 1, duration: 0.7, ease: 'back.out(2)', stagger: 0.2 }, STEM - 0.3);

      var BLOOM = STEM - 0.25;
      var order = cfg.bloomOrder || peonies.map(function (_, i) { return i; });
      order.forEach(function (idx, k) {
        var p = peonies[idx];
        if (!p) return;
        var t0 = BLOOM + k * (cfg.bloomGap || 0.32);
        // bud appears at the stem tip…
        tl.fromTo(p.head, { s: 0.42, r: -22, o: 1 }, { s: 1, r: 0, duration: 2.4, ease: 'power2.out' }, t0 - 0.35);
        tl.fromTo(p.bud, { s: 0, o: 1 }, { s: 1, duration: 0.45, ease: 'back.out(2)' }, t0 - 0.45);
        tl.to(p.bud, { s: 1.35, o: 0, duration: 0.6, ease: 'power1.in' }, t0 + 0.25);
        tl.fromTo(p.shadow, { o: 0 }, { o: 1, duration: 1.2, ease: 'power1.inOut' }, t0 + 0.3);
        // …then petal layers open from the centre outwards
        var ringsInward = p.rings.slice().reverse();
        ringsInward.forEach(function (ring, ri) {
          var at = t0 + ri * 0.16;
          tl.fromTo(ring, { s: 0.12, o: 0, r: function () { return (rnd() - 0.5) * 70; } },
            { s: 1, r: 0, o: 1, duration: 1.25, ease: 'power3.out', stagger: { each: 0.05, from: 'random' } }, at);
        });
      });
      return tl;
    }

    // initial hidden state (also what poster/static export overrides)
    stems.forEach(function (s) { s.dash = 1; });
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
