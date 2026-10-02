/* The journey: Mount Fuji at sunset, a hiker climbing a switchback trail,
 * a flag at the summit. Drawn procedurally in SVG; a virtual camera
 * (cx, cy, S = size of the square that must fit on screen) frames the shots.
 *
 * GSAP tweens plain state objects (camera, hiker, pose); one ticker callback
 * turns that state into SVG transforms each frame. */
(function (NS) {
  'use strict';

  var SVGNS = 'http://www.w3.org/2000/svg';
  var SUMMIT_Y = 228;

  function n(v) { return Math.round(v * 100) / 100; }
  function el(tag, attrs, parent) {
    var node = document.createElementNS(SVGNS, tag);
    for (var k in attrs) node.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(node);
    return node;
  }
  function makeRng(seed) {
    return function () { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function stops(grad, list) {
    list.forEach(function (s) {
      var a = { offset: s[0], 'stop-color': s[1] };
      if (s[2] !== undefined) a['stop-opacity'] = s[2];
      el('stop', a, grad);
    });
    return grad;
  }

  /* ── Mount Fuji geometry: concave slopes, flat crater top ─────────── */
  var LEFT = [[-420, 780], [330, 700], [446, SUMMIT_Y]];
  var RIGHT = [[554, SUMMIT_Y], [670, 700], [1420, 780]];
  function quad(c, t) {
    var u = 1 - t;
    return [u * u * c[0][0] + 2 * u * t * c[1][0] + t * t * c[2][0],
            u * u * c[0][1] + 2 * u * t * c[1][1] + t * t * c[2][1]];
  }
  // x of a slope at height y (sampled)
  function slopeX(curve, y) {
    var best = null, bd = 1e9;
    for (var t = 0; t <= 1.0001; t += 0.004) {
      var p = quad(curve, t), d = Math.abs(p[1] - y);
      if (d < bd) { bd = d; best = p; }
    }
    return best[0];
  }
  var CRATER = 'L462 222 L476 230 L492 223 L508 229 L522 221 L538 228';
  var MOUNTAIN_D = 'M-420 780 Q330 700 446 ' + SUMMIT_Y + ' ' + CRATER + ' L554 ' + SUMMIT_Y + ' Q670 700 1420 780 Z';

  // smooth path through points (Catmull-Rom → cubic Bézier)
  function smoothPath(pts) {
    var d = 'M' + pts[0][0] + ' ' + pts[0][1];
    for (var i = 0; i < pts.length - 1; i++) {
      var p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
      d += ' C' + n(p1[0] + (p2[0] - p0[0]) / 6) + ' ' + n(p1[1] + (p2[1] - p0[1]) / 6) +
        ' ' + n(p2[0] - (p3[0] - p1[0]) / 6) + ' ' + n(p2[1] - (p3[1] - p1[1]) / 6) +
        ' ' + p2[0] + ' ' + p2[1];
    }
    return d;
  }

  function cloud(parent, cx, cy, w, h, rnd, grad) {
    var g = el('g', {}, parent);
    var count = Math.max(5, Math.round(w / (h * 0.7)));
    for (var i = 0; i < count; i++) {
      var u = i / (count - 1);
      var r = h * (0.45 + Math.sin(u * Math.PI) * 0.55) * (0.8 + rnd() * 0.4);
      el('circle', { cx: n(cx - w / 2 + u * w), cy: n(cy - r * 0.35), r: n(r), fill: 'url(#' + grad + ')' }, g);
    }
    el('ellipse', { cx: cx, cy: n(cy + h * 0.12), rx: n(w * 0.56), ry: n(h * 0.4), fill: 'url(#' + grad + ')' }, g);
    return g;
  }

  /* ── Sakura ─────────────────────────────────────────────────────────
   * A recursive, tapering branch skeleton; blossom clusters sit at the branch
   * tips as many small blooms in four tones (shadow → body → light →
   * highlight), lit from the upper side, plus tiny five-petal flowers on the
   * edges. Everything is merged into a few path elements per tree. */
  function circ(cx, cy, r) {
    return 'M' + n(cx - r) + ' ' + n(cy) + 'a' + n(r) + ' ' + n(r) + ' 0 1 0 ' + n(2 * r) + ' 0a' + n(r) + ' ' + n(r) + ' 0 1 0 ' + n(-2 * r) + ' 0';
  }

  function cherryTree(parent, x, y, scale, flip, rnd) {
    var g = el('g', { transform: 'translate(' + x + ' ' + y + ') scale(' + (flip ? -scale : scale) + ' ' + scale + ')' }, parent);
    var wood = ['', '', '', '', ''];     // branch paths by thickness level
    var tips = [];

    // tapered, slightly curved limb drawn as a filled quad strip
    function limb(x0, y0, x1, y1, w0, w1, bend) {
      var dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy) || 1;
      var nx = -dy / L, ny = dx / L;
      var mx = (x0 + x1) / 2 + nx * bend, my = (y0 + y1) / 2 + ny * bend;
      return 'M' + n(x0 + nx * w0 / 2) + ' ' + n(y0 + ny * w0 / 2) +
        ' Q' + n(mx + nx * (w0 + w1) / 4) + ' ' + n(my + ny * (w0 + w1) / 4) + ' ' + n(x1 + nx * w1 / 2) + ' ' + n(y1 + ny * w1 / 2) +
        ' L' + n(x1 - nx * w1 / 2) + ' ' + n(y1 - ny * w1 / 2) +
        ' Q' + n(mx - nx * (w0 + w1) / 4) + ' ' + n(my - ny * (w0 + w1) / 4) + ' ' + n(x0 - nx * w0 / 2) + ' ' + n(y0 - ny * w0 / 2) + 'Z';
    }
    function grow(x0, y0, ang, len, w, depth) {
      var a = ang * Math.PI / 180;
      var x1 = x0 + Math.cos(a) * len, y1 = y0 + Math.sin(a) * len;
      var w1 = w * 0.66;
      wood[Math.min(depth, 4)] += limb(x0, y0, x1, y1, w, w1, (rnd() - 0.5) * len * 0.25);
      if (depth >= 2) tips.push({ x: x1, y: y1, s: depth >= 3 ? 1 : 1.25 });
      if (depth >= 4) return;
      var kids = depth === 0 ? 3 : 2 + (rnd() < 0.45 ? 1 : 0);
      for (var k = 0; k < kids; k++) {
        // umbrella habit: limbs spread sideways, then arch up and out
        var spread = depth === 0 ? (k - 1) * 42 : (k / Math.max(1, kids - 1) - 0.5) * 80;
        var na = ang + spread + (rnd() - 0.5) * 22;
        na = Math.max(-170, Math.min(-10, na));
        grow(x1, y1, na, len * (0.68 + rnd() * 0.14), w1, depth + 1);
      }
    }
    grow(0, 0, -90 + (rnd() - 0.5) * 8, 120, 30, 0);

    // blossom clusters
    var shade = '', body = '', lite = '', glow = '', flowers = '', eyes = '';
    tips.forEach(function (t) {
      var cr = (34 + rnd() * 22) * t.s;
      var count = Math.round(16 + cr * 0.32);
      for (var i = 0; i < count; i++) {
        var a = rnd() * Math.PI * 2, d = Math.sqrt(rnd());
        var px = t.x + Math.cos(a) * d * cr * 1.25;
        var py = t.y + Math.sin(a) * d * cr * 0.8 + d * cr * 0.18; // droop
        var r = 5 + rnd() * 9 * (1 - d * 0.4);
        // light from the upper side: tone by position inside the cluster
        var lit = -Math.sin(a) * d * 0.8 - Math.cos(a) * d * 0.3 + (rnd() - 0.5) * 0.6;
        shade += circ(px + 2, py + 3, r);
        if (lit > -0.35) body += circ(px, py, r * 0.92);
        if (lit > 0.15) lite += circ(px - r * 0.2, py - r * 0.25, r * 0.6);
        if (lit > 0.55) glow += circ(px - r * 0.3, py - r * 0.35, r * 0.3);
      }
      // individual five-petal flowers on the rim of the cluster
      for (i = 0; i < 4; i++) {
        var fa = rnd() * Math.PI * 2, fd = 0.75 + rnd() * 0.35;
        var fx = t.x + Math.cos(fa) * fd * cr * 1.2, fy = t.y + Math.sin(fa) * fd * cr * 0.8 + cr * 0.12;
        var fs = 3.2 + rnd() * 2.6, rot = rnd() * 72;
        for (var p = 0; p < 5; p++) {
          var pa = (rot + p * 72) * Math.PI / 180;
          flowers += circ(fx + Math.cos(pa) * fs * 0.62, fy + Math.sin(pa) * fs * 0.62, fs * 0.5);
        }
        eyes += circ(fx, fy, fs * 0.22);
      }
    });

    var woodCol = ['#2E1B27', '#33202C', '#3A2532', '#432B39', '#4C3140'];
    var layers = [[shade, '#B9578C', 1]];
    for (var lv = 0; lv < wood.length; lv++) if (wood[lv]) layers.push([wood[lv], woodCol[lv], 1]);
    layers.push([body, '#EC93BE', 1], [lite, '#F8BFD8', 1], [glow, '#FFE3EF', 1], [flowers, '#FFE4F0', 0.92], [eyes, '#E27AA6', 1]);
    layers.forEach(function (L) { el('path', { d: L[0], fill: L[1], opacity: L[2] }, g); });
    bakeTree(g, layers, tips, scale);
    return g;
  }

  /* The trees never change, but the camera moves every frame: re-painting
   * thousands of tiny blossom shapes is expensive, so each tree is drawn once
   * into a bitmap (sharp enough for the widest shot on this screen) and the
   * vector version is swapped for an <image>. If anything fails, the vector
   * version simply stays. */
  // bake one tree at a time, shortly after start-up
  var bakeQueue = [];
  function runBakeQueue() {
    var job = bakeQueue.shift();
    if (job) { job(); setTimeout(runBakeQueue, 60); }
  }

  function bakeTree(g, layers, tips, scale) {
    var minX = -40, maxX = 40, minY = -40, maxY = 10;
    tips.forEach(function (t) {
      minX = Math.min(minX, t.x - 110); maxX = Math.max(maxX, t.x + 110);
      minY = Math.min(minY, t.y - 90); maxY = Math.max(maxY, t.y + 110);
    });
    var w = maxX - minX, h = maxY - minY;
    var dpr = Math.min(window.devicePixelRatio || 1, 3);
    var ppu = Math.min(2.5, Math.min(window.innerWidth, window.innerHeight) / 880 * dpr * scale * 1.2);
    ppu = Math.max(0.8, ppu);
    var markup = '<svg xmlns="' + SVGNS + '" viewBox="' + n(minX) + ' ' + n(minY) + ' ' + n(w) + ' ' + n(h) + '" width="' + Math.round(w * ppu) + '" height="' + Math.round(h * ppu) + '">' +
      layers.map(function (L) { return '<path d="' + L[0] + '" fill="' + L[1] + '" opacity="' + L[2] + '"/>'; }).join('') + '</svg>';
    bakeQueue.push(function () {
      try {
        var url = URL.createObjectURL(new Blob([markup], { type: 'image/svg+xml' }));
        var img = new Image();
        img.onload = function () {
          try {
            var c = document.createElement('canvas');
            c.width = Math.round(w * ppu); c.height = Math.round(h * ppu);
            c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
            URL.revokeObjectURL(url);
            c.toBlob(function (blob) {
              if (!blob) return;
              var bmp = URL.createObjectURL(blob);
              var im = el('image', { x: n(minX), y: n(minY), width: n(w), height: n(h), preserveAspectRatio: 'none' });
              im.setAttribute('href', bmp);
              im.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', bmp);
              var probe = new Image();
              probe.onload = function () {
                while (g.firstChild) g.removeChild(g.firstChild);
                g.appendChild(im);
              };
              probe.src = bmp;
            }, 'image/png');
          } catch (e) { /* keep vectors */ }
        };
        img.src = url;
      } catch (e) { /* keep vectors */ }
    });
  }

  /* ── The hiker (side view, facing +x) ─────────────────────────────── */
  function buildHiker(parent) {
    var root = el('g', {}, parent);
    var flip = el('g', {}, root);
    function limb(p, x, y, len, w, color) {
      var g = el('g', {}, p);
      el('line', { x1: 0, y1: 0, x2: 0, y2: len, stroke: color, 'stroke-width': w, 'stroke-linecap': 'round' }, g);
      var j = el('g', { transform: 'translate(0 ' + len + ')' }, g);
      return { g: g, j: j, x: x, y: y };
    }
    function leg(color) {
      var thigh = limb(flip, 0, -40, 20, 7.5, color);
      var shin = limb(thigh.j, 0, 0, 19, 6.5, color);
      var boot = el('g', {}, shin.j);
      el('path', { d: 'M-4 -2 L5 -2 Q10 -1 10 2.5 L-4 2.5 Z', fill: '#3B2A22' }, boot);
      return { thigh: thigh, shin: shin, boot: boot };
    }
    function arm(p, color, pole) {
      var upper = limb(p, 1, -61, 13, 5.5, color);
      var fore = limb(upper.j, 0, 0, 12, 5, color);
      el('circle', { cx: 0, cy: 0, r: 2.6, fill: '#F2C7A5' }, fore.j);
      var poleG = null;
      if (pole) {
        poleG = el('g', {}, fore.j);
        el('line', { x1: 0, y1: -4, x2: 0, y2: 36, stroke: '#D7D3DE', 'stroke-width': 1.5, 'stroke-linecap': 'round' }, poleG);
      }
      return { upper: upper, fore: fore, pole: poleG };
    }

    var backLeg = leg('#4E4838');
    var upperBody = el('g', {}, flip);
    var backArm = arm(upperBody, '#3E5A42', false);
    // backpack + bedroll
    el('rect', { x: -17, y: -68, width: 13, height: 30, rx: 4, fill: '#7A5A3C' }, upperBody);
    el('rect', { x: -15, y: -60, width: 9, height: 3, rx: 1.5, fill: '#5E432C' }, upperBody);
    el('ellipse', { cx: -10.5, cy: -70, rx: 8, ry: 4, fill: '#C4664A' }, upperBody);
    // torso: shirt + open green jacket
    el('path', { d: 'M-6 -64 Q2 -67 8 -63 L7 -39 L-6 -39 Z', fill: '#E3D3AE' }, upperBody);
    el('path', { d: 'M-6 -64 Q-1 -66 2 -65 L1 -39 L-6 -39 Z', fill: '#4F6F52' }, upperBody);
    el('path', { d: 'M-7 -41 L8 -41 L8 -37 L-7 -37 Z', fill: '#5A4630' }, upperBody);
    // head
    var head = el('g', {}, upperBody);
    var pony = el('g', { transform: 'translate(-4 -75)' }, head);
    el('path', { d: 'M0 0 C-6 4 -9 12 -7 22 C-4 16 -2 8 2 2 Z', fill: '#3B2620' }, pony);
    el('rect', { x: -1, y: -68, width: 5, height: 5, fill: '#E8B998' }, head);
    el('path', { d: 'M-5 -78 Q-6 -66 -1 -64 L4 -70 Z', fill: '#3B2620' }, head);
    el('circle', { cx: 2.5, cy: -73, r: 7.6, fill: '#F2C7A5' }, head);
    el('path', { d: 'M-5 -76 Q-3 -82 3 -81 Q-1 -76 -3 -69 Z', fill: '#3B2620' }, head);
    el('circle', { cx: 6.6, cy: -73.5, r: 1.05, fill: '#2B1B22' }, head);
    el('circle', { cx: 6, cy: -70, r: 1.7, fill: '#F08DA6', opacity: 0.55 }, head);
    el('path', { d: 'M6.5 -67.8 Q8 -67 9 -68.2', fill: 'none', stroke: '#9A4A4A', 'stroke-width': 0.8, 'stroke-linecap': 'round' }, head);
    // cap with brim
    el('path', { d: 'M-5.5 -76 Q-4 -84.5 3.5 -84 Q10 -83 10 -76.5 Z', fill: '#E07B3F' }, head);
    el('path', { d: 'M8 -77.2 L16 -76 Q15 -74.6 8 -75.4 Z', fill: '#B95A2A' }, head);
    var frontLeg = leg('#6A5E48');
    var frontArm = arm(upperBody, '#4F6F52', true);
    // front arm must be drawn after the front leg
    flip.appendChild(frontLeg.thigh.g);
    upperBody.appendChild(frontArm.upper.g);
    flip.appendChild(upperBody);

    function setLimb(l, a) { l.g.setAttribute('transform', 'translate(' + l.x + ' ' + l.y + ') rotate(' + n(a) + ')'); }

    return {
      root: root,
      pose: function (st) {
        var ph = st.phase, w = st.walk, up = st.armsUp;
        var s = Math.sin(ph), c = Math.cos(ph);
        // legs: forward swing = negative angle; knee bends while the leg swings
        var fT = -24 * s * w, bT = 24 * s * w;
        var fK = (6 + 34 * Math.max(0, c)) * w, bK = (6 + 34 * Math.max(0, -c)) * w;
        setLimb(frontLeg.thigh, fT); setLimb(frontLeg.shin, fK);
        setLimb(backLeg.thigh, bT); setLimb(backLeg.shin, bK);
        frontLeg.boot.setAttribute('transform', 'rotate(' + n(-(fT + fK)) + ')');
        backLeg.boot.setAttribute('transform', 'rotate(' + n(-(bT + bK)) + ')');
        // arms swing against the legs, or go up in celebration
        var fA = lerp(22 * s * w, -158, up), bA = lerp(-22 * s * w, -172, up);
        var fF = lerp(-18 - 10 * w, -8, up), bF = lerp(-18, -6, up);
        setLimb(frontArm.upper, fA); setLimb(frontArm.fore, fF);
        setLimb(backArm.upper, bA); setLimb(backArm.fore, bF);
        // the pole stays roughly vertical while walking
        frontArm.pole.setAttribute('transform', 'rotate(' + n(-(fA + fF) + 12 * (1 - up)) + ')');
        frontArm.pole.setAttribute('opacity', n(1 - up));
        var bob = -Math.abs(Math.cos(ph)) * 1.6 * w;
        var lean = 9 * w * (1 - up);
        upperBody.setAttribute('transform', 'translate(0 ' + n(bob) + ') rotate(' + n(lean) + ' 0 -40)');
        pony.setAttribute('transform', 'translate(-4 -75) rotate(' + n(Math.sin(ph * 2) * 8 * w + up * 14 * Math.sin(st.t * 9)) + ')');
        flip.setAttribute('transform', 'translate(0 ' + n(bob * 0.5) + ') scale(' + n(st.dir) + ' 1)');
        root.setAttribute('transform', 'translate(' + n(st.x) + ' ' + n(st.y - st.jump) + ') scale(' + n(st.scale) + ')');
        root.setAttribute('opacity', n(st.o));
      }
    };
  }

  /* ── Public ───────────────────────────────────────────────────────── */
  NS.buildWorld = function (container, cfg) {
    cfg = cfg || {};
    var rnd = makeRng(cfg.seed || 5);
    var svg = el('svg', { xmlns: SVGNS, focusable: 'false', preserveAspectRatio: 'none' });
    var defs = el('defs', {}, svg);
    stops(el('linearGradient', { id: 'sky', x1: 0, y1: -700, x2: 0, y2: 790, gradientUnits: 'userSpaceOnUse' }, defs),
      [['0', '#141640'], ['0.3', '#33306A'], ['0.55', '#7C4C86'], ['0.75', '#D7798F'], ['0.9', '#F7A486'], ['1', '#FFCB8C']]);
    stops(el('radialGradient', { id: 'sunglow' }, defs),
      [['0', '#FFF1C9', 0.95], ['0.18', '#FFC98A', 0.7], ['0.5', '#FF9A84', 0.22], ['1', '#FF9A84', 0]]);
    stops(el('linearGradient', { id: 'ray', x1: 0, y1: 0, x2: 1, y2: 0 }, defs),
      [['0', '#FFE7B0', 0.55], ['1', '#FFE7B0', 0]]);
    stops(el('linearGradient', { id: 'fuji', x1: 160, y1: 0, x2: 960, y2: 0, gradientUnits: 'userSpaceOnUse' }, defs),
      [['0', '#22265A'], ['0.45', '#353370'], ['0.7', '#6E4B7E'], ['0.88', '#AE6574'], ['1', '#D9826E']]);
    stops(el('linearGradient', { id: 'haze', x1: 0, y1: 470, x2: 0, y2: 790, gradientUnits: 'userSpaceOnUse' }, defs),
      [['0', '#C98DA6', 0], ['1', '#E9A3A8', 0.75]]);
    stops(el('linearGradient', { id: 'snow', x1: 400, y1: 0, x2: 640, y2: 0, gradientUnits: 'userSpaceOnUse' }, defs),
      [['0', '#B9BDE6'], ['0.45', '#F4F2FF'], ['0.7', '#FFFFFF'], ['1', '#FFD2BC']]);
    stops(el('linearGradient', { id: 'cloudg', x1: 0, y1: 0, x2: 0, y2: 1 }, defs),
      [['0', '#FFF6EE'], ['0.55', '#F9D3CF'], ['1', '#D99AB1']]);
    stops(el('linearGradient', { id: 'cloudfar', x1: 0, y1: 0, x2: 0, y2: 1 }, defs),
      [['0', '#FFC7A8', 0.9], ['1', '#C87AA0', 0.5]]);
    stops(el('linearGradient', { id: 'lake', x1: 0, y1: 780, x2: 0, y2: 1500, gradientUnits: 'userSpaceOnUse' }, defs),
      [['0', '#F2A68E'], ['0.25', '#B06A8E'], ['0.6', '#4A3468'], ['1', '#1E1838']]);
    stops(el('linearGradient', { id: 'sunpath', x1: 0, y1: 0, x2: 0, y2: 1 }, defs),
      [['0', '#FFE2B0', 0.8], ['1', '#FFE2B0', 0]]);
    stops(el('linearGradient', { id: 'ground', x1: 0, y1: 0, x2: 0, y2: 1 }, defs),
      [['0', '#3A2840'], ['1', '#150F22']]);
    var snowClip = el('clipPath', { id: 'snowclip' }, defs);

    var cam = el('g', {}, svg);
    el('rect', { x: -4000, y: -4000, width: 9000, height: 4790, fill: 'url(#sky)' }, cam);
    // stars
    var stars = el('g', { fill: '#FFFFFF' }, cam);
    for (var i = 0; i < 70; i++) {
      el('circle', { cx: n(-900 + rnd() * 2800), cy: n(-1400 + rnd() * 1450), r: n(0.8 + rnd() * 1.8), opacity: n(0.25 + rnd() * 0.6) }, stars);
    }
    // sun with slowly turning rays
    var SUN = { x: 860, y: 610 };
    el('circle', { cx: SUN.x, cy: SUN.y, r: 560, fill: 'url(#sunglow)' }, cam);
    var rays = el('g', {}, cam);
    for (i = 0; i < 14; i++) {
      el('path', { d: 'M0 -6 L900 -30 L900 30 L0 6 Z', fill: 'url(#ray)', transform: 'rotate(' + n(i * 360 / 14 + rnd() * 8) + ')', opacity: n(0.25 + rnd() * 0.3) }, rays);
    }
    el('circle', { cx: SUN.x, cy: SUN.y, r: 44, fill: '#FFF5DC' }, cam);
    // high clouds
    var farClouds = el('g', {}, cam);
    [[-120, 120, 360, 40], [380, 40, 300, 30], [820, 160, 420, 46], [180, 330, 260, 26], [1180, 330, 300, 30]].forEach(function (c) {
      cloud(farClouds, c[0], c[1], c[2], c[3], rnd, 'cloudfar');
    });
    // distant ridges
    el('path', { d: 'M-1600 790 L-900 735 L-600 760 L-300 730 L-80 770 L1080 772 L1300 728 L1600 752 L2000 720 L2600 790 Z', fill: '#4E3B6E', opacity: 0.85 }, cam);

    // Fuji
    var fuji = el('g', {}, cam);
    el('path', { d: MOUNTAIN_D, fill: 'url(#fuji)' }, fuji);
    var ridges = el('g', { fill: 'none', stroke: 'rgba(255,220,230,0.07)', 'stroke-width': 3 }, fuji);
    for (i = -6; i <= 6; i++) {
      if (!i) continue;
      el('path', { d: 'M' + (500 + i * 7) + ' 240 Q' + n(500 + i * 40) + ' 480 ' + n(500 + i * 95 + (rnd() - 0.5) * 40) + ' 780' }, ridges);
    }
    // snow cap with streaks running down the ridges
    var snowPts = [];
    var SL = 392, SR = 378, xL = slopeX(LEFT, SL), xR = slopeX(RIGHT, SR), N = 22;
    for (i = 0; i <= N; i++) {
      var u = i / N, sx = lerp(xL, xR, u), base = lerp(SL, SR, u) - Math.sin(u * Math.PI) * 26;
      var sy = i === 0 || i === N ? base : base + (i % 2 ? 18 + rnd() * 58 : -8 + rnd() * 14);
      snowPts.push(n(sx) + ' ' + n(sy));
    }
    var snowD = 'M' + n(xL) + ' ' + SL;
    for (var y = SL; y >= SUMMIT_Y; y -= 12) snowD += ' L' + n(slopeX(LEFT, y)) + ' ' + y;
    snowD += ' L446 ' + SUMMIT_Y + ' ' + CRATER + ' L554 ' + SUMMIT_Y;
    for (y = SUMMIT_Y + 12; y <= SR; y += 12) snowD += ' L' + n(slopeX(RIGHT, y)) + ' ' + y;
    snowD += ' L' + snowPts.slice().reverse().join(' L') + ' Z';
    el('path', { d: snowD }, snowClip);
    el('path', { d: snowD, fill: 'url(#snow)' }, fuji);
    var snowRidges = el('g', { 'clip-path': 'url(#snowclip)', fill: 'none', stroke: 'rgba(120,110,180,0.2)', 'stroke-width': 1.8 }, fuji);
    for (i = -4; i <= 4; i++) {
      el('path', { d: 'M' + (500 + i * 9) + ' 234 Q' + n(500 + i * 30) + ' 330 ' + n(500 + i * 58 + (rnd() - 0.5) * 24) + ' 450' }, snowRidges);
    }
    el('path', { d: MOUNTAIN_D, fill: 'url(#haze)' }, fuji);

    // clouds hugging the mountain (drift)
    var midClouds = [];
    [[120, 742, 340, 46], [900, 560, 260, 40], [560, 752, 440, 50], [-200, 735, 380, 48], [1200, 745, 380, 48]].forEach(function (c, k) {
      var g = cloud(cam, c[0], c[1], c[2], c[3], rnd, 'cloudg');
      midClouds.push({ g: g });
    });

    // tree line and lake with the mountain's reflection
    var treeD = 'M-1600 800 L-1600 770';
    for (var tx = -1600; tx <= 2600; tx += 9 + rnd() * 10) treeD += ' L' + n(tx) + ' ' + n(778 - rnd() * 22) + ' L' + n(tx + 5) + ' 780';
    treeD += ' L2600 800 Z';
    el('rect', { x: -4000, y: 790, width: 9000, height: 3000, fill: 'url(#lake)' }, cam);
    var refl = el('g', { transform: 'translate(0 1592) scale(1 -1)', opacity: 0.26 }, cam);
    el('path', { d: MOUNTAIN_D, fill: '#2E2C62' }, refl);
    el('path', { d: snowD, fill: '#F6E9F2' }, refl);
    el('rect', { x: SUN.x - 40, y: 796, width: 80, height: 420, fill: 'url(#sunpath)', opacity: 0.55 }, cam);
    var shimmer = el('g', { stroke: 'rgba(255,230,210,0.35)', 'stroke-width': 2, 'stroke-linecap': 'round' }, cam);
    for (i = 0; i < 40; i++) {
      var ly = 810 + rnd() * 420, lx = -200 + rnd() * 1400, lw = 10 + rnd() * 50;
      el('line', { x1: n(lx), y1: n(ly), x2: n(lx + lw), y2: n(ly) }, shimmer);
    }
    el('path', { d: treeD, fill: '#211A38' }, cam);

    // trail
    var TRAIL = cfg.trail || [[240, 690], [640, 600], [360, 500], [600, 402], [468, 300], [496, 230]];
    var trailD = smoothPath(TRAIL);
    el('path', { d: trailD, fill: 'none', stroke: 'rgba(255,236,220,0.28)', 'stroke-width': 3, 'stroke-dasharray': '2 7', 'stroke-linecap': 'round' }, cam);
    var walked = el('path', { d: trailD, fill: 'none', stroke: 'rgba(255,214,150,0.85)', 'stroke-width': 3, 'stroke-dasharray': '2 7', 'stroke-linecap': 'round' }, cam);
    svg.style.visibility = 'hidden';
    container.appendChild(svg);
    var trailLen = walked.getTotalLength();
    var mask = el('path', { d: trailD, fill: 'none', stroke: '#fff', 'stroke-width': 10 }, null);
    var trailMaskId = 'walkmask';
    var m = el('mask', { id: trailMaskId, maskUnits: 'userSpaceOnUse' }, defs);
    mask.setAttribute('stroke-dasharray', n(trailLen) + ' ' + n(trailLen + 10));
    m.appendChild(mask);
    walked.setAttribute('mask', 'url(#' + trailMaskId + ')');

    // flag at the summit
    var flag = el('g', {}, cam);
    el('line', { x1: 0, y1: 0, x2: 0, y2: -52, stroke: '#EDE6F2', 'stroke-width': 2.2, 'stroke-linecap': 'round' }, flag);
    var cloth = el('g', {}, flag);
    el('path', { d: 'M1 -51 Q14 -55 26 -49 Q38 -44 44 -47 L44 -27 Q36 -24 26 -29 Q14 -34 1 -31 Z', fill: '#F07AA8' }, cloth);
    el('path', { d: 'M22 -40 C22 -44 17 -45 16 -41 C15 -45 10 -44 10 -40 C10 -36 16 -33 16 -33 C16 -33 22 -36 22 -40 Z', fill: '#FFFFFF' }, cloth);

    // hiker
    var hiker = buildHiker(cam);

    // foreground: ground and cherry trees framing the lake
    el('path', { d: 'M-2000 1290 C-600 1240 -200 1280 300 1305 C700 1325 1100 1270 2800 1290 L2800 3000 L-2000 3000 Z', fill: 'url(#ground)' }, cam);
    // reeds along the shore
    var reedD = '';
    for (var rx = -1400; rx < 2400; rx += 7 + rnd() * 9) {
      var rh = 30 + rnd() * 60, lean = (rnd() - 0.5) * 18;
      reedD += 'M' + n(rx) + ' 1300 Q' + n(rx + lean * 0.4) + ' ' + n(1300 - rh * 0.6) + ' ' + n(rx + lean) + ' ' + n(1300 - rh) + ' ';
    }
    el('path', { d: reedD, fill: 'none', stroke: '#2C1E35', 'stroke-width': 3, 'stroke-linecap': 'round' }, cam);
    cherryTree(cam, -330, 1300, 1.5, false, rnd);
    cherryTree(cam, 1330, 1305, 1.5, true, rnd);
    cherryTree(cam, 40, 1310, 1.35, false, rnd);
    cherryTree(cam, 960, 1320, 1.3, true, rnd);

    /* ── state ─────────────────────────────────────── */
    var W = 1, H = 1;
    var state = {
      cam: { cx: 500, cy: 470, S: 1250, follow: 0 },
      hiker: { dist: 0, o: 0, scale: 1, walk: 0, armsUp: 0, jump: 0 },
      flag: { s: 0, wave: 0 },
      t: 0
    };
    var smooth = { x: TRAIL[0][0], y: TRAIL[0][1], dir: 1 };
    var pose = { phase: 0, walk: 0, armsUp: 0, dir: 1, x: 0, y: 0, jump: 0, scale: 1, o: 0, t: 0 };
    var k = 1, ox = 0, oy = 0;

    function resize() {
      W = window.innerWidth; H = window.innerHeight;
      svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    }

    function hikerPoint(d) {
      var p = walked.getPointAtLength(Math.max(0, Math.min(trailLen, d)));
      var p2 = walked.getPointAtLength(Math.max(0, Math.min(trailLen, d + 4)));
      return { x: p.x, y: p.y, dx: p2.x - p.x };
    }

    var lastT = 0;
    function update() {
      var now = performance.now() / 1000;
      var dt = Math.min(0.05, lastT ? now - lastT : 0.016);
      lastT = now;
      state.t += dt;

      var h = state.hiker;
      var hp = hikerPoint(h.dist);
      if (Math.abs(hp.dx) > 0.2) smooth.dir += ((hp.dx > 0 ? 1 : -1) - smooth.dir) * Math.min(1, dt * 9);
      pose.phase = h.dist / 58 * Math.PI * 2;
      pose.walk = h.walk; pose.armsUp = h.armsUp; pose.jump = h.jump;
      pose.dir = Math.abs(smooth.dir) < 0.08 ? (smooth.dir < 0 ? -0.08 : 0.08) : smooth.dir;
      pose.x = hp.x; pose.y = hp.y; pose.scale = h.scale; pose.o = h.o; pose.t = state.t;
      hiker.pose(pose);
      mask.setAttribute('stroke-dashoffset', n(trailLen - h.dist));

      // camera: blend the scripted shot with "follow the hiker" (lagged)
      smooth.x += (hp.x - smooth.x) * Math.min(1, dt * 3.5);
      smooth.y += (hp.y - smooth.y) * Math.min(1, dt * 3.5);
      var c = state.cam;
      var cx = lerp(c.cx, smooth.x, c.follow), cy = lerp(c.cy, smooth.y - 30, c.follow);
      k = Math.min(W, H) / c.S;
      ox = W / 2 - cx * k; oy = H / 2 - cy * k;
      cam.setAttribute('transform', 'translate(' + n(ox) + ' ' + n(oy) + ') scale(' + n(k * 1000) / 1000 + ')');

      // ambient motion
      rays.setAttribute('transform', 'translate(' + SUN.x + ' ' + SUN.y + ') rotate(' + n(state.t * 2.2) + ')');
      for (var i = 0; i < midClouds.length; i++) {
        var mc = midClouds[i];
        mc.g.setAttribute('transform', 'translate(' + n(Math.sin(state.t * 0.09 + i) * 40) + ' 0)');
      }
      var f = state.flag;
      flag.setAttribute('transform', 'translate(522 ' + (SUMMIT_Y + 1) + ') scale(' + n(f.s) + ')');
      cloth.setAttribute('transform', 'skewY(' + n(Math.sin(state.t * 6) * 4 * f.wave) + ')');
    }

    resize();
    window.addEventListener('resize', resize);
    setTimeout(runBakeQueue, 50);
    gsap.ticker.add(update);
    update();
    svg.style.visibility = '';

    function timeline(reduced) {
      var tl = gsap.timeline({ paused: true });
      var c = state.cam, h = state.hiker, f = state.flag;
      var CLIMB = cfg.climbDuration || 12;
      // portrait screens see much more height: frame lower so the lake and trees fill it
      var OPEN = H > W ? { cy: 600, S: 900 } : { cy: 520, S: 1000 };
      if (reduced) {
        tl.set(c, { cx: 500, cy: 175, S: 540, follow: 0 }, 0)
          .set(h, { dist: trailLen, o: 1, walk: 0, armsUp: 1, scale: 1 }, 0)
          .set(f, { s: 1, wave: 0.3 }, 0)
          .addLabel('summit', 1.2)
          .to({}, { duration: 2.4 });
        return tl;
      }
      tl.set(h, { dist: 0, o: 0, scale: 0.6, walk: 0, armsUp: 0, jump: 0 }, 0)
        .set(f, { s: 0, wave: 0 }, 0)
        .fromTo(c, { cx: 500, cy: OPEN.cy, S: OPEN.S * 1.18, follow: 0 }, { S: OPEN.S, duration: 3.4, ease: 'sine.inOut' }, 0)
        .to(h, { o: 1, scale: 1, duration: 0.7, ease: 'back.out(2)' }, 1.5)
        .to(c, { follow: 1, S: 330, duration: 2.4, ease: 'power2.inOut' }, 2.4)
        .to(h, { walk: 1, duration: 0.4 }, 2.6)
        .to(h, { dist: trailLen, duration: CLIMB, ease: 'sine.inOut' }, 2.6)
        .addLabel('climb', 2.6)
        .to(c, { follow: 0, cx: 500, cy: 175, S: 540, duration: 2.2, ease: 'power2.inOut' }, 2.6 + CLIMB - 1.2)
        .to(h, { walk: 0, duration: 0.4 }, 2.6 + CLIMB - 0.3)
        .addLabel('summit', 2.6 + CLIMB)
        .to(f, { s: 1, duration: 0.6, ease: 'back.out(2.4)' }, 'summit+=0.1')
        .to(f, { wave: 1, duration: 0.4 }, 'summit+=0.4')
        .to(h, { armsUp: 1, duration: 0.45, ease: 'back.out(2)' }, 'summit+=0.3')
        .to(h, { jump: 9, duration: 0.22, yoyo: true, repeat: 3, ease: 'power1.out' }, 'summit+=0.55');
      return tl;
    }

    return {
      svg: svg,
      state: state,
      timeline: timeline,
      climbProgress: function () { return trailLen ? state.hiker.dist / trailLen : 0; },
      toScreen: function (x, y) { return { x: ox + x * k, y: oy + y * k }; },
      // final shot behind the bouquet
      wideShot: function (dur) {
        var portrait = H > W;
        return gsap.to(state.cam, { follow: 0, cx: 500, cy: portrait ? 520 : 470, S: portrait ? 1000 : 1150, duration: dur, ease: 'power2.inOut' });
      },
      summit: { x: 500, y: SUMMIT_Y }
    };
  };
})(window.Flowers = window.Flowers || {});
